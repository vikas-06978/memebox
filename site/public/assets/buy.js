// MemeBox site: /buy page. Choose a product, pay by UPI (QR code or app link), enter the
// UPI transaction ID, then wait for the admin to approve. The page polls for the key.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const T = (key, ...subs) => (window.MemeSite ? window.MemeSite.t(key, ...subs) : key);
  const params = new URLSearchParams(location.search);
  let orderId = /^MB[A-HJ-NP-Z2-9]{10}$/.test(params.get('order') || '') ? params.get('order') : '';
  let pollTimer = 0;
  let gateway = null, gatewayOrder = null, buying = false, sdkReady = null;
  let historyOrders = [], gatewayTimer = 0, statusAttempts = 0;
  const storageKey = 'memebox-test-checkout';
  async function checkout(body) {
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || T('buy_err_generic'));
    return data;
  }
  function loadCheckout() {
    if (window.Razorpay) return Promise.resolve();
    if (!sdkReady) sdkReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => { sdkReady = null; script.remove(); reject(new Error('Checkout could not load. Try again later.')); };
      document.head.append(script);
    });
    return sdkReady;
  }
  const validReceipt = saved => /^MB[A-HJ-NP-Z2-9]{10}$/.test(saved?.orderId || '') && /^[a-f0-9]{64}$/.test(saved?.recoveryToken || '');
  function renderHistory() {
    $('gateway-history').replaceChildren(...historyOrders.map(receipt => new Option(receipt.orderId, receipt.orderId, false, receipt.orderId === gatewayOrder?.orderId)));
    $('gateway-history-label').hidden = historyOrders.length < 2;
  }
  async function checkGateway(receipt = gatewayOrder) {
    if (!receipt) return;
    const { order } = await checkout({ action: 'status', ...receipt });
    if (receipt.orderId !== gatewayOrder?.orderId) return;
    clearTimeout(gatewayTimer);
    $('gateway-message').textContent = order.status === 'pending' ? 'Payment is pending. If you paid, check again shortly.'
      : order.status === 'fulfilled' ? 'Payment verified. Your key is ready below.'
      : 'This payment needs review. Contact support with your order code.';
    if (order.status === 'fulfilled') showStatus({ ...order, status: 'approved' });
    if (order.status === 'pending' && statusAttempts++ < 10) gatewayTimer = setTimeout(() => checkGateway(receipt).catch(e => alertBox(e.message)), 60000);
  }
  $('gateway-check').addEventListener('click', () => { statusAttempts = 0; checkGateway().catch(e => alertBox(e.message)); });
  $('gateway-history').addEventListener('change', () => {
    gatewayOrder = historyOrders.find(o => o.orderId === $('gateway-history').value);
    $('key-box').hidden = true; $('status').hidden = true; statusAttempts = 0;
    checkGateway().catch(e => alertBox(e.message));
  });
  $('gateway-new').addEventListener('click', () => {
    $('choose').hidden = false; $('status').hidden = true;
    $('gateway-message').textContent = 'Your previous order can still be checked until you start another checkout.';
  });
  async function buyGateway(product) {
    await loadCheckout();
    const { checkout: o } = await checkout({ action: 'create', product, currency: $('checkout-currency').value, forKey: $('for-key').value.trim() });
    gatewayOrder = { orderId: o.orderId, recoveryToken: o.recoveryToken };
    const receipt = gatewayOrder;
    historyOrders = [receipt, ...historyOrders.filter(item => item.orderId !== receipt.orderId)].slice(0, 100);
    renderHistory(); statusAttempts = 0; clearTimeout(gatewayTimer);
    // Recovery secret stays in this browser, never in a query string, analytics or Referer.
    try { localStorage.setItem(storageKey, JSON.stringify(historyOrders)); } catch {
      $('gateway-message').textContent = 'Keep this tab open. This browser could not save payment recovery.';
    }
    $('gateway-check').hidden = false; $('gateway-new').hidden = false;
    $('choose').hidden = true; $('closed').hidden = true;
    $('order-id').textContent = o.orderId;
    const dialog = new window.Razorpay({ key: o.keyId, order_id: o.gatewayOrderId, amount: o.amount, currency: o.currency,
      name: 'MemeBox', description: 'TEST: ' + product,
      handler: async result => {
        $('gateway-message').textContent = 'Verifying payment…';
        try {
          await checkout({ action: 'confirm', ...receipt, paymentId: result.razorpay_payment_id, signature: result.razorpay_signature });
          await checkGateway(receipt);
        } catch (e) { alertBox(e.message); }
      }, modal: { ondismiss: () => { $('gateway-message').textContent = 'Checkout closed. No key is issued until payment is verified. You can check its status below.'; } },
    });
    dialog.on('payment.failed', () => { $('gateway-message').textContent = 'Payment failed. Check its status before starting another payment.'; });
    dialog.open();
  }
  const wanted = /^(pass|char|chars|filter|outfit)_[a-z0-9_]{2,30}$/.test(params.get('product') || '') ? params.get('product') : '';

  function showError(text) {
    $('error').textContent = text;
    $('error').hidden = !text;
  }

  async function api(method, body, query = '') {
    const res = await fetch('/api/order' + query, method === 'GET' ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(res.status === 429 ? T('err_too_many') : data.error || T('buy_err_generic'));
    return data;
  }

  // UPI QR code on a canvas (no inline SVG or styles, so the page CSP stays strict).
  function drawQr(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const canvas = $('qr');
    const quiet = 4;
    const scale = Math.floor(canvas.width / (n + quiet * 2));
    const offset = Math.floor((canvas.width - scale * n) / 2);
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(offset + c * scale, offset + r * scale, scale, scale);
    canvas.dataset.text = text; // for tests and for anyone curious
  }

  function remember(id) {
    orderId = id;
    const u = new URL(location.href);
    u.searchParams.set('order', id);
    history.replaceState(null, '', u);
  }

  async function buy(product) {
    if (buying) return;
    buying = true;
    document.querySelectorAll('#products button').forEach(b => { b.disabled = true; });
    showError('');
    try {
      if (gateway) { await buyGateway(product); return; }
      const forKey = $('for-key').value.trim();
      const o = await api('POST', { action: 'create', product, ...(forKey ? { forKey } : {}) });
      remember(o.orderId);
      $('amount').textContent = '₹' + o.amount;
      $('what').textContent = T('buy_name_' + o.product);
      $('note').textContent = 'MemeBox ' + o.orderId;
      $('upi-link').href = o.upiUrl;
      drawQr(o.upiUrl);
      $('choose').hidden = true;
      $('pay').hidden = false;
      $('utr').focus();
    } catch (err) {
      alertBox(err.message);
    } finally {
      buying = false;
      document.querySelectorAll('#products button').forEach(b => { b.disabled = false; });
    }
  }

  function alertBox(text) {
    $('closed').textContent = text;
    $('closed').hidden = false;
  }

  function showStatus(order) {
    $('choose').hidden = true;
    $('pay').hidden = order.status !== 'new';
    $('status').hidden = order.status === 'new';
    $('order-id').textContent = order.orderId;
    $('key-box').hidden = true;
    clearTimeout(pollTimer);
    if (order.status === 'waiting') {
      $('status-title').textContent = T('buy_waiting_title');
      $('status-text').textContent = T('buy_waiting_text', order.amount);
      pollTimer = setTimeout(() => refresh(), 20000);
    } else if (order.status === 'approved') {
      $('status-title').textContent = T('buy_ok_title');
      $('status-text').textContent = T('buy_ok_text');
      $('key').textContent = order.licenseKey;
      $('key-box').hidden = false;
    } else if (order.status === 'rejected') {
      $('status-title').textContent = T('buy_rejected_title');
      $('status-text').textContent = T('buy_rejected_text');
    }
  }

  async function refresh() {
    try {
      const { order } = await api('GET', null, '?id=' + encodeURIComponent(orderId));
      if (order.status === 'new') {
        // Came back before entering the UTR: start over with a fresh order.
        orderId = '';
        return;
      }
      showStatus(order);
    } catch {
      pollTimer = setTimeout(() => refresh(), 60000);
    }
  }

  $('claim').addEventListener('submit', async (e) => {
    e.preventDefault();
    const utr = $('utr').value.replace(/\s+/g, '');
    if (!/^\d{12}$/.test(utr)) { showError(T('buy_err_utr')); return; }
    showError('');
    const button = e.submitter || $('claim').querySelector('button');
    button.disabled = true;
    try {
      const { order } = await api('POST', { action: 'claim', orderId, utr });
      showStatus(order);
    } catch (err) {
      showError(err.message);
    } finally {
      button.disabled = false;
    }
  });

  $('copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('key').textContent).then(() => { $('copy').textContent = T('buy_copied'); }, () => {});
  });

  // Products and whether payments are open come from the site settings. Wait for the
  // translations too, or the cards show raw keys like "buy_for" when the config wins the race.
  const translations = window.MemeSite ? window.MemeSite.ready.catch(() => {}) : Promise.resolve();
  Promise.all([fetch('/api/config').then((r) => r.json()), translations]).then(([c]) => {
    if (!c.payments) { $('closed').hidden = false; $('choose').hidden = true; return; }
    gateway = c.checkout;
    if (gateway) {
      $('gateway-notice').hidden = false;
      document.querySelector('[data-t="buy_intro"]').hidden = true;
      document.querySelector('[data-t="buy_help"]').textContent = 'Test payments are verified automatically. Problems? Write with your order code to';
      if (gateway.currencies.includes('USD')) {
        const option = document.createElement('option'); option.value = 'USD'; option.textContent = 'USD $'; $('checkout-currency').append(option);
      }
      if (params.get('currency') === 'USD' && gateway.currencies.includes('USD')) $('checkout-currency').value = 'USD';
      $('checkout-currency').addEventListener('change', () => {
        for (const card of document.querySelectorAll('#products .product')) {
          const button = card.querySelector('button'); const p = c.products[button.dataset.product];
          const text = $('checkout-currency').value === 'USD' ? '$' + p.usd.toFixed(2) : '₹' + p.inr;
          card.querySelector('.price').textContent = text; button.textContent = T('buy_for', text);
        }
      });
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        historyOrders = (Array.isArray(saved) ? saved : [saved]).filter(validReceipt).slice(0, 100);
        if (historyOrders.length) {
          gatewayOrder = historyOrders[0]; renderHistory(); $('gateway-check').hidden = false; $('gateway-new').hidden = false;
          checkGateway().catch(e => alertBox(e.message));
        }
      } catch { /* Storage is optional. */ }
    }
    const box = $('products');
    for (const [id, p] of Object.entries(c.products || {})) {
      const isPass = p.proSeconds > 0 || p.maxSeconds > 0;
      const isChar = Array.isArray(p.addons) && p.addons.length > 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'primary';
      const cardPrice = gateway && $('checkout-currency').value === 'USD' ? '$' + p.usd.toFixed(2) : '₹' + p.inr;
      b.textContent = T('buy_for', cardPrice);
      b.dataset.product = id;
      b.addEventListener('click', () => buy(id));
      const card = document.createElement('article');
      card.className = 'card product' + (p.unlimited || p.maxSeconds ? ' best' : '') + (isChar ? ' char' : '');
      const h = document.createElement('h2');
      h.textContent = isPass ? T('buy_name_' + id) : isChar ? (id === 'chars_eight' ? T('buy_chars_all') : T('buy_char_title', id.replace(/^char_/, '').replace(/^./, (c) => c.toUpperCase()))) : p.unlimited ? 'MemeBox Pro' : T('buy_more_pics', p.pictureSlots);
      const d = document.createElement('p');
      d.className = 'muted';
      d.textContent = isPass ? T(p.maxSeconds ? 'buy_pass_desc_max' : 'buy_pass_desc_pro')
        : isChar ? T('buy_char_desc') : p.unlimited ? T('buy_pro_desc') : T('buy_pics_desc', p.pictureSlots);
      const price = document.createElement('p');
      price.className = 'price';
      price.textContent = cardPrice;
      card.append(h, price, d, b);
      box.append(card);
    }
    if (orderId && !gateway) refresh();
    else if (wanted && (c.products || {})[wanted]) buy(wanted); // came from a Buy button on /pricing
  }).catch(() => alertBox(T('buy_err_load')));
})();

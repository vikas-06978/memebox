// MemeBox site: /buy page. Choose a product, pay by UPI (QR code or app link), enter the
// UPI transaction ID, then wait for the admin to approve. The page polls for the key.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const T = (key, ...subs) => (window.MemeSite ? window.MemeSite.t(key, ...subs) : key);
  const params = new URLSearchParams(location.search);
  let orderId = /^MB[A-HJ-NP-Z2-9]{10}$/.test(params.get('order') || '') ? params.get('order') : '';
  let pollTimer = 0;

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
    showError('');
    try {
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

  // Products and whether payments are open come from the site settings.
  fetch('/api/config').then((r) => r.json()).then((c) => {
    if (!c.payments) { $('closed').hidden = false; $('choose').hidden = true; return; }
    const box = $('products');
    for (const [id, p] of Object.entries(c.products || {})) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'primary';
      b.textContent = T('buy_for', '₹' + p.inr);
      b.dataset.product = id;
      b.addEventListener('click', () => buy(id));
      const card = document.createElement('article');
      card.className = 'card product' + (p.unlimited ? ' best' : '');
      const h = document.createElement('h2');
      h.textContent = p.unlimited ? 'MemeBox Pro' : T('buy_more_pics', p.pictureSlots);
      const d = document.createElement('p');
      d.className = 'muted';
      d.textContent = p.unlimited
        ? T('buy_pro_desc')
        : T('buy_pics_desc', p.pictureSlots);
      const price = document.createElement('p');
      price.className = 'price';
      price.textContent = `₹${p.inr}`;
      card.append(h, price, d, b);
      box.append(card);
    }
    if (orderId) refresh();
  }).catch(() => alertBox(T('buy_err_load')));
})();

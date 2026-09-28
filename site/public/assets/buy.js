// MemeBox site: /buy page. Choose a product, pay by UPI (QR code or app link), enter the
// UPI transaction ID, then wait for the admin to approve. The page polls for the key.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
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
    if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong. Try again.');
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
      $('what').textContent = o.productName;
      $('note').textContent = 'MemeBox ' + o.orderId;
      $('upi-id').textContent = o.upiId;
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
      $('status-title').textContent = 'Thanks! Checking your payment ⏳';
      $('status-text').textContent = `We're checking your ₹${order.amount} payment. Your key appears here once it's confirmed, usually within a few hours. You can close this page and come back to this address.`;
      pollTimer = setTimeout(() => refresh(), 20000);
    } else if (order.status === 'approved') {
      $('status-title').textContent = 'Payment confirmed 🎉';
      $('status-text').textContent = `${order.productName} is yours. Here is your key:`;
      $('key').textContent = order.licenseKey;
      $('key-box').hidden = false;
    } else if (order.status === 'rejected') {
      $('status-title').textContent = "We couldn't find this payment";
      $('status-text').textContent = 'If you did pay, write to us with your order code and the UPI transaction ID, and we will sort it out.';
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
    if (!/^\d{12}$/.test(utr)) { showError('The UPI transaction ID has 12 digits. Find it in your UPI app under this payment.'); return; }
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
    navigator.clipboard.writeText($('key').textContent).then(() => { $('copy').textContent = 'Copied'; }, () => {});
  });

  // Products and whether payments are open come from the site settings.
  fetch('/api/config').then((r) => r.json()).then((c) => {
    if (!c.payments) { $('closed').hidden = false; $('choose').hidden = true; return; }
    const box = $('products');
    for (const [id, p] of Object.entries(c.products || {})) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'primary';
      b.textContent = `Buy for ₹${p.inr}`;
      b.dataset.product = id;
      b.addEventListener('click', () => buy(id));
      const card = document.createElement('article');
      card.className = 'card product' + (p.unlimited ? ' best' : '');
      const h = document.createElement('h2');
      h.textContent = p.unlimited ? 'MemeBox Pro' : `${p.pictureSlots} more pictures`;
      const d = document.createElement('p');
      d.className = 'muted';
      d.textContent = p.unlimited
        ? 'Unlimited picture memes, voice changer, camera captions, all packs, party mode and bulk import. Pay once, keep it.'
        : `Add ${p.pictureSlots} more picture memes to MemeBox. Stack as many as you like.`;
      const price = document.createElement('p');
      price.className = 'price';
      price.textContent = `₹${p.inr}`;
      card.append(h, price, d, b);
      box.append(card);
    }
    if (orderId) refresh();
  }).catch(() => alertBox("Couldn't load. Check your internet and reload."));
})();

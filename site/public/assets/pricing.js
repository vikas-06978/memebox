// MemeBox site: /pricing page. Prices come from /api/config (the same numbers the order uses), shown in rupees for
// India and in dollars elsewhere (a switch lets people change it). Rupee buttons go to /buy; card payment in
// dollars is not open yet, so those buttons are replaced by a note.
(() => {
  'use strict';
  const T = (key, ...subs) => (window.MemeSite ? window.MemeSite.t(key, ...subs) : key);
  const DUR = { pass_pro_30: 'pr_dur_30', pass_pro_60: 'pr_dur_60', pass_pro_120: 'pr_dur_120', pass_pro_300: 'pr_dur_300', pass_max_60: 'pr_dur_60', pass_max_180: 'pr_dur_180', pass_max_480: 'pr_dur_480' };
  // Used only if /api/config cannot be reached: the same list prices as site/src/shop.js.
  const FALLBACK = {
    pass_pro_30: { inr: 9, usd: 1.49, proSeconds: 1800, maxSeconds: 0 },
    pass_pro_60: { inr: 15, usd: 2.49, proSeconds: 3600, maxSeconds: 0 },
    pass_pro_120: { inr: 25, usd: 3.99, proSeconds: 7200, maxSeconds: 0 },
    pass_max_60: { inr: 25, usd: 3.49, proSeconds: 0, maxSeconds: 3600 },
    pass_max_180: { inr: 49, usd: 6.49, proSeconds: 0, maxSeconds: 10800 },
    pass_pro_300: { inr: 49, usd: 7.99, proSeconds: 18000, maxSeconds: 0 },
    pass_max_480: { inr: 99, usd: 14.99, proSeconds: 0, maxSeconds: 28800 },
    char_bunny: { inr: 29, usd: 0.99, addons: ['character:bunny'] }, char_panda: { inr: 29, usd: 0.99, addons: ['character:panda'] },
    char_owl: { inr: 29, usd: 0.99, addons: ['character:owl'] }, char_fox: { inr: 29, usd: 0.99, addons: ['character:fox'] },
    char_penguin: { inr: 39, usd: 1.49, addons: ['character:penguin'] }, char_lion: { inr: 39, usd: 1.49, addons: ['character:lion'] },
    char_monkey: { inr: 39, usd: 1.49, addons: ['character:monkey'] }, char_frog: { inr: 39, usd: 1.49, addons: ['character:frog'] },
    chars_eight: { inr: 199, usd: 4.99, addons: new Array(8).fill('x') },
  };
  const isChar = (id) => /^char_/.test(id);

  const fromTimezone = () => {
    try { return /^Asia\/(Kolkata|Calcutta)$/.test(Intl.DateTimeFormat().resolvedOptions().timeZone) ? 'inr' : 'usd'; } catch { return 'inr'; }
  };
  const asked = new URLSearchParams(location.search).get('cur');
  let cur = asked === 'usd' || asked === 'inr' ? asked : fromTimezone();
  let products = FALLBACK;
  let checkoutCurrencies = ['INR'];
  const canBuy = () => checkoutCurrencies.includes(cur.toUpperCase());
  const buyLink = id => '/buy?product=' + id + (cur === 'usd' ? '&currency=USD' : '');

  const money = (p) => (cur === 'inr' ? '₹' + p.inr : '$' + Number(p.usd).toFixed(2));

  function render() {
    for (const b of document.querySelectorAll('.seg-btn')) b.setAttribute('aria-pressed', String(b.dataset.cur === cur));
    document.getElementById('usd-note').hidden = cur !== 'usd' || canBuy();
    for (const [boxId, tier] of [['passes-pro', 'pro'], ['passes-max', 'max']]) {
      const box = document.getElementById(boxId);
      box.replaceChildren();
      for (const [id, p] of Object.entries(products)) {
        if (isChar(id) || id === 'chars_eight') continue;
        if ((tier === 'max') !== (p.maxSeconds > 0)) continue;
        const row = document.createElement('div');
        row.className = 'pass';
        const dur = document.createElement('b');
        dur.textContent = T(DUR[id] || 'pr_dur_60');
        const price = document.createElement('span');
        price.className = 'pass-price';
        price.textContent = money(p);
        row.append(dur, price);
        if (canBuy()) {
          const a = document.createElement('a');
          a.className = 'button primary small';
          a.href = buyLink(id);
          a.textContent = T('pr_buy');
          row.append(a);
        }
        box.append(row);
      }
    }
    renderCharacters();
  }

  // Characters: one-time prices, and the bundle.
  function renderCharacters() {
    const grid = document.getElementById('char-grid');
    if (!grid) return;
    grid.replaceChildren();
    const cap = (id) => id.replace(/^char_/, '').replace(/^./, (c) => c.toUpperCase());
    for (const [id, p] of Object.entries(products)) {
      if (!isChar(id) && id !== 'chars_eight') continue;
      const card = document.createElement('div');
      card.className = 'char-card' + (id === 'chars_eight' ? ' all' : '');
      const name = document.createElement('b');
      name.textContent = id === 'chars_eight' ? T('pr_chars_bundle') : cap(id);
      const price = document.createElement('span');
      price.className = 'pass-price';
      price.textContent = money(p);
      card.append(name, price);
      if (canBuy()) {
        const a = document.createElement('a');
        a.className = 'button primary small';
        a.href = buyLink(id);
        a.textContent = T('pr_buy');
        card.append(a);
      }
      grid.append(card);
    }
  }
  for (const b of document.querySelectorAll('.seg-btn')) b.addEventListener('click', () => { cur = b.dataset.cur; render(); });

  const translations = window.MemeSite ? window.MemeSite.ready.catch(() => {}) : Promise.resolve();
  Promise.all([fetch('/api/config').then((r) => r.json()).catch(() => ({})), translations]).then(([c]) => {
    const sold = c && c.products ? Object.fromEntries(Object.entries(c.products).filter(([id]) => Object.hasOwn(FALLBACK, id))) : {};
    if (Object.keys(sold).length === Object.keys(FALLBACK).length) products = sold;
    if (c.checkout?.mode === 'test') checkoutCurrencies = c.checkout.currencies;
    render();
  });
  render();
})();

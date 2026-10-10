// MemeBox site: /pricing page. Prices come from /api/config (the same numbers the order uses), shown in rupees for
// India and in dollars elsewhere (a switch lets people change it). Rupee buttons go to /buy; card payment in
// dollars is not open yet, so those buttons are replaced by a note.
(() => {
  'use strict';
  const T = (key, ...subs) => (window.MemeSite ? window.MemeSite.t(key, ...subs) : key);
  const DUR = { pass_pro_30: 'pr_dur_30', pass_pro_60: 'pr_dur_60', pass_pro_120: 'pr_dur_120', pass_max_180: 'pr_dur_180' };
  // Used only if /api/config cannot be reached: the same list prices as site/src/shop.js.
  const FALLBACK = {
    pass_pro_30: { inr: 19, usd: 1.99, proSeconds: 1800, maxSeconds: 0 },
    pass_pro_60: { inr: 29, usd: 3.99, proSeconds: 3600, maxSeconds: 0 },
    pass_pro_120: { inr: 49, usd: 5.99, proSeconds: 7200, maxSeconds: 0 },
    pass_max_180: { inr: 69, usd: 8.99, proSeconds: 0, maxSeconds: 10800 },
  };

  const fromTimezone = () => {
    try { return /^Asia\/(Kolkata|Calcutta)$/.test(Intl.DateTimeFormat().resolvedOptions().timeZone) ? 'inr' : 'usd'; } catch { return 'inr'; }
  };
  const asked = new URLSearchParams(location.search).get('cur');
  let cur = asked === 'usd' || asked === 'inr' ? asked : fromTimezone();
  let products = FALLBACK;

  const money = (p) => (cur === 'inr' ? '₹' + p.inr : '$' + Number(p.usd).toFixed(2));

  function render() {
    for (const b of document.querySelectorAll('.seg-btn')) b.setAttribute('aria-pressed', String(b.dataset.cur === cur));
    document.getElementById('usd-note').hidden = cur !== 'usd';
    for (const [boxId, tier] of [['passes-pro', 'pro'], ['passes-max', 'max']]) {
      const box = document.getElementById(boxId);
      box.replaceChildren();
      for (const [id, p] of Object.entries(products)) {
        if ((tier === 'max') !== (p.maxSeconds > 0)) continue;
        const row = document.createElement('div');
        row.className = 'pass';
        const dur = document.createElement('b');
        dur.textContent = T(DUR[id] || 'pr_dur_60');
        const price = document.createElement('span');
        price.className = 'pass-price';
        price.textContent = money(p);
        row.append(dur, price);
        if (cur === 'inr') {
          const a = document.createElement('a');
          a.className = 'button primary small';
          a.href = '/buy?product=' + id;
          a.textContent = T('pr_buy');
          row.append(a);
        }
        box.append(row);
      }
    }
  }

  for (const b of document.querySelectorAll('.seg-btn')) b.addEventListener('click', () => { cur = b.dataset.cur; render(); });

  const translations = window.MemeSite ? window.MemeSite.ready.catch(() => {}) : Promise.resolve();
  Promise.all([fetch('/api/config').then((r) => r.json()).catch(() => ({})), translations]).then(([c]) => {
    const sold = c && c.products ? Object.fromEntries(Object.entries(c.products).filter(([id]) => DUR[id])) : {};
    if (Object.keys(sold).length === 4) products = sold;
    render();
  });
  render();
})();

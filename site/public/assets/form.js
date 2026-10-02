// MemeBox site: feedback form and uninstall survey, in every site language (prefs.js).
// Sends only what the person filled in, plus the version and call site from the link
// the extension opened (?v=1.0.0&site=meet). Spam protection: Turnstile + a honeypot.
(() => {
  'use strict';

  const SITES = ['meet', 'zoom', 'teams', 'discord'];
  const params = new URLSearchParams(location.search);
  const lang = window.MemeSite ? window.MemeSite.lang : 'en';
  const t = (key) => (window.MemeSite ? window.MemeSite.t(key) : key);
  const form = document.getElementById('form');
  const errorEl = document.getElementById('error');
  const type = form.dataset.type === 'uninstall' ? 'uninstall' : 'feedback';
  const version = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(params.get('v') || '') ? params.get('v') : '';
  const site = SITES.includes(params.get('site')) ? params.get('site') : '';

  // ---------- Turnstile ----------
  let token = '';
  let widget = null;

  function loadTurnstile(siteKey) {
    window.onMemeTurnstile = () => {
      widget = window.turnstile.render('#turnstile', {
        sitekey: siteKey,
        appearance: 'interaction-only', // stays invisible unless Cloudflare needs a click
        language: 'auto', // Turnstile picks the visitor's language itself
        callback: (x) => { token = x; },
        'expired-callback': () => { token = ''; },
        'error-callback': () => { token = ''; },
      });
    };
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onMemeTurnstile';
    s.async = true;
    document.head.append(s);
  }

  fetch('/api/config').then((r) => r.json()).then((c) => {
    if (c && c.turnstileSiteKey) loadTurnstile(c.turnstileSiteKey);
  }).catch(() => {});

  // ---------- submit ----------
  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
  }

  function collect() {
    const fd = new FormData(form);
    const body = { type, version, lang, website: String(fd.get('website') || ''), token };
    if (site) body.site = site;
    if (type === 'feedback') {
      body.rating = Number(fd.get('rating')) || 0;
      body.used = fd.getAll('used').map(String);
      body.wants = String(fd.get('wants') || '');
      body.message = String(fd.get('message') || '');
      body.email = String(fd.get('email') || '').trim();
    } else {
      body.reason = String(fd.get('reason') || '');
      body.message = String(fd.get('message') || '');
    }
    return body;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = collect();
    if (type === 'feedback' && !body.rating) return showError(t('err_rating'));
    if (type === 'uninstall' && !body.reason) return showError(t('err_reason'));
    if (body.email && !form.elements.email.checkValidity()) return showError(t('err_email'));
    if (!body.token && widget !== null) return showError(t('err_wait'));
    showError('');
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.hidden = true;
        document.getElementById('thanks').hidden = false;
        return;
      }
      showError(res.status === 429 ? t('err_too_many') : res.status === 403 ? t('err_spam') : data.error || (data.errors && data.errors.join(' ')) || t('err_network'));
      if (widget !== null && window.turnstile) { token = ''; window.turnstile.reset(widget); }
    } catch {
      showError(t('err_network'));
    } finally {
      button.disabled = false;
    }
  });
})();

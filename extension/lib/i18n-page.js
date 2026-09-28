// MemeBox: translate extension pages (popup, options, onboarding).
//   <span data-i18n="key">English fallback</span>
//   <input data-i18n-placeholder="key">   <button data-i18n-title="key">
// Also exposes t(key, ...subs) for scripts.
//
// Language: "Auto" follows Chrome (chrome.i18n). If you pick a language in Options, its texts
// are saved as `langPack` ({ code, messages }) in chrome.storage.local, for the on-call panel,
// and copied to localStorage here, so pages can use it before they paint.
(() => {
  'use strict';
  const PACK_KEY = 'memebox-langpack';
  let pack = null;
  try { pack = JSON.parse(localStorage.getItem(PACK_KEY) || 'null'); } catch { pack = null; }

  function fromPack(key, subs) {
    const m = pack && pack.messages && pack.messages[key];
    if (!m) return '';
    return subs.reduce((s, v, i) => s.split('$' + (i + 1)).join(v), m);
  }

  const t = (key, ...subs) => {
    const s = subs.map(String);
    return fromPack(key, s) || chrome.i18n.getMessage(key, s) || key;
  };

  function apply(root = document) {
    for (const n of root.querySelectorAll('[data-i18n]')) {
      const m = t(n.dataset.i18n);
      if (m !== n.dataset.i18n) n.textContent = m;
    }
    for (const attr of ['title', 'placeholder', 'aria-label']) {
      for (const n of root.querySelectorAll(`[data-i18n-${attr}]`)) {
        const key = n.getAttribute(`data-i18n-${attr}`);
        const m = t(key);
        if (m !== key) n.setAttribute(attr, m);
      }
    }
    // The language the texts are actually in, and its direction (Arabic: rtl). Each language
    // file says it itself: Chrome's @@bidi_dir follows the browser's own language instead,
    // which can differ from the one MemeBox shows.
    document.documentElement.lang = t('lang_code') || 'en';
    document.documentElement.dir = t('text_dir') === 'rtl' ? 'rtl' : 'ltr';
  }

  // Keep this page in step with the choice in chrome.storage (it may have changed elsewhere).
  function syncPack(stored) {
    const want = stored && stored.code ? JSON.stringify(stored) : null;
    const have = pack ? JSON.stringify(pack) : null;
    if (want === have) return false;
    try {
      if (want) localStorage.setItem(PACK_KEY, want); else localStorage.removeItem(PACK_KEY);
    } catch { /* private mode */ }
    return true;
  }
  try {
    chrome.storage.local.get('langPack').then((r) => { if (syncPack(r.langPack)) location.reload(); }).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.langPack && syncPack(changes.langPack.newValue)) location.reload();
    });
  } catch { /* not an extension page */ }

  // Options calls this when you pick a language. 'auto' goes back to Chrome's language.
  async function setLanguage(code) {
    let stored = null;
    if (code && code !== 'auto') {
      const res = await fetch(chrome.runtime.getURL(`_locales/${code}/messages.json`));
      const raw = await res.json();
      stored = { code, messages: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v.message])) };
    }
    syncPack(stored);
    if (stored) await chrome.storage.local.set({ langPack: stored });
    else await chrome.storage.local.remove('langPack');
    location.reload();
  }

  globalThis.MemeI18n = { t, apply, setLanguage, get language() { return pack ? pack.code : 'auto'; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply(), { once: true });
  else apply();
})();

// MemeBox: translate extension pages (popup, options, onboarding) with chrome.i18n.
//   <span data-i18n="key">English fallback</span>
//   <input data-i18n-placeholder="key">   <button data-i18n-title="key">
// Also exposes t(key, ...subs) for scripts.
(() => {
  'use strict';
  const t = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String)) || key;
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
    document.documentElement.lang = chrome.i18n.getMessage('lang_code') || 'en';
    document.documentElement.dir = chrome.i18n.getMessage('text_dir') === 'rtl' ? 'rtl' : 'ltr';
  }
  globalThis.MemeI18n = { t, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply(), { once: true });
  else apply();
})();

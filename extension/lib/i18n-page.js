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
    // The language MemeBox is shown in (e.g. "pt_BR" -> "pt-BR") and its direction (Arabic: rtl).
    const locale = chrome.i18n.getMessage('@@ui_locale') || 'en';
    document.documentElement.lang = locale.replace('_', '-');
    document.documentElement.dir = chrome.i18n.getMessage('@@bidi_dir') || 'ltr';
  }
  globalThis.MemeI18n = { t, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply(), { once: true });
  else apply();
})();

// MemeBox: applies the chosen color theme to an extension page (popup, Options, welcome).
// Sets <html data-theme="auto|light|dark|sunny|neon|candy">, and the page CSS does the rest.
// The choice lives in chrome.storage (settings.theme). A copy in localStorage lets the page
// paint in the right colors straight away, before storage answers.
(() => {
  'use strict';
  const OK = /^(auto|light|dark|sunny|neon|candy)$/;
  const root = document.documentElement;
  const apply = (theme) => { root.dataset.theme = OK.test(theme) ? theme : 'auto'; };

  try { apply(localStorage.getItem('memebox-theme')); } catch { apply('auto'); }

  function fromSettings(settings) {
    const theme = settings && OK.test(settings.theme) ? settings.theme : 'auto';
    apply(theme);
    try { localStorage.setItem('memebox-theme', theme); } catch { /* private mode */ }
  }

  chrome.storage.local.get('settings').then((r) => fromSettings(r.settings)).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) fromSettings(changes.settings.newValue);
  });
})();

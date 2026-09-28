// MemeBox site: language and color theme for every page. Load it in <head> (it sets the theme
// before the page paints, so there's no flash of the wrong colors).
//   <html data-theme>  auto | light | dark | sunny | neon | candy   (remembered in localStorage)
//   Language           ?lang= in the link, then the last choice, then the browser's languages.
//   Texts              elements with data-t="key" (and data-t-ph / data-t-aria for attributes)
//                      get /assets/i18n/<lang>.json. English text in the HTML is the fallback.
//   Pickers            any <div data-prefs> gets a language and a colors menu.
//   For scripts        window.MemeSite.t(key, ...subs), MemeSite.lang, MemeSite.ready (Promise).
(() => {
  'use strict';
  const THEMES = { auto: '🌓', light: '☀️', dark: '🌙', sunny: '🌻', neon: '🪩', candy: '🍬' };
  const LANGS = {
    en: 'English', hi: 'हिन्दी', bn: 'বাংলা', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు', gu: 'ગુજરાતી',
    es: 'Español', ar: 'العربية', pt: 'Português', fr: 'Français', id: 'Bahasa Indonesia',
  };
  const RTL = new Set(['ar']);
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  // ---------- theme (right away) ----------
  const savedTheme = store.get('memebox-theme');
  root.dataset.theme = Object.prototype.hasOwnProperty.call(THEMES, savedTheme) ? savedTheme : 'auto';

  // ---------- language ----------
  function pickLang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS[q]) return q;
    const saved = store.get('memebox-lang');
    if (LANGS[saved]) return saved;
    for (const l of navigator.languages || [navigator.language]) {
      const base = String(l).toLowerCase().split('-')[0];
      if (LANGS[base]) return base;
    }
    return 'en';
  }
  // Pages made by npm run seo (/hi/, /es/…) are already in their language.
  const prerendered = LANGS[root.dataset.prerendered] ? root.dataset.prerendered : '';
  const lang = prerendered || pickLang();
  root.lang = lang;
  root.dir = RTL.has(lang) ? 'rtl' : 'ltr';

  const load = (l) => fetch(`/assets/i18n/${l}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  let en = {};
  let dict = {};
  const ready = Promise.all([load('en'), lang === 'en' ? Promise.resolve({}) : load(lang)]).then(([e, d]) => {
    en = e;
    dict = d;
  });

  // t('key', 'sub1', 'sub2'): the text in the page language, else English, else the key.
  function t(key, ...subs) {
    let s = dict[key] || en[key] || key;
    subs.forEach((v, i) => { s = s.split('$' + (i + 1)).join(String(v)); });
    return s;
  }

  function translate(scope = document) {
    if (lang === 'en') return;
    for (const n of scope.querySelectorAll('[data-t]')) if (dict[n.dataset.t]) n.textContent = dict[n.dataset.t];
    for (const n of scope.querySelectorAll('[data-t-ph]')) if (dict[n.dataset.tPh]) n.placeholder = dict[n.dataset.tPh];
    for (const n of scope.querySelectorAll('[data-t-aria]')) if (dict[n.dataset.tAria]) n.setAttribute('aria-label', dict[n.dataset.tAria]);
  }

  // ---------- pickers ----------
  function buildPickers() {
    for (const box of document.querySelectorAll('[data-prefs]')) {
      const langSel = document.createElement('select');
      langSel.className = 'pref';
      langSel.setAttribute('aria-label', t('pref_language'));
      for (const [code, name] of Object.entries(LANGS)) langSel.append(new Option(name, code, false, code === lang));
      langSel.addEventListener('change', () => {
        store.set('memebox-lang', langSel.value);
        // The landing page has a real page per language (good for search engines).
        if (document.body.hasAttribute('data-landing') || prerendered) {
          location.href = langSel.value === 'en' ? '/' : `/${langSel.value}/`;
          return;
        }
        const u = new URL(location.href);
        u.searchParams.delete('lang');
        location.replace(u.href); // reload in the new language
      });

      const themeSel = document.createElement('select');
      themeSel.className = 'pref';
      themeSel.setAttribute('aria-label', t('pref_theme'));
      for (const [id, emoji] of Object.entries(THEMES)) themeSel.append(new Option(`${emoji} ${t('theme_' + id)}`, id, false, id === root.dataset.theme));
      themeSel.addEventListener('change', () => {
        root.dataset.theme = themeSel.value;
        store.set('memebox-theme', themeSel.value);
        for (const other of document.querySelectorAll('select.pref-theme')) other.value = themeSel.value;
      });
      themeSel.classList.add('pref-theme');

      const l1 = document.createElement('label');
      l1.className = 'pref-label';
      l1.append('🌐', langSel);
      const l2 = document.createElement('label');
      l2.className = 'pref-label';
      l2.append('🎨', themeSel);
      // data-prefs="theme": pages that are only in English get just the colors menu.
      box.replaceChildren(...(box.dataset.prefs === 'theme' ? [l2] : [l1, l2]));
    }
  }

  window.MemeSite = Object.freeze({ t, lang, ready, LANGS, THEMES });

  const start = () => ready.then(() => { translate(); buildPickers(); document.dispatchEvent(new Event('memesite:ready')); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

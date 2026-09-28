// MemeBox: build-time settings. Fill in SITE_URL after deploying /site to Cloudflare Pages.
// Loaded as a classic script by the service worker, extension pages and content scripts.
globalThis.MEMEBOX_CONFIG = Object.freeze({
  // Where the landing / feedback / privacy pages live (no trailing slash).
  SITE_URL: 'https://memebox.pages.dev',
  // Pro features are prepared but switched off: everyone gets everything for free.
  PRO_ENABLED: false,
});

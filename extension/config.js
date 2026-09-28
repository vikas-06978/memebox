// MemeBox: build-time settings. Fill in SITE_URL after deploying /site to Cloudflare Pages.
// Loaded as a classic script by the service worker, extension pages and content scripts.
globalThis.MEMEBOX_CONFIG = Object.freeze({
  // Where the landing / feedback / privacy pages live (no trailing slash).
  SITE_URL: 'https://memebox.pages.dev',
  // The Chrome Web Store page, once published ("Rate us" opens it). Empty = the feedback page.
  STORE_URL: '',
  // Pro features are prepared but switched off: everyone gets everything for free.
  // Don't set this to true before the license check in lib/plan.js exists, or every
  // Pro feature locks for everyone.
  PRO_ENABLED: false,
});

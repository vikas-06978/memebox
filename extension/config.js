// MemeBox: build-time settings. Fill in SITE_URL after deploying /site to Cloudflare Pages.
// Loaded as a classic script by the service worker, extension pages and content scripts.
globalThis.MEMEBOX_CONFIG = Object.freeze({
  // Where the landing / feedback / privacy pages live (no trailing slash).
  SITE_URL: 'https://memebox.pages.dev',
  // The Chrome Web Store page, once published ("Rate us" opens it). Empty = the feedback page.
  STORE_URL: '',
  // Pro is on: the features in lib/plan.js PRO_FEATURES need a license key from the site.
  // false = every feature is free for everyone. While true, the store listing must say
  // which features are paid and declare in-app purchases (STORE.md).
  PRO_ENABLED: true,
});

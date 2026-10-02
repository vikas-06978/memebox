// MemeBox plan: which features are free and which are Pro, and the user's license.
// Classic script (content scripts, extension pages, service worker, unit tests). Needs config.js first.
//
// While PRO_ENABLED is false, isPro() is true for everyone and every feature works for free.
// When it's true, Pro needs a license key checked with the MemeBox site (/api/license).
// The result is cached in chrome.storage.local as `license` and trusted for LICENSE_MAX_AGE_MS,
// so a turned-off (revoked) key stops working at the next check.
(() => {
  'use strict';

  // Pro features. Each gate in the code calls MemePlan.can(<one of these>) and is marked "// PRO:".
  const PRO_FEATURES = Object.freeze({
    voiceChanger: 'Live voice changer (Alt+V)',
    captions: 'Meme captions and pictures on my camera',
    unlimitedClips: 'More than FREE_LIMITS.clips saved clips',
    allPacks: 'Every built-in pack (free: FREE_LIMITS.packs)',
    partyMode: 'Timed lines / party mode',
    bulkImport: 'Import many audio files at once',
    pictures: 'More picture memes than FREE_LIMITS.pictures (or bought picture slots)',
  });

  // What the free plan includes once Pro is switched on.
  const FREE_LIMITS = Object.freeze({
    clips: 10,
    packs: Object.freeze(['general', 'college']),
    pictures: 1,
  });

  const LICENSE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

  const config = () => globalThis.MEMEBOX_CONFIG || {};
  let license = null; // { key, status, unlimited, pictureSlots, checkedAt }

  function sanitize(l) {
    if (!l || typeof l !== 'object' || typeof l.key !== 'string') return null;
    return {
      key: l.key.slice(0, 40),
      status: l.status === 'active' ? 'active' : 'revoked',
      unlimited: l.unlimited === true,
      pictureSlots: Number.isInteger(l.pictureSlots) && l.pictureSlots > 0 ? Math.min(l.pictureSlots, 10000) : 0,
      checkedAt: Number(l.checkedAt) || 0,
    };
  }

  function setLicense(l) { license = sanitize(l); }

  // The cached license if it's active and was confirmed by the site recently enough.
  function validLicense(now = Date.now()) {
    if (!license || license.status !== 'active') return null;
    if (now - license.checkedAt > LICENSE_MAX_AGE_MS || license.checkedAt > now + 60000) return null;
    return license;
  }

  const hasLicense = (now) => !!(validLicense(now) && validLicense(now).unlimited);

  function isPro(now) {
    if (config().PRO_ENABLED !== true) return true; // Pro switched off: everyone gets everything
    return hasLicense(now);
  }

  // true if this feature can be used now. Anything that isn't a Pro feature is always free.
  function can(feature, now) {
    if (!Object.prototype.hasOwnProperty.call(PRO_FEATURES, feature)) return true;
    return isPro(now);
  }

  // How many picture memes this user may have: unlimited with Pro, otherwise the free
  // one plus any picture slots bought with a license key.
  function pictureLimit(now) {
    if (isPro(now)) return Infinity;
    const l = validLicense(now);
    return FREE_LIMITS.pictures + (l ? l.pictureSlots : 0);
  }

  // In extension contexts: load the cached license and follow changes.
  let ready = Promise.resolve();
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      ready = chrome.storage.local.get('license').then((r) => setLicense(r.license)).catch(() => {});
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.license) setLicense(changes.license.newValue);
      });
    } catch { /* orphaned content script */ }
  }

  globalThis.MemePlan = Object.freeze({
    PRO_FEATURES, FREE_LIMITS, LICENSE_MAX_AGE_MS,
    isPro, can, pictureLimit, hasLicense, setLicense, validLicense,
    get ready() { return ready; },
    get license() { return license; },
  });
})();

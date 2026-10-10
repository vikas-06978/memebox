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
    packs: Object.freeze(['general', 'effects', 'college']),
    pictures: 1,
  });

  // Time passes (Pro and Pro Max): bought hours of real use, no expiry date. The timer only runs while the
  // pass is switched on AND you are in a call (the service worker spends the seconds), so nothing is wasted.
  // `proSeconds` / `maxSeconds` are the seconds left. Pro Max is spent first when someone has both.
  const PASS_MAX_SECONDS = 10 * 24 * 3600;
  const LICENSE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

  const config = () => globalThis.MEMEBOX_CONFIG || {};
  let license = null; // { key, status, unlimited, pictureSlots, proSeconds, maxSeconds, checkedAt }
  let passOn = false; // the person's "run my pass" switch (chrome.storage.local.pass.on)

  const passSeconds = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.min(Math.floor(Number(n)), PASS_MAX_SECONDS) : 0);

  function sanitize(l) {
    if (!l || typeof l !== 'object' || typeof l.key !== 'string') return null;
    return {
      key: l.key.slice(0, 40),
      status: l.status === 'active' ? 'active' : 'revoked',
      unlimited: l.unlimited === true,
      pictureSlots: Number.isInteger(l.pictureSlots) && l.pictureSlots > 0 ? Math.min(l.pictureSlots, 10000) : 0,
      proSeconds: passSeconds(l.proSeconds),
      maxSeconds: passSeconds(l.maxSeconds),
      checkedAt: Number(l.checkedAt) || 0,
      // Add-ons bought one by one (a character, a filter): [{ id, until }] with until in ms since 1970
      addons: Array.isArray(l.addons) ? l.addons.slice(0, 60).filter((a) => a && typeof a.id === 'string').map((a) => ({ id: a.id.slice(0, 40), until: Number(a.until) || 0 })) : [],
    };
  }

  function setLicense(l) { license = sanitize(l); }
  function setPass(p) { passOn = !!(p && p.on === true); }

  // The cached license if it's active and was confirmed by the site recently enough.
  function validLicense(now = Date.now()) {
    if (!license || license.status !== 'active') return null;
    if (now - license.checkedAt > LICENSE_MAX_AGE_MS || license.checkedAt > now + 60000) return null;
    return license;
  }

  const hasLicense = (now) => !!(validLicense(now) && validLicense(now).unlimited);

  // Which pass is running now: 'max', 'pro' or null (no balance, or the switch is off).
  function passTier(now) {
    const l = validLicense(now);
    if (!l || !passOn) return null;
    if (l.maxSeconds > 0) return 'max';
    return l.proSeconds > 0 ? 'pro' : null;
  }
  const passLeft = () => (license ? license.proSeconds + license.maxSeconds : 0);

  // Pro things. A permanent (unlimited) key or a running pass unlocks them.
  function isPro(now) {
    if (config().PRO_ENABLED !== true) return true; // Pro switched off: everyone gets everything
    return hasLicense(now) || passTier(now) !== null;
  }

  // Live effects (voice changer, camera captions, party mode) work with a running pass. What is kept
  // (clips, packs, pictures) only grows with a permanent key, so a pass can't be used up and leave people stuck.
  const PASS_FEATURES = new Set(['voiceChanger', 'captions', 'partyMode']);

  // true if this feature can be used now. Anything that isn't a Pro feature is always free.
  function can(feature, now) {
    if (!Object.prototype.hasOwnProperty.call(PRO_FEATURES, feature)) return true;
    if (PASS_FEATURES.has(feature)) return isPro(now);
    if (config().PRO_ENABLED !== true) return true;
    return hasLicense(now);
  }

  // Is this add-on (a filter or a character) bought and still running? With Pro switched off everything is free.
  function hasAddon(id, now = Date.now()) {
    if (config().PRO_ENABLED !== true) return true;
    const l = validLicense(now);
    return !!l && l.addons.some((a) => a.id === id && (!a.until || a.until > now));
  }

  // Lights & looks. 'filter:neon' is one add-on filter. Everything else is part of Pro.
  // Pro Max (or a permanent key) also has the extra filters and every character.
  function canFx(feature, now) {
    const max = config().PRO_ENABLED !== true || hasLicense(now) || passTier(now) === 'max';
    if (feature.startsWith('filter:')) return max || hasAddon(feature, now);
    if (feature === 'characters') return max;
    return isPro(now);
  }

  // How many picture memes this user may have: unlimited with Pro, otherwise the free
  // one plus any picture slots bought with a license key.
  function pictureLimit(now) {
    if (config().PRO_ENABLED !== true || hasLicense(now)) return Infinity;
    const l = validLicense(now);
    return FREE_LIMITS.pictures + (l ? l.pictureSlots : 0);
  }

  // In extension contexts: load the cached license and follow changes.
  let ready = Promise.resolve();
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      ready = chrome.storage.local.get(['license', 'pass']).then((r) => { setLicense(r.license); setPass(r.pass); }).catch(() => {});
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.license) setLicense(changes.license.newValue);
        if (changes.pass) setPass(changes.pass.newValue);
      });
    } catch { /* orphaned content script */ }
  }

  globalThis.MemePlan = Object.freeze({
    PRO_FEATURES, FREE_LIMITS, LICENSE_MAX_AGE_MS,
    PASS_MAX_SECONDS, isPro, can, canFx, hasAddon, pictureLimit, hasLicense, setLicense, setPass, validLicense, passTier, passLeft,
    get ready() { return ready; },
    get license() { return license; },
  });
})();

// MemeBox plan: which features are free and which will be Pro later.
// Classic script (content scripts, extension pages, unit tests). Needs config.js first.
//
// Right now PRO_ENABLED is false, so isPro() is true for everyone and every feature works
// for free. The checks below only mark where Pro will apply later (see "Pro and payments"
// in the README). Turning Pro on also needs the license check in hasLicense() to be built.
(() => {
  'use strict';

  // Future Pro features. Each gate in the code calls MemePlan.can(<one of these>).
  const PRO_FEATURES = Object.freeze({
    voiceChanger: 'Live voice changer (Alt+V)',
    captions: 'Meme captions on my camera',
    unlimitedClips: 'More than FREE_LIMITS.clips saved clips',
    allPacks: 'Every built-in pack (free: FREE_LIMITS.packs)',
    partyMode: 'Timed lines / party mode',
  });

  // What the free plan will include once Pro is switched on.
  const FREE_LIMITS = Object.freeze({
    clips: 10,
    packs: Object.freeze(['general', 'college']),
  });

  const config = () => globalThis.MEMEBOX_CONFIG || {};

  // TODO (payments): read the signed token saved by the /activate flow and verify it with
  // the public key. Until that exists nobody has a license.
  function hasLicense() {
    return false;
  }

  function isPro() {
    if (config().PRO_ENABLED !== true) return true; // Pro switched off: everyone gets everything
    return hasLicense();
  }

  // true if this feature can be used now. Anything that isn't a Pro feature is always free.
  function can(feature) {
    if (!Object.prototype.hasOwnProperty.call(PRO_FEATURES, feature)) return true;
    return isPro();
  }

  globalThis.MemePlan = Object.freeze({ PRO_FEATURES, FREE_LIMITS, isPro, can });
})();

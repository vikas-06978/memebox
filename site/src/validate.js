// MemeBox site: strict validation of feedback and uninstall survey posts.
// Unknown fields are rejected, every field has a type and a length limit.

export const RATINGS = [1, 2, 3, 4];
export const FEATURES = ['soundboard', 'voices', 'clips', 'tab-audio', 'voice-changer', 'captions'];
export const SITES = ['meet', 'zoom', 'teams', 'discord'];
export const REASONS = ['didnt-work', 'too-hard', 'not-funny', 'found-another', 'other'];
export const LANGS = ['en', 'hi'];

export const LIMITS = { wants: 500, message: 2000, email: 254, version: 20, token: 2048, honeypot: 200 };

// Fields every form may send. `token` is the Turnstile answer, `website` is the honeypot.
const COMMON = ['type', 'version', 'site', 'lang', 'token', 'website'];
const ALLOWED = {
  feedback: [...COMMON, 'rating', 'used', 'wants', 'message', 'email'],
  uninstall: [...COMMON, 'reason', 'message'],
};

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
// Control characters other than tab and newline.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function text(v, max, name, errors) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') { errors.push(`${name}: must be text`); return ''; }
  const s = v.replace(/\r\n?/g, '\n').trim();
  if (s.length > max) errors.push(`${name}: at most ${max} characters`);
  if (CONTROL.test(s)) errors.push(`${name}: contains control characters`);
  return s;
}

function oneOf(v, list, name, errors, required = false) {
  if (v === undefined || v === null || v === '') {
    if (required) errors.push(`${name}: required`);
    return '';
  }
  if (!list.includes(v)) { errors.push(`${name}: not one of ${list.join(', ')}`); return ''; }
  return v;
}

// Returns { ok: true, value, spam } or { ok: false, errors }.
// `spam` is true when the honeypot was filled: store nothing, but answer like a success.
export function validateSubmission(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, errors: ['body: must be a JSON object'] };
  const type = body.type;
  if (!Object.prototype.hasOwnProperty.call(ALLOWED, type)) return { ok: false, errors: ['type: must be feedback or uninstall'] };

  for (const k of Object.keys(body)) {
    if (!ALLOWED[type].includes(k)) errors.push(`${k}: unknown field`);
  }

  const website = text(body.website, LIMITS.honeypot, 'website', errors);
  const token = text(body.token, LIMITS.token, 'token', errors);
  const version = text(body.version, LIMITS.version, 'version', errors);
  if (version && !VERSION.test(version)) errors.push('version: must look like 1.2.3');
  const value = {
    type,
    rating: null,
    used: [],
    wants: '',
    message: '',
    email: '',
    reason: '',
    version,
    site: oneOf(body.site, SITES, 'site', errors),
    lang: oneOf(body.lang, LANGS, 'lang', errors) || 'en',
  };

  if (type === 'feedback') {
    if (!RATINGS.includes(body.rating)) errors.push('rating: must be 1, 2, 3 or 4');
    else value.rating = body.rating;
    if (body.used !== undefined) {
      if (!Array.isArray(body.used) || body.used.length > FEATURES.length) errors.push('used: must be a list of features');
      else {
        for (const f of body.used) if (!FEATURES.includes(f)) errors.push(`used: unknown feature ${String(f).slice(0, 30)}`);
        value.used = FEATURES.filter((f) => body.used.includes(f));
      }
    }
    value.wants = text(body.wants, LIMITS.wants, 'wants', errors);
    value.message = text(body.message, LIMITS.message, 'message', errors);
    value.email = text(body.email, LIMITS.email, 'email', errors);
    if (value.email && !EMAIL.test(value.email)) errors.push('email: not a valid address');
  } else {
    value.reason = oneOf(body.reason, REASONS, 'reason', errors, true);
    value.message = text(body.message, 1000, 'message', errors);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value, token, spam: website !== '' };
}

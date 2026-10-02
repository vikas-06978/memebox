// MemeBox .memepack.json format: strict validation, building and base64 helpers.
// Classic script (options page + unit tests). Depends on globalThis.MEME (defaults.js).
//
// {
//   "format": "memebox-pack", "version": 1,
//   "name": "College memes", "description": "optional",
//   "lines": [ { "id", "kind": "tts"|"clip", "text", "say"?, "lang", "tone", "category",
//                "fav"?, "volume"?, "star"?, "clipId"? } ],
//   "clips": [ { "id", "name", "type": "audio/wav", "data": "<base64 WAV>" } ]
// }
(() => {
  'use strict';

  const FORMAT = 'memebox-pack';
  const VERSION = 1;
  const LIMITS = { name: 60, description: 200, lines: 500, clips: 50, text: 300, category: 30, clipName: 120, clipBytes: 1024 * 1024 };
  const ID = /^[A-Za-z0-9_-]{1,64}$/;
  const TOP_KEYS = new Set(['format', 'version', 'name', 'description', 'lines', 'clips']);
  const LINE_KEYS = new Set(['id', 'kind', 'text', 'say', 'lang', 'tone', 'category', 'fav', 'volume', 'star', 'clipId']);
  const CLIP_KEYS = new Set(['id', 'name', 'type', 'data']);
  const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isStr = (v, max, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max;
  const noControl = (s) => !/[\u0000-\u001f\u007f<>]/.test(s);

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bytesToBase64(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  const isWav = (b) => b.length > 44 && String.fromCharCode(b[0], b[1], b[2], b[3]) === 'RIFF'
    && String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WAVE';

  // Returns { ok: true, pack } with decoded clip bytes, or { ok: false, errors: [...] }.
  function validate(data) {
    const errors = [];
    const err = (path, msg) => { if (errors.length < 25) errors.push(`${path}: ${msg}`); };
    const { TONES } = globalThis.MEME;

    if (!isObj(data)) return { ok: false, errors: ['file: not a JSON object'] };
    for (const k of Object.keys(data)) if (!TOP_KEYS.has(k)) err(k, 'unknown field');
    if (data.format !== FORMAT) err('format', `must be "${FORMAT}"`);
    if (data.version !== VERSION) err('version', `must be ${VERSION}`);
    if (!isStr(data.name, LIMITS.name, 1) || !noControl(data.name)) err('name', `1-${LIMITS.name} characters`);
    if (data.description !== undefined && (!isStr(data.description, LIMITS.description) || !noControl(data.description))) err('description', `up to ${LIMITS.description} characters`);

    const clips = new Map();
    if (data.clips !== undefined) {
      if (!Array.isArray(data.clips) || data.clips.length > LIMITS.clips) err('clips', `a list of at most ${LIMITS.clips}`);
      else data.clips.forEach((c, i) => {
        const p = `clips[${i}]`;
        if (!isObj(c)) { err(p, 'not an object'); return; }
        for (const k of Object.keys(c)) if (!CLIP_KEYS.has(k)) err(`${p}.${k}`, 'unknown field');
        if (!isStr(c.id, 64) || !ID.test(c.id)) err(`${p}.id`, 'letters, digits, - or _ (max 64)');
        else if (clips.has(c.id)) err(`${p}.id`, 'duplicate');
        if (!isStr(c.name, LIMITS.clipName, 1) || !noControl(c.name)) err(`${p}.name`, `1-${LIMITS.clipName} characters`);
        if (c.type !== 'audio/wav') err(`${p}.type`, 'must be "audio/wav"');
        if (typeof c.data !== 'string' || !BASE64.test(c.data) || c.data.length % 4 !== 0) { err(`${p}.data`, 'not base64'); return; }
        if (c.data.length > Math.ceil(LIMITS.clipBytes / 3) * 4) { err(`${p}.data`, 'clip is bigger than 1 MB'); return; }
        let bytes;
        try { bytes = base64ToBytes(c.data); } catch { err(`${p}.data`, 'not base64'); return; }
        if (!isWav(bytes)) { err(`${p}.data`, 'not a WAV file'); return; }
        if (ID.test(c.id || '')) clips.set(c.id, { id: c.id, name: c.name, type: 'audio/wav', bytes: bytes.buffer });
      });
    }

    const lines = [];
    if (!Array.isArray(data.lines) || data.lines.length < 1 || data.lines.length > LIMITS.lines) {
      err('lines', `a list of 1-${LIMITS.lines} lines`);
    } else {
      const ids = new Set();
      data.lines.forEach((l, i) => {
        const p = `lines[${i}]`;
        if (!isObj(l)) { err(p, 'not an object'); return; }
        for (const k of Object.keys(l)) if (!LINE_KEYS.has(k)) err(`${p}.${k}`, 'unknown field');
        if (!isStr(l.id, 64) || !ID.test(l.id)) err(`${p}.id`, 'letters, digits, - or _ (max 64)');
        else if (ids.has(l.id)) err(`${p}.id`, 'duplicate');
        ids.add(l.id);
        if (l.kind !== 'tts' && l.kind !== 'clip') err(`${p}.kind`, 'must be "tts" or "clip"');
        if (!isStr(l.text, LIMITS.text, 1) || !l.text.trim() || !noControl(l.text)) err(`${p}.text`, `1-${LIMITS.text} characters`);
        if (l.say !== undefined && (!isStr(l.say, LIMITS.text) || !noControl(l.say))) err(`${p}.say`, `up to ${LIMITS.text} characters`);
        if (l.lang !== 'hi' && l.lang !== 'en') err(`${p}.lang`, 'must be "hi" or "en"');
        if (!Object.prototype.hasOwnProperty.call(TONES, l.tone)) err(`${p}.tone`, `one of ${Object.keys(TONES).join(', ')}`);
        if (!isStr(l.category, LIMITS.category, 1) || !noControl(l.category)) err(`${p}.category`, `1-${LIMITS.category} characters`);
        if (l.fav !== undefined && !(Number.isInteger(l.fav) && l.fav >= 0 && l.fav <= 9)) err(`${p}.fav`, 'whole number 0-9');
        if (l.volume !== undefined && !(typeof l.volume === 'number' && l.volume >= 0 && l.volume <= 2)) err(`${p}.volume`, 'number 0-2');
        if (l.star !== undefined && typeof l.star !== 'boolean') err(`${p}.star`, 'true or false');
        if (l.kind === 'clip') {
          if (!isStr(l.clipId, 64) || !clips.has(l.clipId)) err(`${p}.clipId`, 'must match a clip in "clips"');
        } else if (l.clipId !== undefined) err(`${p}.clipId`, 'only for clip lines');
        if (!errors.length) lines.push(globalThis.MEME.sanitizeLine(l));
      });
    }

    if (errors.length) return { ok: false, errors };
    return { ok: true, pack: { name: data.name, description: data.description || '', lines, clips: [...clips.values()] } };
  }

  // lines: sanitized lines, clips: [{ id, name, bytes: ArrayBuffer }] (only those the lines use).
  function build(name, lines, clips, description) {
    const used = new Set(lines.filter((l) => l.kind === 'clip').map((l) => l.clipId));
    const pack = {
      format: FORMAT,
      version: VERSION,
      name: String(name).slice(0, LIMITS.name) || 'MemeBox pack',
      lines: lines.map((l) => {
        const o = { id: l.id, kind: l.kind === 'clip' ? 'clip' : 'tts', text: l.text, lang: l.lang, tone: l.tone, category: l.category || 'general' };
        if (l.say) o.say = l.say;
        if (l.fav) o.fav = l.fav;
        if (l.volume !== undefined && l.volume !== 1) o.volume = l.volume;
        if (l.star) o.star = true;
        if (o.kind === 'clip') o.clipId = l.clipId;
        return o;
      }),
      clips: clips.filter((c) => used.has(c.id)).map((c) => ({ id: c.id, name: String(c.name || c.id).slice(0, LIMITS.clipName), type: 'audio/wav', data: bytesToBase64(c.bytes) })),
    };
    if (description) pack.description = String(description).slice(0, LIMITS.description);
    return pack;
  }

  globalThis.MemePack = Object.freeze({ FORMAT, VERSION, LIMITS, validate, build, base64ToBytes, bytesToBase64 });
})();

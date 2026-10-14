// Public playlist references only. No audio, provider credentials or invented video IDs.
(() => {
  'use strict';
  const MAX = 10;
  const DEFAULTS = Object.freeze([
    ['PLNMH5TG547qkMqLjy9l2yn4Yaf-X5yAzN', 'Phonk collection 1'],
    ['PL9mEo4EdiFzPjTxoUxx4L3bSpp-GCImeN', 'Phonk collection 2'],
    ['PLRBp0Fe2GpgluLnaBf1dSvXqIg974OGvi', 'NCS collection 1'],
    ['PLRBp0Fe2Gpgk7YGcZD1BxL4-a-3ws1OZ_', 'NCS collection 2'],
    ['PLGBKsNyGY-afmc5ff3n1HOYGTmZO1xJGw', 'Phonk collection 3'],
  ].map(([id, title]) => Object.freeze({ id, title, explicit: false })));
  const validId = id => typeof id === 'string' && /^(PL|UU|OLAK5uy|RD|FL)[A-Za-z0-9_-]{10,75}$/.test(id);
  function parse(input) {
    const text = String(input || '').trim();
    if (validId(text)) return text;
    try {
      const url = new URL(text);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be'].includes(url.hostname)) return null;
      const id = url.searchParams.get('list');
      return validId(id) ? id : null;
    } catch { return null; }
  }
  function sanitize(values) {
    if (!Array.isArray(values)) return DEFAULTS.map(x => ({ ...x }));
    const seen = new Set(), result = [];
    for (const value of values) {
      if (!value || !validId(value.id) || seen.has(value.id)) continue;
      const title = String(value.title || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
      if (!title) continue;
      seen.add(value.id); result.push({ id:value.id, title, explicit:value.explicit === true });
      if (result.length === MAX) break;
    }
    return result;
  }
  globalThis.MemePlaylists = Object.freeze({ DEFAULTS, MAX, parse, sanitize, validId });
})();

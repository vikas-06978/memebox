// Select only a current MemeBox HTTP player, never a landing-page fallback.
// The loopback player is shipped in the review download while the site is awaiting release.
(() => {
  const marker = 'data-memebox-player="2"';
  const local = 'http://127.0.0.1:8790/music-room.html';
  async function resolve() {
    const cfg = globalThis.MEMEBOX_CONFIG || {};
    const candidates = cfg.PLAYER_URL ? [cfg.PLAYER_URL] : (cfg.SITE_URL?.startsWith('http://127.0.0.1:') ? [local] : [new URL('/music-room', cfg.SITE_URL).href, new URL('/music-room/music-room.html', cfg.SITE_URL).href, local]);
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate, { cache: 'no-store', signal: AbortSignal.timeout(2200) });
        if (response.ok && (await response.text()).includes(marker)) return candidate;
      } catch { /* Try the bundled local companion if the deployed site is older. */ }
    }
    return '';
  }
  function selection(base, { memes = false, extension = '', audience = 'me', list, videos, name = '', explicit = false } = {}) {
    const url = new URL(base);
    if (memes) url.searchParams.set('mode', 'memes');
    const fragment = new URLSearchParams();
    if (extension) fragment.set('extension', extension);
    fragment.set('audience', audience === 'call' ? 'call' : 'me');
    if (list) fragment.set('list', list);
    if (videos?.length) fragment.set('videos', videos.join(','));
    if (name) fragment.set('name', name);
    if (explicit) fragment.set('explicit', '1');
    url.hash = fragment.toString();
    return url.href;
  }
  globalThis.MemePlayerRoute = Object.freeze({ resolve, selection });
  if (globalThis.document && globalThis.chrome?.runtime?.id) {
    document.querySelectorAll('a[href^="music-room.html"]').forEach(link => link.addEventListener('click', async event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const memes = new URL(link.href).searchParams.get('mode') === 'memes';
      const base = await resolve();
      location.assign(selection(base || chrome.runtime.getURL('music-room.html'), { memes, extension: chrome.runtime.id }));
    }));
  }
})();

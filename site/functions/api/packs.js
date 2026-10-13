// GET /api/packs: the live music and meme packs (what the extension offers to download). No file addresses and no secrets in it.
// Open to any origin (CORS): the extension calls it from its own pages.
import { json, methodNotAllowed } from '../../src/http.js';
import { publicCatalog } from '../../src/packs.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' };

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET') return methodNotAllowed('GET, OPTIONS');
  if (env.PACKS_ENABLED === 'off') return json({ ok: true, packs: [] }, 200, { ...CORS, 'Cache-Control': 'no-store' });
  if (!env.DB) return json({ ok: false, error: 'Packs are not set up yet.' }, 503, CORS);
  let packs = [];
  // PHONK_MODE=off in Cloudflare turns Phonk Mode (the YouTube link packs) off for everybody
  try { packs = await publicCatalog(env.DB, { links: env.PHONK_MODE !== 'off', audio: env.HOSTED_AUDIO_ENABLED === 'on' }); } catch { /* the packs tables are not there yet (migration not run) */ }
  return json({ ok: true, packs }, 200, { ...CORS, 'Cache-Control': 'public, max-age=60' });
}

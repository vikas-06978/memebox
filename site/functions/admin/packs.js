// /admin/packs: the admin makes music and meme packs and uploads their audio (signed-in admins only).
//   GET  /admin/packs            list of packs, and a form for a new one
//   GET  /admin/packs?id=NAME    one pack: settings, upload audio, add text memes, every item
//   POST /admin/packs            action = pack-create | pack-update | pack-delete | items-upload | lines-add | links-add | item-update | items-tier | item-delete
import { adminResponse, adminRedirect } from '../../src/http.js';
import { isAdmin } from '../../src/security.js';
import { hostedUsage } from '../../src/content-budget.js';
import { packsListPage, packPage } from '../../src/packs-admin.js';
import {
  listPacks, getPack, getItem, listItems, createPack, updatePack, deletePack, addAudio, addLines, updateItem, deleteItem, setItemsTier, addLinks, storageLimitBytes, storageUsed, PACK_ID_RE,
} from '../../src/packs.js';

const MESSAGES = {
  created: 'Pack made. It is a draft: only you can see it.', saved: 'Saved.', deleted: 'Deleted.',
};

const back = (id, msg, err) => {
  const q = new URLSearchParams();
  if (id) q.set('id', id);
  if (msg) q.set('msg', msg);
  if (err) q.set('err', String(err).slice(0, 300));
  return adminRedirect(`/admin/packs${q.toString() ? '?' + q : ''}`);
};

export async function onRequest({ request, env }) {
  if (!env.ADMIN_KEY || !env.DB || !(await isAdmin(request, env))) return adminRedirect('/admin');
  const hasBucket = !!env.PACKS && env.HOSTED_FILES_ENABLED === 'on';

  if (request.method === 'GET') {
    const q = new URL(request.url).searchParams;
    const msg = Object.hasOwn(MESSAGES, q.get('msg')) ? MESSAGES[q.get('msg')] : String(q.get('msg') || '').slice(0, 300);
    const err = String(q.get('err') || '').slice(0, 300);
    const id = q.get('id');
    if (id) {
      const pack = await getPack(env.DB, id);
      if (!pack) return adminRedirect('/admin/packs?err=' + encodeURIComponent('That pack does not exist.'));
      return adminResponse(packPage({ pack, items: await listItems(env.DB, id), hasBucket, msg, err, storage: { used: await storageUsed(env.DB), limit: storageLimitBytes(env) } }));
    }
    return adminResponse(packsListPage({ packs: await listPacks(env.DB), hasBucket, msg, err, storage: { used: await storageUsed(env.DB), limit: storageLimitBytes(env), delivery: await hostedUsage(env), audioEnabled: env.HOSTED_AUDIO_ENABLED === 'on' } }));
  }

  if (request.method !== 'POST') return adminResponse('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8', headers: { Allow: 'GET, POST' } });

  let form;
  try { form = await request.formData(); } catch { return back('', '', 'The upload could not be read (is it over the size limit?).'); }
  const action = String(form.get('action') || ''), packId = String(form.get('pack') || '');
  try {
    if (action === 'pack-create') {
      const id = await createPack(env.DB, { title: form.get('title'), kind: form.get('kind'), region: form.get('region'), tier: form.get('tier'), description: form.get('description') });
      return back(id, 'created');
    }
    if (!PACK_ID_RE.test(packId) || !(await getPack(env.DB, packId))) return back('', '', 'That pack does not exist.');
    const meta = {
      licenceKind: String(form.get('licenceKind') || ''), licenceNote: String(form.get('licenceNote') || ''), credit: String(form.get('credit') || ''), source: String(form.get('source') || ''),
      lang: String(form.get('lang') || ''), tags: String(form.get('tags') || ''), explicit: form.get('explicit') === 'on', cleared: form.get('cleared') === 'on', tier: String(form.get('itemTier') || ''),
    };
    if (action === 'pack-update') {
      await updatePack(env.DB, packId, { title: form.get('title'), region: form.get('region'), tier: form.get('tier'), description: form.get('description'), status: form.get('status'), sort: form.get('sort') });
      return back(packId, 'saved');
    }
    if (!hasBucket && (action === 'pack-delete' || action === 'item-delete')) {
      const candidates = action === 'pack-delete' ? await listItems(env.DB, packId) : [await getItem(env.DB, String(form.get('item') || ''))];
      const files = candidates.filter(item => item?.file_key);
      if (files.length) return back(packId, '', 'Hosted files are paused. Enable hosted files before deleting stored objects.');
    }
    if (action === 'pack-delete') { await deletePack(env.DB, env.PACKS, packId); return back('', 'deleted'); }
    if (action === 'items-upload') {
      if (!env.PACKS) return back(packId, '', 'File storage is not set up yet (see the packs list page).');
      if (!hasBucket) return back(packId, '', 'Hosted uploads are paused. Enable HOSTED_FILES_ENABLED only after reviewing storage billing.');
      const r = await addAudio(env.DB, env.PACKS, packId, form.getAll('files'), meta, storageLimitBytes(env));
      const live = r.added ? ` ${meta.licenceKind === 'free' && !meta.source.trim() ? 'They are drafts: for "Copyright-free" paste the link that says so in Source, then set them live.' : meta.cleared && (meta.licenceKind || meta.licenceNote) ? 'They are live.' : 'They are drafts: tick "I may share this" and write the licence, then set them live.'}` : '';
      return back(packId, `${r.added} file${r.added === 1 ? '' : 's'} uploaded.${live}${r.skipped.length ? ' Skipped: ' + r.skipped.join('; ') : ''}`);
    }
    if (action === 'links-add') {
      const r = await addLinks(env.DB, packId, form.get('links'), { cleared: form.get('official') === 'on', tier: String(form.get('itemTier') || '') });
      const live = r.added ? (form.get('official') === 'on' ? ' They are live.' : ' They are drafts: tick the official-upload box, then set them live.') : '';
      return back(packId, `${r.added} link${r.added === 1 ? '' : 's'} added.${live}${r.skipped.length ? ' Skipped: ' + r.skipped.join('; ') : ''}`);
    }
    if (action === 'lines-add') {
      const n = await addLines(env.DB, packId, form.get('lines'), meta);
      return back(packId, `${n} meme${n === 1 ? '' : 's'} added.`);
    }
    if (action === 'item-update') {
      const r = await updateItem(env.DB, String(form.get('item') || ''), {
        title: form.get('title'), text: form.get('text'), lang: form.get('lang'), tags: form.get('tags'), explicit: form.get('explicit') === 'on', licence: form.get('licence'),
        source: form.get('source'), credit: form.get('credit'), cleared: form.get('cleared') === 'on', status: form.get('status'), sort: form.get('sort'), tier: form.get('itemTier'),
      });
      return r.note ? back(packId, '', r.note) : back(packId, 'saved');
    }
    if (action === 'items-tier') { // the checked items get a plan: you decide which ones are the free ones
      const n = await setItemsTier(env.DB, packId, form.getAll('ids').map(String), String(form.get('itemTier') || ''));
      return back(packId, n ? `${n} item${n === 1 ? '' : 's'} updated.` : '', n ? '' : 'Tick some items first.');
    }
    if (action === 'item-delete') { await deleteItem(env.DB, env.PACKS, String(form.get('item') || '')); return back(packId, 'deleted'); }
  } catch (e) {
    return back(PACK_ID_RE.test(packId) ? packId : '', '', (e && e.message) || 'Something went wrong.');
  }
  return back(packId, '', 'Unknown action.');
}

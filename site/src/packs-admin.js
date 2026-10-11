// MemeBox site: the /admin/packs pages (HTML). No scripts: plain forms, so the admin page's strict security policy stays.
import { escapeHtml as h } from './http.js';
import { page } from './admin.js';
import { KINDS, TIERS, REGIONS, LICENCES, LANGS, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, canPublish, itemTier } from './packs.js';

const mb = (n) => (Number(n) / 1048576).toFixed(Number(n) >= 1048576 * 10 ? 0 : 1);
const opts = (obj, selected) => Object.entries(obj).map(([k, v]) => `<option value="${h(k)}"${String(selected) === k ? ' selected' : ''}>${h(v)}</option>`).join('');
const tierText = { free: 'Free', pro: 'Pro', max: 'Pro Max' };
// The plan of one item: '' follows the pack.
const itemTierOpts = (selected, packTier) => `<option value=""${selected ? '' : ' selected'}>Same as the pack (${h(tierText[packTier] || packTier)})</option>${TIERS.map((t) => `<option value="${t}"${selected === t ? ' selected' : ''}>${tierText[t]} (this item only)</option>`).join('')}`;
// What you plan to give away free, per type (shown as a counter next to the real number).
const FREE_PLAN = { music: [10, 'tracks'], memes: [5, 'memes'], pictures: [1, 'picture'], links: [10, 'tracks'] };

const COPYRIGHT = `
<p class="notice" role="note"><b>Before you publish:</b> anything in a live pack is downloaded by real people, and paid packs are sold. It must be <b>yours</b>, or <b>licensed to you in writing</b> for sharing and selling inside an app.
A video or song being "copyright free" on YouTube is not a licence. Drafts are never shown to anyone. An item only goes live when you tick <i>I may share this</i> and write the licence.</p>`;

function notice(msg, err) {
  return `${msg ? `<p class="notice" role="status">${h(msg)}</p>` : ''}${err ? `<p class="error" role="alert">${h(err)}</p>` : ''}`;
}

// "123 MB of 5000 MB": what the packs hold in the bucket against your budget (Cloudflare's free storage is 10 GB).
function storageMeter(storage) {
  if (!storage) return '';
  const pct = Math.min(100, Math.round((storage.used / storage.limit) * 100));
  return `<p class="storage"><b>Storage:</b> ${mb(storage.used)} MB of ${mb(storage.limit)} MB used (${pct}%). <progress max="100" value="${pct}"></progress>
    <span class="muted">Uploads stop at the budget so the bucket cannot grow by surprise. Cloudflare R2 gives 10 GB of storage free every month; the budget is set with PACKS_MAX_MB.</span></p>`;
}

export function packsListPage({ packs, hasBucket, msg = '', err = '', storage = null }) {
  const rows = packs.map((p) => `
    <tr>
      <td><a href="/admin/packs?id=${h(p.id)}"><b>${h(p.title)}</b></a><div class="muted">${h(p.id)}</div></td>
      <td>${h(p.kind === 'music' ? 'Music' : p.kind === 'pictures' ? 'Pictures' : p.kind === 'links' ? 'Phonk Mode' : 'Memes')}</td>
      <td>${h(REGIONS[p.region] || p.region)}</td>
      <td>${h(tierText[p.tier] || p.tier)}</td>
      <td>${p.status === 'live' ? '<b>Live</b>' : '<span class="muted">Draft</span>'}</td>
      <td>${Number(p.live_items)} / ${Number(p.items)}</td>
      <td class="nowrap">${mb(p.bytes)} MB</td>
    </tr>`).join('');
  return page('Packs · MemeBox admin', `
<header class="admin-head">
  <h1>Music &amp; meme packs</h1>
  <a class="button" href="/admin">Back to admin</a>
</header>
${notice(msg, err)}
${hasBucket ? '' : '<p class="error" role="alert">The file storage is not set up yet. Run once: <code>npx wrangler r2 bucket create memebox-packs</code>, then deploy again. Until then you can add text memes, but not audio.</p>'}
${storageMeter(storage)}
${COPYRIGHT}
<section class="card">
  <h2>Your packs</h2>
  ${packs.length ? `<div class="table-wrap"><table><thead><tr><th>Pack</th><th>Type</th><th>For</th><th>Plan</th><th>State</th><th>Live items</th><th>Size</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No packs yet. Make the first one below.</p>'}
</section>
<section class="card">
  <h2>New pack</h2>
  <p class="muted">Start with <b>Common</b> packs (music and memes that everyone enjoys). Then add <b>India</b> and <b>Global</b> packs for memes that differ by country. A pack is private until you set it to Live. People see Live packs in MemeBox → Options → Online packs (after pressing Browse packs), or from the “＋ Free packs” button in the panel. Free packs can be added by everybody; Pro and Pro Max packs show “Coming soon” until the paid options open.</p>
  <form method="post" action="/admin/packs" class="keyform">
    <input type="hidden" name="action" value="pack-create">
    <label>Name <input name="title" maxlength="80" required placeholder="e.g. Phonk starter pack"></label>
    <label>Type <select name="kind"><option value="music">Music (audio tracks)</option><option value="memes">Memes (sounds and lines)</option><option value="pictures">Pictures (meme pictures)</option><option value="links">Phonk Mode (YouTube links, nothing hosted)</option></select></label>
    <label>For <select name="region">${opts(REGIONS, 'common')}</select></label>
    <label>Plan <select name="tier"><option value="free">Free</option><option value="pro">Pro</option><option value="max">Pro Max</option></select></label>
    <label>About it <input name="description" maxlength="400" placeholder="One line users will read"></label>
    <button type="submit" class="primary">Make the pack</button>
  </form>
</section>`);
}

// "4 free (plan: 10) · 40 Pro Max": how many items each plan has, next to what you planned to give away free.
function planSummary(p, items) {
  const n = { free: 0, pro: 0, max: 0 };
  for (const i of items) n[itemTier(i, p)]++;
  const [target, noun] = FREE_PLAN[p.kind] || [0, ''];
  const left = target - n.free;
  return `<p class="plans"><span class="tier tier-free">${n.free} free</span> <span class="tier tier-pro">${n.pro} Pro</span> <span class="tier tier-max">${n.max} Pro Max</span>
    <span class="muted">${target ? (left > 0 ? `You planned ${target} free ${noun}: ${left} more can be free.` : left === 0 ? `That is the ${target} free ${noun} you planned.` : `${-left} more free than the ${target} you planned.`) : ''} Tick items below and choose a plan, or set one item at a time.</span></p>`;
}

function itemRow(p, i) {
  const tierNow = TIERS.includes(i.tier) ? i.tier : '';
  const live = i.status === 'live', ok = canPublish(i);
  const sound = i.kind === 'link' ? `<a href="https://www.youtube.com/watch?v=${h(i.text)}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a><div class="muted">${h(i.text)} · ${Number(i.downloads) || 0} plays</div>` : i.kind === 'image' ? `<img class="thumb" alt="" src="/admin/packfile?id=${h(i.id)}"><div class="muted">${h(i.mime)} · ${mb(i.bytes)} MB · ${Number(i.downloads) || 0} downloads</div>` : i.kind === 'audio' ? `<audio controls preload="none" src="/admin/packfile?id=${h(i.id)}"></audio><div class="muted">${h(i.mime)} · ${mb(i.bytes)} MB · ${Number(i.downloads) || 0} downloads</div>` : '<div class="muted">Text meme (spoken by the voice engine)</div>';
  return `
    <tr>
      <td class="nowrap"><input type="checkbox" name="ids" value="${h(i.id)}" form="bulk" aria-label="Select ${h(i.title)}"><div><span class="tier tier-${h(itemTier(i, p))}">${h(tierText[itemTier(i, p)])}</span></div></td>
      <td>
        <form method="post" action="/admin/packs" class="itemform">
          <input type="hidden" name="action" value="item-update"><input type="hidden" name="pack" value="${h(p.id)}"><input type="hidden" name="item" value="${h(i.id)}">
          <div class="row-wrap">
            <label>Title <input name="title" value="${h(i.title)}" maxlength="80"></label>
            ${i.kind === 'line' ? `<label>Text <input name="text" value="${h(i.text)}" maxlength="200"></label>` : ''}
            <label>Language <select name="lang">${opts(LANGS, i.lang)}</select></label>
            <label>Tags <input name="tags" value="${h(i.tags)}" maxlength="120" placeholder="funny, sad, party"></label>
          </div>
          <div class="row-wrap">
            <label>Licence <input name="licence" value="${h(i.licence)}" maxlength="300" placeholder="Own work / CC0 / Licensed: who, when"></label>
            <label>Credit <input name="credit" value="${h(i.credit)}" maxlength="120" placeholder="Artist name (shown in the app)"></label>
            <label>Source <input name="source" value="${h(i.source)}" maxlength="200" placeholder="Where it came from / proof"></label>
          </div>
          <div class="row-wrap">
            <label class="check"><input type="checkbox" name="cleared"${Number(i.cleared) === 1 ? ' checked' : ''}> I may share this</label>
            <label class="check"><input type="checkbox" name="explicit"${Number(i.explicit) === 1 ? ' checked' : ''}> Strong language (only for people who allow it)</label>
            <label>Plan <select name="itemTier">${itemTierOpts(tierNow, p.tier)}</select></label>
            <label>State <select name="status"><option value="draft"${live ? '' : ' selected'}>Draft (hidden)</option><option value="live"${live ? ' selected' : ''}>Live</option></select></label>
            <label>Order <input type="number" name="sort" min="0" max="9999" value="${Number(i.sort) || 100}" class="narrow"></label>
            <button type="submit" class="primary">Save</button>
            ${!ok && !live ? '<span class="muted">Needs "I may share this" and a licence to go live.</span>' : ''}
          </div>
        </form>
      </td>
      <td class="nowrap">${sound}
        <form method="post" action="/admin/packs" class="inline"><input type="hidden" name="action" value="item-delete"><input type="hidden" name="pack" value="${h(p.id)}"><input type="hidden" name="item" value="${h(i.id)}"><button type="submit">Delete</button></form>
      </td>
    </tr>`;
}

export function packPage({ pack: p, items, hasBucket, msg = '', err = '', storage = null }) {
  const bytes = items.reduce((a, i) => a + Number(i.bytes || 0), 0), live = items.filter((i) => i.status === 'live').length;
  const licenceFields = `
      <label>Plan for these <select name="itemTier">${itemTierOpts('', p.tier)}</select></label>
      <label>Licence <select name="licenceKind">${opts(LICENCES, 'own')}</select></label>
      <label>Licence details <input name="licenceNote" maxlength="200" placeholder="Who gave you the rights, and when"></label>
      <label>Credit <input name="credit" maxlength="120" placeholder="Artist name (shown in the app)"></label>
      <label>Source <input name="source" maxlength="200" placeholder="Where it came from"></label>
      <label>Language <select name="lang">${opts(LANGS, '')}</select></label>
      <label>Tags <input name="tags" maxlength="120" placeholder="funny, sad, party"></label>
      <label class="check"><input type="checkbox" name="explicit"> Strong language (only for people who allow it)</label>
      <label class="check"><input type="checkbox" name="cleared"> <b>I may share this</b> (I own it, or I have written permission to share and sell it inside MemeBox)</label>`;
  return page(`${p.title} · packs · MemeBox admin`, `
<header class="admin-head">
  <h1>${h(p.title)}</h1>
  <a class="button" href="/admin/packs">All packs</a>
</header>
${notice(msg, err)}
${storageMeter(storage)}
${COPYRIGHT}
<section class="card">
  <h2>About this pack</h2>
  <p class="muted">${live} of ${items.length} items are live · ${mb(bytes)} MB. Users see the pack only when it is <b>Live</b> and has at least one live item.</p>
  <form method="post" action="/admin/packs" class="keyform">
    <input type="hidden" name="action" value="pack-update"><input type="hidden" name="pack" value="${h(p.id)}">
    <label>Name <input name="title" value="${h(p.title)}" maxlength="80" required></label>
    <label>For <select name="region">${opts(REGIONS, p.region)}</select></label>
    <label>Plan <select name="tier">${opts(Object.fromEntries(TIERS.map((t) => [t, tierText[t]])), p.tier)}</select></label>
    <label>About it <input name="description" value="${h(p.description)}" maxlength="400"></label>
    <label>State <select name="status"><option value="draft"${p.status === 'live' ? '' : ' selected'}>Draft (hidden)</option><option value="live"${p.status === 'live' ? ' selected' : ''}>Live</option></select></label>
    <label>Order <input type="number" name="sort" min="0" max="9999" value="${Number(p.sort) || 100}" class="narrow"></label>
    <button type="submit" class="primary">Save the pack</button>
  </form>
  <form method="post" action="/admin/packs" class="inline"><input type="hidden" name="action" value="pack-delete"><input type="hidden" name="pack" value="${h(p.id)}"><button type="submit">Delete this pack and all its files</button></form>
</section>
${p.kind === 'links' ? `<section class="card">
  <h2>Add YouTube links</h2>
  <p class="notice" role="note"><b>Nothing is hosted.</b> MemeBox plays these through YouTube's own player, so the artists keep their views. Add only <b>official uploads</b> (the artist's or label's own channel, or a channel that owns the rights) that <b>allow embedding</b>. Never add re-uploads by other people, and remove a track if its owner asks. Phonk Mode can be switched off for everybody at any time (PHONK_MODE=off in Cloudflare).</p>
  <p class="muted">One per line: <code>link | title | artist</code> (title and artist are optional). Normal YouTube links work (youtube.com/watch?v=..., youtu.be/...).</p>
  <form method="post" action="/admin/packs" class="keyform">
    <input type="hidden" name="action" value="links-add"><input type="hidden" name="pack" value="${h(p.id)}">
    <label class="wide">Links <textarea name="links" rows="8" maxlength="30000" placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX | Track name | Artist" required></textarea></label>
    <label>Plan for these <select name="itemTier">${itemTierOpts('', p.tier)}</select></label>
    <label class="check"><input type="checkbox" name="official"> <b>These are official uploads that allow embedding</b> (I checked each one)</label>
    <button type="submit" class="primary">Add the links</button>
  </form>
</section>` : p.kind === 'pictures' ? `<section class="card">
  <h2>Upload pictures</h2>
  ${hasBucket ? '' : '<p class="error">File storage is not set up yet (see the packs list page).</p>'}
  <p class="muted">Choose one or many pictures (png, jpg, webp; up to ${Math.round(MAX_IMAGE_BYTES / 1048576)} MB each). The file name becomes the title. The app shrinks them to fit on the camera, and users attach them to a line as a picture meme.</p>
  <form method="post" action="/admin/packs" enctype="multipart/form-data" class="keyform">
    <input type="hidden" name="action" value="items-upload"><input type="hidden" name="pack" value="${h(p.id)}">
    <label>Files <input type="file" name="files" multiple accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" required></label>
    ${licenceFields}
    <button type="submit" class="primary">Upload</button>
  </form>
</section>` : `<section class="card">
  <h2>Upload audio</h2>
  ${hasBucket ? '' : '<p class="error">File storage is not set up yet (see the packs list page).</p>'}
  <p class="muted">Choose one or many files (mp3, m4a, ogg, opus, wav, webm, flac, aac; up to ${Math.round(MAX_AUDIO_BYTES / 1048576)} MB each). The file name becomes the title. Shorter, compressed files download faster for your users.</p>
  <form method="post" action="/admin/packs" enctype="multipart/form-data" class="keyform">
    <input type="hidden" name="action" value="items-upload"><input type="hidden" name="pack" value="${h(p.id)}">
    <label>Files <input type="file" name="files" multiple accept="audio/*,.mp3,.m4a,.ogg,.opus,.wav,.webm,.flac,.aac" required></label>
    ${licenceFields}
    <button type="submit" class="primary">Upload</button>
  </form>
</section>`}
${p.kind === 'memes' ? `<section class="card">
  <h2>Add text memes</h2>
  <p class="muted">One per line: <code>text | language | strong</code>. The language (en, hi, hinglish) and the word <code>strong</code> are optional. The voice engine speaks them.</p>
  <form method="post" action="/admin/packs" class="keyform">
    <input type="hidden" name="action" value="lines-add"><input type="hidden" name="pack" value="${h(p.id)}">
    <label class="wide">Memes <textarea name="lines" rows="6" maxlength="30000" placeholder="Bhai tu rehne de | hinglish&#10;That's what she said | en&#10;(something with strong language) | hi | strong" required></textarea></label>
    ${licenceFields}
    <button type="submit" class="primary">Add them</button>
  </form>
</section>` : ''}
<section class="card">
  <h2>Items (${items.length})</h2>
  ${planSummary(p, items)}
  ${items.length ? `<form method="post" action="/admin/packs" id="bulk" class="keyform bulk">
    <input type="hidden" name="action" value="items-tier"><input type="hidden" name="pack" value="${h(p.id)}">
    <span class="muted">With the ticked items:</span>
    <label>make them <select name="itemTier">${itemTierOpts('', p.tier)}</select></label>
    <button type="submit" class="primary">Set the plan</button>
  </form>
  <div class="table-wrap"><table><tbody>${items.map((i) => itemRow(p, i)).join('')}</tbody></table></div>` : '<p class="muted">Nothing here yet.</p>'}
</section>`);
}

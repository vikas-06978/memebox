'use strict';
const ROOM_ASSET_BASE = new URL('.', document.currentScript.src);
MemeRoomI18n.ready.then(async () => {
  await MemePlan.ready;
  const $ = id => document.getElementById(id), { t } = MemeRoomI18n;
  const memeMode = new URLSearchParams(location.search).get('mode') === 'memes';
  const catalogKind = memeMode ? 'memevideos' : 'links';
  const inExtension = !!globalThis.chrome?.runtime?.id, needsWeb = inExtension || location.protocol === 'file:', EMBED = 'https://www.youtube-nocookie.com';
  const originalIds = [...MemeMusic.PHONK_IDS, ...MemeMusic.IDS];
  let lists = [], showAdult = false, editId = '', selected = '', currentPlaylist = null, originalId = '', tier = 'all';
  let context = null, synth = null, timer = 0, paused = false, shuffle = false, published = [];
  const previewCatalog = Array.isArray(globalThis.MemeBoxPreviewCatalog) ? globalThis.MemeBoxPreviewCatalog : [];
  const previewMemeCount = previewCatalog.filter(pack=>pack?.kind==='memevideos').reduce((total,pack)=>total+(Array.isArray(pack.items)?pack.items.length:0),0);
  const storageKey = 'memebox-room-playlists';
  const allowed = list => !list.explicit || showAdult;
  const make = (tag, text, className = '') => { const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node; };
  const status = text => { $('room-status').textContent=text; };
  const tierOf = id => MemeMusic.FREE_TUNES.includes(id) ? 'free' : ['phonk_drift','phonk_midnight','epic','disco','club','bass','house','desi'].includes(id) ? 'max' : 'pro';
  const tierName = value => value === 'max' ? 'Pro Max' : value === 'pro' ? 'Pro' : t('fx_tier_free');
  if(memeMode) {
    document.title='MemeBox Video Memes';document.body.classList.add('meme-video-room');
    $('playlist-section').hidden=true;$('original-section').hidden=true;
    document.querySelector('.room-kicker').textContent='Video memes for every country';
    document.querySelector('.room-hero h2').textContent='Pick a meme. Play the moment.';
    document.querySelector('.room-hero p').textContent='Admin-curated Worldwide, India, Gaming, Trending and After Dark video meme packs. YouTube streams the visible source video.';
    document.querySelector('#published-section h2').textContent='Video meme packs';
    document.querySelector('#published-section > p').textContent='Only the MemeBox admin publishes these categories. Browse to load the current catalog.';
    document.querySelector('#how-to-add h2').textContent='Video memes in your call';
    document.querySelector('#how-to-add > p').textContent='Play the visible YouTube video. To let everyone hear it, click the MemeBox toolbar icon and choose “Send this tab’s sound”.';
  }
  if(previewMemeCount)$('meme-library-count').textContent=previewMemeCount+' curated memes across worldwide and regional packs';
  async function save() {
    if(inExtension)await chrome.storage.local.set({musicRoomPlaylists:lists});
    else try{localStorage.setItem(storageKey,JSON.stringify(lists))}catch{ $('manager-status').textContent=t('room_storage_error'); }
  }
  function command(func,args=[]) { if($('youtube-player').hasAttribute('src'))$('youtube-player').contentWindow.postMessage(JSON.stringify({event:'command',func,args}),EMBED); }
  function stop() {
    clearTimeout(timer); if(synth)synth.stop(); originalId='';selected='';currentPlaylist=null;paused=false;
    $('youtube-player').removeAttribute('src');$('youtube-box').hidden=true;$('player-empty').hidden=false;
    $('youtube-link').hidden=true;$('now-title').textContent=memeMode?'Choose a video meme to start':t('room_pick');status('');renderOriginals();renderLists();renderPublished();
  }
  function webUrl(list) {
    const config=globalThis.MEMEBOX_CONFIG||{},local=(config.SITE_URL||'').startsWith('http://127.0.0.1:');
    const url=new URL(local?'http://127.0.0.1:8790/music-room.html':new URL('/music-room',config.SITE_URL||location.origin));
    if(memeMode)url.searchParams.set('mode','memes');
    const selection=new URLSearchParams();
    if(list.videos)selection.set('videos',list.videos.join(','));else selection.set('list',list.id);selection.set('name',list.title);
    if(list.explicit)selection.set('explicit','1');url.hash=selection.toString();return url;
  }
  function playPlaylist(list) {
    if(!allowed(list)){status(t('adult_blocked'));return;}
    stop();selected=list.id;currentPlaylist=list;$('now-title').textContent=list.title;
    $('youtube-link').hidden=true;
    if(needsWeb) {
      const url=webUrl(list);$('website-player').href=url.href;$('website-player').hidden=false;
      status(t('room_web_required'));renderLists();window.open(url.href,'_blank','noopener');return;
    }
    const url=new URL(list.videos?'/embed/'+list.videos[0]:'/embed/videoseries',EMBED);if(list.videos&&list.videos.length>1)url.searchParams.set('playlist',list.videos.slice(1).join(','));else if(!list.videos)url.searchParams.set('list',list.id);url.searchParams.set('autoplay','1');url.searchParams.set('playsinline','1');url.searchParams.set('enablejsapi','1');
    if(/^https?:$/.test(location.protocol))url.searchParams.set('origin',location.origin);
    $('youtube-player').src=url.href;$('youtube-box').hidden=false;$('player-empty').hidden=true;
    status(t('room_youtube_loading'));renderLists();
  }
  function playOriginal(id) {
    if(!MemeMusic.TUNES[id])return;
    const full=MemePlan.canFx('music:'+id);stop();
    context=context||new AudioContext();context.resume().catch(()=>{});synth=synth||MemeMusic.createPlayer(context,context.destination);
    synth.setVolume(Number($('room-volume').value)/100);synth.play(id,full?0:20);originalId=id;
    $('now-title').textContent=t('mu_t_'+id);status(t(full?'room_original_playing':'room_preview'));
    $('player-empty').textContent=MemeMusic.PHONK_IDS.includes(id)?'🔥':'🎶';
    if(!full)timer=setTimeout(()=>{if(originalId===id){stop();status(t('room_preview_finished'))}},20500);
    renderOriginals();
  }
  function renderLists() {
    const query=$('playlist-search').value.trim().toLocaleLowerCase(),visible=lists.filter(list=>allowed(list)&&(!query||list.title.toLocaleLowerCase().includes(query)));
    $('playlist-list').replaceChildren();$('playlist-empty').hidden=visible.length>0;
    for(const item of visible) {
      const card=make('article','','room-track');card.dataset.playlist=item.id;
      const details=make('div',''),heading=make('h3',item.title);details.append(heading,make('p',t('room_collection_meta')));
      const actions=make('div','','room-actions'),play=make('button',needsWeb?t('room_web_player'):t('room_play'));
      play.type='button';play.dataset.playlistPlay=item.id;play.setAttribute('aria-pressed',String(selected===item.id));play.addEventListener('click',()=>playPlaylist(item));
      actions.append(play);card.append(details,actions);$('playlist-list').append(card);
    }
  }
  function renderOriginals() {
    $('original-list').replaceChildren();
    for(const id of originalIds.filter(id=>tier==='all'||(tier==='phonk'?MemeMusic.PHONK_IDS.includes(id):tierOf(id)===tier))) {
      const card=make('article','','room-track'),details=make('div','');card.dataset.original=id;
      const tune=MemeMusic.TUNES[id];details.append(make('h3',t('mu_t_'+id)),make('p',tierName(tierOf(id))+' · '+tune.bpm+' BPM'+(MemeMusic.PHONK_IDS.includes(id)?' · '+t('room_drop_at',(1920/tune.bpm).toFixed(1)):'')+(MemePlan.canFx('music:'+id)?'':' · '+t('room_preview_badge'))));
      const actions=make('div','','room-actions'),play=make('button',originalId===id?t('mu_stop'):t('room_play'));play.type='button';play.dataset.originalPlay=id;play.setAttribute('aria-pressed',String(originalId===id));play.addEventListener('click',()=>originalId===id?stop():playOriginal(id));
      const plans=make('a',t('plans_passes'));plans.href=new URL('plans.html?tier='+tierOf(id)+'#passes',ROOM_ASSET_BASE).href;plans.target='_blank';plans.rel='noopener';actions.append(play);if(tierOf(id)!=='free')actions.append(plans);card.append(details,actions);$('original-list').append(card);
    }
  }
  function renderPublished() {
    $('published-list').replaceChildren();
    for(const pack of published) {
      const items=pack.items.filter(item=>showAdult||!item.explicit);if(!items.length)continue;
      const card=make('article','','room-track');card.dataset.published=pack.id;
      const details=make('div','');details.append(make('h3',pack.title),make('p',t('room_published_count',items.length)));
      const songs=make(memeMode?'div':'ol','',memeMode?'meme-items':'');
      for(const item of items) {
        if(memeMode) {
          const row=make('div','','meme-item'),name=make('span',item.title),playOne=make('button',needsWeb?t('room_web_player'):t('room_play'));
          playOne.type='button';playOne.dataset.videoId=item.videoId;playOne.addEventListener('click',()=>playPlaylist({id:item.videoId,title:item.title,videos:[item.videoId],explicit:item.explicit}));
          row.append(name,playOne);songs.append(row);
        } else songs.append(make('li',item.title+(item.credit?' · '+item.credit:'')));
      }
      details.append(songs);
      const play=make('button',needsWeb?t('room_web_player'):t('room_play'));play.type='button';play.dataset.publishedPlay=pack.id;
      play.addEventListener('click',()=>{const playable=pack.items.filter(item=>showAdult||!item.explicit);if(playable.length)playPlaylist({id:pack.id,title:pack.title,videos:playable.map(item=>item.videoId),explicit:playable.some(item=>item.explicit)})});
      card.append(details);if(!memeMode)card.append(play);$('published-list').append(card);
    }
  }
  function loadPreviewCatalog() {
    published=previewCatalog.filter(pack=>pack?.kind===catalogKind).map((pack,index)=>({
      id:'preview-'+index,title:String(pack.title||'').slice(0,80),items:(Array.isArray(pack.items)?pack.items:[]).filter(item=>/^[A-Za-z0-9_-]{11}$/.test(item.videoId||''))
    })).filter(pack=>pack.items.length);
    renderPublished();
    const count=published.reduce((n,p)=>n+p.items.length,0);
    $('published-status').textContent=count?'Local review catalog · '+count+' items':t('room_catalog_unavailable');
    return count;
  }
  $('published-browse').addEventListener('click',async()=>{
    if(previewCatalog.length){loadPreviewCatalog();return;}
    $('published-browse').disabled=true;$('published-status').textContent=t('room_catalog_loading');
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
    try {
      const catalogBase=!inExtension && /^https?:$/.test(location.protocol) && !MEMEBOX_CONFIG.SITE_URL.startsWith('http://127.0.0.1:') ? location.origin : MEMEBOX_CONFIG.SITE_URL;
      const api=new URL('/api/packs',catalogBase);api.searchParams.set('kind',catalogKind);
      const config=await fetch(new URL('/api/config',catalogBase),{signal:abort.signal});
      if(!config.ok)throw Error('Catalog unavailable');
      const settings=await config.json();if(!memeMode&&settings.phonkEnabled===false){published=[];stop();$('published-status').textContent=t('room_catalog_paused');return;}
      const response=await fetch(api,{signal:abort.signal});if(!response.ok)throw Error('Catalog unavailable');
      const data=await response.json();published=(Array.isArray(data.packs)?data.packs:[]).filter(pack=>pack?.kind===catalogKind).slice(0,memeMode?30:10).map((pack,index)=>({
        id:'published-'+index,title:String(pack.title||'').slice(0,80),items:(Array.isArray(pack.items)?pack.items:[]).slice(0,50).filter(item=>typeof item?.videoId==='string'&&/^[A-Za-z0-9_-]{11}$/.test(item.videoId)).map(item=>({videoId:item.videoId,title:String(item.title||item.videoId).slice(0,100),credit:String(item.credit||'').slice(0,100),explicit:item.explicit===true}))
      })).filter(pack=>pack.items.length);
      renderPublished();$('published-status').textContent=published.length?'':t('room_catalog_empty');
    }catch{loadPreviewCatalog();}
    finally{clearTimeout(timeout);$('published-browse').disabled=false;}
  });
  function cancelEdit(){editId='';$('playlist-form').reset();$('manager-status').textContent='';}
  $('playlist-form').addEventListener('submit',async event=>{
    event.preventDefault();const id=MemePlaylists.parse($('playlist-url').value),title=$('playlist-name').value.trim();
    if(!id||!title){$('manager-status').textContent=t('room_invalid');return;}
    if(lists.some(list=>list.id===id&&list.id!==editId)){$('manager-status').textContent=t('room_duplicate');return;}
    if(!editId&&lists.length>=MemePlaylists.MAX){$('manager-status').textContent=t('room_limit',MemePlaylists.MAX);return;}
    const item=MemePlaylists.sanitize([{id,title,explicit:$('playlist-explicit').checked}])[0];
    if(!item){$('manager-status').textContent=t('room_invalid');return;}
    if(editId){if(selected===editId)stop();lists=lists.map(list=>list.id===editId?item:list)}else lists.push(item);
    cancelEdit();await save();renderLists();$('manager-status').textContent=t('room_saved');
  });
  $('playlist-cancel').addEventListener('click',cancelEdit);
  $('playlist-restore').addEventListener('click',async()=>{stop();lists=MemePlaylists.sanitize(null);cancelEdit();await save();renderLists();$('manager-status').textContent=t('room_saved')});
  $('playlist-search').addEventListener('input',renderLists);
  $('room-adult').addEventListener('change',async()=>{
    showAdult=$('room-adult').checked;
    if(!showAdult&&currentPlaylist?.explicit)stop();
    if(inExtension){const {settings}=await chrome.storage.local.get('settings');await chrome.storage.local.set({settings:{...settings,showStrong:showAdult,adultConfirmed:showAdult}})}
    else try{localStorage.setItem('memebox-room-adult',showAdult?'on':'off')}catch{}
    renderLists();renderPublished();
  });
  $('stop').addEventListener('click',stop);
  $('pause').addEventListener('click',()=>{if(originalId&&context){if(paused)context.resume().catch(()=>{});else context.suspend().catch(()=>{});paused=!paused}else if(selected){command(paused?'playVideo':'pauseVideo');paused=!paused}});
  const advance=direction=>{if(originalId){const ids=originalIds.filter(id=>MemePlan.canFx('music:'+id)),at=ids.indexOf(originalId);playOriginal(ids[(at+direction+ids.length)%ids.length])}else if(selected)command(direction>0?'nextVideo':'previousVideo')};
  $('previous').addEventListener('click',()=>advance(-1));$('next').addEventListener('click',()=>advance(1));
  $('shuffle').addEventListener('click',()=>{shuffle=!shuffle;$('shuffle').setAttribute('aria-pressed',String(shuffle));if(selected)command('setShuffle',[shuffle]);if(shuffle&&originalId){const ids=originalIds.filter(id=>MemePlan.canFx('music:'+id)&&id!==originalId);playOriginal(ids[Math.floor(Math.random()*ids.length)])}});
  $('room-volume').addEventListener('input',()=>{if(synth)synth.setVolume(Number($('room-volume').value)/100);command('setVolume',[Number($('room-volume').value)])});
  for(const button of document.querySelectorAll('[data-tier]'))button.addEventListener('click',()=>{tier=button.dataset.tier;for(const item of document.querySelectorAll('[data-tier]'))item.setAttribute('aria-pressed',String(item===button));renderOriginals()});
  $('youtube-player').addEventListener('load',()=>{if($('youtube-player').hasAttribute('src'))$('youtube-player').contentWindow.postMessage(JSON.stringify({event:'listening',id:1,channel:'widget'}),EMBED)});
  window.addEventListener('message',event=>{
    if(event.origin!==EMBED||event.source!==$('youtube-player').contentWindow||!selected)return;
    let data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data}catch{return}
    if(data?.event==='onError')status((currentPlaylist?.title||'This video')+' could not play here. YouTube may have removed it or blocked embedding in your region. Try another meme.');
    if(data?.event==='onStateChange'&&data.info===1){status(t('room_youtube_playing'));paused=false;command('setVolume',[Number($('room-volume').value)]);if(shuffle)command('setShuffle',[true]);}
  });
  if(inExtension) {
    const stored=await chrome.storage.local.get(['musicRoomPlaylists','settings']);lists=MemePlaylists.sanitize(stored.musicRoomPlaylists);showAdult=stored.settings?.showStrong===true&&stored.settings?.adultConfirmed===true;
    $('extension-player-help').hidden=false;
    chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes.settings){const settings=changes.settings.newValue||{};showAdult=settings.showStrong===true&&settings.adultConfirmed===true;$('room-adult').checked=showAdult;if(!showAdult&&currentPlaylist?.explicit)stop();renderLists();renderPublished()}});
  } else {
    let saved;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');showAdult=localStorage.getItem('memebox-room-adult')==='on'}catch{}lists=MemePlaylists.sanitize(saved);
    for(const item of document.querySelectorAll('.extension-only'))item.hidden=true;
  }
  $('playlist-manager').hidden=true;
  $('extension-player-help').hidden=!needsWeb;
  $('room-adult').checked=showAdult;$('review-status').hidden=MEMEBOX_CONFIG.PRO_ENABLED!==false;
  $('room-language').replaceChildren(...MemeRoomI18n.choices.map(([id,name])=>new Option(name,id)));$('room-language').value=MemeRoomI18n.code;
  $('room-language').addEventListener('change',async()=>{await MemeRoomI18n.load($('room-language').value,true);renderLists();renderOriginals();renderPublished()});
  renderLists();renderOriginals();if(previewCatalog.length)loadPreviewCatalog();
  const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
  for(const [key,value] of fragment)if(['list','videos','name','explicit'].includes(key))query.set(key,value);
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  const wanted=MemePlaylists.parse(query.get('list'));
  if(wanted&&!inExtension){let item=lists.find(list=>list.id===wanted);if(!item)item=MemePlaylists.sanitize([{id:wanted,title:query.get('name')||t('room_external'),explicit:query.get('explicit')==='1'}])[0];
    else item={...item,title:(query.get('name')||item.title).slice(0,80),explicit:item.explicit||query.get('explicit')==='1'};
    if(item){
      if(!lists.some(saved=>saved.id===item.id)){if(lists.length>=MemePlaylists.MAX){status(t('room_limit',MemePlaylists.MAX));return;}lists.push(item);}
      else lists=lists.map(saved=>saved.id===item.id?item:saved);
      lists=MemePlaylists.sanitize(lists);await save();renderLists();playPlaylist(item);
    }}
  const incomingVideos=(query.get('videos')||'').split(',').filter(id=>/^[A-Za-z0-9_-]{11}$/.test(id)).slice(0,50);
  if(incomingVideos.length&&!needsWeb) {
    const pack={id:'published-shared',title:(query.get('name')||t('room_external')).slice(0,80),items:incomingVideos.map(videoId=>({videoId,title:videoId,explicit:query.get('explicit')==='1'}))};
    published.push(pack);renderPublished();playPlaylist({id:pack.id,title:pack.title,videos:incomingVideos,explicit:query.get('explicit')==='1'});
  }
  window.addEventListener('pagehide',stop);
}).catch(()=>{document.getElementById('room-status').textContent='Could not load the music room. Reload this page.'});

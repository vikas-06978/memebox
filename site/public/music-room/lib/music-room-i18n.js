// Shared public-page translations for extension pages and the localhost/site music room.
(() => {
  'use strict';
  const inExtension = !!globalThis.chrome?.runtime?.id;
  let messages = {}, code = 'en';
  const choices = [['en','English'],['hi','हिन्दी'],['es','Español'],['pt_BR','Português'],['fr','Français'],['id','Bahasa Indonesia'],['ar','العربية'],['bn','বাংলা'],['mr','मराठी'],['gu','ગુજરાતી'],['ta','தமிழ்'],['te','తెలుగు'],['de','Deutsch · Beta'],['it','Italiano · Beta'],['ja','日本語 · Beta'],['pa','ਪੰਜਾਬੀ · Beta']];
  const normalize = value => { const id = String(value || '').replace('-','_'); return choices.some(([c])=>c===id) ? id : id.startsWith('pt') ? 'pt_BR' : choices.some(([c])=>c===id.split('_')[0]) ? id.split('_')[0] : 'en'; };
  const t = (key, ...subs) => {
    let text = messages[key] || (inExtension ? chrome.i18n.getMessage(key, subs.map(String)) : '') || key;
    return subs.reduce((value, part, i) => value.split('$'+(i+1)).join(String(part)), text);
  };
  function apply() {
    document.documentElement.lang = code.replace('_','-'); document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    for (const element of document.querySelectorAll('[data-i18n]')) { const value=t(element.dataset.i18n); if(value!==element.dataset.i18n)element.textContent=value; }
    for (const attr of ['title','placeholder','aria-label']) for (const element of document.querySelectorAll('[data-i18n-'+attr+']')) element.setAttribute(attr,t(element.getAttribute('data-i18n-'+attr)));
  }
  async function load(value, save = false) {
    code = normalize(value);
    messages={...MemeRoomMessages.en,...MemeRoomMessages[code]};
    if(save){try{localStorage.setItem('memebox-room-language',code)}catch{} if(inExtension)await chrome.storage.local.set({musicRoomLanguage:code});}
    apply(); window.dispatchEvent(new CustomEvent('memebox-room-language'));return code;
  }
  const ready=(async()=>{
    let chosen='en';try{chosen=localStorage.getItem('memebox-room-language')||chosen}catch{}
    if(inExtension){const stored=await chrome.storage.local.get(['langPack','musicRoomLanguage']);chosen=stored.musicRoomLanguage||stored.langPack?.code||chosen;}
    await load(chosen);
  })();
  globalThis.MemeRoomI18n=Object.freeze({ t, ready, load, apply, choices, get code(){return code} });
  globalThis.MemeI18n=globalThis.MemeRoomI18n;
})();

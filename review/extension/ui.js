(async()=>{"use strict";if(window!==window.top||globalThis.__memeboxUi||!globalThis.MemeBridge)return;globalThis.__memeboxUi=!0;let N=null;try{N=(await chrome.storage.local.get("langPack")).langPack||null}catch{}const{TONES:te,VOICES:I,THEMES:xt,sanitizeLine:yt}=globalThis.MEME,b=globalThis.MemeBridge,K=globalThis.MemePlan,C=location.hostname,vt=/meet\.google/.test(C)?"meet":/zoom/.test(C)?"zoom":/teams/.test(C)?"teams":/discord/.test(C)?"discord":"",o=(e,...t)=>{const n=t.map(String),s=N&&N.messages&&N.messages[e];if(s)return n.reduce((r,m,l)=>r.split("$"+(l+1)).join(m),s);try{return chrome.i18n.getMessage(e,n)||e}catch{return e}},ye=12,a={lines:MEME.defaultLines(),settings:MEME.defaultSettings(),pos:null,recent:[],frames:new Map,wasLive:!1,hidden:!1,reqId:0,pending:new Map,lastRandomId:null,nowPlayingId:null,tabAudio:!1,voice:"off",query:"",filter:"all"};function ve(e){Array.isArray(e.lines)&&(a.lines=e.lines.map(yt).filter(Boolean)),e.settings&&typeof e.settings=="object"&&(a.settings={...MEME.defaultSettings(),...e.settings});const t=e.buttonPos&&e.buttonPos[C];t&&Number.isFinite(t.x)&&Number.isFinite(t.y)&&(a.pos=t),Array.isArray(e.recent)&&(a.recent=e.recent.filter(n=>typeof n=="string").slice(0,ye))}function we(e){try{chrome.storage.local.set(e).catch(()=>{})}catch{}}function ne(e,t){try{chrome.storage.local.get(e).then(n=>we({[e]:t(n[e])})).catch(()=>{})}catch{}}function w(e,t){ne("settings",n=>({...MEME.defaultSettings(),...n||{},[e]:t}))}try{chrome.storage.local.get(["lines","settings","buttonPos","recent"]).then(e=>{ve(e),ee(),J(),fe(a.settings.panelTab,!1),B()}).catch(()=>{}),chrome.storage.onChanged.addListener((e,t)=>{if(t!=="local")return;e.langPack&&c(o("lang_reload"));const n={};for(const s of Object.keys(e))n[s]=e[s].newValue;if("lines"in n&&!Array.isArray(n.lines)&&(n.lines=MEME.defaultLines()),ve(n),J(),n.settings&&n.settings.panelTab&&n.settings.panelTab!==f.dataset.tab&&fe(n.settings.panelTab,!1),"settings"in n){B();for(const s of at)try{s()}catch{}}})}catch{}function k(){let e=null;for(const[t,n]of a.frames)n.active&&(!e||n.since>e.since)&&(e={id:t,...n});return e}function ke(){const e=k();return e?e.ctxState!=="running"?"suspended":e.muted?"muted":"live":"none"}const Ee={none:"#9aa0a6",suspended:"#f9ab00",muted:"#f9ab00",live:"#1e8e3e"};function wt(e){if(typeof e.frameId!="number")return;const t=a.frames.get(e.frameId),n=e.active===!0,s=n&&!(t&&t.active)?Date.now():t?t.since:0;a.frames.set(e.frameId,{active:n,muted:e.muted===!0,ctxState:String(e.ctxState),since:s});const r=!!k();r&&!a.wasLive&&(b.toRuntime({type:"warmup"}),B()),!r&&a.wasLive&&(re.clear(),Y()),a.wasLive=r,ot()}function V(){c(o("err_reload"))}function j(e){if(!e)return;const t=k();if(!t){c(o("join_first"));return}const n=++a.reqId;a.pending.set(n,e),setTimeout(()=>a.pending.delete(n),2e4),b.toRuntime({type:"play",frameId:t.id,reqId:n,item:e})||V()}const P=new Map;function kt(e){const t=atob(e.b64),n=new Uint8Array(t.length);for(let s=0;s<t.length;s++)n[s]=t.charCodeAt(s);P.set(e.reqId,createImageBitmap(new Blob([n],{type:e.mime})).catch(()=>null)),setTimeout(()=>{const s=P.get(e.reqId);P.delete(e.reqId),s&&s.then(r=>{r&&r.close()})},2e4)}async function ae(e){const t=a.pending.get(e.reqId);a.pending.delete(e.reqId);const n=P.has(e.reqId)?await P.get(e.reqId):null;if(P.delete(e.reqId),e.ok){if(!A.hidden){A.hidden=!0;try{chrome.storage.local.set({startDone:!0})}catch{}}Pt(),t&&(F(t.text,n),t.id!=="beep"&&Et(t.id),a.nowPlayingId=t.id,S(),clearTimeout(ae.t),ae.t=setTimeout(()=>{a.nowPlayingId=null,S()},3e3)),e.muted&&c(o("muted_nobody"),6e3)}else n&&n.close(),c(e.reason==="no-call"?o("join_first"):o("err_play",e.reason))}function Et(e){a.recent=[e,...a.recent.filter(t=>t!==e)].slice(0,ye),we({recent:a.recent}),b.toRuntime({type:"played-one"})}function _t(){if(!k()){c(o("join_first"));return}const t=++a.reqId;a.pending.set(t,{id:"beep",text:o("mic_test_caption")}),setTimeout(()=>a.pending.delete(t),2e4),d({type:"beep",reqId:t})}const W=()=>N&&N.code?MEME.langOf(N.code):"",oe=()=>W()||MEME.langOf(navigator.language);function _e(){const e=a.settings.lineLang;if(e==="all")return null;if(MEME.isLang(e))return new Set([e]);if(W()&&W()!=="en")return new Set([W()]);const t=String(navigator.language||"en").toLowerCase();let n="";try{n=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch{}return/^(hi|mr|gu|bn|ta|te|pa|kn|ml|ur)/.test(t)||n==="Asia/Kolkata"||n==="Asia/Calcutta"?null:new Set(["en",oe()])}const Lt=()=>{const e=a.settings.lineLang;return e==="all"||MEME.isLang(e)?e:"auto"},Le=e=>{const t=_e();return t?e.filter(n=>n.kind!=="tts"||t.has(n.lang)||!MEME.isBuiltinLine(n)):e};function ie(){const e=a.query.trim().toLowerCase();let t=Le(a.lines);return a.filter==="star"?t=t.filter(n=>n.star):a.filter==="recent"?t=a.recent.map(n=>t.find(s=>s.id===n)).filter(Boolean):a.filter!=="all"&&(t=t.filter(n=>n.category===a.filter)),e&&(t=t.filter(n=>n.text.toLowerCase().includes(e)||(n.say||"").toLowerCase().includes(e))),t}function se(){const e=g?ie():Le(a.lines),t=e.length>1?e.filter(s=>s.id!==a.lastRandomId):e;if(!t.length){c(o("no_lines"));return}const n=t[Math.floor(Math.random()*t.length)];a.lastRandomId=n.id,j(n)}function Nt(e){const t=a.lines.find(n=>n.fav===e);t?j(t):c(o("slot_empty",e))}function Ne(){d({type:"stop"}),a.tabAudio&&d({type:"tab-audio-stop"}),Y();for(const e of x.querySelectorAll(".caption"))e.remove()}function Y(){b.toRuntime({type:"caption-clear"});for(const e of x.querySelectorAll(".caption.pinned"))e.remove()}function d(e){const t=k();t&&b.toRuntime({type:"to-frame",frameId:t.id,inner:{type:"hook",cmd:e}})}function B(){d({type:"volume",value:a.settings.volume}),d({type:"monitor",value:a.settings.monitor===!0}),d({type:"duck",value:a.settings.autoDuck!==!1}),d({type:"tab-audio-volume",value:a.settings.tabVolume}),d({type:"voice",value:a.voice})}function Me(e){if(Object.prototype.hasOwnProperty.call(I,e)||(e="off"),e!=="off"&&!K.can("voiceChanger")){ue(),c(o("pro_only"));return}a.voice=e,e!=="off"&&a.settings.voiceLast!==e&&(a.settings={...a.settings,voiceLast:e},w("voiceLast",e)),d({type:"voice",value:e}),ue(),k()?c(e==="off"?o("voice_now_off"):o("voice_now_on",I[e].emoji+" "+o("voice_"+e))):c(o("voice_after_join"))}function Mt(){const e=Object.prototype.hasOwnProperty.call(I,a.settings.voiceLast)&&a.settings.voiceLast!=="off"?a.settings.voiceLast:"chipmunk";Me(a.voice==="off"?e:"off")}function At(e){const t=!e.star;ne("lines",n=>(Array.isArray(n)?n:a.lines).map(s=>s.id===e.id?{...s,star:t}:s)),e.star=t,S()}function St(e){a.hidden=e;for(const t of[p,y,M])t.hidden=e;e&&q(),c(o(e?"ui_hidden":"ui_shown"))}b.onUiMessage=e=>{for(const t of nt)try{t(e)}catch{}if(e.type==="fx-status"&&(a.camLive=e.active===!0),e.type==="cam-caption"&&e.fixed===!0&&(a.captionFixedAt=Date.now()),e.type==="frame-status")wt(e);else if(e.type==="play-result")ae(e);else if(e.type==="tab-audio-start"&&typeof e.streamId=="string")k()?d({type:"tab-audio-start",value:e.streamId}):(b.toRuntime({type:"tab-audio-state",on:!1,error:"no-call",fromUi:!0}),c(o("join_first")));else if(e.type==="tab-audio-stop")d({type:"tab-audio-stop"});else if(e.type==="tab-audio-state"){const t=a.tabAudio;a.tabAudio=e.on===!0,Ct(),e.on?c(o("tab_on")):e.error?c(e.error==="no-call"?o("join_first"):o("tab_err",e.error)):t&&c(o("tab_off"))}else e.type==="command"&&typeof e.command=="string"?Ae(e.command):e.type==="ask-feedback"?Bt():e.type==="show-picture"&&typeof e.b64=="string"&&/^image\/(webp|png|jpeg|gif)$/.test(e.mime)&&kt(e)};function Ae(e,t){if(!t&&Te(document.activeElement))return;const n=/^fav-([1-9])$/.exec(e);n?Nt(Number(n[1])):e==="stop-all"?(Ne(),c(o("stopped"))):e==="toggle-ui"?St(!a.hidden):e==="toggle-voice"&&Mt()}function Se(e){if(!e||e.nodeType!==1)return!1;if(e.isContentEditable)return!0;const t=e.tagName;if(t==="TEXTAREA"||t==="SELECT")return!0;if(t==="INPUT")return!/^(button|checkbox|radio|range|submit|reset|color|file|image)$/i.test(e.type);const n=e.getAttribute("role");return n==="textbox"||n==="combobox"||n==="searchbox"}function Te(e){for(;e;)if(e===E)e=x.activeElement;else if(e.shadowRoot&&e.shadowRoot.activeElement)e=e.shadowRoot.activeElement;else break;return Se(e)}const Ie={Digit0:"stop-all",KeyM:"toggle-ui",KeyV:"toggle-voice"};for(let e=1;e<=9;e++)Ie["Digit"+e]="fav-"+e;window.addEventListener("keydown",e=>{if(e.key==="Escape"&&x.querySelector(".caption.pinned")){Y(),e.preventDefault();return}if(e.key==="Escape"&&g){q();return}if(!e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;const t=Ie[e.code];t&&(Se(e.composedPath()[0])||Te(document.activeElement)||(e.preventDefault(),e.stopPropagation(),Ae(t,!0)))},!0);const re=new Map,Ce=e=>String(e).padStart(2,"0");setInterval(()=>{const e=a.settings;if(!e.timersEnabled||!Array.isArray(e.timers)||ke()==="none"||!K.can("partyMode"))return;const t=new Date,n=Ce(t.getHours())+":"+Ce(t.getMinutes()),s=t.toDateString();for(const r of e.timers){if(!r||!r.enabled)continue;const m=a.lines.find(h=>h.id===r.lineId);if(!m)continue;const l=re.get(r.id)||{};if(re.set(r.id,l),r.mode==="clock")r.time===n&&l.day!==s&&(l.day=s,j(m));else{const h=Math.max(1,Number(r.minutes)||0)*6e4;l.base?Date.now()-l.base>=h&&(l.base=Date.now(),j(m)):l.base=Date.now()}}},1e4);const E=document.createElement("div");E.style.cssText="all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;";const x=E.attachShadow({mode:"closed"}),je=document.createElement("style");je.textContent=`
    :host { all: initial; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    /* Colors: one set of variables per theme (settings.theme sets data-theme on the host). */
    :host, :host([data-theme="light"]) {
      --p-bg: #ffffff; --p-text: #1c1b20; --p-muted: #5f6368; --p-line: #e3e5e8; --p-soft: #f6f7f9; --p-field: #ffffff;
      --p-hover: #fff8db; --p-now: #ffec99; --p-chip-bg: #1c1b20; --p-chip-fg: #ffffff; --p-b1: #ffd43b; --p-b2: #ffa94d; --p-on-b: #1c1b20;
      --p-blue-bg: #e8f0fe; --p-blue-fg: #174ea6; --p-red-bg: #fdecea; --p-red-fg: #c5221f; --p-star: #f59f00; --p-glow: rgba(255, 146, 43, .45);
    }
    @media (prefers-color-scheme: dark) {
      :host(:not([data-theme])), :host([data-theme="auto"]) {
        --p-bg: #1f1f24; --p-text: #ecebf0; --p-muted: #a3a4ad; --p-line: #3a3a42; --p-soft: #2a2a31; --p-field: #18181c;
        --p-hover: #2e2a1c; --p-now: #4a3f16; --p-chip-bg: #ffd43b; --p-chip-fg: #1c1b20;
        --p-blue-bg: #1f3354; --p-blue-fg: #aecbfa; --p-red-bg: #5c2b29; --p-red-fg: #f6aea9;
      }
    }
    :host([data-theme="dark"]) {
      --p-bg: #1f1f24; --p-text: #ecebf0; --p-muted: #a3a4ad; --p-line: #3a3a42; --p-soft: #2a2a31; --p-field: #18181c;
      --p-hover: #2e2a1c; --p-now: #4a3f16; --p-chip-bg: #ffd43b; --p-chip-fg: #1c1b20;
      --p-blue-bg: #1f3354; --p-blue-fg: #aecbfa; --p-red-bg: #5c2b29; --p-red-fg: #f6aea9;
    }
    :host([data-theme="sunny"]) {
      --p-bg: #fffdf0; --p-text: #3d2c00; --p-muted: #7a6320; --p-line: #f3dd8a; --p-soft: #fff3bf; --p-field: #fffef7;
      --p-hover: #ffec99; --p-now: #ffe066; --p-chip-bg: #e67700; --p-chip-fg: #ffffff; --p-b1: #ffd43b; --p-b2: #ff922b; --p-on-b: #3d2c00;
      --p-star: #e67700;
    }
    :host([data-theme="neon"]) {
      --p-bg: #1a1238; --p-text: #f3eaff; --p-muted: #b8a6e6; --p-line: #3b2d6e; --p-soft: #241a4d; --p-field: #130d2c;
      --p-hover: #2c2160; --p-now: #4a2a8a; --p-chip-bg: #f72585; --p-chip-fg: #ffffff; --p-b1: #f72585; --p-b2: #7209b7; --p-on-b: #ffffff;
      --p-blue-bg: #13325a; --p-blue-fg: #4cc9f0; --p-red-bg: #4a1030; --p-red-fg: #ff8fab; --p-star: #4cc9f0; --p-glow: rgba(247, 37, 133, .55);
    }
    :host([data-theme="candy"]) {
      --p-bg: #ffffff; --p-text: #3b1030; --p-muted: #8c4a73; --p-line: #fcc2d7; --p-soft: #fff0f6; --p-field: #fffafd;
      --p-hover: #ffdeeb; --p-now: #fcc2d7; --p-chip-bg: #d6336c; --p-chip-fg: #ffffff; --p-b1: #faa2c1; --p-b2: #f06595; --p-on-b: #3b1030;
      --p-blue-bg: #f3f0ff; --p-blue-fg: #6741d9; --p-star: #d6336c; --p-glow: rgba(240, 101, 149, .5);
    }

    .fab { position: fixed; width: 54px; height: 54px; border-radius: 50%; border: 0; padding: 0;
      background: radial-gradient(circle at 30% 25%, #fff3bf, var(--p-b1) 45%, var(--p-b2)); cursor: grab; touch-action: none;
      box-shadow: 0 6px 18px var(--p-glow), 0 2px 6px rgba(0,0,0,.25);
      font: 29px/54px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; text-align: center;
      user-select: none; -webkit-user-select: none; transition: transform .12s ease, box-shadow .12s ease; }
    .fab:hover { transform: scale(1.08) rotate(-6deg); box-shadow: 0 10px 24px var(--p-glow), 0 2px 6px rgba(0,0,0,.25); }
    .fab:active { transform: scale(.94); cursor: grabbing; }
    .fab:focus-visible { outline: 3px solid #1a73e8; outline-offset: 3px; }
    .fab.playing { animation: laugh .5s ease-in-out 3; }
    .fab.playing::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 3px solid var(--p-b2); animation: ring 1s ease-out infinite; }
    @keyframes laugh { 0%, 100% { transform: rotate(0) scale(1); } 25% { transform: rotate(-12deg) scale(1.1); } 75% { transform: rotate(12deg) scale(1.1); } }
    @keyframes ring { from { opacity: .9; transform: scale(1); } to { opacity: 0; transform: scale(1.5); } }
    .fab .dot { position: absolute; right: 1px; bottom: 1px; width: 15px; height: 15px; border-radius: 50%;
      border: 2.5px solid #fff; background: #9aa0a6; }
    /* Muted in the call: memes would be silent, so the button says so (and the panel too). */
    .fab.muted::before { content: "\u{1F507}"; position: absolute; left: -7px; bottom: -4px; width: 24px; height: 24px; border-radius: 50%;
      background: #fff; border: 2px solid #f9ab00; font: 13px/20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; text-align: center; }

    /* Emoji burst when a meme plays (interactive and fun, off with reduced motion). */
    .burst { position: fixed; pointer-events: none; font: 24px/1 "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
      animation: fly .95s cubic-bezier(.2, .7, .3, 1) forwards; }
    @keyframes fly {
      0% { opacity: 0; transform: translate(0, 0) scale(.4) rotate(0); }
      15% { opacity: 1; }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.2) rotate(var(--rot)); }
    }

    .mon { position: fixed; width: 24px; height: 24px; padding: 0; border-radius: 50%; border: 2px solid #fff;
      background: #1a73e8; box-shadow: 0 2px 6px rgba(0,0,0,.3); cursor: pointer; text-align: center;
      font: 12px/20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; transition: transform .1s; }
    .mon.off { background: #5f6368; }
    .mon.pickbtn { background: #1c1b20; color: #fff; font: 700 13px/20px system-ui, sans-serif; }
    .mon:hover { transform: scale(1.12); }
    .mon:focus-visible { outline: 3px solid #1a73e8; outline-offset: 2px; }

    .panel { position: fixed; width: 356px; max-height: min(600px, calc(100vh - 24px)); display: none;
      flex-direction: column; gap: 10px; padding: 14px; border-radius: 20px; background: var(--p-bg); color: var(--p-text);
      border: 1px solid var(--p-line); box-shadow: 0 18px 48px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.12);
      font: 13.5px/1.4 system-ui, -apple-system, "Segoe UI", "Nirmala UI", sans-serif; }
    .panel.open { display: flex; animation: rise .16s ease-out; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
    .panel > * { flex: none; }
    .panel > .list { flex: 1 1 auto; min-height: 90px; }
    .head { display: flex; align-items: center; gap: 2px; }
    .head h1 { flex: 1; margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -.01em; }
    .icon { border: 0; background: transparent; cursor: pointer; font-size: 16px; width: 32px; height: 32px; border-radius: 10px; color: inherit;
      display: grid; place-items: center; padding: 0; transition: background .1s; }
    .icon:hover { background: var(--p-soft); }
    .status { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px; background: var(--p-soft); font-weight: 600; }
    .status.warn { background: #fff3cd; color: #5c3d00; border: 1px solid #f9ab00; font-size: 13px; line-height: 1.35; }
    :host([data-theme="dark"]) .status.warn, :host([data-theme="neon"]) .status.warn { background: #4a3a00; color: #ffe08a; }
    @media (prefers-color-scheme: dark) { :host(:not([data-theme])) .status.warn, :host([data-theme="auto"]) .status.warn { background: #4a3a00; color: #ffe08a; } }
    .start { background: var(--p-soft); border-radius: 12px; padding: 8px 12px; font-size: 11.5px; line-height: 1.35; display: flex; flex-direction: column; gap: 3px; }
    .start-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; }
    .start .btn.small { padding: 3px 10px; font-size: 11.5px; }
    .start[hidden] { display: none; }
    .start p { margin: 0; }
    .status .dot { width: 10px; height: 10px; flex: none; border-radius: 50%; background: #9aa0a6; box-shadow: 0 0 0 3px rgba(127,127,127,.15); }
    .search { width: 100%; padding: 10px 14px; border: 1px solid var(--p-line); border-radius: 12px; font: inherit; color: inherit; background: var(--p-field);
      transition: border-color .1s, box-shadow .1s; }
    .search:focus { outline: none; border-color: #1a73e8; box-shadow: 0 0 0 4px rgba(26, 115, 232, .15); }
    .chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
    .chips::-webkit-scrollbar { display: none; }
    .chip { flex: none; border: 1px solid var(--p-line); background: var(--p-bg); color: inherit; border-radius: 999px;
      padding: 5px 12px; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background .1s; }
    .chip:hover { background: var(--p-soft); }
    .chip.on { background: var(--p-chip-bg); border-color: var(--p-chip-bg); color: var(--p-chip-fg); }
    .row { display: flex; gap: 8px; align-items: center; }
    .btn { flex: 1; border: 0; border-radius: 12px; padding: 9px 8px; font: inherit; font-weight: 700; cursor: pointer;
      background: linear-gradient(135deg, var(--p-b1), var(--p-b2)); color: var(--p-on-b); white-space: nowrap; transition: transform .1s, filter .1s; }
    .btn:hover { filter: brightness(1.03); transform: translateY(-1px); }
    .btn:active { transform: none; }
    .btn.stop { background: var(--p-red-bg); color: var(--p-red-fg); }
    .btn.test { background: var(--p-blue-bg); color: var(--p-blue-fg); }
    .btn.small { flex: none; padding: 5px 12px; font-size: 12px; }
    .tabbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px; background: var(--p-blue-bg); color: var(--p-blue-fg); font-weight: 600; }
    .tabbar { flex-wrap: wrap; }
    .tabbar > span { flex: 1; }
    .row.full { flex-basis: 100%; }
    .voice { flex: 1; padding: 6px 8px; border: 1px solid var(--p-line); border-radius: 10px; font: inherit; color: inherit; background: transparent; }
    .voice option { background: var(--p-bg); }
    .voice.on { border-color: var(--p-b2); background: color-mix(in srgb, var(--p-b1) 25%, transparent); font-weight: 700; }
    .vol { flex: 1; accent-color: var(--p-b2); }
    .checks { display: flex; flex-direction: column; gap: 6px; }
    .check { display: flex; align-items: center; gap: 8px; cursor: pointer; color: inherit; }
    .check input { margin: 0; width: 16px; height: 16px; accent-color: var(--p-b2); }
    .volval { width: 42px; text-align: right; font-variant-numeric: tabular-nums; color: var(--p-muted); font-weight: 600; }
    .list { list-style: none; margin: 0 -4px; padding: 0 4px; overflow-y: auto; min-height: 60px; }
    .list li { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 12px; transition: background .1s; }
    .list li + li { margin-top: 2px; }
    .list li.pick { cursor: pointer; }
    .list li.pick:hover { background: var(--p-hover); }
    .list li.now { background: var(--p-now); }
    .list li.now .play { transform: scale(1.1); }
    .play { flex: none; width: 32px; height: 32px; border-radius: 50%; border: 0; cursor: pointer; font-size: 12px; color: var(--p-on-b);
      background: linear-gradient(135deg, var(--p-b1), var(--p-b2)); box-shadow: 0 2px 6px var(--p-glow); transition: transform .1s; }
    .play:hover { transform: scale(1.12) rotate(-8deg); }
    .star { flex: none; border: 0; background: transparent; cursor: pointer; font-size: 17px; padding: 2px; color: var(--p-muted); opacity: .6; transition: transform .1s; }
    .star:hover { transform: scale(1.25); opacity: 1; }
    .star.on { color: var(--p-star); opacity: 1; }
    .txt { flex: 1; min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
    .tags { flex: none; display: flex; gap: 4px; color: var(--p-muted); font-size: 11px; align-items: center; }
    .tag { padding: 2px 6px; border-radius: 6px; background: var(--p-soft); font-weight: 600; }
    .empty { padding: 16px 8px; color: var(--p-muted); text-align: center; }
    .settings { border-top: 1px solid var(--p-line); padding-top: 8px; }
    .settings summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; padding: 4px 2px; border-radius: 8px; }
    .settings summary::-webkit-details-marker { display: none; }
    .settings summary::after { content: "\u25BE"; color: var(--p-muted); transition: transform .15s; }
    .settings[open] summary::after { transform: rotate(180deg); }
    .settings summary .sum { flex: 1; text-align: right; color: var(--p-muted); font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .settings-body { display: grid; gap: 10px; padding: 10px 2px 2px; }
    .panel.fx-open { overflow-y: auto; }
    /* pages */
    .pagetabs { display: flex; gap: 2px; padding: 3px; border-radius: 12px; background: var(--p-soft); }
    .ptab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; border: 0; background: transparent; color: var(--p-muted);
      padding: 7px 4px; border-radius: 9px; font: 700 12.5px/1 system-ui, -apple-system, "Segoe UI", "Nirmala UI", sans-serif; cursor: pointer; transition: background .12s, color .12s; }
    .ptab:hover { color: var(--p-text); }
    .ptab.on { background: var(--p-bg); color: var(--p-text); box-shadow: 0 1px 3px rgba(0,0,0,.16); }
    .ptab:focus-visible { outline: 2px solid #1a73e8; outline-offset: 1px; }
    .pti { font-size: 14px; }
    .panel[data-tab="music"] :is(.search, .chips, .memes-row, .list, .packs-link, details[data-page]:not([data-page="music"])),
    .panel[data-tab="lights"] :is(.search, .chips, .memes-row, .list, .packs-link, details[data-page]:not([data-page="lights"])),
    .panel[data-tab="sound"] :is(.search, .chips, .memes-row, .list, .packs-link, details[data-page]:not([data-page="sound"])),
    .panel[data-tab="memes"] details[data-page] { display: none; }
    details[data-page] > summary { display: none; }
    details[data-page] { border-top: 0; padding-top: 0; }
    details[data-page] .settings-body { padding-top: 2px; }
    .panel[data-tab="memes"] .foot { display: block; }
    .panel:not([data-tab="memes"]) > .foot, .panel:not([data-tab="memes"]) > .start { display: none; }
    .langchips { margin-top: -4px; }
    .chip.small { padding: 3px 10px; font-size: 11.5px; }
    .lang-more { appearance: none; -webkit-appearance: none; cursor: pointer; max-width: 130px; }
    /* switches instead of boxes */
    .panel .check input[type="checkbox"] { appearance: none; -webkit-appearance: none; flex: none; width: 32px; height: 19px; margin: 0; border-radius: 19px; background: var(--p-line);
      position: relative; cursor: pointer; transition: background .15s; }
    .panel .check input[type="checkbox"]::after { content: ""; position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: transform .15s; }
    .panel .check input[type="checkbox"]:checked { background: #f59e0b; }
    .panel .check input[type="checkbox"]:checked::after { transform: translateX(13px); }
    .panel .check input[type="checkbox"]:disabled { opacity: .45; cursor: default; }
    .panel .check input[type="checkbox"]:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
    .panel .check { gap: 9px; }
    .fx-adv { border: 1px solid var(--p-line); border-radius: 12px; padding: 4px 10px; }
    .fx-adv > summary { cursor: pointer; font-weight: 700; padding: 6px 0; list-style: none; display: flex; justify-content: space-between; }
    .fx-adv > summary::-webkit-details-marker { display: none; }
    .fx-adv > summary::after { content: "\u25BE"; color: var(--p-muted); }
    .fx-adv[open] > summary::after { content: "\u25B4"; }
    .fx-adv .checks { padding-bottom: 8px; }
    .panel.fx-open .list, .panel.fx-open .chips, .panel.fx-open .search { display: none; }
    .fx-pass { display: flex; gap: 8px; align-items: center; justify-content: space-between; background: var(--p-soft); border-radius: 10px; padding: 8px 10px; font-weight: 600; font-size: 12px; }
    .fx-pass.on { background: #e6f4ea; color: #137333; }
    .fx-how, .fx-status { color: var(--p-muted); font-size: 12px; line-height: 1.4; }
    .fx-status.ok { color: #188038; font-weight: 700; }
    .fx-prev { width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--p-line); background: #23253a; display: block; }
    .fx-body.fx-off .fx-prev { opacity: .75; }
    .fx-main { font-size: 14px; }
    .fx-prev.fx-drag { cursor: grab; touch-action: none; }
    .fx-prev.fx-drag:active { cursor: grabbing; }
    .fx-pair { display: inline-flex; gap: 2px; }
    .chip.del { padding-left: 8px; padding-right: 8px; opacity: .7; }
    .chip.preset { font-weight: 800; }
    .icon.add { font-size: 20px; font-weight: 700; }
    .fx-group { display: grid; gap: 6px; }
    .fx-label { font-weight: 700; font-size: 12px; color: var(--p-muted); text-transform: none; }
    .fx-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .fx-chips .chip.locked { opacity: .8; border-style: dashed; }
    .fx-swatches { display: flex; flex-wrap: wrap; gap: 8px; }
    .fx-sw { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--p-line); cursor: pointer; padding: 0; }
    .fx-sw.on { border-color: var(--p-text); box-shadow: 0 0 0 2px var(--p-bg), 0 0 0 4px var(--p-text); }
    .fx-sw.locked { opacity: .6; }
    .fx-lock { display: flex; gap: 8px; align-items: center; justify-content: space-between; background: var(--p-blue-bg); color: var(--p-blue-fg); border-radius: 10px; padding: 8px 10px; font-size: 12px; font-weight: 600; }
    .foot { color: var(--p-muted); font-size: 11px; }

    .ask { position: fixed; width: 260px; padding: 14px; border-radius: 16px; background: var(--p-bg); color: var(--p-text); border: 1px solid var(--p-line);
      box-shadow: 0 12px 32px rgba(0,0,0,.3); font: 13px/1.35 system-ui, -apple-system, "Segoe UI", "Nirmala UI", sans-serif;
      display: grid; gap: 10px; }
    .ask b { font-size: 15px; padding-right: 26px; }
    .ask .x { position: absolute; top: 6px; right: 6px; }
    .toast { position: fixed; max-width: 280px; padding: 9px 14px; border-radius: 12px; background: #1c1b20; color: #fff;
      font: 13px/1.35 system-ui, -apple-system, "Segoe UI", "Nirmala UI", sans-serif; box-shadow: 0 6px 18px rgba(0,0,0,.3);
      opacity: 0; transform: translateY(4px); transition: opacity .15s, transform .15s; pointer-events: none; }
    .toast.show { opacity: 1; transform: none; }

    .caption { position: fixed; left: 50%; top: 8vh; transform: translateX(-50%); width: max-content; max-width: 92vw;
      text-align: center; pointer-events: none; font: 900 clamp(30px, 6vw, 72px)/1.05 Impact, "Anton", "Arial Black", "Nirmala UI", sans-serif;
      text-transform: uppercase; color: #fff; -webkit-text-stroke: 2px #000; paint-order: stroke fill;
      text-shadow: 0 0 2px #000, 3px 3px 0 #000, -1px -1px 0 #000, 0 6px 16px rgba(0,0,0,.5); overflow-wrap: anywhere;
      animation: pop 3s ease forwards; }
    .caption.pinned { pointer-events: auto; animation: picture-pop .25s ease-out both; padding: 34px 14px 14px; }
    .caption.pinned .meme-pic { display: block; margin: 0 auto 10px; max-width: min(76vw, 900px); max-height: 64vh; width: auto; height: auto;
      border-radius: 14px; box-shadow: 0 8px 26px rgba(0,0,0,.45); }
    .caption .picture-close { position: absolute; inset-block-start: 0; inset-inline-end: 0; width: 38px; height: 38px; border: 2px solid #fff;
      border-radius: 999px; background: #17151c; color: #fff; cursor: pointer; font: 700 20px/1 system-ui, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.45); }
    .caption .picture-close:focus-visible { outline: 3px solid #ffd43b; outline-offset: 3px; }
    @keyframes picture-pop { from { opacity: 0; transform: translateX(-50%) scale(.92); } to { opacity: 1; transform: translateX(-50%) scale(1); } }
    @keyframes pop {
      0% { opacity: 0; transform: translateX(-50%) scale(.6) rotate(-3deg); }
      10% { opacity: 1; transform: translateX(-50%) scale(1.08) rotate(1deg); }
      18% { transform: translateX(-50%) scale(1) rotate(0); }
      85% { opacity: 1; }
      100% { opacity: 0; transform: translateX(-50%) scale(1); }
    }    @media (prefers-reduced-motion: reduce) {
      .caption:not(.pinned) { animation: fade 3s linear forwards; } .caption.pinned { animation: none; }
      @keyframes fade { 0%, 85% { opacity: 1; } 100% { opacity: 0; } }
      .burst { display: none; } .fab.playing, .fab.playing::after { animation: none; }
    }
  `;const i=(e,t={},...n)=>{const s=document.createElement(e);return Object.assign(s,t),s.append(...n),s},Pe=i("span",{className:"dot"}),p=i("button",{className:"fab",type:"button"},"\u{1F602}",Pe);p.setAttribute("aria-label",o("fab_label"));const y=i("button",{className:"mon",type:"button"},"\u{1F3A7}");y.setAttribute("aria-label",o("monitor_label"));const M=i("button",{className:"mon pickbtn",type:"button",title:o("list_btn")},"\u2630");M.setAttribute("aria-label",o("list_btn"));const Be=i("span",{className:"dot"}),Re=i("span"),De=i("div",{className:"status"},Be,Re),R=i("input",{className:"search",type:"search",placeholder:o("search_ph")});R.setAttribute("aria-label",o("search_ph"));const ze=i("div",{className:"chips",role:"tablist"}),Ue=i("div",{className:"chips langchips"}),Oe=i("button",{className:"btn",type:"button"},o("btn_random")),qe=i("button",{className:"btn test",type:"button",title:o("btn_mic_test_tip")},o("btn_mic_test")),Ve=i("button",{className:"btn stop",type:"button",title:"Alt+0"},o("btn_stop_all")),D=i("input",{className:"vol",type:"range",min:0,max:200,step:5,title:o("volume")});D.setAttribute("aria-label",o("volume"));const le=i("span",{className:"volval"}),He=i("button",{className:"btn stop small",type:"button"},o("tab_stop")),z=i("input",{className:"vol",type:"range",min:0,max:200,step:5,title:o("tab_volume")});z.setAttribute("aria-label",o("tab_volume"));const Xe=i("div",{className:"tabbar",hidden:!0},i("span",{},o("tab_bar")),He,i("div",{className:"row full"},i("span",{title:o("tab_volume")},"\u{1F509}"),z)),U=i("select",{className:"voice",title:o("voice_tip")},...Object.entries(I).map(([e,t])=>i("option",{value:e},`${t.emoji} ${o("voice_"+e)}`)));U.setAttribute("aria-label",o("voice_label"));const G=i("input",{type:"checkbox"}),H=i("input",{type:"checkbox"}),_=i("input",{type:"checkbox"}),X=i("input",{type:"checkbox"}),O=i("ul",{className:"list"}),Fe=i("button",{className:"chip small packs-link",type:"button",title:o("op_online_hint")},o("pk_get"));Fe.addEventListener("click",()=>api.openPacks());const $e=i("button",{className:"icon",type:"button",title:o("options")},"\u2699\uFE0F"),pe=i("button",{className:"icon",type:"button",title:o("feedback")},"\u{1F4AC}");pe.setAttribute("aria-label",o("feedback"));const Ke=i("button",{className:"icon",type:"button",title:o("close")},"\u2715"),We=i("div",{className:"foot"}),Ye=i("span",{className:"sum"}),Z=i("details",{className:"settings"},i("summary",{},i("span",{},o("settings_label")),Ye),i("div",{className:"settings-body"},i("div",{className:"row"},i("span",{title:o("volume")},"\u{1F50A}"),D,le),i("label",{className:"row",title:o("voice_tip")},i("span",{},o("voice_label")),U,i("span",{className:"foot"},"Alt+V")),i("div",{className:"checks"},i("label",{className:"check",title:o("monitor_tip")},G,o("monitor_label")),i("label",{className:"check",title:o("duck_tip")},H,o("duck_label")),i("label",{className:"check",title:o("cam_tip")},_,o("cam_label")),i("label",{className:"check",title:o("cam_unmirror_tip")},X,o("cam_unmirror")))));Z.addEventListener("toggle",()=>{g&&T()});const Ge=i("button",{className:"btn small",type:"button"},o("st_ok")),A=i("div",{className:"start",hidden:!0},i("div",{className:"start-head"},i("strong",{},o("st_title")),Ge),i("p",{},o("st_1")),i("p",{},o("st_2")),i("p",{},o("st_3")));Ge.addEventListener("click",()=>{A.hidden=!0;try{chrome.storage.local.set({startDone:!0})}catch{}g&&T()});try{chrome.storage.local.get("startDone").then(e=>{A.hidden=e.startDone===!0}).catch(()=>{A.hidden=!1})}catch{A.hidden=!1}const Tt=[["memes","\u{1F602}","tab_memes"],["music","\u{1F3B5}","tab_music"],["lights","\u{1F4A1}","tab_lights"],["sound","\u{1F39B}","tab_sound"]],Ze=i("div",{className:"pagetabs",role:"tablist"}),ce={};for(const[e,t,n]of Tt){const s=i("button",{className:"ptab",type:"button",role:"tab"},i("span",{className:"pti"},t),i("span",{},o(n)));s.addEventListener("click",()=>fe(e)),ce[e]=s,Ze.append(s)}Z.dataset.page="sound";const f=i("div",{className:"panel"},i("div",{className:"head"},i("h1",{},"\u{1F602} MemeBox"),pe,$e,Ke),De,A,Ze,Xe,R,ze,Ue,i("div",{className:"row memes-row"},Oe,qe,Ve),O,Fe,Z,i("div",{className:"foot"},o("panel_foot")),We);f.setAttribute("role","dialog");const Je=o("text_dir")==="rtl"?"rtl":"ltr";f.dir=Je,f.setAttribute("aria-label","MemeBox");const L=i("div",{className:"toast",role:"status"}),Qe=i("button",{className:"btn",type:"button"},o("ask_rate")),et=i("button",{className:"btn test",type:"button"},o("ask_feedback")),tt=i("button",{className:"icon x",type:"button",title:o("close")},"\u2715"),v=i("div",{className:"ask",hidden:!0,role:"dialog"},i("b",{},o("ask_title")),i("div",{className:"row"},Qe,et),tt);v.setAttribute("aria-label",o("ask_title")),v.dir=Je,x.append(je,p,y,M,f,v,L);const de=[],nt=[],at=[],It={el:i,t:o,settingsDetails:Z,panel:f,getSettings:()=>a.settings,setLocal:(e,t)=>{a.settings={...a.settings,[e]:t}},saveSetting:(e,t)=>w(e,t),placePanel:()=>T(),panelIsOpen:()=>g,openPacks:()=>{b.toRuntime({type:"open-options",hash:"online"})||V()},openSite:e=>{b.toRuntime({type:"open-site",path:e})||V()},inCall:()=>!!k(),frameId:()=>{const e=k();return e?e.id:null},ask:e=>b.ask(e),clipCount:()=>a.lines.filter(e=>e.kind==="clip").length,LIMITS:MEME.LIMITS,toast:(e,t)=>c(e,t),sendToHook:e=>d(e),send:e=>b.toRuntime(e),onPanelToggle:e=>de.push(e),onMessage:e=>nt.push(e),onSettings:e=>at.push(e)};for(const e of globalThis.MemeUiMounts||[])try{e(It)}catch{}function fe(e,t=!0){ce[e]||(e="memes"),f.dataset.tab=e;for(const[n,s]of Object.entries(ce))s.classList.toggle("on",n===e),s.setAttribute("aria-selected",String(n===e));for(const n of f.querySelectorAll("details[data-page]")){const s=n.dataset.page===e;n.open!==s&&(n.open=s)}f.classList.toggle("fx-open",e==="lights"||e==="music"),t&&a.settings.panelTab!==e&&(a.settings={...a.settings,panelTab:e},w("panelTab",e)),g&&T()}f.dataset.tab="memes";function J(){const e=a.settings.theme;E.dataset.theme=Object.prototype.hasOwnProperty.call(xt,e)?e:"auto",ot(),st(),S(),rt(),ue()}function ue(){U.value=a.voice,U.classList.toggle("on",a.voice!=="off"),be()}function be(){const e=Math.round((Number(a.settings.volume)||0)*100),t=I[a.voice]||I.off;Ye.textContent=`\u{1F50A} ${e}% \xB7 ${t.emoji} ${o("voice_"+a.voice)}`}function ot(){const e=ke();Pe.style.background=Ee[e],Be.style.background=Ee[e],Re.textContent=(e==="muted"?"\u{1F507} ":"")+o("st_"+e),De.classList.toggle("warn",e==="muted"||e==="none"),p.classList.toggle("muted",e==="muted"),p.title="MemeBox: "+o("st_"+e)+`
`+o("fab_tip")}function Ct(){Xe.hidden=!a.tabAudio,g&&T()}function jt(e){const t=o("cat_"+e);return t==="cat_"+e?e:t}function it(){const e=Lt(),t=_e(),n=l=>{a.settings={...a.settings,lineLang:l},w("lineLang",l),MEME.isLang(l)&&b.toRuntime({type:"add-lang-lines",lang:l}),it(),S()},s=["en",oe(),"hi"].filter((l,h,$)=>$.indexOf(l)===h),r=(l,h)=>{const $=e==="auto"?l==="all"?!t:!!t&&t.has(l)&&l===oe():l===e,ht=i("button",{className:"chip small"+($?" on":""),type:"button"},h);return ht.addEventListener("click",()=>n(l)),ht},m=i("select",{className:"chip small lang-more",title:o("chip_lang_more")},i("option",{value:""},o("chip_lang_more")),...Object.entries(MEME.LANGS).map(([l,h])=>i("option",{value:l},h)));m.addEventListener("change",()=>{m.value&&n(m.value)}),MEME.isLang(e)&&!s.includes(e)&&(m.value=e,m.classList.add("on")),Ue.replaceChildren(r("all",o("chip_lang_all")),...s.map(l=>r(l,MEME.LANGS[l])),m)}function st(){it();const e=[...new Set(a.lines.map(n=>n.category).filter(Boolean))],t=[["all",o("chip_all")],["star","\u2B50 "+o("chip_star")],["recent","\u{1F558} "+o("chip_recent")],...e.map(n=>[n,jt(n)])];t.some(([n])=>n===a.filter)||(a.filter="all"),ze.replaceChildren(...t.map(([n,s])=>{const r=i("button",{className:"chip"+(n===a.filter?" on":""),type:"button",role:"tab"},s);return r.setAttribute("aria-selected",String(n===a.filter)),r.addEventListener("click",()=>{a.filter=n,st(),S()}),r}))}function rt(){const e=Math.round((Number(a.settings.volume)||0)*100);D.value=e,le.textContent=e+"%",be();const t=a.settings.monitor===!0;G.checked=t,H.checked=a.settings.autoDuck!==!1,_.checked=a.settings.camCaptions===!0,X.checked=a.settings.camUnmirror!==!1,(!x.activeElement||x.activeElement!==z)&&(z.value=Math.round((Number(a.settings.tabVolume??1)||0)*100)),y.textContent=t?"\u{1F3A7}":"\u{1F507}",y.classList.toggle("off",!t),y.title=o(t?"monitor_on_tip":"monitor_off_tip"),y.setAttribute("aria-pressed",String(t));const n=a.settings,s=Array.isArray(n.timers)?n.timers.filter(r=>r&&r.enabled).length:0;We.textContent=n.timersEnabled&&s?o("timers_on",s):""}function S(){const e=ie(),t=O.scrollTop;if(queueMicrotask(()=>{O.scrollTop=t}),O.replaceChildren(),!e.length){const n=a.filter==="star"?o("empty_star"):a.filter==="recent"?o("empty_recent"):a.lines.length?o("empty_search"):o("no_lines");O.append(i("li",{className:"empty"},n));return}for(const n of e){const s=te[n.tone]||te.normal,r=i("span",{className:"tags"},n.kind!=="tts"?i("span",{className:"tag",title:o(n.kind==="sfx"?"tag_sfx":"tag_clip")},"\u{1F3B5}"):i("span",{className:"tag",title:o("tag_lang")},n.lang.toUpperCase()),i("span",{title:o("tone_"+(te[n.tone]?n.tone:"normal"))},s.emoji));n.fav&&r.append(i("span",{className:"tag",title:o("tag_shortcut")},"Alt+"+n.fav));const m=i("button",{className:"play",type:"button",title:o("play")},"\u25B6");m.setAttribute("aria-label",o("play")+": "+n.text);const l=i("button",{className:"star"+(n.star?" on":""),type:"button",title:n.star?o("unstar"):o("star")},n.star?"\u2605":"\u2606");l.setAttribute("aria-pressed",String(!!n.star)),l.addEventListener("click",$=>{$.stopPropagation(),At(n)});const h=i("li",{className:"pick"+(n.id===a.nowPlayingId?" now":""),title:o("play")+": "+n.text},m,i("span",{className:"txt"},n.text),r,l);h.addEventListener("click",()=>j(n)),O.append(h)}}let lt=0;function c(e,t=3200){L.textContent=e;const n=a.hidden?{left:16,width:0,top:window.innerHeight-60,bottom:window.innerHeight-60}:p.getBoundingClientRect(),s=Math.min(280,window.innerWidth-16);L.style.left=Math.max(8,Math.min(n.left+n.width/2-s/2,window.innerWidth-s-8))+"px",L.style.maxWidth=s+"px";const r=n.top>80;L.style.top=r?"":n.bottom+8+"px",L.style.bottom=r?window.innerHeight-n.top+8+"px":"",L.classList.add("show"),clearTimeout(lt),lt=setTimeout(()=>L.classList.remove("show"),t)}const pt=["\u{1F602}","\u{1F923}","\u{1F606}","\u{1F50A}","\u{1F389}","\u{1F639}","\u{1F4A5}","\u{1F92A}"];let ct=0;function Pt(){if(a.hidden)return;p.classList.add("playing"),clearTimeout(ct),ct=setTimeout(()=>p.classList.remove("playing"),1600);const e=p.getBoundingClientRect();for(let t=0;t<9;t++){const n=-Math.PI/2+(Math.random()-.5)*Math.PI*1.6,s=70+Math.random()*70,r=i("span",{className:"burst"},pt[Math.floor(Math.random()*pt.length)]);r.setAttribute("aria-hidden","true"),r.style.left=e.left+e.width/2-12+"px",r.style.top=e.top+e.height/2-12+"px",r.style.setProperty("--dx",Math.cos(n)*s+"px"),r.style.setProperty("--dy",Math.sin(n)*s+"px"),r.style.setProperty("--rot",(Math.random()-.5)*120+"deg"),r.style.animationDelay=t*25+"ms",x.append(r),setTimeout(()=>r.remove(),1300)}}function F(e,t){for(const s of x.querySelectorAll(t?".caption":".caption:not(.pinned)"))s.remove();if(!t&&x.querySelector(".caption.pinned"))return;if(!t&&a.settings.camCaptions===!0&&a.camLive&&K.can("captions")&&a.settings.camUnmirror!==!1&&!F.now){setTimeout(()=>{F.now=!0,Date.now()-(a.captionFixedAt||0)>800?F(e,t):t&&t.close(),F.now=!1},250);return}const n=i("div",{className:"caption"});if(t){n.classList.add("pinned"),n.setAttribute("role","dialog"),n.setAttribute("aria-label",e||o("tag_picture"));const s=i("button",{className:"picture-close",type:"button",title:o("close")},"\xD7");s.setAttribute("aria-label",o("close")),s.addEventListener("click",Y);const r=i("canvas",{className:"meme-pic",width:t.width,height:t.height});r.getContext("2d").drawImage(t,0,0),t.close(),n.append(s,r)}n.append(e),t||n.setAttribute("aria-hidden","true"),x.append(n),t||setTimeout(()=>n.remove(),3e3)}const Q=54;function ee(){const e=a.pos?a.pos.x:16,t=a.pos?a.pos.y:window.innerHeight-Q-120,n=Math.max(4,Math.min(e,window.innerWidth-Q-4)),s=Math.max(4,Math.min(t,window.innerHeight-Q-4));p.style.left=n+"px",p.style.top=s+"px",y.style.left=n+Q-18+"px",y.style.top=s-6+"px",M.style.left=n-6+"px",M.style.top=s-6+"px",g&&T()}let u=null,me=0;p.addEventListener("pointerdown",e=>{if(d({type:"resume"}),e.button!==0)return;const t=p.getBoundingClientRect();u={id:e.pointerId,sx:e.clientX,sy:e.clientY,ox:e.clientX-t.left,oy:e.clientY-t.top,moved:!1,long:!1},p.setPointerCapture(e.pointerId),me=setTimeout(()=>{u&&!u.moved&&(u.long=!0,ge())},500)}),p.addEventListener("pointermove",e=>{!u||e.pointerId!==u.id||!u.moved&&Math.hypot(e.clientX-u.sx,e.clientY-u.sy)<6||(u.moved=!0,clearTimeout(me),a.pos={x:e.clientX-u.ox,y:e.clientY-u.oy},ee())});function dt(e,t){if(!u||e.pointerId!==u.id)return;clearTimeout(me);const n=u;u=null,!t&&(n.moved?ne("buttonPos",s=>({...s&&typeof s=="object"&&!("x"in s)?s:{},[C]:a.pos})):n.long||se())}p.addEventListener("pointerup",e=>dt(e,!1)),p.addEventListener("pointercancel",e=>dt(e,!0)),p.addEventListener("click",e=>{e.detail===0&&se()}),p.addEventListener("contextmenu",e=>{e.preventDefault(),g?q():ge()}),window.addEventListener("resize",ee);let g=!1;function T(){const e=p.getBoundingClientRect(),t=Math.min(340,window.innerWidth-16);f.style.width=t+"px";const n=f.offsetHeight||400;let s=e.right+10;s+t>window.innerWidth-8&&(s=e.left-t-10),s<8&&(s=Math.max(8,Math.min(e.left,window.innerWidth-t-8)));const r=Math.min(e.top,window.innerHeight-n-8);f.style.left=s+"px",f.style.top=Math.max(8,r)+"px"}function ge(){g=!0,f.classList.add("open"),J(),T(),R.focus({preventScroll:!0});for(const e of de)try{e(!0)}catch{}}function q(){g=!1,f.classList.remove("open");for(const e of de)try{e(!1)}catch{}}Ke.addEventListener("click",q),M.addEventListener("pointerdown",()=>d({type:"resume"})),M.addEventListener("click",()=>{g?q():ge()}),$e.addEventListener("click",()=>{b.toRuntime({type:"open-options"})||V()});function he(e){b.toRuntime({type:"open-feedback",site:vt,rate:e})||V()}pe.addEventListener("click",()=>he(!1));let ft=0;function Bt(){if(a.hidden)return;const e=p.getBoundingClientRect();v.style.left=Math.max(8,Math.min(e.left,window.innerWidth-268))+"px",v.style.top="",v.style.bottom=window.innerHeight-e.top+10+"px",v.hidden=!1,clearTimeout(ft),ft=setTimeout(()=>{v.hidden=!0},3e4)}Qe.addEventListener("click",()=>{v.hidden=!0,he(!0)}),et.addEventListener("click",()=>{v.hidden=!0,he(!1)}),tt.addEventListener("click",()=>{v.hidden=!0}),Oe.addEventListener("click",se),Ve.addEventListener("click",Ne),qe.addEventListener("click",_t),He.addEventListener("click",()=>d({type:"tab-audio-stop"})),R.addEventListener("input",()=>{a.query=R.value,S()}),R.addEventListener("keydown",e=>{if(e.key==="Enter"){const t=ie()[0];t&&j(t)}});let ut=0;D.addEventListener("input",()=>{a.settings={...a.settings,volume:Number(D.value)/100},le.textContent=D.value+"%",be(),B(),clearTimeout(ut),ut=setTimeout(()=>w("volume",a.settings.volume),300)});function bt(e){a.settings={...a.settings,monitor:e},B(),rt(),w("monitor",e),c(o(e?"monitor_on":"monitor_off"))}G.addEventListener("change",()=>bt(G.checked)),y.addEventListener("pointerdown",()=>d({type:"resume"})),y.addEventListener("click",()=>bt(a.settings.monitor!==!0)),H.addEventListener("change",()=>{a.settings={...a.settings,autoDuck:H.checked},B(),w("autoDuck",H.checked)}),U.addEventListener("change",()=>Me(U.value)),_.addEventListener("change",()=>{if(_.checked&&!K.can("captions")){_.checked=!1,c(o("pro_only"));return}a.settings={...a.settings,camCaptions:_.checked},w("camCaptions",_.checked),c(_.checked?o("cam_on"):o("cam_off"))}),X.addEventListener("change",()=>{a.settings={...a.settings,camUnmirror:X.checked},w("camUnmirror",X.checked)});let mt=0;z.addEventListener("input",()=>{a.settings={...a.settings,tabVolume:Number(z.value)/100},d({type:"tab-audio-volume",value:a.settings.tabVolume}),clearTimeout(mt),mt=setTimeout(()=>w("tabVolume",a.settings.tabVolume),300)}),window.addEventListener("pointerdown",e=>{g&&!e.composedPath().includes(E)&&q()},!0);function xe(){const e=document.fullscreenElement&&document.fullscreenElement.tagName!=="VIDEO"?document.fullscreenElement:document.documentElement;E.parentNode!==e&&e.appendChild(E)}function gt(){xe(),ee(),J(),b.toRuntime({type:"query-status"}),document.addEventListener("fullscreenchange",xe),setInterval(()=>{E.isConnected||xe()},2e3)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",gt,{once:!0}):gt()})();

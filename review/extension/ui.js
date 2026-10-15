(async()=>{"use strict";if(window!==window.top||globalThis.__memeboxUi||!globalThis.MemeBridge)return;globalThis.__memeboxUi=!0;let A=null;try{A=(await chrome.storage.local.get("langPack")).langPack||null}catch{}const{TONES:ie,VOICES:C,THEMES:kt,sanitizeLine:Et}=globalThis.MEME,d=globalThis.MemeBridge,J=globalThis.MemePlan,P=location.hostname,_t=/meet\.google/.test(P)?"meet":/zoom/.test(P)?"zoom":/teams/.test(P)?"teams":/discord/.test(P)?"discord":"",o=(e,...n)=>{const t=n.map(String),s=A&&A.messages&&A.messages[e];if(s)return t.reduce((r,f,p)=>r.split("$"+(p+1)).join(f),s);try{return chrome.i18n.getMessage(e,t)||e}catch{return e}},Le=12,a={lines:MEME.defaultLines(),settings:MEME.defaultSettings(),pos:null,recent:[],frames:new Map,wasLive:!1,hidden:!1,reqId:0,pending:new Map,lastRandomId:null,nowPlayingId:null,tabAudio:!1,voice:"off",query:"",filter:"all"};function Ne(e){Array.isArray(e.lines)&&(a.lines=e.lines.map(Et).filter(Boolean)),e.settings&&typeof e.settings=="object"&&(a.settings={...MEME.defaultSettings(),...e.settings});const n=e.buttonPos&&e.buttonPos[P];n&&Number.isFinite(n.x)&&Number.isFinite(n.y)&&(a.pos=n),Array.isArray(e.recent)&&(a.recent=e.recent.filter(t=>typeof t=="string").slice(0,Le))}function Me(e){try{chrome.storage.local.set(e).catch(()=>{})}catch{}}function Q(e,n){try{chrome.storage.local.get(e).then(t=>Me({[e]:n(t[e])})).catch(()=>{})}catch{}}function w(e,n){Q("settings",t=>({...MEME.defaultSettings(),...t||{},[e]:n}))}try{chrome.storage.local.get(["lines","settings","buttonPos","recent"]).then(e=>{Ne(e),oe(),ne(),ge(a.settings.panelTab,!1),z()}).catch(()=>{}),chrome.storage.onChanged.addListener((e,n)=>{if(n!=="local")return;e.langPack&&l(o("lang_reload"));const t={};for(const r of Object.keys(e))t[r]=e[r].newValue;const s=a.settings.showStrong===!0&&a.settings.adultConfirmed===!0;if("lines"in t&&!Array.isArray(t.lines)&&(t.lines=MEME.defaultLines()),Ne(t),s&&!(a.settings.showStrong&&a.settings.adultConfirmed)&&ee(),ne(),t.settings&&t.settings.panelTab&&t.settings.panelTab!==m.dataset.tab&&ge(t.settings.panelTab,!1),"settings"in t){z();for(const r of lt)try{r()}catch{}}})}catch{}function k(){let e=null;for(const[n,t]of a.frames)t.active&&(!e||t.since>e.since)&&(e={id:n,...t});return e}function Ae(){const e=k();return e?e.ctxState!=="running"?"suspended":e.muted?"muted":"live":"none"}const Se={none:"#9aa0a6",suspended:"#f9ab00",muted:"#f9ab00",live:"#1e8e3e"};function Lt(e){if(typeof e.frameId!="number")return;const n=a.frames.get(e.frameId),t=e.active===!0,s=t&&!(n&&n.active)?Date.now():n?n.since:0;a.frames.set(e.frameId,{active:t,muted:e.muted===!0,ctxState:String(e.ctxState),since:s});const r=!!k();r&&!a.wasLive&&(d.toRuntime({type:"warmup"}),z()),!r&&a.wasLive&&(de.clear(),F()),a.wasLive=r,ct()}function H(){l(o("err_reload"))}function j(e){if(!e)return;if(!MEME.contentAllowed(e,a.settings)){l(o("adult_blocked"));return}const n=k();if(!n){l(o("join_first"));return}const t=++a.reqId;a.pending.set(t,e),setTimeout(()=>a.pending.delete(t),2e4),d.toRuntime({type:"play",frameId:n.id,reqId:t,item:e})?d.toRuntime({type:"usage-event",feature:e.pictureId?"picture":"meme",item:e.pictureId?"picture":e.kind==="sfx"?"sound-effect":e.kind==="clip"?"personal-clip":e.packId?"pack":"line"}):H()}const B=new Map;let R=0;function Nt(e){if(!a.pending.has(e.reqId))return;const n=atob(e.b64),t=new Uint8Array(n.length);for(let s=0;s<n.length;s++)t[s]=n.charCodeAt(s);B.set(e.reqId,createImageBitmap(new Blob([t],{type:e.mime})).catch(()=>null)),setTimeout(()=>{const s=B.get(e.reqId);B.delete(e.reqId),s&&s.then(r=>{r&&r.close()})},2e4)}async function se(e){const n=R,t=a.pending.get(e.reqId);a.pending.delete(e.reqId);const s=B.has(e.reqId)?await B.get(e.reqId):null;if(B.delete(e.reqId),n!==R||t&&!MEME.contentAllowed(t,a.settings)){s&&s.close();return}if(e.reason==="cancelled"){s&&s.close();return}if(e.ok){if(!I.hidden){I.hidden=!0;try{chrome.storage.local.set({startDone:!0})}catch{}}if(qt(),t){if(n!==R){s&&s.close();return}K(t.pictureId?t.pictureCaption??t.text:t.text,s),t.id!=="beep"&&Mt(t.id),a.nowPlayingId=t.id,E(),clearTimeout(se.t),se.t=setTimeout(()=>{a.nowPlayingId=null,E()},3e3)}e.muted&&l(o("muted_nobody"),6e3)}else s&&s.close(),l(e.reason==="no-call"?o("join_first"):o("err_play",e.reason))}function Mt(e){a.recent=[e,...a.recent.filter(n=>n!==e)].slice(0,Le),Me({recent:a.recent}),d.toRuntime({type:"played-one"})}function At(){if(!k()){l(o("join_first"));return}const n=++a.reqId;a.pending.set(n,{id:"beep",text:o("mic_test_caption")}),setTimeout(()=>a.pending.delete(n),2e4),u({type:"beep",reqId:n})}const Z=()=>A&&A.code?MEME.langOf(A.code):"",re=()=>Z()||MEME.langOf(navigator.language);function Ie(){const e=a.settings.lineLang;return e==="all"?null:MEME.isLang(e)?new Set([e]):Z()&&Z()!=="en"?new Set([Z()]):new Set(["en",re()])}const St=()=>{const e=a.settings.lineLang;return e==="all"||MEME.isLang(e)?e:"auto"},pe=e=>MEME.libraryLines(e,a.settings,Ie());function le(){const e=a.query.trim().toLowerCase();let n=pe(a.lines);return a.settings.panelTab==="pictures"&&(n=a.lines.filter(t=>t.pictureId&&MEME.contentAllowed(t,a.settings))),a.filter==="star"?n=n.filter(t=>t.star):a.filter==="recent"?n=a.recent.map(t=>n.find(s=>s.id===t)).filter(Boolean):a.filter!=="all"&&(n=n.filter(t=>t.category===a.filter)),e&&(n=n.filter(t=>t.text.toLowerCase().includes(e)||(t.say||"").toLowerCase().includes(e))),n}function ce(){const e=g?le():pe(a.lines),n=e.length>1?e.filter(s=>s.id!==a.lastRandomId):e;if(!n.length){l(o("no_lines"));return}const t=n[Math.floor(Math.random()*n.length)];a.lastRandomId=t.id,j(t)}function It(e){const n=a.lines.find(t=>t.fav===e);n?j(n):l(o("slot_empty",e))}function ee(){u({type:"stop"}),a.tabAudio&&u({type:"tab-audio-stop"}),F();for(const e of h.querySelectorAll(".caption"))e.remove()}function F(){R++,a.pending.clear(),d.toRuntime({type:"caption-clear"});for(const e of h.querySelectorAll(".caption.pinned"))e.remove()}function u(e){const n=k();n&&d.toRuntime({type:"to-frame",frameId:n.id,inner:{type:"hook",cmd:e}})}function z(){u({type:"volume",value:a.settings.volume}),u({type:"monitor",value:a.settings.monitor===!0}),u({type:"duck",value:a.settings.autoDuck!==!1}),u({type:"tab-audio-volume",value:a.settings.tabVolume}),u({type:"voice",value:a.voice})}function Te(e){if(Object.prototype.hasOwnProperty.call(C,e)||(e="off"),e!=="off"&&!J.can("voiceChanger")){he(),l(o("pro_only"));return}a.voice=e,e!=="off"&&d.toRuntime({type:"usage-event",feature:"voice",item:e}),e!=="off"&&a.settings.voiceLast!==e&&(a.settings={...a.settings,voiceLast:e},w("voiceLast",e)),u({type:"voice",value:e}),he(),k()?l(e==="off"?o("voice_now_off"):o("voice_now_on",C[e].emoji+" "+o("voice_"+e))):l(o("voice_after_join"))}function Tt(){const e=Object.prototype.hasOwnProperty.call(C,a.settings.voiceLast)&&a.settings.voiceLast!=="off"?a.settings.voiceLast:"chipmunk";Te(a.voice==="off"?e:"off")}function Ct(e){const n=!e.star;Q("lines",t=>(Array.isArray(t)?t:a.lines).map(s=>s.id===e.id?{...s,star:n}:s)),e.star=n,E()}function Pt(e){a.hidden=e;for(const n of[c,y,S])n.hidden=e;e&&X(),l(o(e?"ui_hidden":"ui_shown"))}d.onUiMessage=e=>{for(const n of pt)try{n(e)}catch{}if(e.type==="fx-status"&&(a.camLive=e.active===!0),e.type==="picture-position"&&[e.left,e.top,e.width,e.height].every(Number.isFinite)){a.picturePosition={left:e.left,top:e.top,width:e.width,height:e.height};return}if(e.type==="cam-caption"&&e.fixed===!0&&(a.captionFixedAt=Date.now()),e.type==="frame-status")Lt(e);else if(e.type==="play-result")se(e);else if(e.type==="tab-audio-start"&&typeof e.streamId=="string")k()?u({type:"tab-audio-start",value:e.streamId}):(d.toRuntime({type:"tab-audio-state",on:!1,error:"no-call",fromUi:!0}),l(o("join_first")));else if(e.type==="tab-audio-stop")u({type:"tab-audio-stop"});else if(e.type==="tab-audio-state"){const n=a.tabAudio;a.tabAudio=e.on===!0,Dt(),e.on?l(o("tab_on")):e.error?l(e.error==="no-call"?o("join_first"):o("tab_err",e.error)):n&&l(o("tab_off"))}else e.type==="command"&&typeof e.command=="string"?Ce(e.command):e.type==="ask-feedback"?Vt():e.type==="show-picture"&&typeof e.b64=="string"&&/^image\/(webp|png|jpeg|gif)$/.test(e.mime)&&Nt(e)};function Ce(e,n){if(!n&&je(document.activeElement))return;const t=/^fav-([1-9])$/.exec(e);t?It(Number(t[1])):e==="stop-all"?(ee(),l(o("stopped"))):e==="toggle-ui"?Pt(!a.hidden):e==="toggle-voice"&&Tt()}function Pe(e){if(!e||e.nodeType!==1)return!1;if(e.isContentEditable)return!0;const n=e.tagName;if(n==="TEXTAREA"||n==="SELECT")return!0;if(n==="INPUT")return!/^(button|checkbox|radio|range|submit|reset|color|file|image)$/i.test(e.type);const t=e.getAttribute("role");return t==="textbox"||t==="combobox"||t==="searchbox"}function je(e){for(;e;)if(e===_)e=h.activeElement;else if(e.shadowRoot&&e.shadowRoot.activeElement)e=e.shadowRoot.activeElement;else break;return Pe(e)}const Be={Digit0:"stop-all",KeyM:"toggle-ui",KeyV:"toggle-voice"};for(let e=1;e<=9;e++)Be["Digit"+e]="fav-"+e;window.addEventListener("keydown",e=>{if(e.key==="Escape"&&h.querySelector(".caption.pinned")){F(),e.preventDefault();return}if(e.key==="Escape"&&g){X();return}if(!e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;const n=Be[e.code];n&&(Pe(e.composedPath()[0])||je(document.activeElement)||(e.preventDefault(),e.stopPropagation(),Ce(n,!0)))},!0);const de=new Map,Re=e=>String(e).padStart(2,"0");setInterval(()=>{const e=a.settings;if(!e.timersEnabled||!Array.isArray(e.timers)||Ae()==="none"||!J.can("partyMode"))return;const n=new Date,t=Re(n.getHours())+":"+Re(n.getMinutes()),s=n.toDateString();for(const r of e.timers){if(!r||!r.enabled)continue;const f=a.lines.find(x=>x.id===r.lineId);if(!f)continue;const p=de.get(r.id)||{};if(de.set(r.id,p),r.mode==="clock")r.time===t&&p.day!==s&&(p.day=s,j(f));else{const x=Math.max(1,Number(r.minutes)||0)*6e4;p.base?Date.now()-p.base>=x&&(p.base=Date.now(),j(f)):p.base=Date.now()}}},1e4);const _=document.createElement("div");_.style.cssText="all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;";const h=_.attachShadow({mode:"closed"}),ze=document.createElement("style");ze.textContent=`
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
    .panel[data-tab="pictures"] details[data-page],
    .panel[data-tab="memes"] details[data-page] { display: none; }
    details[data-page] > summary { display: none; }
    details[data-page] { border-top: 0; padding-top: 0; }
    details[data-page] .settings-body { padding-top: 2px; }
    .adult-preference { font-size:11px; line-height:1.35; margin:8px 0; } .panel:not([data-tab=memes]) .adult-preference { display:none; } .pictures-tools { display:none; } .panel[data-tab="pictures"] .pictures-tools { display:grid; gap:10px; padding:10px 0; } .panel[data-tab="pictures"] :is(.chips,.langchips,.memes-row,.packs-link) { display:none; }
    .pagetabs { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:4px; }
    .ptab { min-width:0; padding:8px 2px; font-size:11px; line-height:1.2; flex-direction:column; gap:5px; overflow-wrap:anywhere; }
    .pti { line-height:18px; font-size:17px; }
    .toggle-help { display:block; font-size:11px; line-height:1.4; color:var(--p-muted); margin-top:3px; }
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
    .caption.pinned { pointer-events: auto; animation: picture-pop .25s ease-out both; padding: 8px; }
    .caption.pinned .meme-pic { display: block; margin: 0 auto 10px; max-width: min(76vw, 900px); max-height: 64vh; width: auto; height: auto;
      border-radius: 14px; box-shadow: 0 8px 26px rgba(0,0,0,.45); }
    .caption .picture-close { position: absolute; inset-block-start: 4px; inset-inline-end: 4px; width: 38px; height: 38px; border: 2px solid #fff;
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
  `;const i=(e,n={},...t)=>{const s=document.createElement(e);return Object.assign(s,n),s.append(...t),s},Oe=i("span",{className:"dot"}),c=i("button",{className:"fab",type:"button"},"\u{1F602}",Oe);c.setAttribute("aria-label",o("fab_label"));const y=i("button",{className:"mon",type:"button"},"\u{1F3A7}");y.setAttribute("aria-label",o("monitor_label"));const S=i("button",{className:"mon pickbtn",type:"button",title:o("list_btn")},"\u2630");S.setAttribute("aria-label",o("list_btn"));const De=i("span",{className:"dot"}),Ue=i("span"),qe=i("div",{className:"status"},De,Ue),O=i("input",{className:"search",type:"search",placeholder:o("search_ph")});O.setAttribute("aria-label",o("search_ph"));const Ve=i("div",{className:"chips",role:"tablist"}),Xe=i("div",{className:"chips langchips"}),He=i("button",{className:"btn",type:"button"},o("btn_random")),Fe=i("button",{className:"btn test",type:"button",title:o("btn_mic_test_tip")},o("btn_mic_test")),We=i("button",{className:"btn stop",type:"button",title:"Alt+0"},o("btn_stop_all")),D=i("input",{className:"vol",type:"range",min:0,max:200,step:5,title:o("volume")});D.setAttribute("aria-label",o("volume"));const fe=i("span",{className:"volval"}),$e=i("button",{className:"btn stop small",type:"button"},o("tab_stop")),U=i("input",{className:"vol",type:"range",min:0,max:200,step:5,title:o("tab_volume")});U.setAttribute("aria-label",o("tab_volume"));const Ye=i("div",{className:"tabbar",hidden:!0},i("span",{},o("tab_bar")),$e,i("div",{className:"row full"},i("span",{title:o("tab_volume")},"\u{1F509}"),U)),q=i("select",{className:"voice",title:o("voice_tip")},...Object.entries(C).map(([e,n])=>i("option",{value:e},`${n.emoji} ${o("voice_"+e)}`)));q.setAttribute("aria-label",o("voice_label"));const te=i("input",{type:"checkbox"}),W=i("input",{type:"checkbox"}),L=i("input",{type:"checkbox"}),$=i("input",{type:"checkbox"}),V=i("ul",{className:"list"}),Ke=i("button",{className:"chip small packs-link",type:"button",title:o("op_online_hint")},o("pk_get"));Ke.addEventListener("click",()=>api.openPacks());const Ge=i("button",{className:"chip small packs-link",type:"button",title:"Browse admin-curated video meme packs"},"\u{1F3AC} Video memes");Ge.addEventListener("click",()=>d.toRuntime({type:"open-options",hash:"meme-room",audience:a.settings.musicAudience}));const jt=i("div",{className:"row packs-link"},Ke,Ge),Je=i("button",{className:"icon",type:"button",title:o("options")},"\u2699\uFE0F"),ue=i("button",{className:"icon",type:"button",title:o("feedback")},"\u{1F4AC}");ue.setAttribute("aria-label",o("feedback"));const Qe=i("button",{className:"icon",type:"button",title:o("close")},"\u2715"),Ze=i("div",{className:"foot"}),et=i("span",{className:"sum"}),Y=i("details",{className:"settings"},i("summary",{},i("span",{},o("settings_label")),et),i("div",{className:"settings-body"},i("div",{className:"row"},i("span",{title:o("volume")},"\u{1F50A}"),D,fe),i("label",{className:"row",title:o("voice_tip")},i("span",{},o("voice_label")),q,i("span",{className:"foot"},"Alt+V")),i("div",{className:"checks"},i("label",{className:"check",title:o("monitor_tip")},te,o("monitor_label")),i("label",{className:"check",title:o("duck_tip")},W,o("duck_label")),i("label",{className:"check",title:o("cam_tip")},L,o("cam_label")),i("label",{className:"check",title:o("cam_unmirror_tip")},$,o("cam_unmirror")))));Y.addEventListener("toggle",()=>{g&&T()});const tt=i("button",{className:"btn small",type:"button"},o("st_ok")),I=i("div",{className:"start",hidden:!0},i("div",{className:"start-head"},i("strong",{},o("st_title")),tt),i("p",{},o("st_1")),i("p",{},o("st_2")),i("p",{},o("st_3")));tt.addEventListener("click",()=>{I.hidden=!0;try{chrome.storage.local.set({startDone:!0})}catch{}g&&T()});try{chrome.storage.local.get("startDone").then(e=>{I.hidden=e.startDone===!0}).catch(()=>{I.hidden=!1})}catch{I.hidden=!1}const Bt=[["memes","\u{1F602}","tab_memes"],["music","\u{1F3B5}","tab_music"],["lights","\u{1F4A1}","tab_lights"],["pictures","\u{1F5BC}","tab_pictures"],["sound","\u{1F39B}","tab_sound"]],nt=i("div",{className:"pagetabs",role:"tablist"}),me={};for(const[e,n,t]of Bt){const s=i("button",{className:"ptab",type:"button",role:"tab"},i("span",{className:"pti"},n),i("span",{},o(t)));s.dataset.tab=e,s.addEventListener("click",()=>ge(e)),me[e]=s,nt.append(s)}Y.dataset.page="sound",Y.querySelector(".settings-body").prepend(i("p",{className:"fx-how"},o("sound_help")));const at=i("button",{className:"chip",type:"button"},o("pictures_add"));at.addEventListener("click",()=>d.toRuntime({type:"open-options",hash:"pictures"}));const N=i("input",{type:"checkbox"}),Rt=i("label",{className:"check adult-preference"},N,o("adult_optin"));N.addEventListener("change",()=>{a.settings={...a.settings,showStrong:N.checked,adultConfirmed:N.checked},Q("settings",e=>({...MEME.defaultSettings(),...e,showStrong:N.checked,adultConfirmed:N.checked})),N.checked||ee(),ye(),E()});const zt=i("div",{className:"pictures-tools"},i("div",{className:"fx-how"},o("pictures_help")),at),m=i("div",{className:"panel"},i("div",{className:"head"},i("h1",{},"\u{1F602} MemeBox"),ue,Je,Qe),qe,I,nt,Rt,zt,Ye,O,Ve,Xe,i("div",{className:"row memes-row"},He,Fe,We),V,jt,Y,i("div",{className:"foot"},o("panel_foot")),Ze);m.setAttribute("role","dialog");const ot=o("text_dir")==="rtl"?"rtl":"ltr";m.dir=ot,m.setAttribute("aria-label","MemeBox");const M=i("div",{className:"toast",role:"status"}),it=i("button",{className:"btn",type:"button"},o("ask_rate")),st=i("button",{className:"btn test",type:"button"},o("ask_feedback")),rt=i("button",{className:"icon x",type:"button",title:o("close")},"\u2715"),v=i("div",{className:"ask",hidden:!0,role:"dialog"},i("b",{},o("ask_title")),i("div",{className:"row"},it,st),rt);v.setAttribute("aria-label",o("ask_title")),v.dir=ot,h.append(ze,c,y,S,m,v,M);const be=[],pt=[],lt=[],Ot={el:i,t:o,settingsDetails:Y,panel:m,getSettings:()=>a.settings,setLocal:(e,n)=>{a.settings={...a.settings,[e]:n}},saveSetting:(e,n)=>w(e,n),placePanel:()=>T(),panelIsOpen:()=>g,openPacks:()=>{d.toRuntime({type:"open-options",hash:"online"})||H()},openSite:e=>{const n=(MEMEBOX_CONFIG.SITE_URL||"").startsWith("http://127.0.0.1:")||MEMEBOX_CONFIG.SHOP_OPEN===!1;d.toRuntime(n&&["/buy","/pricing"].includes(e)?{type:"open-options",hash:"plans"}:{type:"open-site",path:e})||H()},inCall:()=>!!k(),frameId:()=>{const e=k();return e?e.id:null},ask:e=>d.ask(e),clipCount:()=>a.lines.filter(e=>e.kind==="clip").length,LIMITS:MEME.LIMITS,toast:(e,n)=>l(e,n),sendToHook:e=>u(e),send:e=>d.toRuntime(e),onPanelToggle:e=>be.push(e),onMessage:e=>pt.push(e),onSettings:e=>lt.push(e)};for(const e of globalThis.MemeUiMounts||[])try{e(Ot)}catch{}function ge(e,n=!0){me[e]||(e="memes"),m.dataset.tab=e,a.settings={...a.settings,panelTab:e},e==="pictures"&&(a.filter="all"),E();for(const[t,s]of Object.entries(me))s.classList.toggle("on",t===e),s.setAttribute("aria-selected",String(t===e));for(const t of m.querySelectorAll("details[data-page]")){const s=t.dataset.page===e;t.open!==s&&(t.open=s)}m.classList.toggle("fx-open",e==="lights"||e==="music"),n&&(a.settings={...a.settings,panelTab:e},w("panelTab",e)),g&&T()}m.dataset.tab="memes";function ne(){const e=a.settings.theme;_.dataset.theme=Object.prototype.hasOwnProperty.call(kt,e)?e:"auto",ct(),ye(),E(),ft(),he()}function he(){q.value=a.voice,q.classList.toggle("on",a.voice!=="off"),xe()}function xe(){N.checked=a.settings.showStrong===!0&&a.settings.adultConfirmed===!0;const e=Math.round((Number(a.settings.volume)||0)*100),n=C[a.voice]||C.off;et.textContent=`\u{1F50A} ${e}% \xB7 ${n.emoji} ${o("voice_"+a.voice)}`}function ct(){const e=Ae();Oe.style.background=Se[e],De.style.background=Se[e],Ue.textContent=(e==="muted"?"\u{1F507} ":"")+o("st_"+e),qe.classList.toggle("warn",e==="muted"||e==="none"),c.classList.toggle("muted",e==="muted"),c.title="MemeBox: "+o("st_"+e)+`
`+o("fab_tip")}function Dt(){Ye.hidden=!a.tabAudio,g&&T()}function Ut(e){const n=o("cat_"+e);return n==="cat_"+e?e:n}function dt(){const e=St(),n=Ie(),t=p=>{a.settings={...a.settings,lineLang:p},w("lineLang",p),MEME.isLang(p)&&d.toRuntime({type:"add-lang-lines",lang:p}),dt(),E()},s=["en",re(),"hi"].filter((p,x,G)=>G.indexOf(p)===x),r=(p,x)=>{const G=e==="auto"?p==="all"?!n:!!n&&n.has(p)&&p===re():p===e,_e=i("button",{className:"chip small"+(G?" on":""),type:"button"},x);return _e.dataset.lang=p,_e.addEventListener("click",()=>t(p)),_e},f=i("select",{className:"chip small lang-more",title:o("chip_lang_more")},i("option",{value:""},o("chip_lang_more")),...Object.entries(MEME.LANGS).map(([p,x])=>i("option",{value:p},x)));f.addEventListener("change",()=>{f.value&&t(f.value)}),MEME.isLang(e)&&!s.includes(e)&&(f.value=e,f.classList.add("on")),Xe.replaceChildren(r("all",o("chip_lang_all")),...s.map(p=>r(p,MEME.LANGS[p])),f)}function ye(){dt();const e=[...new Set(pe(a.lines).map(t=>t.category).filter(Boolean))],n=[["all",o("chip_all")],["star","\u2B50 "+o("chip_star")],["recent","\u{1F558} "+o("chip_recent")],...e.map(t=>[t,Ut(t)])];n.some(([t])=>t===a.filter)||(a.filter="all"),Ve.replaceChildren(...n.map(([t,s])=>{const r=i("button",{className:"chip"+(t===a.filter?" on":""),type:"button",role:"tab"},s);return r.setAttribute("aria-selected",String(t===a.filter)),r.addEventListener("click",()=>{a.filter=t,ye(),E()}),r}))}function ft(){const e=Math.round((Number(a.settings.volume)||0)*100);D.value=e,fe.textContent=e+"%",xe();const n=a.settings.monitor===!0;te.checked=n,W.checked=a.settings.autoDuck!==!1,L.checked=a.settings.camCaptions===!0,$.checked=a.settings.camUnmirror!==!1,(!h.activeElement||h.activeElement!==U)&&(U.value=Math.round((Number(a.settings.tabVolume??1)||0)*100)),y.textContent=n?"\u{1F3A7}":"\u{1F507}",y.classList.toggle("off",!n),y.title=o(n?"monitor_on_tip":"monitor_off_tip"),y.setAttribute("aria-pressed",String(n));const t=a.settings,s=Array.isArray(t.timers)?t.timers.filter(r=>r&&r.enabled).length:0;Ze.textContent=t.timersEnabled&&s?o("timers_on",s):""}function E(){const e=le(),n=V.scrollTop;if(queueMicrotask(()=>{V.scrollTop=n}),V.replaceChildren(),!e.length){const t=a.settings.panelTab==="pictures"?o("pictures_empty"):a.filter==="star"?o("empty_star"):a.filter==="recent"?o("empty_recent"):a.lines.length?o("empty_search"):o("no_lines");V.append(i("li",{className:"empty"},t));return}for(const t of e){const s=ie[t.tone]||ie.normal,r=i("span",{className:"tags"},t.kind!=="tts"?i("span",{className:"tag",title:o(t.kind==="sfx"?"tag_sfx":"tag_clip")},"\u{1F3B5}"):i("span",{className:"tag",title:o("tag_lang")},t.lang.toUpperCase()),i("span",{title:o("tone_"+(ie[t.tone]?t.tone:"normal"))},s.emoji));t.pictureId&&r.prepend(i("span",{className:"tag",title:o("tag_picture")},"\u{1F5BC}")),t.fav&&r.append(i("span",{className:"tag",title:o("tag_shortcut")},"Alt+"+t.fav));const f=i("button",{className:"play",type:"button",title:o("play")},"\u25B6");f.setAttribute("aria-label",o("play")+": "+t.text);const p=i("button",{className:"star"+(t.star?" on":""),type:"button",title:t.star?o("unstar"):o("star")},t.star?"\u2605":"\u2606");p.setAttribute("aria-pressed",String(!!t.star)),p.addEventListener("click",G=>{G.stopPropagation(),Ct(t)});const x=i("li",{className:"pick"+(t.id===a.nowPlayingId?" now":""),title:o("play")+": "+t.text},f,i("span",{className:"txt"},t.pictureId?t.pictureCaption||t.say||o("tag_picture"):t.text),r,p);x.addEventListener("click",()=>j(t)),V.append(x)}}let ut=0;function l(e,n=3200){M.textContent=e;const t=a.hidden?{left:16,width:0,top:window.innerHeight-60,bottom:window.innerHeight-60}:c.getBoundingClientRect(),s=Math.min(280,window.innerWidth-16);M.style.left=Math.max(8,Math.min(t.left+t.width/2-s/2,window.innerWidth-s-8))+"px",M.style.maxWidth=s+"px";const r=t.top>80;M.style.top=r?"":t.bottom+8+"px",M.style.bottom=r?window.innerHeight-t.top+8+"px":"",M.classList.add("show"),clearTimeout(ut),ut=setTimeout(()=>M.classList.remove("show"),n)}const mt=["\u{1F602}","\u{1F923}","\u{1F606}","\u{1F50A}","\u{1F389}","\u{1F639}","\u{1F4A5}","\u{1F92A}"];let bt=0;function qt(){if(a.hidden)return;c.classList.add("playing"),clearTimeout(bt),bt=setTimeout(()=>c.classList.remove("playing"),1600);const e=c.getBoundingClientRect();for(let n=0;n<9;n++){const t=-Math.PI/2+(Math.random()-.5)*Math.PI*1.6,s=70+Math.random()*70,r=i("span",{className:"burst"},mt[Math.floor(Math.random()*mt.length)]);r.setAttribute("aria-hidden","true"),r.style.left=e.left+e.width/2-12+"px",r.style.top=e.top+e.height/2-12+"px",r.style.setProperty("--dx",Math.cos(t)*s+"px"),r.style.setProperty("--dy",Math.sin(t)*s+"px"),r.style.setProperty("--rot",(Math.random()-.5)*120+"deg"),r.style.animationDelay=n*25+"ms",h.append(r),setTimeout(()=>r.remove(),1300)}}function K(e,n){for(const s of h.querySelectorAll(n?".caption":".caption:not(.pinned)"))s.remove();if(!n&&h.querySelector(".caption.pinned"))return;if(n&&a.settings.camCaptions===!0&&a.camLive&&a.picturePosition){const s=a.picturePosition;n.close();const r=i("div",{className:"caption pinned camera-picture-close"});r.style.cssText="left:"+Math.max(24,Math.min(innerWidth-24,s.left+s.width-24))+"px;top:"+Math.max(8,s.top+8)+"px;padding:0;width:38px;height:38px;background:transparent;box-shadow:none;";const f=i("button",{className:"picture-close",type:"button",title:o("close")},"\xD7");f.setAttribute("aria-label",o("close")),f.addEventListener("click",F),r.append(f),h.append(r);return}if(a.settings.camCaptions===!0&&a.camLive&&J.can("captions")&&a.settings.camUnmirror!==!1&&!K.now){const s=R;setTimeout(()=>{s===R&&(K.now=!0,Date.now()-(a.captionFixedAt||0)>800?K(e,n):n&&n.close(),K.now=!1)},250);return}const t=i("div",{className:"caption"});if(n){t.classList.add("pinned"),t.setAttribute("role","dialog"),t.setAttribute("aria-label",e||o("tag_picture"));const s=i("button",{className:"picture-close",type:"button",title:o("close")},"\xD7");s.setAttribute("aria-label",o("close")),s.addEventListener("click",F);const r=i("canvas",{className:"meme-pic",width:n.width,height:n.height});r.getContext("2d").drawImage(n,0,0),n.close(),t.append(s,r)}t.append(e),n||t.setAttribute("aria-hidden","true"),h.append(t),n||setTimeout(()=>t.remove(),3e3)}const ae=54;function oe(){const e=a.pos?a.pos.x:16,n=a.pos?a.pos.y:window.innerHeight-ae-120,t=Math.max(4,Math.min(e,window.innerWidth-ae-4)),s=Math.max(4,Math.min(n,window.innerHeight-ae-4));c.style.left=t+"px",c.style.top=s+"px",y.style.left=t+ae-18+"px",y.style.top=s-6+"px",S.style.left=t-6+"px",S.style.top=s-6+"px",g&&T()}let b=null,ve=0;c.addEventListener("pointerdown",e=>{if(u({type:"resume"}),e.button!==0)return;const n=c.getBoundingClientRect();b={id:e.pointerId,sx:e.clientX,sy:e.clientY,ox:e.clientX-n.left,oy:e.clientY-n.top,moved:!1,long:!1},c.setPointerCapture(e.pointerId),ve=setTimeout(()=>{b&&!b.moved&&(b.long=!0,we())},500)}),c.addEventListener("pointermove",e=>{!b||e.pointerId!==b.id||!b.moved&&Math.hypot(e.clientX-b.sx,e.clientY-b.sy)<6||(b.moved=!0,clearTimeout(ve),a.pos={x:e.clientX-b.ox,y:e.clientY-b.oy},oe())});function gt(e,n){if(!b||e.pointerId!==b.id)return;clearTimeout(ve);const t=b;b=null,!n&&(t.moved?Q("buttonPos",s=>({...s&&typeof s=="object"&&!("x"in s)?s:{},[P]:a.pos})):t.long||ce())}c.addEventListener("pointerup",e=>gt(e,!1)),c.addEventListener("pointercancel",e=>gt(e,!0)),c.addEventListener("click",e=>{e.detail===0&&ce()}),c.addEventListener("contextmenu",e=>{e.preventDefault(),g?X():we()}),window.addEventListener("resize",oe);let g=!1;function T(){const e=c.getBoundingClientRect(),n=Math.min(340,window.innerWidth-16);m.style.width=n+"px";const t=m.offsetHeight||400;let s=e.right+10;s+n>window.innerWidth-8&&(s=e.left-n-10),s<8&&(s=Math.max(8,Math.min(e.left,window.innerWidth-n-8)));const r=Math.min(e.top,window.innerHeight-t-8);m.style.left=s+"px",m.style.top=Math.max(8,r)+"px"}function we(){g=!0,m.classList.add("open"),ne(),T(),O.focus({preventScroll:!0});for(const e of be)try{e(!0)}catch{}}function X(){g=!1,m.classList.remove("open");for(const e of be)try{e(!1)}catch{}}Qe.addEventListener("click",X),S.addEventListener("pointerdown",()=>u({type:"resume"})),S.addEventListener("click",()=>{g?X():we()}),Je.addEventListener("click",()=>{d.toRuntime({type:"open-options"})||H()});function ke(e){d.toRuntime({type:"open-feedback",site:_t,rate:e})||H()}ue.addEventListener("click",()=>ke(!1));let ht=0;function Vt(){if(a.hidden)return;const e=c.getBoundingClientRect();v.style.left=Math.max(8,Math.min(e.left,window.innerWidth-268))+"px",v.style.top="",v.style.bottom=window.innerHeight-e.top+10+"px",v.hidden=!1,clearTimeout(ht),ht=setTimeout(()=>{v.hidden=!0},3e4)}it.addEventListener("click",()=>{v.hidden=!0,ke(!0)}),st.addEventListener("click",()=>{v.hidden=!0,ke(!1)}),rt.addEventListener("click",()=>{v.hidden=!0}),He.addEventListener("click",ce),We.addEventListener("click",ee),Fe.addEventListener("click",At),$e.addEventListener("click",()=>u({type:"tab-audio-stop"})),O.addEventListener("input",()=>{a.query=O.value,E()}),O.addEventListener("keydown",e=>{if(e.key==="Enter"){const n=le()[0];n&&j(n)}});let xt=0;D.addEventListener("input",()=>{a.settings={...a.settings,volume:Number(D.value)/100},fe.textContent=D.value+"%",xe(),z(),clearTimeout(xt),xt=setTimeout(()=>w("volume",a.settings.volume),300)});function yt(e){a.settings={...a.settings,monitor:e},z(),ft(),w("monitor",e),l(o(e?"monitor_on":"monitor_off"))}te.addEventListener("change",()=>yt(te.checked)),y.addEventListener("pointerdown",()=>u({type:"resume"})),y.addEventListener("click",()=>yt(a.settings.monitor!==!0)),W.addEventListener("change",()=>{a.settings={...a.settings,autoDuck:W.checked},z(),w("autoDuck",W.checked)}),q.addEventListener("change",()=>Te(q.value)),L.addEventListener("change",()=>{if(L.checked&&!J.can("captions")){L.checked=!1,l(o("pro_only"));return}a.settings={...a.settings,camCaptions:L.checked},w("camCaptions",L.checked),l(L.checked?o("cam_on"):o("cam_off"))}),$.addEventListener("change",()=>{a.settings={...a.settings,camUnmirror:$.checked},w("camUnmirror",$.checked)});let vt=0;U.addEventListener("input",()=>{a.settings={...a.settings,tabVolume:Number(U.value)/100},u({type:"tab-audio-volume",value:a.settings.tabVolume}),clearTimeout(vt),vt=setTimeout(()=>w("tabVolume",a.settings.tabVolume),300)}),window.addEventListener("pointerdown",e=>{g&&!e.composedPath().includes(_)&&X()},!0);function Ee(){const e=document.fullscreenElement&&document.fullscreenElement.tagName!=="VIDEO"?document.fullscreenElement:document.documentElement;_.parentNode!==e&&e.appendChild(_)}function wt(){Ee(),oe(),ne(),d.toRuntime({type:"query-status"}),document.addEventListener("fullscreenchange",Ee),setInterval(()=>{_.isConnected||Ee()},2e3)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",wt,{once:!0}):wt()})();

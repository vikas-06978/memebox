// MemeBox: mic hook (runs in the page's MAIN world at document_start).
//
// Wraps getUserMedia so that every audio track the call site receives is a mix of
//   real microphone -> micGain -> destination
//   soundboard      ------------> destination
// Meme audio is played into the soundboard node, so it goes out through the
// user's "microphone" to everyone in the call. It reaches the user's own
// speakers only through the optional "monitor" node (the panel's 🎧 toggle).
// Nothing is recorded or sent
// anywhere by this script. It only rewires audio inside this tab.
(() => {
  'use strict';

  const HOOK = 'memebox-hook-9c1e';     // `source` of messages we send
  const BRIDGE = 'memebox-bridge-9c1e'; // `source` of messages we accept

  if (window.__memeboxHook) return;
  if (typeof MediaDevices === 'undefined' || !MediaDevices.prototype.getUserMedia) return;
  Object.defineProperty(window, '__memeboxHook', { value: true });

  const LOG = '[MemeBox]';
  const MONITOR_LEVEL = 0.3; // how loud you hear memes yourself when "monitor" is on
  const origGetUserMedia = MediaDevices.prototype.getUserMedia;
  const trackProto = MediaStreamTrack.prototype;
  const enabledDesc = Object.getOwnPropertyDescriptor(trackProto, 'enabled');
  const origStop = trackProto.stop;
  const origClone = trackProto.clone;
  const Shifter = window.MemePitchShifter; // lib/pitch-shift.js (voice changer fallback)

  let ctx = null;   // one AudioContext per frame, shared by all sessions
  let board = null; // the soundboard GainNode (meme volume)
  let volume = 1;
  let monitor = null;     // optional quiet copy to your own speakers (off by default)
  let monitorOn = false;
  let voiceFx = 'off';      // live voice changer on YOUR voice
  let camCaptions = false;  // draw meme text onto your own camera (set from settings by the bridge)
  let fxCfg = null;         // Lights & looks (lib/fx.js), already limited to what this person may use; null = never set
  let fxMeter = null;       // listens to the sounds being played, so the lights can follow them
  let fxMood = '';          // the mood of the sound that played last (suspense, excited, ...)
  let fxMoodAt = 0;
  let fxLevel = 0;
  let fxAvg = 0;
  const sessions = new Set();
  const mixedTracks = new WeakSet(); // tracks we produced (and their clones)
  const playing = new Set();

  // ---------- messaging ----------

  function post(msg, transfer) {
    window.postMessage({ ...msg, source: HOOK }, '*', transfer || []);
  }

  function isActive() {
    for (const s of sessions) if (s.realAudio.readyState === 'live') return true;
    return false;
  }

  // Muted = every live mixed track has been disabled by the call site.
  function isMuted() {
    let live = false;
    for (const s of sessions) {
      if (s.realAudio.readyState !== 'live') continue;
      for (const t of s.tracks) {
        live = true;
        if (enabledDesc.get.call(t)) return false;
      }
    }
    return live;
  }

  function announce() {
    post({ type: 'status', active: isActive(), muted: isMuted(), ctxState: ctx ? ctx.state : 'none' });
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || typeof d !== 'object' || d.source !== BRIDGE) return;
    switch (d.type) {
      case 'query-status': announce(); break;
      case 'beep': play(d.reqId, beep, '(test beep)'); break;
      case 'play-audio': playAudio(d); break;
      case 'stop': stopAll(); stopMusic(); clearCamCaption(); break;
      case 'music-play': startMusic(String(d.value), d.volume); break;
      case 'music-bytes': startMine(d); break;
      case 'music-stop': stopMusic(); break;
      case 'music-volume': if (musicPlayer) musicPlayer.setVolume(d.value); musicVolume = clamp(d.value, 0, 1, 0.5); if (mineGain) mineGain.gain.setTargetAtTime(musicVolume, ctx.currentTime, 0.05); break;
      case 'volume': setVolume(d.value); break;
      case 'duck': setDuck(d.value !== false); break;
      case 'monitor': setMonitor(d.value === true); break;
      case 'resume': if (ctx && ctx.state !== 'running') ctx.resume().then(announce, () => {}); break;
      case 'tab-audio-start': startTabAudio(d.value); break;
      case 'tab-audio-stop': stopTabAudio(); break;
      case 'tab-audio-volume': setTabVolume(d.value); break;
      case 'voice': setVoice(String(d.value), d.url); break;
      case 'cam-captions': camCaptions = d.value === true; camUnmirror = d.unmirror !== false; if (!camCaptions) clearCamCaption(); break;
      case 'caption-clear': clearCamCaption(); break;
      case 'face-result': { // where the face is, how it looks (blendshapes 0..1), and raised hands (every other result)
        const n = performance.now(), prev = faceMl;
        if (faceBusy) { const rt = n - faceBusy; faceMs = faceMs ? faceMs * 0.7 + rt * 0.3 : rt; }
        faceBusy = 0; faceTimes.push(n); while (faceTimes.length && n - faceTimes[0] > 2000) faceTimes.shift();
        const num = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
        const bs = d.bs && typeof d.bs === 'object' ? Object.fromEntries(['blinkL', 'blinkR', 'jaw', 'smile', 'tongue', 'brow', 'pucker', 'wide'].map((k) => [k, num(d.bs[k])])) : null;
        const hands = Array.isArray(d.hands) ? d.hands.slice(0, 2).map((h) => ({ x: num(h.x), y: num(h.y), s: num(h.s), n: Number(h.n) || 0, open: h.open === true, thumbUp: h.thumbUp === true, peace: h.peace === true, ok: h.ok === true, fingerHeart: h.fingerHeart === true, rock: h.rock === true, callMe: h.callMe === true, heart2: h.heart2 === true })) : null;
        faceMl = { at: n, face: d.face && Number.isFinite(d.face.x) && Number.isFinite(d.face.y) ? { x: d.face.x, y: d.face.y, w: Number(d.face.w) || 0, h: Number(d.face.h) || 0, pose: d.face.pose && Number.isFinite(d.face.pose.yaw) && Number.isFinite(d.face.pose.pitch) ? { yaw: d.face.pose.yaw, pitch: d.face.pose.pitch } : null } : null, bs, hands: hands || (prev ? prev.hands : null), handsAt: hands ? n : (prev ? prev.handsAt : -1e9) };
        break; }
      case 'fx-config': fxCfg = globalThis.MemeFx ? globalThis.MemeFx.sanitize(d.value) : null; break;
    }
  });

  // ---------- audio graph ----------

  function ensureCtx() {
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: 'interactive' });
      board = ctx.createGain();
      board.gain.value = volume;
      fxMeter = ctx.createAnalyser(); // reads the level of what is played (not your voice)
      fxMeter.fftSize = 512;
      board.connect(fxMeter);
      ctx.addEventListener('statechange', announce);
      setMonitor(monitorOn);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // Autoplay policy may start the context suspended. The first user gesture fixes it.
  const resumeOnGesture = () => {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    ensureWrapped('user gesture');
  };
  window.addEventListener('pointerdown', resumeOnGesture, true);
  window.addEventListener('keydown', resumeOnGesture, true);

  function syncEnabled(s) {
    let anyEnabled = false;
    for (const t of s.tracks) if (enabledDesc.get.call(t)) anyEnabled = true;
    if (s.realAudio.readyState === 'live') s.realAudio.enabled = anyEnabled;
  }

  // Make a mixed track behave like the real mic track it replaces.
  function wrapTrack(t, s) {
    s.tracks.add(t);
    Object.defineProperties(t, {
      enabled: {
        configurable: true,
        get() { return enabledDesc.get.call(t); },
        set(v) { enabledDesc.set.call(t, v); syncEnabled(s); announce(); },
      },
      label: { configurable: true, get: () => s.realAudio.label },
    });
    t.stop = function stop() {
      origStop.call(t);
      s.tracks.delete(t);
      if (!s.tracks.size) closeSession(s);
      else syncEnabled(s);
    };
    t.clone = function clone() {
      const c = origClone.call(t);
      wrapTrack(c, s);
      mixedTracks.add(c);
      return c;
    };
    t.getSettings = () => ({ ...s.realAudio.getSettings() });
    t.getCapabilities = () => (s.realAudio.getCapabilities ? s.realAudio.getCapabilities() : {});
    t.getConstraints = () => s.realAudio.getConstraints();
    t.applyConstraints = (c) => s.realAudio.applyConstraints(c);
  }

  function closeSession(s) {
    if (s.closed) return;
    s.closed = true;
    if (s.chain) s.chain.stop();
    try { s.src.disconnect(); } catch {}
    try { s.mic.disconnect(); } catch {}
    try { board.disconnect(s.dest); } catch {}
    if (s.realAudio.readyState === 'live') origStop.call(s.realAudio);
    sessions.delete(s);
    if (!isActive()) stopTabAudio(); // left the call
    announce();
  }

  function mix(realStream) {
    const realAudio = realStream.getAudioTracks()[0];
    if (!realAudio) return realStream;
    ensureCtx();

    const src = ctx.createMediaStreamSource(new MediaStream([realAudio]));
    const mic = ctx.createGain();
    const dest = ctx.createMediaStreamDestination();
    src.connect(mic).connect(dest); // the voice changer, when on, sits between src and mic
    board.connect(dest);
    const meter = ctx.createAnalyser(); // for auto-duck (reads the real voice level)
    meter.fftSize = 1024;
    src.connect(meter);

    const s = { realAudio, src, mic, dest, meter, tracks: new Set(), closed: false, chain: null, fx: 'off' };
    const out = dest.stream.getAudioTracks()[0];
    wrapTrack(out, s);
    mixedTracks.add(out);
    enabledDesc.set.call(out, realAudio.enabled);
    sessions.add(s);

    // Real mic went away (unplugged, permission revoked): end our tracks too.
    realAudio.addEventListener('ended', () => {
      for (const t of [...s.tracks]) {
        origStop.call(t);
        t.dispatchEvent(new Event('ended'));
      }
      s.tracks.clear();
      closeSession(s);
    });

    console.log(LOG, 'mic intercepted, track', out.id, `(real mic: "${realAudio.label}" ${realAudio.id})`);
    if (voiceFx !== 'off') setVoice(voiceFx); // the call asked for the mic again: keep the voice
    announce();
    return new MediaStream([out, ...realStream.getVideoTracks()]);
  }

  const wrappers = new WeakSet(); // our getUserMedia wrappers

  function makeGetUserMedia(original) {
    const wrapped = function getUserMedia(constraints) {
      const p = original.call(this, constraints);
      const audio = !!(constraints && constraints.audio);
      const video = !!(constraints && constraints.video) && camWanted();
      if (!audio && !video) return p;
      return p.then((stream) => {
        let out = stream;
        // Already mixed (a site wrapper around ours called us): never mix twice.
        if (audio && !stream.getAudioTracks().some((t) => mixedTracks.has(t))) {
          try {
            out = mix(stream);
          } catch (err) {
            // Never break the call: hand back the plain real microphone.
            console.warn(LOG, 'could not mix microphone, using the plain mic', err);
          }
        }
        if (video) {
          try {
            out = withEffectsVideo(out);
          } catch (err) {
            console.warn(LOG, 'could not add camera effects, using the plain camera', err);
          }
        }
        return out;
      });
    };
    wrappers.add(wrapped);
    return wrapped;
  }

  MediaDevices.prototype.getUserMedia = makeGetUserMedia(origGetUserMedia);

  // Some sites replace getUserMedia later (their own wrappers, SDK updates). Whenever the
  // devices change (or on the next gesture), make sure ours is still in the chain.
  function ensureWrapped(reason) {
    const md = navigator.mediaDevices;
    if (!md) return;
    const own = Object.prototype.hasOwnProperty.call(md, 'getUserMedia');
    const current = own ? md.getUserMedia : MediaDevices.prototype.getUserMedia;
    if (typeof current !== 'function' || wrappers.has(current)) return;
    const rewrapped = makeGetUserMedia(current);
    if (own) md.getUserMedia = rewrapped;
    else MediaDevices.prototype.getUserMedia = rewrapped;
    console.log(LOG, 're-wrapped getUserMedia after', reason);
  }

  if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      console.log(LOG, 'devices changed, the call will ask for the mic again and it will be re-mixed');
      ensureWrapped('devicechange');
    });
  }

  // Sites can grab an untouched getUserMedia from a fresh same-origin iframe
  // (about:blank / srcdoc), where content scripts may not have run yet. Patch
  // those windows the moment the page reaches into them, and mix into OUR
  // AudioContext so the memes still land in that stream.
  function patchRealm(win) {
    try {
      if (!win || win === window || win.__memeboxHook) return;
      const MD = win.MediaDevices;
      if (!MD || !MD.prototype.getUserMedia) return;
      Object.defineProperty(win, '__memeboxHook', { value: true });
      MD.prototype.getUserMedia = makeGetUserMedia(MD.prototype.getUserMedia);
    } catch {
      // Cross-origin frame: it gets its own copy of this script if it's a call site.
    }
  }

  for (const [proto, prop, toWin] of [
    [HTMLIFrameElement.prototype, 'contentWindow', (v) => v],
    [HTMLIFrameElement.prototype, 'contentDocument', (v) => v && v.defaultView],
  ]) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc || !desc.get) continue;
    Object.defineProperty(proto, prop, {
      ...desc,
      get() {
        const v = desc.get.call(this);
        patchRealm(toWin(v));
        return v;
      },
    });
  }

  // ---------- playback into the soundboard ----------

  async function play(reqId, starter, label, caption, picture) {
    if (!isActive() || !ctx) {
      post({ type: 'played', reqId, ok: false, reason: 'no-call' });
      return;
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    try {
      const node = await starter();
      stopAll(); // one meme at a time
      playing.add(node);
      duckTick(true); // if you're already talking, start the meme ducked (no loud first moment)
      startDuckWatch();
      node.start();
      node.addEventListener('ended', () => playing.delete(node));
      if (caption || picture) showCamCaption(caption || '', picture);
      console.log(LOG, 'playing into mic:', label, `(${sessions.size} mic stream${sessions.size === 1 ? '' : 's'}, context ${ctx.state})`);
      post({ type: 'played', reqId, ok: true, muted: isMuted() });
    } catch (err) {
      post({ type: 'played', reqId, ok: false, reason: String((err && err.message) || err) });
    }
  }

  function clamp(v, lo, hi, dflt) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  }

  // WAV/MP3/OGG bytes -> BufferSource (not started) wired into the soundboard.
  function playAudio(d) {
    fxMood = typeof d.mood === 'string' ? d.mood : '';
    fxMoodAt = performance.now();
    play(d.reqId, async () => {
      if (!(d.bytes instanceof ArrayBuffer)) throw new Error('No audio data');
      const buffer = await ctx.decodeAudioData(d.bytes);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = clamp(d.playbackRate, 0.25, 4, 1);
      const out = ctx.createGain();
      out.gain.value = clamp(d.gain, 0, 3, 1);
      const cleanup = [out];

      if (d.effect === 'robot') {
        // Ring modulator plus a little dry signal = classic robot voice.
        const ring = ctx.createGain();
        ring.gain.value = 0;
        const osc = ctx.createOscillator();
        osc.frequency.value = 55;
        osc.connect(ring.gain);
        osc.start();
        const dry = ctx.createGain();
        dry.gain.value = 0.35;
        src.connect(ring).connect(out);
        src.connect(dry).connect(out);
        cleanup.push(ring, dry, osc);
        src.addEventListener('ended', () => osc.stop());
      } else {
        src.connect(out);
      }
      out.connect(board);
      src.addEventListener('ended', () => cleanup.forEach((n) => n.disconnect()));
      return src;
    }, String(d.text || '(audio)'), String(d.text || ''),
    d.picture instanceof ArrayBuffer && /^image\/(webp|png|jpeg|gif)$/.test(d.pictureType) ? { bytes: d.picture, type: d.pictureType } : null);
  }

  // Test sound: a short two-tone "ding-dong".
  function beep() {
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.02);
    g.gain.setValueAtTime(0.5, t + 0.5);
    g.gain.linearRampToValueAtTime(0, t + 0.6);
    g.connect(board);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(660, t + 0.25);
    o.connect(g);
    // play() calls start() without arguments, so schedule the stop at the same time.
    const start = o.start;
    o.start = () => { start.call(o, t); o.stop(t + 0.62); };
    o.addEventListener('ended', () => g.disconnect());
    return o;
  }

  function stopAll() {
    for (const n of playing) { try { n.stop(); } catch {} }
    playing.clear();
  }

  function setVolume(v) {
    volume = Math.min(2, Math.max(0, Number(v) || 0));
    applyBoardGain(0.02);
  }

  // ---------- music: original tunes (lib/music.js) played into the mic ----------
  // It goes through the same soundboard as the memes, so it gets quieter while you talk (auto-duck),
  // and the lights and characters follow it (a mood per tune). "Stop all" stops it too.
  let musicPlayer = null;
  let musicVolume = 0.5;
  let musicMoodTimer = 0;
  const MUSIC_MOOD = { funky: 'fun', party: 'excited', suspense: 'suspense', retro: 'fun', jazz: 'fun', epic: 'suspense', tropical: 'excited', disco: 'fun', club: 'excited', bass: 'excited', desi: 'excited', house: 'fun' };

  function startMusic(id, vol) {
    if (!globalThis.MemeMusic || !MemeMusic.TUNES[id] || !isActive() || !ctx) { post({ type: 'music-state', id: '' }); return; }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!musicPlayer) musicPlayer = MemeMusic.createPlayer(ctx, board);
    musicVolume = clamp(vol, 0, 1, musicVolume);
    musicPlayer.setVolume(musicVolume);
    musicPlayer.play(id);
    const mood = MUSIC_MOOD[id] || '';
    clearInterval(musicMoodTimer);
    musicMoodTimer = setInterval(() => { if (mood) { fxMood = mood; fxMoodAt = performance.now(); } }, 3000);
    if (mood) { fxMood = mood; fxMoodAt = performance.now(); }
    duckTick(true);
    startDuckWatch();
    post({ type: 'music-state', id });
  }

  function stopMusic() {
    clearInterval(musicMoodTimer);
    let was = false;
    if (musicPlayer && musicPlayer.playing) { musicPlayer.stop(); was = true; }
    if (mineSrc) {
      try { mineSrc.stop(); } catch { /* already stopped */ }
      try { mineSrc.disconnect(); mineGain.disconnect(); } catch { /* already gone */ }
      mineSrc = null; mineGain = null; was = true;
    }
    if (was) post({ type: 'music-state', id: '' });
  }

  // The person's own music (added from the panel): a whole track, repeated until stopped. Same soundboard,
  // so auto-duck, "Stop all", the lights and the characters all work with it.
  let mineSrc = null;
  let mineGain = null;
  async function startMine(d) {
    if (!isActive() || !ctx || !(d.bytes instanceof ArrayBuffer)) { post({ type: 'music-state', id: '' }); return; }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    try {
      const buffer = await ctx.decodeAudioData(d.bytes);
      stopMusic();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      musicVolume = clamp(d.volume, 0, 1, musicVolume);
      gain.gain.value = musicVolume;
      src.connect(gain).connect(board);
      src.start();
      mineSrc = src; mineGain = gain;
      duckTick(true);
      startDuckWatch();
      post({ type: 'music-state', id: 'mine:' + String(d.mid || '') });
    } catch (err) {
      console.warn(LOG, 'could not play the music file', err);
      post({ type: 'music-state', id: '', error: 'decode' });
    }
  }

  // ---------- auto-duck: memes get quieter while YOU are talking ----------
  // Watches the real mic level (before any effects) only while something is playing.

  const DUCK_LEVEL = 0.35;     // meme volume multiplier while you talk
  const DUCK_RMS = 0.04;       // ≈ -28 dBFS counts as "talking"
  const DUCK_HOLD_MS = 350;    // keep ducked a moment after you stop
  let duckEnabled = true;
  let ducked = false;
  let lastVoiceAt = 0;
  let duckTimer = 0;
  const duckBuf = new Float32Array(1024);

  function applyBoardGain(tau) {
    if (!board) return;
    board.gain.setTargetAtTime(volume * (ducked ? DUCK_LEVEL : 1), ctx.currentTime, tau);
  }

  function voiceLevel() {
    let best = 0;
    for (const s of sessions) {
      if (!s.meter || s.realAudio.readyState !== 'live' || !s.realAudio.enabled) continue;
      s.meter.getFloatTimeDomainData(duckBuf);
      let sum = 0;
      for (const x of duckBuf) sum += x * x;
      best = Math.max(best, Math.sqrt(sum / duckBuf.length));
    }
    return best;
  }

  function duckTick(atStart = false) {
    const busy = playing.size > 0 || !!tabAudio || !!(musicPlayer && musicPlayer.playing) || !!mineSrc;
    if (!busy || !duckEnabled) {
      if (ducked) { ducked = false; applyBoardGain(0.15); }
      if (!busy) { clearInterval(duckTimer); duckTimer = 0; }
      return;
    }
    const now = performance.now();
    if (voiceLevel() > DUCK_RMS) lastVoiceAt = now;
    const want = now - lastVoiceAt < DUCK_HOLD_MS;
    if (want !== ducked || atStart) {
      ducked = want;
      if (atStart && board) {
        // Jump straight to the right level before the meme's first sample.
        board.gain.cancelScheduledValues(ctx.currentTime);
        board.gain.setValueAtTime(volume * (ducked ? DUCK_LEVEL : 1), ctx.currentTime);
      } else {
        applyBoardGain(want ? 0.03 : 0.25); // duck fast, recover gently
      }
    }
  }

  function startDuckWatch() {
    if (!duckTimer) duckTimer = setInterval(duckTick, 50);
  }

  function setDuck(on) {
    duckEnabled = on;
    duckTick();
  }

  // ---------- another tab's sound (YouTube, Instagram…) into the mic ----------
  // The popup gets a tabCapture stream id for the video tab, with this call tab as the
  // consumer. We open it with the ORIGINAL getUserMedia (it's not a mic, so no mixing)
  // and feed it into the soundboard like any meme. Capturing a tab silences it, so a
  // copy also goes to your speakers (`hear`), so the video keeps playing out loud for you.

  let tabAudio = null; // { stream, src, gain, hear }
  let tabVolume = 1;

  function setTabVolume(v) {
    tabVolume = clamp(v, 0, 2, 1);
    if (tabAudio) tabAudio.gain.gain.setTargetAtTime(tabVolume, ctx.currentTime, 0.02);
  }

  async function startTabAudio(streamId) {
    stopTabAudio(false);
    if (!isActive()) {
      post({ type: 'tab-audio', on: false, error: 'no-call' });
      return;
    }
    try {
      const stream = await origGetUserMedia.call(navigator.mediaDevices, {
        audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: String(streamId) } },
        video: false,
      });
      ensureCtx();
      const src = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = tabVolume;
      src.connect(gain).connect(board);
      const hear = ctx.createGain(); // not the call: your own speakers, at the video's own level
      src.connect(hear).connect(ctx.destination); // tabHear
      const t = { stream, src, gain, hear };
      tabAudio = t;
      startDuckWatch();
      for (const track of stream.getAudioTracks()) {
        track.addEventListener('ended', () => { if (tabAudio === t) stopTabAudio(); });
      }
      console.log(LOG, "playing another tab's sound into mic");
      post({ type: 'tab-audio', on: true });
    } catch (err) {
      post({ type: 'tab-audio', on: false, error: String((err && err.message) || err) });
    }
  }

  function stopTabAudio(notify = true) {
    if (!tabAudio) return;
    const { stream, src, gain, hear } = tabAudio;
    tabAudio = null;
    try { src.disconnect(); gain.disconnect(); hear.disconnect(); } catch {}
    for (const track of stream.getTracks()) origStop.call(track);
    console.log(LOG, "stopped the other tab's sound");
    if (notify) post({ type: 'tab-audio', on: false });
  }

  // The ONLY connection to your speakers: soundboard -> monitor -> ctx.destination,
  // and it only exists while monitoring is switched on.
  function setMonitor(on) {
    monitorOn = on;
    if (!ctx) return;
    if (on && !monitor) {
      monitor = ctx.createGain();
      monitor.gain.value = MONITOR_LEVEL;
      board.connect(monitor).connect(ctx.destination);
    } else if (!on && monitor) {
      try { board.disconnect(monitor); } catch {}
      monitor.disconnect();
      monitor = null;
    }
  }

  // ---------- live voice changer: YOUR voice, between the real mic and the mixer ----------
  // real mic -> src -> [chain] -> mic gain -> destination. "off" connects src straight
  // to the mic gain again, so the plain voice comes back instantly. Auto-duck keeps
  // reading the raw voice (the meter hangs off src, before any effect).

  const VOICES = new Set(['off', 'chipmunk', 'deep', 'robot', 'echo', 'radio']);
  const PITCH = { chipmunk: 1.6, deep: 0.72 };
  let workletUrl = '';
  let workletLoad = null; // Promise<boolean>: the AudioWorklet module loaded
  let workletOk = false;

  function loadWorklet() {
    if (!workletLoad) {
      workletLoad = (ctx.audioWorklet && workletUrl
        ? ctx.audioWorklet.addModule(workletUrl)
        : Promise.reject(new Error('AudioWorklet not available')))
        .then(() => { workletOk = true; return true; }, (err) => {
          console.warn(LOG, 'voice worklet could not load, using the fallback pitch shifter', err);
          return false;
        });
    }
    return workletLoad;
  }

  function pitchNode(ratio) {
    if (workletOk) {
      return new AudioWorkletNode(ctx, 'memebox-pitch', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        channelCount: 1, channelCountMode: 'explicit', parameterData: { ratio },
      });
    }
    // Fallback when the page blocks the worklet: same maths on the main thread.
    if (!Shifter || !ctx.createScriptProcessor) throw new Error('No pitch shifter available');
    const sp = ctx.createScriptProcessor(1024, 1, 1);
    const shifter = new Shifter(ctx.sampleRate);
    shifter.ratio = ratio;
    sp.onaudioprocess = (e) => shifter.process(e.inputBuffer.getChannelData(0), e.outputBuffer.getChannelData(0));
    return sp;
  }

  // Builds the effect for `fx`: { input, output, stop() }.
  function buildChain(fx) {
    const nodes = [];
    const oscs = [];
    const add = (n) => { nodes.push(n); return n; };
    const input = add(ctx.createGain());
    const output = add(ctx.createGain());

    if (PITCH[fx]) {
      input.connect(add(pitchNode(PITCH[fx]))).connect(output);
    } else if (fx === 'robot') {
      // Ring modulator + a little dry voice (same idea as the Robot tone for memes).
      const ring = add(ctx.createGain());
      ring.gain.value = 0;
      const osc = add(ctx.createOscillator());
      osc.frequency.value = 50;
      osc.connect(ring.gain);
      osc.start();
      oscs.push(osc);
      const dry = add(ctx.createGain());
      dry.gain.value = 0.3;
      input.connect(ring).connect(output);
      input.connect(dry).connect(output);
      output.gain.value = 1.4;
    } else if (fx === 'echo') {
      const delay = add(ctx.createDelay(1));
      delay.delayTime.value = 0.22;
      const feedback = add(ctx.createGain());
      feedback.gain.value = 0.42;
      const wet = add(ctx.createGain());
      wet.gain.value = 0.55;
      input.connect(output);
      input.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(output);
    } else if (fx === 'radio') {
      // Narrow band + a bit of drive = old walkie-talkie / radio.
      const hp = add(ctx.createBiquadFilter());
      hp.type = 'highpass'; hp.frequency.value = 500;
      const lp = add(ctx.createBiquadFilter());
      lp.type = 'lowpass'; lp.frequency.value = 3000;
      const drive = add(ctx.createWaveShaper());
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(3 * ((i / (curve.length - 1)) * 2 - 1)) * 0.8;
      drive.curve = curve;
      input.connect(hp).connect(lp).connect(drive).connect(output);
      output.gain.value = 1.3;
    } else {
      input.connect(output);
    }

    return {
      input, output,
      stop() {
        for (const o of oscs) { try { o.stop(); } catch {} }
        for (const n of nodes) {
          if (n.onaudioprocess) n.onaudioprocess = null;
          try { n.disconnect(); } catch {}
        }
      },
    };
  }

  function wireVoice(s) {
    if (s.closed || s.fx === voiceFx) return;
    const next = voiceFx === 'off' ? null : buildChain(voiceFx);
    try { s.src.disconnect(s.mic); } catch {}
    if (s.chain) {
      try { s.src.disconnect(s.chain.input); } catch {}
      s.chain.stop();
    }
    s.chain = next;
    s.fx = voiceFx;
    if (next) {
      s.src.connect(next.input);
      next.output.connect(s.mic);
    } else {
      s.src.connect(s.mic);
    }
  }

  async function setVoice(fx, url) {
    if (!VOICES.has(fx)) fx = 'off';
    if (url && !workletUrl) workletUrl = String(url);
    voiceFx = fx;
    if (PITCH[fx] && ctx) await loadWorklet();
    if (voiceFx !== fx) return; // switched again while the worklet was loading
    let changed = false;
    for (const s of sessions) {
      if (s.fx === fx) continue;
      try {
        wireVoice(s);
        changed = true;
      } catch (err) {
        // Never break the call: plain voice.
        console.warn(LOG, 'voice changer failed, using the plain voice', err);
        voiceFx = 'off';
        wireVoice(s);
      }
    }
    if (changed) console.log(LOG, 'voice changer:', voiceFx);
  }

  // ---------- meme captions on YOUR OWN camera (optional) ----------
  // camera -> hidden <video> -> canvas (frame + meme text) -> canvas.captureStream(30).
  // Only the video you send is changed, nobody else's.

  const captionedTracks = new WeakSet();
  let camUnmirror = true, unmirrored = [], unmirrorTimer = 0;
  // The call site shows YOUR OWN tile mirrored, so a caption on your camera reads backwards to you (everybody else sees it right).
  // While a caption shows, your own tile is flipped back so you can read it too. Returns how many tiles were flipped.
  function unmirrorSelf() {
    if (!camUnmirror) return 0;
    restoreMirror();
    for (const v of document.querySelectorAll('video')) {
      const so = v.srcObject;
      if (!so || typeof so.getVideoTracks !== 'function' || !so.getVideoTracks().some((t) => captionedTracks.has(t))) continue;
      for (let el = v, i = 0; el && i < 4; el = el.parentElement, i++) { // the mirror is on the video or on something just around it
        const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform || '');
        if (m && parseFloat(m[1].split(',')[0]) < 0) {
          unmirrored.push({ el, prev: el.style.getPropertyValue('transform'), prio: el.style.getPropertyPriority('transform') });
          el.style.setProperty('transform', 'none', 'important');
          break;
        }
      }
    }
    clearTimeout(unmirrorTimer);
    unmirrorTimer = setTimeout(restoreMirror, 3050);
    return unmirrored.length;
  }
  function restoreMirror() {
    for (const u of unmirrored) { if (u.prev) u.el.style.setProperty('transform', u.prev, u.prio); else u.el.style.removeProperty('transform'); }
    unmirrored = [];
  }
  let camText = '';
  let camTextUntil = 0;
  let camPicture = null; // ImageBitmap of the playing line's meme picture
  let camCaptionSeq = 0;

  function clearCamCaption() {
    camCaptionSeq++;
    camText = '';
    camTextUntil = 0;
    if (camPicture) { camPicture.close(); camPicture = null; }
    restoreMirror();
  }

  function showCamCaption(text, picture) {
    const seq = ++camCaptionSeq;
    camText = String(text).slice(0, 120);
    // A picture stays on the outgoing camera until the person closes it, presses Stop all,
    // plays another picture, or switches camera captions off. Text-only captions still flash.
    camTextUntil = picture ? Infinity : performance.now() + 3000;
    if (camText) post({ type: 'cam-caption', fixed: unmirrorSelf() > 0 }); // the panel shows its own copy of the caption only when your tile could not be flipped
    if (camPicture) { camPicture.close(); camPicture = null; }
    if (picture) {
      createImageBitmap(new Blob([picture.bytes], { type: picture.type })).then((bmp) => {
        if (seq !== camCaptionSeq) { bmp.close(); return; }
        camPicture = bmp;
        console.log(LOG, 'meme picture ready', bmp.width + 'x' + bmp.height);
      }, () => {});
    }
  }

  // The meme picture in the upper part of the frame, above the caption.
  function drawCamPicture(g, w, h) {
    const maxW = w * 0.78;
    const maxH = h * 0.72;
    const s = Math.min(maxW / camPicture.width, maxH / camPicture.height);
    const pw = camPicture.width * s;
    const ph = camPicture.height * s;
    const x = (w - pw) / 2;
    const y = h * 0.06;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = 12;
    g.drawImage(camPicture, x, y, pw, ph);
    g.restore();
  }

  function wrapLines(g, text, maxWidth) {
    const words = text.split(/\s+/);
    const out = [];
    let line = '';
    for (const w of words) {
      const tryLine = line ? line + ' ' + w : w;
      if (line && g.measureText(tryLine).width > maxWidth) { out.push(line); line = w; } else line = tryLine;
    }
    if (line) out.push(line);
    return out.slice(0, 3);
  }

  function drawCamCaption(g, w, h) {
    const size = Math.max(18, Math.round(h / 10));
    g.save();
    g.font = `900 ${size}px Impact, "Arial Black", "Nirmala UI", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(3, size / 7);
    g.strokeStyle = '#000';
    g.fillStyle = '#fff';
    const lines = wrapLines(g, camText.toUpperCase(), w * 0.92);
    let y = h - size * 0.4 - (lines.length - 1) * size * 1.05;
    for (const l of lines) {
      g.strokeText(l, w / 2, y);
      g.fillText(l, w / 2, y);
      y += size * 1.05;
    }
    g.restore();
  }

  // ---------- Lights & looks, and captions: one pipeline for the camera you send ----------

  const fxActive = () => !!fxCfg && (fxCfg.on || fxCfg.filter !== 'none' || fxCfg.enhance > 0);
  // The camera is always routed through the frame pipeline when the browser has it (frames pass through
  // untouched while nothing is on), so Lights can be switched on at any moment without restarting the camera.
  // Without that support (old browsers) it is only done once Lights has been used, because the fallback
  // costs a little power.
  const camWanted = () => insertableStreams() || camCaptions || (!!fxCfg && (fxCfg.on || fxCfg.armed || fxCfg.filter !== 'none'));
  const needsPaint = () => fxActive() || performance.now() < camTextUntil;
  const meterBuf = new Float32Array(512);

  // What the lights listen to: how loud the sound is, its bass / middle / treble, a 16-band spectrum, a beat now and
  // then, its mood, and which tune is playing. (Only the sounds MemeBox plays, never your voice or the others.)
  const fxFreq = new Uint8Array(256);
  const SPEC_EDGES = [0, 1, 2, 3, 4, 6, 8, 11, 15, 20, 27, 36, 48, 64, 85, 115, 160];
  let fxBassAvg = 0;
  let fxLastBeat = 0;
  const fxSpec = new Array(16).fill(0);
  function audioInfo() {
    const now = performance.now();
    let rms = 0, bass = 0, mid = 0, high = 0;
    if (fxMeter) {
      fxMeter.getFloatTimeDomainData(meterBuf);
      let sum = 0;
      for (let i = 0; i < meterBuf.length; i++) sum += meterBuf[i] * meterBuf[i];
      rms = Math.sqrt(sum / meterBuf.length);
      fxMeter.getByteFrequencyData(fxFreq);
      const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += fxFreq[i]; return s / (b - a) / 255; };
      bass = avg(0, 4); mid = avg(4, 21); high = avg(21, 90);
      for (let k = 0; k < 16; k++) fxSpec[k] = fxSpec[k] * 0.55 + 0.45 * avg(SPEC_EDGES[k], SPEC_EDGES[k + 1]);
    }
    fxLevel = Math.max(Math.min(1, rms * 3.4), fxLevel * 0.9);
    // a beat: the bass jumps above its recent average (at most about 3 per second)
    const kick = bass > fxBassAvg * 1.3 + 0.08 && now - fxLastBeat > 280;
    if (kick) fxLastBeat = now;
    fxBassAvg = fxBassAvg * 0.92 + bass * 0.08;
    const beat = kick || rms > fxAvg * 1.55 + 0.02 ? 1 : 0;
    fxAvg = fxAvg * 0.93 + rms * 0.07;
    const mood = fxMood && now - fxMoodAt < 12000 ? fxMood : '';
    const tune = musicPlayer && musicPlayer.playing ? musicPlayer.id : mineSrc ? 'mine' : '';
    return { level: fxLevel, bass: Math.min(1, bass * 1.4), mid: Math.min(1, mid * 1.8), high: Math.min(1, high * 3), spec: fxSpec, beat, mood, tune, voice: Math.min(1, voiceLevel() * 4) };
  }

  // Face finding for "Follow me": a small copy of the frame goes to the bridge (same page, never leaves the computer),
  // which runs a small face model and sends the face position back. One frame at a time, about 10 a second.
  let faceMl = null, faceBusy = 0, faceLast = 0, faceN = 0, seenAt = 0, faceMs = 0;
  const faceTimes = []; // when the answers arrived, for "answers per second"
  function sendFace(src, w, h, now) {
    if (now - faceLast < 35 || (faceBusy && now - faceBusy < 1000) || typeof createImageBitmap !== 'function') return;
    faceLast = now; faceBusy = now; faceN++;
    const fw = 384, fh = Math.max(16, Math.round(256 * h / w));
    createImageBitmap(src, { resizeWidth: fw, resizeHeight: fh, resizeQuality: 'low' })
      .then((bm) => { try { post({ type: 'face-frame', bitmap: bm, w: fw, h: fh, hands: faceN % 2 === 0 }, [bm]); } catch { faceBusy = 0; } })
      .catch(() => { faceBusy = 0; });
  }

  function paintCamera(R, g, src, w, h) {
    const now = performance.now();
    if (fxActive() && R) {
      R.ml = faceMl;
      R.render(g, src, w, h, fxCfg, now, audioInfo(), {});
      const sq = R.takeSfx && R.takeSfx(); // the little sounds the animal makes (they go into the call like a meme)
      if (sq && sq.length && fxCfg.sounds !== false && ctx && ctx.state === 'running' && board && globalThis.MemeSfx) for (const x of sq) { try { globalThis.MemeSfx.play(ctx, board, x.k, x.a); } catch { /* ignore */ } }
      if (R.followOn && now - R.followOn < 300) {
        sendFace(src, w, h, now);
        if (now - seenAt > 250) { seenAt = now; post({ type: 'fx-seen', ...R.seen(now), waiting: faceN > 3 && !(faceMl && now - faceMl.at < 3000), fps: Math.round(faceTimes.filter((x) => now - x < 2000).length / 2), ms: Math.round(faceMs) }); } // for the panel's "what the camera sees" line
      }
    }
    else g.drawImage(src, 0, 0, w, h);
    if (now < camTextUntil) {
      if (camPicture) drawCamPicture(g, w, h);
      if (camText) drawCamCaption(g, w, h);
    }
  }

  const insertableStreams = () => typeof MediaStreamTrackProcessor === 'function' && typeof MediaStreamTrackGenerator === 'function'
    && typeof VideoFrame === 'function' && typeof OffscreenCanvas === 'function';

  function effectsVideo(real) {
    const R = globalThis.MemeFx ? globalThis.MemeFx.createRenderer() : null;
    const s = { tracks: new Set() };
    let out;
    let stopPipeline;

    if (insertableStreams()) {
      // Frames come straight from the camera, so it keeps its speed in a background tab. A frame passes
      // through untouched when nothing is switched on.
      const processor = new MediaStreamTrackProcessor({ track: real });
      const generator = new MediaStreamTrackGenerator({ kind: 'video' });
      let canvas = null;
      let g = null;
      const transform = new TransformStream({
        transform(frame, controller) {
          let done = false;
          try {
            if (needsPaint()) {
              const w = frame.displayWidth;
              const h = frame.displayHeight;
              if (!canvas || canvas.width !== w || canvas.height !== h) {
                canvas = new OffscreenCanvas(w, h);
                g = canvas.getContext('2d', { alpha: false });
              }
              paintCamera(R, g, frame, w, h);
              const framed = new VideoFrame(canvas, { timestamp: frame.timestamp, duration: frame.duration || undefined });
              frame.close();
              done = true;
              controller.enqueue(framed);
              return;
            }
          } catch (err) {
            if (!done) console.warn(LOG, 'camera effects skipped for one frame', err);
          }
          if (!done) controller.enqueue(frame);
        },
      });
      processor.readable.pipeThrough(transform).pipeTo(generator.writable).catch(() => {});
      out = generator;
      stopPipeline = () => { try { processor.readable.cancel(); } catch {} };
    } else {
      // Older browsers: a hidden <video> drawn onto a canvas 30 times a second.
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = new MediaStream([real]);
      video.play().catch(() => {});
      const st = real.getSettings();
      const canvas = document.createElement('canvas');
      canvas.width = st.width || 640;
      canvas.height = st.height || 480;
      const g = canvas.getContext('2d', { alpha: false });
      out = canvas.captureStream(30).getVideoTracks()[0];
      const timer = setInterval(() => {
        if (real.readyState !== 'live') { finish(); return; }
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw && vh && (canvas.width !== vw || canvas.height !== vh)) { canvas.width = vw; canvas.height = vh; }
        if (video.readyState >= 2) paintCamera(R, g, video, canvas.width, canvas.height);
      }, 1000 / 30);
      stopPipeline = () => { clearInterval(timer); video.srcObject = null; };
    }

    function finish() {
      stopPipeline();
      if (real.readyState === 'live') origStop.call(real);
      for (const t of s.tracks) {
        if (t.readyState === 'live') { origStop.call(t); t.dispatchEvent(new Event('ended')); }
      }
      s.tracks.clear();
      post({ type: 'fx-status', active: false });
    }
    real.addEventListener('ended', finish);

    // Same idea as the mic: our track stands in for the real camera.
    const wrap = (t) => {
      s.tracks.add(t);
      captionedTracks.add(t);
      Object.defineProperties(t, {
        enabled: {
          configurable: true,
          get() { return enabledDesc.get.call(t); },
          set(v) {
            enabledDesc.set.call(t, v);
            let any = false;
            for (const x of s.tracks) if (enabledDesc.get.call(x)) any = true;
            if (real.readyState === 'live') real.enabled = any;
          },
        },
        label: { configurable: true, get: () => real.label },
      });
      t.stop = function stop() {
        origStop.call(t);
        s.tracks.delete(t);
        if (!s.tracks.size) finish();
      };
      t.clone = function clone() {
        const c = origClone.call(t);
        wrap(c);
        return c;
      };
      t.getSettings = () => ({ ...real.getSettings() });
      t.getCapabilities = () => (real.getCapabilities ? real.getCapabilities() : {});
      t.getConstraints = () => real.getConstraints();
      t.applyConstraints = (c) => real.applyConstraints(c);
    };
    wrap(out);
    enabledDesc.set.call(out, real.enabled);
    post({ type: 'fx-status', active: true });
    console.log(LOG, 'camera effects ready for', real.label, insertableStreams() ? '(frame by frame)' : '(canvas)');
    return out;
  }

  function withEffectsVideo(stream) {
    const videos = stream.getVideoTracks();
    if (!videos.length || videos.some((t) => captionedTracks.has(t))) return stream;
    return new MediaStream([...stream.getAudioTracks(), ...videos.map(effectsVideo)]);
  }

  window.addEventListener('pagehide', () => post({ type: 'status', active: false, muted: false, ctxState: 'closed' }));
  console.log(LOG, 'hook installed', window === window.top ? '(top frame)' : '(frame)', location.href);
})();

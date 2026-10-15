import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers.mjs';

test('player discovery rejects a 200 homepage and selects only the current player marker',async()=>{
  const requested=[];
  const route=loadScript('lib/player-route.js',{MEMEBOX_CONFIG:{SITE_URL:'https://memebox.site'},AbortSignal,
    fetch:async url=>{requested.push(url);return new Response(url.endsWith('/music-room')?'<html>A home page</html>':'<body data-memebox-player="2">Player</body>');},
  }).MemePlayerRoute;
  assert.equal(await route.resolve(),'https://memebox.site/music-room/music-room.html');
  assert.equal(requested.length,2);
});

test('a stale site can use the current loopback companion; an unavailable player has no destination',async()=>{
  const globals={MEMEBOX_CONFIG:{SITE_URL:'https://memebox.site'},AbortSignal};
  const route=loadScript('lib/player-route.js',{...globals,fetch:async url=>new Response(url.startsWith('http://127.0.0.1:8790')?'<body data-memebox-player="2">':'Old page')}).MemePlayerRoute;
  assert.equal(await route.resolve(),'http://127.0.0.1:8790/music-room.html');
  const absent=loadScript('lib/player-route.js',{...globals,fetch:async()=>new Response('Old page')}).MemePlayerRoute;
  assert.equal(await absent.resolve(),'');
});

test('player selection keeps meme mode and private playlist references without a license key',()=>{
  const route=loadScript('lib/player-route.js',{URLSearchParams}).MemePlayerRoute;
  const url=new URL(route.selection('https://memebox.site/music-room',{memes:true,extension:'a'.repeat(32),videos:['abcdefghijk'],name:'My video',audience:'call'}));
  assert.equal(url.searchParams.get('mode'),'memes');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('videos'),'abcdefghijk');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('audience'),'call');
  assert.equal(url.searchParams.has('videos'),false);
});

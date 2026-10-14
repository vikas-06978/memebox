import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),context={URL};
vm.runInNewContext(fs.readFileSync(path.join(root,'extension/lib/playlist-library.js'),'utf8'),context);
const library=context.MemePlaylists;
test('playlist references accept supplied YouTube URLs and IDs, strip tracking, and refuse other origins or embedded credentials',()=>{
 for(const item of library.DEFAULTS){assert.equal(library.parse(item.id),item.id);assert.equal(library.parse('https://youtube.com/playlist?list='+item.id+'&si=tracking'),item.id)}
 for(const input of ['javascript:alert(1)','https://youtube.com.evil.test/playlist?list='+library.DEFAULTS[0].id,'https://user:password@youtube.com/playlist?list='+library.DEFAULTS[0].id,'https://youtube.com:8443/playlist?list='+library.DEFAULTS[0].id,'https://youtube.com/watch?v=not-playlist','http://youtube.com/playlist?list='+library.DEFAULTS[0].id])assert.equal(library.parse(input),null,input);
});
test('private collection validation deduplicates, preserves adult markers, permits an empty library and enforces a small cap',()=>{
 const values=Array.from({length:15},(_,i)=>({id:'PL12345678901234567890123456789'+i,title:'Collection '+i,explicit:i===0}));
 const sanitized=library.sanitize([values[0],values[0],...values.slice(1)]);assert.equal(sanitized.length,10);assert.equal(sanitized[0].explicit,true);assert.equal(library.sanitize([]).length,0);assert.equal(library.sanitize(null).length,5);
 assert.equal(library.sanitize([{id:values[0].id,title:'\u0000  Hello  ',explicit:'yes'}])[0].title,'Hello');assert.equal(library.sanitize([{id:'invalid',title:'x'}]).length,0);
});
test('the starter collections exactly match the five supplied references; they do not invent individual song IDs',()=>{
 const source=JSON.parse(fs.readFileSync(path.join(root,'docs/pack-content/phonk-playlist-candidates.json'),'utf8'));
 assert.equal(library.DEFAULTS.map(item=>item.id).join(','),source.sources.map(item=>item.id).join(','));
 for(const item of library.DEFAULTS)assert.equal('videoId' in item,false);
});

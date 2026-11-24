import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMediaDocument,parseStructuredMedia,resolveProviderMedia,decodeMarkup} from '../src/media.js';

test('decode HTML entities and escaped JS URLs',()=>{
  assert.equal(decodeMarkup('https:\\/\\/cdn.example.org\\/a.m3u8?a=1&amp;b=2'),'https://cdn.example.org/a.m3u8?a=1&b=2');
});
test('parse real-style source page with video link and episode labels',()=>{
  const html=`<ul><li data-file="https://video.example.org/season2-ep3.m3u8?sig=ok&amp;key=1" data-voice="Українська">Сезон 2 Серія 3</li></ul><iframe src="//ashdi.vip/embed/123"></iframe>`;
  const out=parseMediaDocument(html,'https://uafix.net/show/23');
  assert.equal(out.streams.length,1);
  assert.equal(out.episodes[0].season,2);
  assert.equal(out.episodes[0].episode,3);
  assert.match(out.streams[0].url,/key=1/);
  assert.deepEqual(out.embeds,['https://ashdi.vip/embed/123']);
});
test('never follow arbitrary host through an iframe',()=>{
  const out=parseMediaDocument('<iframe src="https://127.0.0.1/admin"></iframe><iframe src="https://evil.example/bad"></iframe>','https://uafix.net/x');
  assert.equal(out.embeds.length,0);
});
test('read media URLs from nested structured provider response',()=>{
  const out=parseStructuredMedia({result:{episodes:[{season:1,episode:7,file:'https://cdn.example.org/a.mp4'}]}});
  assert.equal(out.streams.length,1);
  assert.equal(out.episodes[0].episode,7);
});
test('resolve UAKino page through an explicitly allowlisted iframe',async()=>{
  const visited=[];
  const fetcher=async (url,options)=>{
    visited.push(new URL(url).hostname);
    if(url==='https://uakino.eu/ua/test-film')return new Response('<iframe src="https://ashdi.vip/embed/xyz"></iframe>',{status:200});
    if(url==='https://ashdi.vip/embed/xyz')return new Response('var file="https://stream.example.net/master.m3u8?tk=xyz";',{status:200});
    throw Error('Unexpected external request '+url);
  };
  const response=await resolveProviderMedia('uakino','https://uakino.eu/ua/test-film',fetcher);
  assert.equal(response.streams[0].type,'hls');
  assert.deepEqual(visited,['uakino.eu','ashdi.vip']);
});
test('strict media page origin prevents arbitrary backend fetch',async()=>{
  await assert.rejects(resolveProviderMedia('uaflix','https://localhost/admin',async()=>{throw Error('fetch should not run')}),/Некоректна адреса/);
  await assert.rejects(resolveProviderMedia('uafilm','https://klonua.com.evil.example/a',async()=>{throw Error('fetch should not run')}),/Некоректна адреса/);
});
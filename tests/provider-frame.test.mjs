import test from 'node:test';
import assert from 'node:assert/strict';
import {providerFrameUrl,playerFrameUrl,browserProbeUrl,probeBrowserAccess,uakinoBestArticleUrl} from '../public/provider-frame.js';
test('UAFlix and UAFilm provider pages can be opened directly',()=>{
  assert.equal(providerFrameUrl('uaflix'),'https://uafix.net/');
  assert.equal(providerFrameUrl('uafilm','/filmy/test.html'),'https://klonua.com/filmy/test.html');
});
test('no arbitrary, credentialed, HTTP or cross-origin frame URL',()=>{
  for(const url of ['https://uafix.net.evil.example/','https://user:pass@uafix.net/','http://uafix.net/','javascript:alert(1)','//evil.example/','https://uafix.net:444/'])assert.equal(providerFrameUrl('uaflix',url),null);
  assert.equal(providerFrameUrl('uaserials'),null);
  assert.equal(providerFrameUrl('constructor'),null);
});

test('only configured public player origins are accepted',()=>{
  assert.equal(playerFrameUrl('uafilm','https://ashdi.vip/embed/example'),'https://ashdi.vip/embed/example');
  assert.equal(playerFrameUrl('uafilm','https://klonua.com/film.html'),null);
  assert.equal(playerFrameUrl('uafilm','https://ashdi.vip.evil.example/'),null);
  assert.equal(playerFrameUrl('uaserials','https://ashdi.vip/embed/example'),null);
});

test('anime providers accept configured public player origin only',()=>{
 assert.equal(playerFrameUrl('mikai','https://ashdi.vip/embed/example'),'https://ashdi.vip/embed/example');
 assert.equal(playerFrameUrl('animeon','https://moonanime.art/iframe/example'),'https://moonanime.art/iframe/example');
 assert.equal(playerFrameUrl('mikai','https://evil.example/'),null);
});

test('UAKino accepts configured player origins, not arbitrary pages',()=>{
 assert.equal(playerFrameUrl('uakino','https://ashdi.vip/embed/sample'),'https://ashdi.vip/embed/sample');
 assert.equal(playerFrameUrl('uakino','https://uakino.eu/films/123-sample.html'),null);
 assert.equal(playerFrameUrl('uakino','https://evil.example/player'),null);
});

test('UAKino page frame stays on selected mirror origin',()=>{
 assert.equal(providerFrameUrl('uakino','https://uakino.eu/films/123-sample.html'),'https://uakino.eu/films/123-sample.html');
 assert.equal(providerFrameUrl('uakino','https://uakino.best/films/123-sample.html'),null);
 assert.equal(providerFrameUrl('uakino','https://evil.example/'),null);
});
test('browser probe builds only fixed provider endpoints',()=>{
 assert.equal(browserProbeUrl('uakino','playlist','https://uakino.eu/films/123-sample.html'),'https://uakino.eu/engine/ajax/playlists.php?news_id=123&xfield=playlist');
 assert.equal(browserProbeUrl('uaflix','search','Sample title'),'https://uafix.net/index.php?do=search&subaction=search&story=Sample+title');
 assert.equal(browserProbeUrl('uakino','playlist','https://evil.example/123-sample.html'),null);
 assert.equal(browserProbeUrl('uaserials','search','Test'),null);
});
test('direct browser probe respects CORS and stops on 403',async()=>{
 let calls=0;
 const out=await probeBrowserAccess('uaflix','search','Test',async(url,opts)=>{
   calls++;assert.equal(opts.mode,'cors');assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
   return new Response('',{status:403});
 });
 assert.deepEqual(out,{state:'http_error',status:403});assert.equal(calls,1);
});
test('browser probe distinguishes readable response from unknown network/CORS failure',async()=>{
 assert.deepEqual(await probeBrowserAccess('uakino','search','Test',async()=>new Response('ok')),{state:'readable',status:200});
 assert.deepEqual(await probeBrowserAccess('uakino','search','Test',async()=>{throw new TypeError('Failed to fetch')}),{state:'unreadable',status:0});
});

test('UAKino.best explicit page mode stays on its own origin',()=>{
 assert.equal(providerFrameUrl('uakino-best'),'https://uakino.best/ua/');
 assert.equal(providerFrameUrl('uakino-best','https://uakino.eu/films/123-sample.html'),null);
 assert.equal(providerFrameUrl('uakino-best','https://uakino.best.evil.example/'),null);
 assert.equal(providerFrameUrl('uakino-best','http://uakino.best/'),null);
 assert.equal(browserProbeUrl('uakino-best','search','Test'),null);
});

test('selected UAKino article retains its complete path for browser navigation',()=>{
 assert.equal(uakinoBestArticleUrl('https://uakino.eu/films/123-example.html'),'https://uakino.best/films/123-example.html');
 assert.equal(uakinoBestArticleUrl('https://uakino.eu/series/123-example.html'),'https://uakino.best/series/123-example.html');
 for(const value of ['', 'https://uakino.eu/', 'https://evil.example/123-example.html','https://uakino.eu/123-example.html?x=1','https://uakino.eu/123-example.html#x'])assert.equal(uakinoBestArticleUrl(value),null);
});

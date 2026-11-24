import test from 'node:test';
import assert from 'node:assert/strict';
import {providerFrameUrl,playerFrameUrl} from '../public/provider-frame.js';
test('UAFilm provider pages can be opened directly',()=>{
  assert.equal(providerFrameUrl('uafilm','/filmy/test.html'),'https://klonua.com/filmy/test.html');
});
test('no arbitrary, credentialed, HTTP or cross-origin frame URL',()=>{
  for(const url of ['https://klonua.com.evil.example/','https://user:pass@klonua.com/','http://klonua.com/','javascript:alert(1)','//evil.example/','https://klonua.com:444/'])assert.equal(providerFrameUrl('uafilm',url),null);
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


test('removed sources cannot open page or player frames',()=>{
 for(const id of ['uaflix','uakino','uakino-best']){
  assert.equal(providerFrameUrl(id),null);
  assert.equal(playerFrameUrl(id,'https://ashdi.vip/embed/sample'),null);
 }
});

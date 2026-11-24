import test from 'node:test';
import assert from 'node:assert/strict';
import {providerFrameUrl,playerFrameUrl} from '../public/provider-frame.js';
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

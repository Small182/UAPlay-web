import test from 'node:test';
import assert from 'node:assert/strict';
import {providerFrameUrl} from '../public/provider-frame.js';
test('UAFlix and UAFilm provider pages can be opened directly',()=>{
  assert.equal(providerFrameUrl('uaflix'),'https://uafix.net/');
  assert.equal(providerFrameUrl('uafilm','/filmy/test.html'),'https://klonua.com/filmy/test.html');
});
test('no arbitrary, credentialed, HTTP or cross-origin frame URL',()=>{
  for(const url of ['https://uafix.net.evil.example/','https://user:pass@uafix.net/','http://uafix.net/','javascript:alert(1)','//evil.example/','https://uafix.net:444/'])assert.equal(providerFrameUrl('uaflix',url),null);
  assert.equal(providerFrameUrl('uaserials'),null);
  assert.equal(providerFrameUrl('constructor'),null);
});

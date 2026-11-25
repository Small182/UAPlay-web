import test from 'node:test';
import assert from 'node:assert/strict';
import {homeRailMetrics,wheelCardIndex,isPhoneDevice} from '../public/desktop-layout.js';
test('whole desktop cards fill the visible rail without partial next card',()=>{
 for(const [w,h,g] of [[1200,410,20],[1840,500,24],[760,250,12]]){
  const {columns,cardWidth}=homeRailMetrics(w,h,g);
  assert.ok(columns>=1);
  assert.ok(Math.abs(columns*cardWidth+(columns-1)*g-w)<0.001);
  assert.ok(cardWidth*1.5+42<=h+1);
 }
});
test('wheel navigation moves one card and clamps at rail edges',()=>{
 assert.equal(wheelCardIndex(0,-100,5),0);
 assert.equal(wheelCardIndex(2,100,5),3);
 assert.equal(wheelCardIndex(3,-100,5),2);
 assert.equal(wheelCardIndex(5,100,5),5);
});

test('landscape split layout is reserved for phones, not tablets or desktops',()=>{
 const iphone={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari',platform:'iPhone',maxTouchPoints:5};
 const ipad={userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari',platform:'iPad',maxTouchPoints:5};
 const desktopIpad={userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari',platform:'MacIntel',maxTouchPoints:5};
 assert.equal(isPhoneDevice(iphone),true);
 assert.equal(isPhoneDevice(ipad),false);
 assert.equal(isPhoneDevice(desktopIpad),false);
 assert.equal(isPhoneDevice({userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari',userAgentData:{mobile:true}}),true);
 assert.equal(isPhoneDevice({userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) Safari',userAgentData:{mobile:false}}),false);
 assert.equal(isPhoneDevice({userAgent:'Mozilla/5.0 (Linux; Android 15) Mobile Safari'}),true);
 assert.equal(isPhoneDevice({userAgent:'Mozilla/5.0 (Linux; Android 15) Safari'}),false);
 assert.equal(isPhoneDevice({userAgent:'Mozilla/5.0 (Windows NT 10.0) Chrome',maxTouchPoints:10,userAgentData:{mobile:false}}),false);
 assert.equal(isPhoneDevice({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari',platform:'MacIntel',maxTouchPoints:0}),false);
});

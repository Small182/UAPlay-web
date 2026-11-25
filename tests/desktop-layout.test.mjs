import test from 'node:test';
import assert from 'node:assert/strict';
import {homeRailMetrics,wheelCardIndex} from '../public/desktop-layout.js';
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

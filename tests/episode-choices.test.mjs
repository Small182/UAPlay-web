import test from 'node:test';
import assert from 'node:assert/strict';
import {episodeChoices} from '../public/episode-choices.js';
test('different episode selections return different known links',()=>{
 const episodes=[{url:'one',season:1,episode:1},{url:'three',season:1,episode:3},{url:'other-season',season:2,episode:1}];
 const data={episodes,streams:episodes.map(x=>({url:x.url})),playerEmbeds:[{url:'generic'},{url:'specific',season:1,episode:3}]};
 assert.deepEqual(episodeChoices(data,{season:1,episode:1}).selected.map(x=>x.url),['one']);
 assert.deepEqual(episodeChoices(data,{season:1,episode:3}).selected.map(x=>x.url),['three']);
 assert.deepEqual(episodeChoices(data,{season:1,episode:1}).frames,[]);
 assert.deepEqual(episodeChoices(data,{season:1,episode:3}).frames.map(x=>x.url),['specific']);
 assert.deepEqual(episodeChoices(data,{season:1,episode:2}).unverified,[]);
});
test('unknown direct streams remain manually selectable, not verified',()=>{
 const data={streams:[{url:'a'},{url:'b'}],playerEmbeds:[{url:'generic'}]};
 const result=episodeChoices(data,{season:1,episode:3});
 assert.deepEqual(result.selected,[]);
 assert.deepEqual(result.unverified.map(x=>x.url),['a','b']);
 assert.deepEqual(result.frames,[]);
});
test('season-specific articles can supply missing season metadata',()=>{
 const data={episodes:[{url:'a',episode:3}]};
 assert.deepEqual(episodeChoices(data,{season:2,episode:3,sourceSeason:2}).selected.map(x=>x.url),['a']);
 assert.deepEqual(episodeChoices(data,{season:1,episode:3,sourceSeason:2}).unverified,[]);
});

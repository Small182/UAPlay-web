import test from 'node:test';
import assert from 'node:assert/strict';
import {episodeChoices,providerEpisodeFrames} from '../public/episode-choices.js';
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

test('only UAFilm retains an explicitly manual generic player fallback',()=>{
 const data={playerEmbeds:[{url:'generic'},{url:'wrong',season:2,episode:1}]};
 const match=episodeChoices(data,{season:1,episode:1});
 assert.deepEqual(providerEpisodeFrames('uafilm',data,match).map(x=>x.url),['generic']);
 assert.deepEqual(providerEpisodeFrames('uaserials',data,match),[]);
 assert.deepEqual(providerEpisodeFrames('eneyida',data,match),[]);
});

import {adjacentEpisode,nextChannelIndex} from '../public/episode-choices.js';
test('episode step uses adjacent numbered episodes and stops at season boundary',()=>{
 assert.equal(adjacentEpisode([3,1,2,2],2,1),3);assert.equal(adjacentEpisode([3,1,2],2,-1),1);assert.equal(adjacentEpisode([1,2],2,1),undefined);assert.equal(adjacentEpisode([1,2],1,-1),undefined);assert.equal(adjacentEpisode([1,3],2,1),undefined);
});
test('IPTV channel step wraps within the visible list',()=>{
 assert.equal(nextChannelIndex(0,-1,3),2);assert.equal(nextChannelIndex(2,1,3),0);assert.equal(nextChannelIndex(1,1,3),2);assert.equal(nextChannelIndex(0,1,1),0);assert.equal(nextChannelIndex(0,1,0),null);
});

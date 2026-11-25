import test from 'node:test';
import assert from 'node:assert/strict';
import {episodeChoices,automaticEpisodeChoice,nextChannelIndex} from '../public/episode-choices.js';
test('automatic episode choice never selects an unverified episode',()=>{
 const data={streams:[{url:'wrong',season:1,episode:2},{url:'unknown'},{url:'correct',season:1,episode:3}]};
 const exact=episodeChoices(data,{season:1,episode:3});
 assert.deepEqual(automaticEpisodeChoice(exact.selected,[],null),{url:'correct',voiceIndex:-1});
 assert.equal(automaticEpisodeChoice(episodeChoices(data,{season:1,episode:4}).selected,[],null),null);
});
test('automatic transition preserves preferred voice if available',()=>{
 const voices=[{url:'a',key:'a'},{url:'b',key:'b'}];
 assert.deepEqual(automaticEpisodeChoice(voices,voices,'b'),{url:'b',voiceIndex:1});
 assert.deepEqual(automaticEpisodeChoice(voices,voices,'missing'),{url:'a',voiceIndex:0});
});
test('IPTV channel stepping follows the current filtered list and wraps',()=>{
 assert.equal(nextChannelIndex(0,-1,5),4);
 assert.equal(nextChannelIndex(4,1,5),0);
 assert.equal(nextChannelIndex(2,1,5),3);
 assert.equal(nextChannelIndex(0,1,1),0);
 assert.equal(nextChannelIndex(0,1,0),null);
});

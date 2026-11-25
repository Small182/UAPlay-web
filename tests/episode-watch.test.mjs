import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreWatchedEpisodes,episodeWatchStatus} from '../public/episode-choices.js';
test('completed episodes stay watched even when replayed',()=>{
 const key='tv:1:2:3';
 assert.deepEqual(episodeWatchStatus({[key]:true},key,{[key]:35}),{kind:'watched'});
 assert.deepEqual(episodeWatchStatus({},key,{[key]:93.8}),{kind:'started',seconds:93});
 assert.deepEqual(episodeWatchStatus({},key,{}),{kind:'unwatched'});
 assert.deepEqual(episodeWatchStatus({[key]:true},'tv:1:2:4',{}),{kind:'unwatched'});
});
test('legacy history migrates only the last explicitly completed episode',()=>{
 const history={'tv:1':{completed:true},'tv:2':{completed:false},'movie:3':{completed:true}};
 const last={'tv:1':{season:2,episode:4},'tv:2':{season:1,episode:2},'movie:3':{season:1,episode:1}};
 assert.deepEqual(restoreWatchedEpisodes(undefined,history,last),{'tv:1:2:4':true});
 assert.deepEqual(restoreWatchedEpisodes({},history,last),{});
 assert.deepEqual(restoreWatchedEpisodes({'tv:9:1:1':true},history,last),{'tv:9:1:1':true});
});

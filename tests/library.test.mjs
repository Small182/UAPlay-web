import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryItems} from '../public/library.js';
test('saved titles remain visible even if started or completed',()=>{
 const a={id:1,type:'tv'},b={id:2,type:'movie'},c={id:3,type:'movie'};
 const favorites={'tv:1':a,'movie:2':b,'movie:3':c};
 const history={'tv:1':{...a,completed:false,watchedAt:2},'movie:2':{...b,completed:true,watchedAt:1}};
 assert.deepEqual(libraryItems('saved',favorites,history),[a,b,c]);
 delete favorites['tv:1'];
 assert.deepEqual(libraryItems('saved',favorites,history),[b,c]);
 assert.deepEqual(libraryItems('history',favorites,history),[history['tv:1'],history['movie:2']]);
 assert.deepEqual(libraryItems('saved',favorites,{}),[b,c]);
});

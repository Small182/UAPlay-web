import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceChoices,preferredVoiceIndex,voiceResumeTime} from '../public/voice-choices.js';
test('only confirmed TV streams of UASerials and Eneyida are grouped',()=>{
 const rows=[{url:'one',voice:'Studio A'},{url:'two',voice:'Studio B'},{url:'one',voice:'Studio A'}];
 for(const provider of ['uaserials','eneyida'])assert.deepEqual(voiceChoices(provider,true,rows).map(x=>x.label),['Studio A','Studio B']);
 assert.deepEqual(voiceChoices('uafilm',true,rows),[]);
 assert.deepEqual(voiceChoices('eneyida',false,rows),[]);
});
test('known voice preference follows name even when stream order changes',()=>{
 const first=voiceChoices('eneyida',true,[{url:'a',voice:'Studio A'},{url:'b',voice:'Studio B'}]);
 const next=voiceChoices('eneyida',true,[{url:'c',voice:'Studio B'},{url:'d',voice:'Studio A'}]);
 assert.equal(preferredVoiceIndex(next,first[1].key),0);
 assert.equal(preferredVoiceIndex(next,'missing'),0);
});
test('unnamed or repeated voices remain independently selectable',()=>{
 const rows=voiceChoices('uaserials',true,[{url:'a'},{url:'b',voice:'Основна'},{url:'c',voice:'Studio'},{url:'d',voice:'Studio'}]);
 assert.deepEqual(rows.map(x=>x.label),['Озвучення 1','Озвучення 2','Studio','Studio (2)']);
 assert.equal(new Set(rows.map(x=>x.key)).size,4);
});
test('resume position survives a source switch and respects duration',()=>{
 assert.equal(voiceResumeTime(75,200),75);
 assert.equal(voiceResumeTime(100,90),89.75);
 assert.equal(voiceResumeTime(15,Infinity),15);
 assert.equal(voiceResumeTime(NaN,100),0);
});

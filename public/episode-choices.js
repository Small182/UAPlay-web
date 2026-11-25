// Match explicit episode metadata; never infer episode identity from URL ordering.
export function episodeChoices(data,{season,episode,sourceSeason=0}){
 const streams=Array.isArray(data.streams)?data.streams:[];
 const tagged=Array.isArray(data.episodes)?data.episodes:[];
 const all=[...tagged,...streams];
 const selected=[],unverified=[],known=new Set(tagged.filter(x=>Number(x.episode)>0||Number(x.season)>0).map(x=>x.url));
 const matches=x=>Number(x.episode)===episode&&Number(x.season||sourceSeason)===season;
 const seen=new Set();
 for(const row of all){
   if(!row.url||seen.has(row.url)||!matches(row))continue;
   selected.push(row);seen.add(row.url);
 }
 if(!selected.length){
   for(const row of all){
     if(!row.url||seen.has(row.url))continue;
     const s=Number(row.season||sourceSeason)||0,e=Number(row.episode)||0;
     if((s&&s!==season)||(e&&e!==episode))continue;
     // Do not reintroduce a known, contradictory episode as an unlabeled stream.
     if(!row.episode&&!row.season&&known.has(row.url))continue;
     unverified.push(row);seen.add(row.url);
   }
 }
 const frames=(Array.isArray(data.playerEmbeds)?data.playerEmbeds:[]).filter(matches);
 return {selected,unverified,frames};
}

 // UAFilm's own player exposes its own episode selector. It is not a direct
 // episode URL; do not claim that the requested episode was selected.
export function providerEpisodeFrames(provider,data,matching){
 const exact=matching.frames||[];
 if(provider!=='uafilm'||exact.length)return exact;
 return (Array.isArray(data.playerEmbeds)?data.playerEmbeds:[])
  .filter(p=>!p.season&&!p.episode)
  .map(p=>({...p,label:'Вбудований плеєр · оберіть серію в плеєрі'}));
}

/* Only previously confirmed episode streams are eligible for automatic play. */
export function automaticEpisodeChoice(choices,voices,preference){
  if(voices.length){
    const preferred=voices.findIndex(v=>v.key===preference);
    const voiceIndex=preferred>=0?preferred:0;
    return {url:voices[voiceIndex].url,voiceIndex};
  }
  return choices.length?{url:choices[0].url,voiceIndex:-1}:null;
}
export function nextChannelIndex(index,delta,count){
  if(!Number.isInteger(index)||index<0||index>=count||!Number.isInteger(count)||count<1||!delta)return null;
  return (index+Math.sign(delta)+count)%count;
}

export function restoreWatchedEpisodes(stored,history={},lastEpisode={}){
  if(stored&&typeof stored==='object'&&!Array.isArray(stored))return {...stored};
  const result={};
  for(const [key,entry] of Object.entries(history||{})){
    const last=lastEpisode?.[key];
    if(key.startsWith('tv:')&&entry?.completed===true&&Number.isInteger(last?.season)&&last.season>=0&&Number.isInteger(last?.episode)&&last.episode>0){
      result[key+':'+last.season+':'+last.episode]=true;
    }
  }
  return result;
}
export function episodeWatchStatus(watched,key,progress){
  if(watched?.[key]===true)return {kind:'watched'};
  const seconds=Number(progress?.[key]);
  if(Number.isFinite(seconds)&&seconds>=1)return {kind:'started',seconds:Math.floor(seconds)};
  return {kind:'unwatched'};
}

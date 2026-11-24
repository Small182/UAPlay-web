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

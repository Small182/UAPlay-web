// Independent video URLs for the same confirmed episode, not audio tracks.
export function voiceChoices(provider,isTV,streams){
  if(!isTV||!['uaserials','eneyida'].includes(provider))return [];
  const seen=new Set(),names=new Map(),rows=[];
  for(const stream of streams||[]){
    if(!stream?.url||seen.has(stream.url))continue;
    seen.add(stream.url);
    const raw=String(stream.voice||'').trim();
    const name=raw&&!/^(main|основна|default)$/i.test(raw)?raw:'';
    const key=name?name.normalize('NFKC').toLowerCase(): '';
    const n=(names.get(key)||0)+1;names.set(key,n);
    rows.push({url:stream.url,label:name?(n>1?name+' ('+n+')':name):'Озвучення '+(rows.length+1),key:key?'name:'+key+':'+n:'unknown:'+n});
  }
  return rows;
}
export function preferredVoiceIndex(rows,preference){
  const index=rows.findIndex(row=>row.key===preference);
  return index>=0?index:0;
}
export function voiceResumeTime(position,duration){
  const time=Number.isFinite(position)?Math.max(0,position):0;
  return Number.isFinite(duration)?Math.min(time,Math.max(0,duration-0.25)):time;
}

// Video source resolution for UAPlay Web. Only metadata/links are returned;
// no media data is proxied and no protected/player-authenticated content is bypassed.
export const VIDEO_PROVIDERS = Object.freeze({
  uaflix: 'uafix.net', uaserials: 'uaserials.my',
  eneyida: 'eneyida.tv', uafilm: 'klonua.com', uakino: 'uakino.eu',
  mikai: 'api.mikai.me', animeon: 'animeon.club'
});
const EMBED_HOSTS = new Set([
  ...Object.values(VIDEO_PROVIDERS),'uakino.best','zetvideo.net','hdvbua.pro',
  'ashdi.vip','moonanime.net','moon.goldenkite.top','player.ashdi.vip'
]);
const EXT = /\.(m3u8|mp4)(?:$|[?#])/i;
const DECODABLE = /&(amp|quot|apos|lt|gt|#(?:38|34|39|60|62));/gi;
const ENTITIES = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>', '#38':'&','#34':'"','#39':"'",'#60':'<','#62':'>'};
export function decodeMarkup(text) {
  return String(text||'').replace(DECODABLE,(_m,k)=>ENTITIES[k.toLowerCase()]||_m)
    .replace(/\\u002[fF]/g,'/').replace(/\\u003[aA]/g,':')
    .replace(/\\\//g,'/').replace(/\\&/g,'&');
}
function parseHttpsLink(input, base, hostOnly=false) {
  if(typeof input!=='string'||input.length>4096) return null;
  try {
    const url=new URL(decodeMarkup(input).trim(),base);
    if(url.protocol!=='https:'||url.username||url.password||url.port && url.port!=='443')return null;
    if(hostOnly && !EMBED_HOSTS.has(url.hostname.toLowerCase()))return null;
    return url;
  }catch{return null;}
}
function validMedia(value,base) {
  const link=parseHttpsLink(value,base);
  if(!link || !EXT.test(link.pathname+link.search))return null;
  return {url:link.href,type:/\.m3u8(?:$|[?#])/i.test(link.pathname+link.search)?'hls':'mp4'};
}
function uniqueItems(items) {
  const seen=new Set();return items.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;});
}
function cappedLabel(value) {return String(value||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,120);}
function pickVideoLinks(str,base) {
  const media=[];
  // Handles explicit JS/JSON file/URL literals and direct links, including escaped slashes.
  const decoded=decodeMarkup(str);
  const re=/(?:https?:)?\/\/[^\s"'<>\\]+|https?:\\\/\\\/[^\s"'<>]+/gi;
  for(const hit of decoded.matchAll(re)) {
    const raw=hit[0].replace(/[),;\]]+$/,'');
    if(raw.startsWith('http:'))continue;
    const entry=validMedia(raw.startsWith('//')?'https:'+raw:raw,base);
    if(entry)media.push(entry);
  }
  return uniqueItems(media).slice(0,40);
}
// Extract direct HTML/JS embeds, retaining reasonable episode/voice labels where present.
export function parseMediaDocument(body,base) {
  if(typeof body!=='string')return {streams:[],embeds:[],episodes:[]};
  const decoded=decodeMarkup(body);
  const streams=pickVideoLinks(decoded,base);
  const episodes=[];
  const seen=new Set();
  const li=/<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
  for(const match of decoded.matchAll(li)) {
    const link=match[1].match(/\bdata-file\s*=\s*(["'])(.*?)\1/i)?.[2];
    const media=link&&validMedia(link,base);
    if(!media||seen.has(media.url))continue;
    seen.add(media.url);
    const label=cappedLabel(match[2]);
    const season=Number(label.match(/(?:сезон|season|s)\s*(\d{1,3})/i)?.[1])||0;
    const episode=Number(label.match(/(?:серія|серии|episode|ep|e)\s*(\d{1,4})/i)?.[1])||0;
    const voice=cappedLabel(match[1].match(/\bdata-voice\s*=\s*(["'])(.*?)\1/i)?.[2]||'');
    episodes.push({...media,label:label||voice||'Відтворити',season,episode,voice});
  }
  const embeds=[];
  // Explicit iframe/frame/JS embed links only; restrict remote HTML fetches to a fixed allowlist.
  const re=/<(?:iframe|embed)\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi;
  for(const m of decoded.matchAll(re)) {
    const url=parseHttpsLink(m[2],base,true);
    if(url && !embeds.includes(url.href))embeds.push(url.href);
  }
  return {streams:uniqueItems([...episodes,...streams]),episodes,embeds:embeds.slice(0,6)};
}
export function parseStructuredMedia(payload) {
  const streams=[];const episodes=[];const seen=new Set();
  function walk(v, depth=0,context={}) {
    if(depth>9||streams.length>70||v===null||v===undefined)return;
    if(typeof v==='string'){
      const parsed=validMedia(v);
      if(parsed){streams.push(parsed);if(context.episode||context.label){episodes.push({...parsed,...context});}}
      else if(v.length<10000 && (/\.m3u8|\.mp4/i.test(v)))streams.push(...pickVideoLinks(v));
      else if(v.length<150000 && (v.includes('data-file')||v.includes('iframe'))) {
        const html=parseMediaDocument(v);streams.push(...html.streams);episodes.push(...html.episodes);
      }
    }else if(typeof v==='object'){
      if(seen.has(v))return;seen.add(v);
      if(Array.isArray(v)){v.slice(0,150).forEach(x=>walk(x,depth+1,context));return;}
      const label=cappedLabel(v.title||v.name||v.label||v.voice||v.dub||context.label||'');
      const season=Number(v.season||v.season_number||context.season)||0;
      const episode=Number(v.episode||v.episode_number||context.episode)||0;
      const ctx={label,season,episode};
      for(const [key,value] of Object.entries(v).slice(0,110)){
        if(['url','file','source','src','video','stream','hls','mp4','playlist','result','data','players','links','episodes','seasons','items','sources','iframe','embed','qualities','voice','dubbing'].includes(key.toLowerCase()))walk(value,depth+1,ctx);
      }
    }
  }
  walk(payload);
  const all=uniqueItems(streams).slice(0,50);
  return {streams:all,episodes:uniqueItems(episodes).slice(0,80)};
}
// Shared transport: ordinary redirects and transient retry only.
export async function providerRequest(input,options={},fetcher=fetch){
  const initial=parseHttpsLink(input,undefined,true);
  if(!initial)throw Object.assign(new Error('Некоректна адреса джерела'),{status:400});
  let url=initial,method=(options.method||'GET').toUpperCase(),body=options.body;
  const headers={Accept:'text/html,application/json;q=0.9,*/*;q=0.8','User-Agent':'UAPlay-Web/0.4.1',...(options.headers||{})};
  const visited=new Set([url.href]);let redirects=0,retries=0;
  const failure=(message,status=503,upstreamStatus=0)=>Object.assign(new Error(message),{status,upstreamStatus});
  while(true){
    let response;
    try{response=await fetcher(url.href,{method,body,headers,redirect:'manual',signal:AbortSignal.timeout(7000)});}
    catch(e){if(method==='GET'&&retries++===0)continue;throw failure('Мережевий збій або тайм-аут джерела. Спробуйте ще раз.');}
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');
      const target=location?parseHttpsLink(location,url.href,true):null;
      if(!target||target.origin!==initial.origin||redirects++>=3||visited.has(target.href))
        throw failure('Джерело перенаправляє на непідтримувану адресу',502,response.status);
      if(response.status===303||([301,302].includes(response.status)&&method==='POST')){
        method='GET';body=undefined;delete headers['Content-Type'];delete headers['content-type'];
      }
      visited.add(target.href);url=target;continue;
    }
    if([401,403,451].includes(response.status))
      throw failure('Джерело відхилило запит (HTTP '+response.status+'). Спробуйте інше джерело.',502,response.status);
    if(response.status===429)throw failure('Ліміт запитів (HTTP 429). Спробуйте пізніше.',503,429);
    if([500,502,503,504].includes(response.status)&&method==='GET'&&retries++===0)continue;
    if(!response.ok)throw failure('Джерело повернуло HTTP '+response.status,502,response.status);
    if(Number(response.headers.get('content-length'))>1800000)throw failure('Завелика відповідь джерела',502);
    const text=await response.text();
    if(text.length>1800000)throw failure('Завелика відповідь джерела',502);
    return {text,url:url.href};
  }
}
async function getResponse(url,referrer,fetcher){
  const headers={};
  if(referrer){try{const r=new URL(referrer);if(EMBED_HOSTS.has(r.hostname))headers.Referer=r.origin+'/';}catch{}}
  return providerRequest(url,{headers},fetcher);
}
export async function resolveProviderMedia(provider,id,fetcher=fetch){
  const host=VIDEO_PROVIDERS[provider];if(!host)throw Object.assign(new Error('Невідоме джерело'),{status:400});
  let page;
  if(provider==='mikai'||provider==='animeon'){
    if(!/^\d{1,10}$/.test(id||''))throw Object.assign(new Error('Некоректний ID'),{status:400});
    page=provider==='mikai'?`https://${host}/public/v1/anime/${id}/player`:`https://${host}/api/player/${id}`;
  }else{
    const u=parseHttpsLink(id);if(!u||u.hostname!==host)throw Object.assign(new Error('Некоректна адреса матеріалу'),{status:400});
    page=u.href;
  }
  const loaded=await getResponse(page,null,fetcher);const content=loaded.text;page=loaded.url;
  if(provider==='mikai'||provider==='animeon'){
    let json;try{json=JSON.parse(content)}catch{throw Object.assign(new Error('Некоректний JSON відповіді джерела'),{status:502})}
    const {streams,episodes}=parseStructuredMedia(json);
    return {provider,streams,episodes,sourcePage:page};
  }
  const start=parseMediaDocument(content,page);
  const result={provider,streams:[...start.streams],episodes:[...start.episodes],sourcePage:page,warnings:[]};
  const pending=start.embeds.map(url=>({url,depth:1,from:page}));const visited=new Set([page]);
  // Follow at most five explicit iframe links and two levels, never arbitrary URLs.
  while(pending.length && visited.size<6){
    const next=pending.shift();if(!next||visited.has(next.url))continue;visited.add(next.url);
    try{
      const html=await getResponse(next.url,next.from,fetcher);
      const parsed=parseMediaDocument(html.text,html.url);
      result.streams.push(...parsed.streams);result.episodes.push(...parsed.episodes);
      if(next.depth<2)pending.push(...parsed.embeds.map(url=>({url,depth:next.depth+1,from:next.url})));
    }catch(e){if(result.warnings.length<5)result.warnings.push({status:e.upstreamStatus||0,message:e.message});}
    if(result.streams.length>=50)break;
  }
  result.streams=uniqueItems(result.streams).slice(0,50);
  result.episodes=uniqueItems(result.episodes).slice(0,80);
  return result;
}
// Video source resolution for UAPlay Web. Only metadata/links are returned;
// no media data is proxied and no protected/player-authenticated content is bypassed.
export const VIDEO_PROVIDERS = Object.freeze({
  uaflix: 'uafix.net', uaserials: 'uaserials.my',
  eneyida: 'eneyida.tv', uafilm: 'klonua.com', uakino: 'uakino.eu', 'uakino-best':'uakino.best',
  mikai: 'api.mikai.me', animeon: 'animeon.club'
});
const EMBED_HOSTS = new Set([
  ...Object.values(VIDEO_PROVIDERS),'uakino.best','zetvideo.net','hdvbua.pro',
  'ashdi.vip','moonanime.net','moonanime.art','moon.goldenkite.top','player.ashdi.vip'
]);
// Only explicit, publicly returned iframe URLs on configured video-player origins.
const FRAME_PLAYER_HOSTS=new Set(['zetvideo.net','hdvbua.pro','ashdi.vip','player.ashdi.vip','moonanime.net','moonanime.art','moon.goldenkite.top']);
function publicPlayerFrames(body,base){
  const found=[];
  for(const match of String(body||'').matchAll(/<iframe\b[^>]*>/gi)){
    const tag=match[0];
    if(/\s+srcdoc\s*=/i.test(tag))continue;
    const attr=name=>tag.match(new RegExp('\\s+'+name+'\\s*=\\s*(["\\x27])(.*?)\\1','i'))?.[2];
    const url=parseHttpsLink(attr('src')||attr('data-src'),base,true);
    if(url&&FRAME_PLAYER_HOSTS.has(url.hostname)&&!validMedia(url.href,base)&&!found.includes(url.href))found.push(url.href);
  }
  return found.slice(0,6);
}
// Respect explicit restrictions; the browser remains the final authority.
function frameHeadersPermit(headers){
  if(!headers)return false;
  if(headers.get('x-frame-options')?.trim())return false;
  const csp=headers.get('content-security-policy')||'';
  for(const policy of csp.split(',')){
    const rule=policy.split(';').map(x=>x.trim()).find(x=>/^frame-ancestors(?:\s|$)/i.test(x));
    if(rule&&!rule.split(/\s+/).slice(1).some(x=>x==='*'||x==='https:'))return false;
  }
  return true;
}
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
  // Native HTML video sources may use relative URLs rather than absolute links.
  for(const tag of body.matchAll(/<(?:video|source)\b[^>]*>/gi)){
    const raw=tag[0].match(/\s+src\s*=\s*(["'])(.*?)\1/i)?.[2];
    if(!raw)continue;
    const media=validMedia(raw,base);if(media)streams.push(media);
  }
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
    return {text,url:url.href,headers:response.headers};
  }
}
async function getResponse(url,referrer,fetcher){
  const headers={};
  if(referrer){try{const r=new URL(referrer);if(EMBED_HOSTS.has(r.hostname))headers.Referer=r.origin+'/';}catch{}}
  return providerRequest(url,{headers},fetcher);
}
// Classify explicit page-level availability notices, never reroute access denials.
function availabilityNotice(html){
  const body=String(html||'').slice(0,1800000);
  const visible=body.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  if(/пройдіть\s+авторизацію|змініть\s+країну|увійдіть,?\s+щоб\s+дивитис|доступн\p{L}*\s+лише\s+(?:для\s+)?зареєстрован/iu.test(visible))
    return {status:'access_denied',message:'Сторінка вимагає входу або повідомляє про територіальні обмеження. Перевірте доступ на сайті джерела.'};
  if(/контент недоступний|відео видалено|файл не знайдено|video not found|file not found/i.test(visible))
    return {status:'removed',message:'Сторінка повідомляє, що відео недоступне або видалене.'};
  return null;
}
// Public Mikai release schema and plain AnimeON player metadata.
// Do not decode hidden URLs, forward credentials or retry access denials.
export function normalizeAnimeMedia(provider,payload){
  const streams=[],episodes=[],playerEmbeds=[],seen=new Set();
  const root=payload?.result??payload;
  if(root?.licensed===true)return {streams,episodes,playerEmbeds,mediaStatus:'licensed'};
  function add(value,ctx,embed=false){
    if(typeof value!=='string'||seen.size>=4000)return;
    const url=parseHttpsLink(value);
    if(!url)return;
    const media=validMedia(value);
    const key=url.href+'|'+ctx.season+'|'+ctx.episode+'|'+ctx.voice;
    if(seen.has(key))return;
    const row={url:url.href,season:ctx.season||0,episode:ctx.episode||0,voice:ctx.voice||'',label:cappedLabel([ctx.episode?'Серія '+ctx.episode:'',ctx.voice,ctx.host].filter(Boolean).join(' · '))||'Плеєр'};
    if(media){seen.add(key);streams.push({...media,...row});if(row.episode||row.season)episodes.push({...media,...row});}
    else if(embed&&FRAME_PLAYER_HOSTS.has(url.hostname)){seen.add(key);playerEmbeds.push(row);}
  }
  if(provider==='mikai'){
    for(const release of (Array.isArray(root?.releases)?root.releases:[])){
      const voice=cappedLabel((Array.isArray(release.teams)?release.teams.map(t=>t?.name).filter(Boolean).join(' + '):'')||(release.teamName||'Mikai'))+(release.kind==='sub'?' · Субтитри':'');
      for(const ep of (Array.isArray(release.episodes)?release.episodes:[])){
        const number=Number(ep.number);if(!Number.isFinite(number)||number<=0)continue;
        for(const src of (Array.isArray(ep.sources)?ep.sources:[]))add(src.embedUrl,{season:Number(ep.season)||0,episode:number,voice,host:src.provider},true);
      }
    }
  }else{
    let visited=0;
    function walk(node,ctx={},depth=0){
      if(depth>12||++visited>30000||!node)return;
      if(Array.isArray(node)){for(const x of node)walk(x,ctx,depth+1);return;}
      if(typeof node!=='object')return;
      const title=typeof node.title==='string'?node.title:'';
      const season=Number(node.season)||Number(title.match(/(?:сезон|season)\s*(\d+)/i)?.[1])||ctx.season||0;
      const epNumber=Number(node.episode??node.episode_number??node.number)||Number(title.match(/(?:серія|episode|епізод)\s*(\d+(?:\.\d+)?)/i)?.[1])||ctx.episode||0;
      const voice=cappedLabel(node.voice||node.translation?.name||node.name||ctx.voice||'AnimeON');
      const next={season,episode:epNumber,voice};
      for(const k of ['file','fileUrl','video_url','videoUrl','embedUrl','url']){
        if(typeof node[k]==='string')add(node[k],next,k!=='fileUrl');
      }
      for(const k of ['players','data','result','episodes','videos','folder','translations','items','sources','playlist']){
        if(node[k]&&typeof node[k]==='object')walk(node[k],next,depth+1);
      }
      if(typeof node.json==='string'&&node.json.length<=1800000){
        try{walk(JSON.parse(node.json),next,depth+1);}catch{}
      }else if(node.json&&typeof node.json==='object')walk(node.json,next,depth+1);
    }
    walk(payload);
  }
  return {streams,episodes,playerEmbeds,mediaStatus:streams.length||playerEmbeds.length?'available':'no_public_media'};
}
// UAKino's catalogue article exposes a separate public playlist endpoint.
// Keep the request on the original article origin; never switch hosts after a denial.
function uakinoPlaylistUrl(page){
  const u=new URL(page);
  if(u.origin!=='https://uakino.eu')return null;
  const id=u.pathname.match(/\/(\d{1,10})-[^/]+\.html$/i)?.[1];
  if(!id||Number(id)<1)return null;
  const endpoint=new URL('/engine/ajax/playlists.php',u.origin);
  endpoint.searchParams.set('news_id',id);
  endpoint.searchParams.set('xfield','playlist');
  return endpoint.href;
}
function uakinoPlaylistFrames(html,base){
  const frames=[];
  for(const match of String(html||'').matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)){
    const attrs=match[1];
    const raw=attrs.match(/\bdata-file\s*=\s*(["'])(.*?)\1/i)?.[2];
    const url=parseHttpsLink(raw,base,true);
    if(!url||!FRAME_PLAYER_HOSTS.has(url.hostname)||validMedia(url.href,base))continue;
    const voice=cappedLabel(decodeMarkup(attrs.match(/\bdata-voice\s*=\s*(["'])(.*?)\1/i)?.[2]||''));
    const title=cappedLabel(decodeMarkup(match[2]));
    const season=Number(title.match(/(?:сезон|season)\s*(\d+)/i)?.[1])||0;
    const episode=Number(title.match(/(?:серія|episode|епізод)\s*(\d+)/i)?.[1])||0;
    frames.push({url:url.href,label:[title,voice].filter(Boolean).join(' · ')||'Вбудований плеєр',season,episode});
  }
  return frames.slice(0,80);
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
    if(json?.ok===false)throw Object.assign(new Error('API джерела повідомило про помилку'),{status:502});
    const normalized=normalizeAnimeMedia(provider,json);
    return {provider,...normalized,sourcePage:page};
  }
  const availability=availabilityNotice(content);
  if(availability?.status==='access_denied')return {provider,streams:[],episodes:[],sourcePage:page,mediaStatus:availability.status,warnings:[{status:403,message:availability.message}]};
  if(provider==='uakino-best'){
    // Standalone player mode only: use explicit embeds supplied by the selected
    // article and respect access and framing restrictions. No guessed ID,
    // hidden player data, cross-origin retry or media proxy.
    const result={provider,streams:[],episodes:[],playerEmbeds:[],sourcePage:page,warnings:[],mediaStatus:availability?.status||'no_supported_media'};
    if(availability)return result;
    for(const url of publicPlayerFrames(content,page).slice(0,3)){
      try{
        const player=await getResponse(url,page,fetcher);
        if(!availabilityNotice(player.text)&&frameHeadersPermit(player.headers)&&FRAME_PLAYER_HOSTS.has(new URL(player.url).hostname)){
          result.playerEmbeds.push({url:player.url,label:'Вбудований плеєр '+(result.playerEmbeds.length+1)});
        }
      }catch(e){result.warnings.push({stage:'player',host:new URL(url).hostname,status:e.upstreamStatus||0,message:e.message});}
    }
    if(result.playerEmbeds.length)result.mediaStatus='available';
    else if(result.warnings.some(w=>[401,403,451].includes(w.status)))result.mediaStatus='access_denied';
    return result;
  }
  const start=parseMediaDocument(content,page);
  const frameCandidates= ['uafilm','uaflix','uakino'].includes(provider)&&!availability?publicPlayerFrames(content,page):[];
  const playlistFrames=[];
  const result={provider,streams:[...start.streams],episodes:[...start.episodes],sourcePage:page,warnings:[],embedCount:start.embeds.length,playerEmbeds:[]};
  if(provider==='uakino'&&!availability){
    const endpoint=uakinoPlaylistUrl(page);
    if(endpoint){
      try{
        const playlist=await getResponse(endpoint,null,fetcher);
        const payload=JSON.parse(playlist.text);
        const html=typeof payload?.response==='string'?payload.response:'';
        const notice=availabilityNotice(html);
        if(notice?.status==='access_denied')return {provider,streams:[],episodes:[],playerEmbeds:[],sourcePage:page,mediaStatus:'access_denied',warnings:[{status:403,message:notice.message}]};
        if(!notice){
          const parsed=parseMediaDocument(html,page);
          result.streams.push(...parsed.streams);result.episodes.push(...parsed.episodes);
          playlistFrames.push(...uakinoPlaylistFrames(html,page));
          frameCandidates.push(...publicPlayerFrames(html,page),...playlistFrames.map(x=>x.url));
        }
      }catch(e){
        result.warnings.push({status:e.upstreamStatus||0,message:e.message,stage:'playlist',host:new URL(endpoint).hostname});
        if([401,403,451].includes(e.upstreamStatus))return {...result,streams:[],episodes:[],playerEmbeds:[],mediaStatus:'access_denied'};
      }
    }
  }
  const pending=[...new Set([...start.embeds,...frameCandidates])].map(url=>({url,depth:1,from:page}));const visited=new Set([page]);
  // Follow at most five explicit iframe links and two levels, never arbitrary URLs.
  while(pending.length && visited.size<6){
    const next=pending.shift();if(!next||visited.has(next.url))continue;visited.add(next.url);
    try{
      const html=await getResponse(next.url,next.from,fetcher);
      const parsed=parseMediaDocument(html.text,html.url);
      if(frameCandidates.includes(next.url)&&FRAME_PLAYER_HOSTS.has(new URL(html.url).hostname)&&!availabilityNotice(html.text)&&frameHeadersPermit(html.headers)){
        const labels=playlistFrames.filter(x=>x.url===next.url);
        if(labels.length)result.playerEmbeds.push(...labels.map(x=>({...x,url:html.url})));
        else result.playerEmbeds.push({url:html.url,label:'Вбудований плеєр '+(result.playerEmbeds.length+1)});
      }
      const frameLabels=playlistFrames.filter(x=>x.url===next.url);
      if(frameLabels.length){
        for(const label of frameLabels)for(const stream of parsed.streams){const entry={...stream,label:label.label,season:label.season,episode:label.episode};result.streams.push(entry);if(entry.episode||entry.season)result.episodes.push(entry);}
      }else{result.streams.push(...parsed.streams);result.episodes.push(...parsed.episodes);}
      if(next.depth<2)pending.push(...parsed.embeds.map(url=>({url,depth:next.depth+1,from:next.url})));
    }catch(e){if(result.warnings.length<5)result.warnings.push({status:e.upstreamStatus||0,message:e.message,...(provider==='uakino'?{stage:'player',host:new URL(next.url).hostname}:{})});}
    if(result.streams.length>=50)break;
  }
  result.streams=uniqueItems(result.streams).slice(0,50);
  result.episodes=uniqueItems(result.episodes).slice(0,80);
  result.mediaStatus=(result.streams.length||result.playerEmbeds.length)?'available':result.warnings.some(w=>[401,403,451].includes(w.status))?'access_denied':result.warnings.length?'upstream_error':result.embedCount?'no_supported_media':'no_public_media';
  if(result.mediaStatus==='access_denied'||availability)result.playerEmbeds=[];
  if(!result.streams.length&&availability){result.mediaStatus=availability.status;result.warnings.unshift({status:0,message:availability.message});}
  return result;
}
import { resolveProviderMedia, providerRequest } from './media.js';
// UAPlay-nx provider endpoints adapted to Cloudflare Workers.
// External services may alter their API, block Workers, or require rights/authorization.
// Never proxy arbitrary URLs or bypass authentication/DRM.
const PROVIDERS = Object.freeze({
  uaserials: { name: 'UASerials', host: 'https://uaserials.my', type: 'html-get' },
  eneyida: { name: 'Eneyida', host: 'https://eneyida.tv', type: 'html-post' },
  uafilm: { name: 'UAFilm', host: 'https://klonua.com', type: 'html-post' },
  mikai: { name: 'Mikai', host: 'https://api.mikai.me', type: 'json' },
  animeon: { name: 'AnimeON', host: 'https://animeon.club', type: 'json' }
});
const js = (data, status = 200, cache = 0) => new Response(JSON.stringify(data), {status,headers: {
  'content-type':'application/json; charset=utf-8',
  'cache-control':cache ? `public, max-age=${cache}`:'no-store',
  'x-content-type-options':'nosniff'
}});
const err = (message, status=400) => js({error:message},status);
const clean = (v,n=128) => String(v||'').replace(/[\x00-\x1F\x7F]/g,' ').trim().slice(0,n);
const digits = v => /^\d{1,10}$/.test(v||'');
const fmt = (v,n=20) => clean(v,n);
const str = (v,n=128) => typeof v==='string' ? clean(v,n) : '';
function htmlPlain(value) {
  return clean(String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|#38);/gi,'&').replace(/&(?:quot|#34);/gi,'"').replace(/&(?:apos|#0*39|#x27);/gi,"'").replace(/&nbsp;/gi,' ').replace(/\s+/g,' '),190);
}
async function upstream(url, options={}, maxBytes=2_000_000) {
  const endpoint=new URL(url);
  if(endpoint.protocol!=='https:')throw new Error('Неприпустима адреса API');
  const response=await fetch(endpoint.toString(),{redirect:'manual',signal:AbortSignal.timeout(9000),headers:{accept:'application/json, text/html, */*', 'user-agent':'UAPlay-Web/0.3'},...options});
  if(!response.ok)throw Object.assign(new Error(`Джерело повернуло HTTP ${response.status}`),{status:502});
  if(Number(response.headers.get('content-length'))>maxBytes)throw new Error('Завелика відповідь джерела');
  const body=await response.text();
  if(body.length>maxBytes)throw new Error('Завелика відповідь джерела');
  return body;
}
function normalizeAnime(provider,data){
  const source=provider==='mikai'?(Array.isArray(data.result)?data.result:Array.isArray(data.result?.data)?data.result.data:[]):
    (Array.isArray(data.results)?data.results:Array.isArray(data.data)?data.data:[]);
  return source.slice(0,20).map(e=>{
    const id=provider==='mikai'?Number(e.ids?.mikai??e.mikai):Number(e.id);
    const title=provider==='mikai'?(e.titles?.ua||e.titles?.english||e.ua||e.english||e.title):(e.titleUa||e.titleEn||e.title);
    const original=provider==='mikai'?(e.titles?.english||e.english||e.titles?.original||''):(e.titleEn||'');
    return {id:String(id),provider,title:clean(title,185),original:clean(original,185),name:PROVIDERS[provider].name};
  }).filter(e=>digits(e.id)&&e.title);
}
// Match actual catalogue article URLs, not navigation or season filters.
// Based on the validation and title ranking in UAPlay-nx catalog.c.
function articleLink(provider,value,type=''){
  const conf=PROVIDERS[provider];if(!conf||!value)return null;
  let url;
  try{url=new URL(value.replace(/&amp;/gi,'&'),conf.host);}catch{return null;}
  if(url.origin!==conf.host||url.username||url.password||url.search||url.hash)return null;
  const path=url.pathname;
  if(provider==='uaserials'){
    if(!/^\/\d+-[^/]+\.html$/i.test(path))return null;
  }else{
    if(!/\/\d+-[^/]+\.html$/i.test(path))return null;
    if(provider==='uafilm'){
      if(type==='movie'&&/\/(?:serialy|multserialy)\//i.test(path))return null;
      if(type==='tv'&&/\/(?:filmy|multfilmy)\//i.test(path))return null;
    }
  }
  return url.href;
}
// Catalogue matching informed by the supplied UAFresh 82ff45d plugin.
// Independent implementation; no third-party script, proxy or session data.
function normalizedTitle(s){
  return String(s||'').normalize('NFKC').toLowerCase().replace(/[ʼ’'‘\x60]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function baseCatalogueTitle(s){
  return normalizedTitle(s).replace(/\s+(?:(?:season|сезон|sezon)\s+\d+|\d+\s+(?:season|сезон|sezon))(?:\s.*)?$/i,'')
    .replace(/\s+(?:онлайн|дивитися|дивитись|watch)(?:\s.*)?$/i,'')
    .replace(/\b(?:19|20)\d{2}\b/g,' ').replace(/\s+/g,' ').trim();
}
function catalogueYear(title,url){
  const explicit=String(title||'').match(/(?:\(|[·–—]\s*|\s)((?:19|20)\d{2})(?:\)|\s*$)/);
  const path=String(url||'').match(/[-_/]((?:19|20)\d{2})(?:[-_.][a-z]*)?\.html$/i);
  return Number(explicit?.[1]||path?.[1])||null;
}
function catalogueSeason(title){
  const s=String(title||'');
  if(/\d+\s*[-–]\s*\d+\s*(?:сезон|season)/i.test(s))return null;
  const match=s.match(/(?:season|сезон|sezon)[\s_-]*(\d{1,3})|(\d{1,3})[\s_-]*(?:season|сезон|sezon)/i);
  return Number(match?.[1]||match?.[2])||null;
}
function rankSources(results,local,original='',strict=false,year=0,type='',season=0,seasonYear=0){
  const a=baseCatalogueTitle(local),b=baseCatalogueTitle(original);
  const score=(x)=>Math.max(0,...[...String(x.title||'').split('/'),x.original||''].map(part=>{
    const n=baseCatalogueTitle(part);
    if(!n)return 0;
    if(a&&n===a)return 120;
    if(b&&n===b)return 110;
    if(a&&(' '+n+' ').includes(' '+a+' '))return 78;
    if(b&&(' '+n+' ').includes(' '+b+' '))return 68;
    if(a.length>=6&&n.includes(a))return 32;
    if(b.length>=6&&n.includes(b))return 28;
    return 0;
  }));
  const ranked=results.map(item=>({item,score:score(item),year:catalogueYear(item.title,item.url),season:catalogueSeason(item.title)||catalogueSeason(item.url)})).sort((x,y)=>y.score-x.score);
  let compatible=ranked.filter(x=>{
    if(type==='tv'&&season>0&&x.season&&x.season!==season)return false;
    if(type==='movie'&&strict&&x.season)return false;
    if(!x.year||year<1900)return true;
    if(type==='movie')return Math.abs(x.year-year)<=1;
    if(type==='tv'){
      if(x.season&&x.season>1)return seasonYear>=1900?Math.abs(x.year-seasonYear)<=1:x.year>=year-1;
      if(x.season===1||season===1)return Math.abs(x.year-year)<=1;
      return x.year>=year-1&&(Math.abs(x.year-year)<=1||!seasonYear||Math.abs(x.year-seasonYear)<=1);
    }
    return true;
  });
  const top=compatible[0]?.score||0;
  let relevant=compatible.filter(x=>top>=110?x.score>=100:top>=68?x.score>0:strict?x.score>0:true);
  if(type==='tv'&&season>0)relevant.sort((x,y)=>Number(y.season===season)-Number(x.season===season)||y.score-x.score);
  return relevant.map(x=>({...x.item,year:x.year,season:x.season}));
}
function parseHtmlSearch(provider,html,type='') {
  const conf=PROVIDERS[provider];if(!conf)return [];
  const matches=[];const seen=new Set();
  const attr=(s,key)=>s.match(new RegExp('\\b'+key+'\\s*=\\s*(["\\x27])(.*?)\\1','i'))?.[2]||'';
  const classLabel=(s,pattern)=>s.match(new RegExp('class\\s*=\\s*["\\x27][^"\\x27]*(?:'+pattern+')[^"\\x27]*["\\x27][^>]*>([\\s\\S]*?)<\\/[^>]+>','i'))?.[1]||'';
  const add=(href,label,original='')=>{
    const url=articleLink(provider,href,type);const title=htmlPlain(label);
    if(!url||title.length<2||seen.has(url)||matches.length>=60)return;
    seen.add(url);matches.push({id:url,provider,title,original:htmlPlain(original),name:conf.name,url});
  };
  const anchors=/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi;
  let match;
  while((match=anchors.exec(html))&&matches.length<60){
    const piece=match[0];const opening=piece.slice(0,piece.indexOf('>')+1);
    const href=attr(opening,'href');if(!articleLink(provider,href,type))continue;
    const cls=attr(opening,'class');
    if(provider==='eneyida'&&!/\bshort_title\b/.test(cls)&&!classLabel(piece,'short_title'))continue;
    if(provider==='uafilm'&&!/\b(?:card-link__text|card-title__block)\b/.test(cls)&&!classLabel(piece,'card-link__text|card-title__block'))continue;
    let label=piece.match(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i)?.[1]||
      classLabel(piece,'th-title(?!-oname)|movie-title|short_title|card-link__text|card-title__block|search-result-title')||attr(opening,'title')||'';
    let original=classLabel(piece,'th-title-oname|original-title');
    if(provider==='uaserials'){
      const img=piece.match(/<img\b[^>]*>/i)?.[0]||'';
      const current=articleLink(provider,href,type);
      const next=html.slice(anchors.lastIndex,anchors.lastIndex+900);
      const boundary=[...next.matchAll(/<a\b[^>]*>/gi)].find(x=>{
        const target=articleLink(provider,attr(x[0],'href'),type);
        return target&&target!==current;
      });
      const bounded=boundary?next.slice(0,boundary.index):next;
      label=classLabel(piece,'th-title(?!-oname)')||classLabel(bounded,'th-title(?!-oname)')||label||attr(img,'alt')||attr(img,'title');
      original=original||classLabel(bounded,'th-title-oname|original-title');
    }
    if(!label)label=piece.slice(opening.length).replace(/<\/a\s*>$/i,'');
    add(href,label,original);
  }
  // Klon catalogue cards may keep the title outside the link, as on Switch.
  if(provider==='uafilm'){
    const cards=[...html.matchAll(/class\s*=\s*["'][^"']*\bshort-news__(?:slide-item|small)\b[^"']*["']/gi)];
    for(let k=0;k<cards.length;k++){
      const start=cards[k].index,end=Math.min(cards[k+1]?.index??html.length,start+3500);
      const piece=html.slice(start,end);
      const label=classLabel(piece,'card-link__text|card-title__block');if(!label)continue;
      const link=[...piece.matchAll(/<a\b[^>]*>/gi)].find(x=>articleLink(provider,attr(x[0],'href'),type));
      if(link)add(attr(link[0],'href'),label);
    }
  }
  // Eneyida stores its title and anchor within the same article.
  if(provider==='eneyida'){
    for(const a of html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article\s*>/gi)){
      const label=classLabel(a[0],'short_title');if(!label)continue;
      for(const link of a[0].matchAll(/<a\b[^>]*>/gi)){
        const href=attr(link[0],'href');if(articleLink(provider,href,type)){add(href,label);break;}
      }
    }
  }
  return matches;
}
async function providerSearch(params) {
  const provider=clean(params.get('provider'),24).toLowerCase();
  if(!PROVIDERS[provider])return err('Невідоме джерело');
  const query=clean(params.get('q'),100);
  if(query.length<2)return err('Пошуковий запит надто короткий');
  const conf=PROVIDERS[provider];let endpoint,options;
  if(provider==='mikai')endpoint=`${conf.host}/public/v1/anime?search=${encodeURIComponent(query)}&limit=12`;
  else if(provider==='animeon')endpoint=`${conf.host}/api/anime?search=${encodeURIComponent(query)}&take=12`;
  else if(conf.type==='html-post'){
    endpoint=`${conf.host}/index.php?do=search`;
    options={method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Referer':`${conf.host}/`},
      body:new URLSearchParams({do:'search',subaction:'search',search_start:'0',full_search:'0',result_from:'1',story:query}).toString()};
  }else endpoint=`${conf.host}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`;
  const {text:body}=await providerRequest(endpoint,options);
  const type=params.get('type')||'';const original=clean(params.get('original'),100);
  let results;
  if(conf.type==='json'){
    let payload;try{payload=JSON.parse(body);}catch{throw new Error('Некоректна відповідь API джерела');}
    if(payload?.ok===false)throw Object.assign(new Error('API джерела повідомило про помилку'),{status:502});
    results=normalizeAnime(provider,payload);
  }else results=parseHtmlSearch(provider,body,type);
  const year=Number(params.get('year'))||0;
  results=rankSources(results,query,original,['uafilm','uaserials','eneyida'].includes(provider),year,type,Number(params.get('season'))||0,Number(params.get('seasonYear'))||0).slice(0,18);
  return js({provider,results,notice:'Наявність результату не гарантує відтворення у Safari.'},200,0);
}
async function providerMedia(params) {
  const provider=clean(params.get('provider'),24).toLowerCase();
  if(!PROVIDERS[provider])return err('Невідоме джерело');
  const id=params.get('id')||'';
  if(id.length>2048)return err('Завеликий ID');
  const data=await resolveProviderMedia(provider,id);
  return js({...data,notice:(data.streams.length||data.playerEmbeds?.length)?'Відтворення залежить від доступності потоку та обмежень Safari.':'Сторінка джерела не містить відкритого MP4/HLS. Перевірте відео на сайті джерела.'},200,0);
}
async function wallpapers(params){
  const query=clean(params.get('q'),70);
  const page=Math.max(1,Math.min(30,Number(params.get('page'))||1));
  const url=new URL('https://wallhaven.cc/api/v1/search');
  url.searchParams.set('purity','100');url.searchParams.set('categories','100');url.searchParams.set('atleast','1280x720');url.searchParams.set('page',String(page));
  if(query)url.searchParams.set('q',query);
  const data=JSON.parse(await upstream(url.toString()));
  return js({page,wallpapers:(data.data||[]).slice(0,24).map(p=>({id:clean(p.id,20),thumb:p.thumbs?.large||null,image:p.path||null,resolution:p.resolution||''})).filter(p=>p.image?.startsWith('https://'))},200,300);
}
async function subtitles(params,env){
  if(!env.SUBDL_TOKEN)return err('Для пошуку субтитрів додайте SUBDL_TOKEN у Cloudflare Secrets',503);
  const type=params.get('type'),id=params.get('id');
  if(!['movie','tv'].includes(type)||!digits(id))return err('Некоректні параметри');
  const language=params.get('language')||'uk';
  if(!['uk','en'].includes(language))return err('Доступні українські й англійські субтитри');
  const url=new URL('https://api.subdl.com/api/v2/subtitles/search');
  url.searchParams.set('tmdb_id',id);url.searchParams.set('type',type);url.searchParams.set('languages',language);
  url.searchParams.set('unpack','1');url.searchParams.set('subs_per_page','20');
  if(type==='tv'){
    const season=params.get('season'),episode=params.get('episode');
    if(!/^\d{1,3}$/.test(season||'')||!/^\d{1,4}$/.test(episode||''))return err('Вкажіть сезон і серію');
    url.searchParams.set('season',season);url.searchParams.set('episode',episode);
  }
  const raw=await upstream(url.toString(),{headers:{Authorization:`Bearer ${env.SUBDL_TOKEN}`,Accept:'application/json'}},500_000);
  const data=JSON.parse(raw);
  const found=[];
  for(const sub of data.subtitles||[]){
    const files=sub.files||[];
    for(const file of files){
      const link=file.url||file.link||file.download_url||file.resource||'';
      const s=String(link);
      const u=s.startsWith('/subtitle/')?`https://dl.subdl.com${s}`:s;
      if(!/^https:\/\/dl\.subdl\.com\/subtitle\/[\w\-/.%]+$/i.test(u))continue;
      const format=clean(file.format||s.split('.').at(-1)||'',12).toLowerCase();
      if(!['vtt','srt','ass','ssa','sub'].includes(format))continue;
      found.push({url:u,format,title:clean(file.name||sub.release_name||'Субтитри',180),language});
      if(found.length>=50)break;
    }
    if(found.length>=50)break;
  }
  return js({subtitles:found,notice:'Safari підтримує WebVTT; інші формати можуть вимагати конвертації.'},200,90);
}
async function releases(){
  const data=JSON.parse(await upstream('https://api.github.com/repos/Small182/UAPlay-nx/releases/latest',{headers:{Accept:'application/vnd.github+json','User-Agent':'UAPlay-Web/0.3'}}));
  return js({name:clean(data.name,120),tag:clean(data.tag_name,100),url:typeof data.html_url==='string'&&data.html_url.startsWith('https://github.com/')?data.html_url:null,publishedAt:data.published_at||null},200,900);
}
export async function handleIntegration(request,env){
  const url=new URL(request.url);const path=url.pathname;
  const known=['/api/providers','/api/providers/search','/api/providers/media','/api/wallpapers','/api/subtitles','/api/switch-release'];
  if(!known.includes(path))return null;
  if(request.method!=='GET')return err('Метод не підтримується',405);
  try{
    if(path==='/api/providers')return js({providers:Object.entries(PROVIDERS).map(([id,p])=>({id,name:p.name,search:true,autoStream:['mikai','animeon'].includes(id)})),unsupported:['Movy — використовує локальний проксі та логіку нативного плеєра']},200,600);
    if(path==='/api/providers/search')return await providerSearch(url.searchParams);
    if(path==='/api/providers/media')return await providerMedia(url.searchParams);
    if(path==='/api/wallpapers')return await wallpapers(url.searchParams);
    if(path==='/api/subtitles')return await subtitles(url.searchParams,env);
    return await releases();
  }catch(e){return js({error:e?.message||'Зовнішнє джерело недоступне',upstreamStatus:e?.upstreamStatus||0},e?.status||503);}
}
export {normalizeAnime,parseHtmlSearch,PROVIDERS};
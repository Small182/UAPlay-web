import { resolveProviderMedia, providerRequest } from './media.js';
// UAPlay-nx provider endpoints adapted to Cloudflare Workers.
// External services may alter their API, block Workers, or require rights/authorization.
// Never proxy arbitrary URLs or bypass authentication/DRM.
const PROVIDERS = Object.freeze({
  uaflix: { name: 'UAFlix', host: 'https://uafix.net', type: 'html-get' },
  uaserials: { name: 'UASerials', host: 'https://uaserials.my', type: 'html-get' },
  eneyida: { name: 'Eneyida', host: 'https://eneyida.tv', type: 'html-post' },
  uafilm: { name: 'UAFilm', host: 'https://klonua.com', type: 'html-post' },
  uakino: { name: 'UAKino', host: 'https://uakino.eu', type: 'html-get' },
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
  return clean(String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|#38);/gi,'&').replace(/&(?:quot|#34);/gi,'"').replace(/&(?:apos|#39);/gi,"'").replace(/&nbsp;/gi,' ').replace(/\s+/g,' '),190);
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
    const id=provider==='mikai'?Number(e.mikai):Number(e.id);
    const title=provider==='mikai'?(e.ua||e.english||e.title):(e.titleUa||e.titleEn||e.title);
    return {id:String(id),provider,title:clean(title,185),name:PROVIDERS[provider].name};
  }).filter(e=>digits(e.id)&&e.title);
}
function parseHtmlSearch(provider,html) {
  const {host,name}=PROVIDERS[provider];const matches=[];const seen=new Set();
  // Provider-specific article cards are preferred to site navigation menus.
  let matcher = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>[\s\S]*?<\/a\s*>/gi;
  let result;
  while((result=matcher.exec(html)) && matches.length<18) {
    const piece=result[0];
    if(provider==='uaflix' && !/sres-wrap/.test(piece))continue;
    if(provider==='uakino' && !/(movie-item|movie-title|short-item)/.test(piece))continue;
    let link;
    try{link=new URL(result[2],host);}catch{continue;}
    if(link.protocol!=='https:'||link.origin!==host||seen.has(link.href))continue;
    if(link.searchParams.has('do')||link.pathname==='/'||/\b(?:login|account|register|category|search|news)\b/i.test(link.pathname))continue;
    const label=piece.match(/<(?:h2|h3)[^>]*>([\s\S]*?)<\/h[23]>/i)?.[1]||
      piece.match(/class=["'][^"']*(?:th-title|movie-title)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1]||
      piece.match(/title\s*=\s*["']([^"']+)["']/i)?.[1]||piece.replace(/^[\s\S]*?>/,'').replace(/<\/a\s*>[\s\S]*$/,'');
    const title=htmlPlain(label);
    if(title.length<3)continue;
    seen.add(link.href);matches.push({id:link.href,provider,title,name,url:link.href});
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
  let results;
  if(conf.type==='json'){
    let payload;try{payload=JSON.parse(body);}catch{throw new Error('Некоректна відповідь API джерела');}
    results=normalizeAnime(provider,payload);
  }else results=parseHtmlSearch(provider,body);
  return js({provider,results,notice:'Наявність результату не гарантує відтворення у Safari.'},200,60);
}
async function providerMedia(params) {
  const provider=clean(params.get('provider'),24).toLowerCase();
  if(!PROVIDERS[provider])return err('Невідоме джерело');
  const id=params.get('id')||'';
  if(id.length>2048)return err('Завеликий ID');
  const data=await resolveProviderMedia(provider,id);
  return js({...data,notice:data.streams.length?'Відтворення залежить від доступності потоку та обмежень Safari.':'Сторінка джерела не містить відкритого MP4/HLS. Перевірте відео на сайті джерела.'},200,30);
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
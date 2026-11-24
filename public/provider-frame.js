// Browser-hosted provider pages: no proxy, no header or cookie rewriting.
const FRAME_ORIGINS=Object.freeze({
  uaflix:'https://uafix.net',
  uafilm:'https://klonua.com',
  uakino:'https://uakino.eu',
  'uakino-best':'https://uakino.best'
});
export function providerFrameUrl(provider,value=''){
  const origin=Object.hasOwn(FRAME_ORIGINS,provider)?FRAME_ORIGINS[provider]:null;
  if(!origin)return null;
  try{
    const u=new URL(value||(provider==='uakino-best'?'/ua/':'/'),origin);
    if(u.origin!==origin||u.username||u.password||u.protocol!=='https:')return null;
    return u.href;
  }catch{return null;}
}

const PLAYER_HOSTS=new Set(['zetvideo.net','hdvbua.pro','ashdi.vip','player.ashdi.vip','moonanime.net','moonanime.art','moon.goldenkite.top']);
export function playerFrameUrl(provider,value){
  if(!['uaflix','uafilm','uakino','mikai','animeon'].includes(provider)||typeof value!=='string'||value.length>4096)return null;
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port||!PLAYER_HOSTS.has(u.hostname))return null;
    return u.href;
  }catch{return null;}
}

// Explicit browser connectivity check. No credentials, proxy, custom referrer,
// cross-origin redirect, or opaque no-cors response.
export function browserProbeUrl(provider,kind,value){
  if(!['uaflix','uakino'].includes(provider))return null;
  const origin=FRAME_ORIGINS[provider];
  if(kind==='search'){
    if(typeof value!=='string'||value.trim().length<2||value.length>100)return null;
    const url=new URL('/index.php',origin);
    url.searchParams.set('do','search');url.searchParams.set('subaction','search');url.searchParams.set('story',value.trim());
    return url.href;
  }
  if(kind==='playlist'&&provider==='uakino'){
    if(typeof value!=='string')return null;
    const page=providerFrameUrl(provider,value);
    if(!page)return null;
    const u=new URL(page);
    if(u.search||u.hash)return null;
    const id=u.pathname.match(/\/(\d{1,10})-[^/]+\.html$/i)?.[1];
    if(!id||Number(id)<1)return null;
    const url=new URL('/engine/ajax/playlists.php',origin);
    url.searchParams.set('news_id',id);url.searchParams.set('xfield','playlist');
    return url.href;
  }
  return null;
}
export async function probeBrowserAccess(provider,kind,value,fetcher=fetch){
  const url=browserProbeUrl(provider,kind,value);
  if(!url)return {state:'invalid',status:0};
  try{
    const response=await fetcher(url,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(9000)});
    if(response.type==='opaque'||response.type==='opaqueredirect')return {state:'unreadable',status:0};
    const result={state:response.ok?'readable':'http_error',status:response.status};
    if(response.body)await response.body.cancel().catch(()=>{});
    return result;
  }catch{return {state:'unreadable',status:0};}
}

// Map an explicitly selected catalogue article to the corresponding browser
// navigation on the other configured origin. No server-side retries or proxy.
export function uakinoBestArticleUrl(value){
  if(typeof value!=='string'||!value)return null;
  const source=providerFrameUrl('uakino',value);
  if(!source)return null;
  const u=new URL(source);
  if(u.search||u.hash||!/^\/(?:[^/]+\/)*\d{1,10}-[^/]+\.html$/i.test(u.pathname))return null;
  return providerFrameUrl('uakino-best',u.pathname);
}

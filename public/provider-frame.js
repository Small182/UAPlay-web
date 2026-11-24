// Browser-hosted provider pages: no proxy, no header or cookie rewriting.
const FRAME_ORIGINS=Object.freeze({
  uaflix:'https://uafix.net',
  uafilm:'https://klonua.com'
});
export function providerFrameUrl(provider,value=''){
  const origin=Object.hasOwn(FRAME_ORIGINS,provider)?FRAME_ORIGINS[provider]:null;
  if(!origin)return null;
  try{
    const u=new URL(value||'/',origin);
    if(u.origin!==origin||u.username||u.password||u.protocol!=='https:')return null;
    return u.href;
  }catch{return null;}
}

const PLAYER_HOSTS=new Set(['zetvideo.net','hdvbua.pro','ashdi.vip','player.ashdi.vip','moonanime.net','moon.goldenkite.top']);
export function playerFrameUrl(provider,value){
  if(!Object.hasOwn(FRAME_ORIGINS,provider)||typeof value!=='string'||value.length>4096)return null;
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port||!PLAYER_HOSTS.has(u.hostname))return null;
    return u.href;
  }catch{return null;}
}

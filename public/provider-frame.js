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

// Pure layout helpers used by the desktop home rail.
export function homeRailMetrics(width,height,gap=20){
  const available=Math.max(1,width);
  const ideal=Math.max(96,(height-42)*2/3);
  const columns=Math.max(1,Math.min(12,Math.ceil((available+gap)/(ideal+gap))));
  return {columns,cardWidth:Math.max(1,(available-(columns-1)*gap)/columns)};
}
export function wheelCardIndex(current,delta,maxIndex){
  return Math.max(0,Math.min(maxIndex,current+Math.sign(delta)));
}

// Device classification is independent of viewport size: a short desktop
// window or a tablet in split-screen is not a phone.
export function isPhoneDevice({userAgent='',platform='',maxTouchPoints=0,userAgentData}={}){
  const ua=String(userAgent);
  if(/\b(?:iPad|Tablet|PlayBook|Kindle|Silk)\b/i.test(ua))return false;
  // iPadOS may advertise itself as a Mac.
  if((/Macintosh/i.test(ua)||/^Mac/i.test(platform))&&maxTouchPoints>1)return false;
  if(/iPhone|iPod|Windows Phone/i.test(ua))return true;
  if(typeof userAgentData?.mobile==='boolean')return userAgentData.mobile;
  return /Android/i.test(ua)&&/\bMobile\b/i.test(ua);
}

// iPadOS desktop-mode UA and Android tablets must remain distinct from PCs.
export function isTabletDevice(info={}){
  if(isPhoneDevice(info))return false;
  const {userAgent='',platform='',maxTouchPoints=0}=info;
  return /\b(?:iPad|Tablet|PlayBook|Kindle|Silk)\b/i.test(userAgent)||
    (/Macintosh/i.test(userAgent)||/^Mac/i.test(platform))&&maxTouchPoints>1||
    /Android/i.test(userAgent);
}
export function useMobileShelves(phone,tablet,landscape){
  return phone||tablet&&!landscape;
}

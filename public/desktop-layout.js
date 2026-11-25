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

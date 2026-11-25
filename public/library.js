// The saved list is explicit user intent, independent of viewing history.
export function libraryItems(tab,favorites={},history={}){
  return tab==='history'
    ? Object.values(history).sort((a,b)=>(b.watchedAt||0)-(a.watchedAt||0))
    : Object.values(favorites);
}

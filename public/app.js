const $ = selector => document.querySelector(selector);
const content = $('#app-content');
const modal = $('#modal-root');
const toastBox = $('#toast');
const ICONS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/>',
  tv: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 2 4 4 4-4"/>',
  animation: '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01M8 15q4 4 8 0"/>',
  anime: '<path d="M12 2 4 12l4 2-1 8 11-12-5-2z"/>',
  heart: '<path d="M20.5 8.5c0 5-8.5 11-8.5 11s-8.5-6-8.5-11a4.8 4.8 0 0 1 8.5-3 4.8 4.8 0 0 1 8.5 3z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.8"/><path d="m16 16 5 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 14.5 21 16l-2 3-2.4-1-2.1 1-.5 2.5h-4L9.5 19l-2.1-1L5 19l-2-3 2-1.5v-3L3 10l2-3 2.4 1 2.1-1L10 4.5h4L14.5 7l2.1 1L19 7l2 3-2 1.5z"/>',
  live: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m9 9 6 3-6 3z"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="M5 5 19 19M19 5 5 19"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
const NAV = [
  ['home','Головна','home'],['movies','Фільми','film'],['series','Серіали','tv'],
  ['animation','Мультфільми','animation'],['anime','Аніме','anime'],
  ['iptv','IPTV','live'],['favorites','Вибране','heart'],['search','Пошук','search'],['settings','Налаштування','settings']
];
const MOBILE_NAV = ['home','search','favorites','iptv','settings'];
const STORE = 'uaplay-web-v1';
const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
const persisted = readStore();
const state = {
  view:'home', demo:[], demoMode:false, tmdbConfigured:false, home:{}, lists:{}, page:1,
  searchQuery:'', favorites: persisted.favorites || {}, progress: persisted.progress || {}, sources:persisted.sources || {},
  history: persisted.history || {}, episodeProgress: persisted.episodeProgress || {}, lastEpisode: persisted.lastEpisode || {}, disabledProviders: persisted.disabledProviders || [], theme: persisted.theme || 'dark', sort: persisted.sort || 'popularity', iptvFavorites: persisted.iptvFavorites || {}, libraryTab:'saved', iptvGroup:'', iptvOnlyFavorites:false, downloads:[], downloadActive:null, subtitleUrls:[], playerRate:1, playerVolume:1, wakeLock:null, objectUrl:null, accent: persisted.accent || 'turquoise', wallpaper: persisted.wallpaper || '', activeItem:null, selectedSeason:1, selectedEpisode:1, activeProvider:'',activeSource:null,activePlayer:null, hls:null,
  searchTimer:0, toastTimer:0, playerControlsTimer:0, iptvCountry:'ua', channels:[], channelQuery:'', loadId:0
};
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const keyFor = item => `${item.type}:${item.id}`;
const year = item => String(item.date || '').slice(0,4) || '—';
const imageUrl = (path, size = 'w500') => /^\/[\w-]+\.(?:jpg|png|webp)$/i.test(path || '') ? `https://image.tmdb.org/t/p/${size}${path}` : '';
const externalImageUrl = url => { try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : ''; } catch { return ''; } };
const unique = values => [...new Map(values.map(item => [keyFor(item),item])).values()];
function save() { try { localStorage.setItem(STORE, JSON.stringify({ favorites:state.favorites, progress:state.progress, sources:state.sources, accent:state.accent, wallpaper:state.wallpaper, history:state.history, episodeProgress:state.episodeProgress, lastEpisode:state.lastEpisode, disabledProviders:state.disabledProviders, theme:state.theme, sort:state.sort, iptvFavorites:state.iptvFavorites })); } catch { toast('Не вдалося зберегти дані браузера'); } }
function notify(message) { clearTimeout(state.toastTimer);toastBox.textContent=message;toastBox.classList.add('show');state.toastTimer=setTimeout(()=>toastBox.classList.remove('show'),3000); }
const toast = notify;
function applyAccent() {
  document.documentElement.dataset.theme=state.theme;
  const options = {turquoise:['#3DD7BB','61,215,187'],cyan:['#3BADE0','59,173,224'],yellow:['#F5D100','245,209,0'],orange:['#FF6A00','255,106,0'],red:['#FF2247','255,34,71'],violet:['#6A0DAD','106,13,173'],blue:['#1490D7','20,144,215'],green:['#12B89A','18,184,154'],pink:['#F42A9A','244,42,154'],white:['#FFFFFF','255,255,255']};
  const [hex,rgb] = options[state.accent] || options.turquoise;
  document.documentElement.style.setProperty('--accent',hex);
  document.documentElement.style.setProperty('--accent-rgb',rgb);
  applyWallpaper();
}
function applyWallpaper(){
  const wallpaper=state.wallpaper;
  try{
    const u=new URL(wallpaper);
    if(u.protocol==='https:'&&u.hostname==='w.wallhaven.cc'){
      document.body.style.backgroundImage=`linear-gradient(#090b0eb8,#090b0eb8), url("${u.href.replace(/"/g,'%22')}")`;
      document.body.style.backgroundAttachment='fixed';
      document.body.style.backgroundSize='cover';
      return;
    }
  }catch{}
  document.body.style.backgroundImage='none';
}
async function openWallpapers(){
  modal.innerHTML=`<div class="modal-backdrop" data-close><section class="detail-modal source-modal" role="dialog" aria-modal="true" aria-label="Шпалери UAPlay"><button class="close-modal" data-close aria-label="Закрити">${icon('close')}</button><h2>Шпалери</h2><p class="section-note">Галерея Wallhaven · Безпечний пошук. Зображення не зберігаються на нашому сервері.</p><form id="wallpaper-form" class="player-form"><input id="wallpaper-query" class="input-line" placeholder="Пошук шпалер" maxlength="70"><button class="btn primary" type="submit">Шукати</button></form><div id="wallpaper-results">Завантаження…</div><button class="btn secondary" data-wallpaper-reset>Стандартний фон</button></section></div>`;
  loadWallpapers('');
}
async function loadWallpapers(query){
  const el=$('#wallpaper-results');if(!el)return;
  el.textContent='Завантаження шпалер…';
  try{
    const data=await api(`/api/wallpapers?q=${encodeURIComponent(query)}`);
    if(!$('#wallpaper-results'))return;
    el.innerHTML=`<div class="wallpaper-grid">${data.wallpapers.map(w=>`<button class="wallpaper-pick" type="button" data-set-wallpaper="${safe(w.image)}"><img src="${safe(externalImageUrl(w.thumb))}" alt="Шпалери ${safe(w.id)}" loading="lazy"><span>${safe(w.resolution)}</span></button>`).join('')}</div>`;
  }catch(e){el.innerHTML=`<p class="section-note">${safe(e.message)}</p>`;}
}
async function findSubtitles(){
  const item=state.activePlayer?.item;
  if(!item||item.type!=='movie')return;
  const el=$('#subtitle-results');if(!el)return;
  el.textContent='Шукаємо українські субтитри в SubDL…';
  try{
    const data=await api(`/api/subtitles?type=movie&id=${encodeURIComponent(item.id)}&language=uk`);
    if(!$('#subtitle-results'))return;
    const vtt=data.subtitles.filter(s=>s.format==='vtt');
    el.innerHTML=vtt.length?vtt.map(t=>`<button type="button" class="source-tab" data-attach-subtitle="${safe(t.url)}">${safe(t.title)} · VTT</button>`).join(''):'<p class="section-note">Сумісних WebVTT не знайдено. Safari не відтворює SRT/ASS як стандартні текстові доріжки.</p>';
  }catch(e){el.innerHTML=`<p class="section-note">${safe(e.message)}</p>`;}
}
function attachSubtitle(raw){
  const player=$('#video');if(!player)return;
  try{
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.hostname!=='dl.subdl.com')return;
    player.querySelectorAll('track').forEach(t=>t.remove());
    const track=document.createElement('track');track.kind='subtitles';track.label='Українська';track.srclang='uk';track.src=u.href;track.default=true;player.append(track);
    if($('#subtitle-results'))$('#subtitle-results').textContent='Доріжку додано. Якщо субтитри не показуються, джерело може блокувати CORS.';
  }catch{}
}
async function api(path) {
  const response = await fetch(path, { headers: { Accept:'application/json' } });
  if (!response.ok) { let msg='Сервер недоступний';try { msg=(await response.json()).error || msg; }catch{} throw new Error(msg); }
  const data=await response.json();
  if (!data || typeof data!=='object') throw new Error('Неправильна відповідь API');
  return data;
}
function demoSection(section) {
  if (section === 'movies') return state.demo.filter(i => i.type === 'movie');
  if (section === 'series') return state.demo.filter(i => i.type === 'tv');
  if (section === 'animation') return state.demo.filter(i => i.type === 'movie' && i.genreIds?.includes(16));
  if (section === 'anime') return state.demo.filter(i => i.genreIds?.includes(16));
  return state.demo;
}
async function fetchSection(section, page=1) {
  if (state.demoMode) return { results:page === 1 ? demoSection(section) : [], page, totalPages:1 };
  try { return await api(`/api/catalog?section=${encodeURIComponent(section)}&page=${page}&sort=${encodeURIComponent(state.sort)}`); }
  catch (error) { if (page !== 1) throw error; toast(`TMDB: ${error.message}. Показано офлайн-каталог.`); return { results:demoSection(section),page:1,totalPages:1 }; }
}
function posterCard(item) {
  const img=imageUrl(item.poster,'w342');
  return `<button type="button" class="poster-card" data-title="${safe(keyFor(item))}" aria-label="${safe(item.title)}">
    <div class="poster-cover"><div class="poster-fallback">${safe(item.title)}</div>${img ? `<img src="${img}" loading="lazy" alt="Постер: ${safe(item.title)}">` : ''}
    ${item.rating ? `<span class="rating-pill">★ ${Number(item.rating).toFixed(1)}</span>` : ''}</div>
    <div class="poster-title">${safe(item.title)}</div><div class="poster-sub">${safe(year(item))} · ${item.type==='tv'?'Серіал':'Фільм'}</div>
  </button>`;
}
function posterGrid(items) { return `<div class="poster-grid">${items.map(posterCard).join('')}</div>`; }
function rail(title, items, section) {
  if (!items?.length) return '';
  return `<section aria-label="${safe(title)}"><div class="section-row"><h2 class="section-title">${safe(title)}</h2><button type="button" class="see-all" data-view="${section}">Усі ${icon('chevron')}</button></div><div class="poster-rail">${items.map(posterCard).join('')}</div></section>`;
}
function modeBanner() {
  // Switch catalog doesn't have a full-width alert above its hero.
  return '';
}
function legalNotice() {
  // Copyright attribution remains unobtrusive; the Switch controller legend is not used on the web.
  return `<p class="tmdb-legal">This product uses the TMDB API but is not endorsed or certified by TMDB. Відеоконтент не розміщується в UAPlay.</p>`;
}
function buildNav() {
  const mainTabs=['home','series','movies','animation','iptv','favorites'];
  $('#side-nav').innerHTML=NAV.filter(([view])=>mainTabs.includes(view)).sort((a,b)=>mainTabs.indexOf(a[0])-mainTabs.indexOf(b[0])).map(([view,label]) => `<button type="button" class="nav-button ${state.view===view||(view==='animation'&&state.view==='anime')?'active':''}" data-view="${view}">${label}</button>`).join('');
  $('#bottom-nav').innerHTML=NAV.filter(([view])=>MOBILE_NAV.includes(view)).map(([view,label,ico])=>`<button type="button" class="bottom-button ${state.view===view?'active':''}" data-view="${view}" aria-label="${label}">${icon(ico)}<span>${label}</span></button>`).join('');
  $('#page-heading').textContent=NAV.find(([name])=>name===state.view)?.[1] || 'UAPlay';
}
function loadVisibleItems(items) {
  for(const i of items || []) state.lists[keyFor(i)] = i;
}
const HOME_SHELVES = [
  ['Популярні фільми','movies'],['Популярні серіали','series'],
  ['Популярні мультфільми','animation'],['Популярні мультсеріали','anime']
];
function heroPanel(movie){
  const key=movie?keyFor(movie):'';
  const img=movie?imageUrl(movie.poster,'w342'):'';
  return `<section class="home-hero" id="catalog-hero" aria-label="Вибраний фільм">
    <div class="hero-content"><h1 class="hero-title" id="hero-title">${safe(movie?.title||'UAPlay')}</h1>
      <div class="hero-meta" id="hero-meta">${movie?`${safe(year(movie))} <span>·</span> ${movie.type==='tv'?'Серіал':'Фільм'}`:''}</div>
      <p class="hero-desc" id="hero-desc">${safe(movie?.overview||'Україномовний каталог фільмів та серіалів.')}</p>
      <div class="hero-buttons"><button class="btn primary" id="hero-watch" data-title="${safe(key)}">▶ &nbsp;Дивитися</button>
      <button class="btn secondary" id="hero-favorite" data-favorite="${safe(key)}">${movie&&state.favorites[key]?'✓  У вибраному':'+  У вибране'}</button></div>
    </div>
    <div class="hero-poster">${img?`<img src="${img}" alt="Постер: ${safe(movie.title)}">`:'<span>UAPLAY</span>'}</div>
  </section>`;
}
function updateHero(movie){
  if(!movie)return;
  const title=$('#hero-title');if(!title)return;
  title.textContent=movie.title||'';
  $('#hero-meta').textContent=`${year(movie)}  ·  ${movie.type==='tv'?'Серіал':'Фільм'}`;
  $('#hero-desc').textContent=movie.overview||'';
  $('#hero-watch').dataset.title=keyFor(movie);
  $('#hero-favorite').dataset.favorite=keyFor(movie);
  $('#hero-favorite').textContent=state.favorites[keyFor(movie)]?'✓  У вибраному':'+  У вибране';
  const poster=$('#catalog-hero .hero-poster');if(poster){const url=imageUrl(movie.poster,'w342');poster.innerHTML=url?`<img src="${url}" alt="Постер: ${safe(movie.title)}">`:'<span>UAPLAY</span>';}
  document.querySelectorAll('.poster-card[data-home-item]').forEach(b=>b.classList.toggle('selected',b.dataset.homeItem===keyFor(movie)));
}
async function renderHome() {
  const id=++state.loadId;
  const sections=['trending','movies','series','animation','anime'];
  if (!Object.keys(state.home).length) {
    content.innerHTML='<div class="loading-bar"></div><div class="loading-bar" style="height:80px;margin-top:30px"></div>';
    const results=await Promise.all(sections.map(s=>fetchSection(s).catch(()=>({results:[]}))));
    if(id!==state.loadId)return;
    sections.forEach((section,i)=>{state.home[section]=results[i].results||[];loadVisibleItems(state.home[section]);});
  }
  state.homeShelf=Math.min(state.homeShelf||0,HOME_SHELVES.length-1);
  const [name,section]=HOME_SHELVES[state.homeShelf];
  const items=state.home[section]||[];
  const movie=items[0]||state.home.trending?.[0]||state.demo[0];
  content.innerHTML=`${modeBanner()}${heroPanel(movie)}
    <div class="shelf-toolbar"><div class="shelf-title">${safe(name)}</div><div class="shelf-actions">
      <span class="shelf-count">${state.homeShelf+1} / ${HOME_SHELVES.length}</span>
      <button class="shelf-arrow" data-shelf-step="-1" aria-label="Попередня добірка">↑</button>
      <button class="shelf-arrow" data-shelf-step="1" aria-label="Наступна добірка">↓</button>
      <button class="btn shelf-more" data-view="${section}">Більше &nbsp;›</button>
    </div></div>
    ${items.length?`<div class="poster-rail switch-rail" id="home-rail">${items.map(item=>posterCard(item).replace('class="poster-card"',`class="poster-card ${movie&&keyFor(item)===keyFor(movie)?'selected':''}" data-home-item="${safe(keyFor(item))}"`)).join('')}</div>`:'<div class="empty">Добірка порожня</div>'}
    ${legalNotice()}`;
}
async function renderCategory(section) {
  const id=++state.loadId;
  const label=NAV.find(([name])=>name===section)?.[1] || 'Каталог';
  content.innerHTML=`<div class="page-intro"><div><h1>${label}</h1><p>Добірка UAPlay</p></div></div>${modeBanner()}<div class="loading-bar"></div>`;
  const data=await fetchSection(section).catch(()=>({results:[],page:1,totalPages:1}));
  if(id!==state.loadId) return;
  state.page=1;state.activeCategory=section;state.categoryTotal=data.totalPages||1;state.categoryItems=data.results||[];loadVisibleItems(state.categoryItems);
  paintCategory();
}
function sortControl(){return '<div class="setting-control"><label for="catalog-sort">Сортування</label><select id="catalog-sort">'+[['popularity','Популярність'],['newest','Найновіші'],['oldest','Найстаріші'],['rating','Рейтинг']].map(([v,t])=>'<option value="'+v+'" '+(state.sort===v?'selected':'')+'>'+t+'</option>').join('')+'</select></div>';}
function paintCategory() {
  const label=NAV.find(([name])=>name===state.activeCategory)?.[1]||'Каталог';
  content.innerHTML=`<div class="page-intro"><div><h1>${label}</h1><p>${state.categoryItems.length} записів у добірці</p></div></div>${modeBanner()}
    ${sortControl()}${state.categoryItems.length?posterGrid(state.categoryItems):`<div class="empty"><div class="empty-icon">◇</div><h2>Поки немає записів</h2><p>Підключіть TMDB, щоб побачити повний каталог.</p></div>`}
    ${state.page<state.categoryTotal?'<button class="load-more" data-more>Завантажити ще</button>':''}${legalNotice()}`;
}
async function loadMore() {
  if(state.page>=state.categoryTotal || !state.activeCategory)return;
  const button=$('[data-more]');if(button){button.disabled=true;button.textContent='Завантаження…';}
  try {const data=await fetchSection(state.activeCategory,state.page+1);state.page++;state.categoryItems=unique([...state.categoryItems,...data.results]);loadVisibleItems(data.results);paintCategory();}
  catch(e){toast(e.message);if(button){button.disabled=false;button.textContent='Повторити';}}
}
async function renderSearch() {
  ++state.loadId;
  content.innerHTML=`<div class="page-intro"><div><h1>Пошук</h1><p>Знайдіть фільм або серіал за назвою</p></div></div>${modeBanner()}
    <label class="search-box">${icon('search')}<input id="search-input" autocomplete="off" type="search" placeholder="Введіть назву фільму або серіалу…" value="${safe(state.searchQuery)}" aria-label="Назва фільму чи серіалу"></label>
    <div id="search-results"></div>${legalNotice()}`;
  await performSearch();
}
async function performSearch() {
  const query=state.searchQuery.trim();
  const target=$('#search-results');if(!target)return;
  if(query.length<2){target.innerHTML='<div class="empty"><div class="empty-icon">⌕</div><h2>Що шукаємо?</h2><p>Почніть вводити назву — результат з’явиться тут.</p></div>';return;}
  target.innerHTML='<p class="muted">Шукаємо…</p>';
  const id=++state.loadId;
  let results=[];
  try {
    if(!state.demoMode) results=(await api(`/api/search?q=${encodeURIComponent(query)}`)).results || [];
    else results=state.demo.filter(i=>`${i.title} ${i.originalTitle}`.toLocaleLowerCase('uk').includes(query.toLocaleLowerCase('uk')));
  } catch(e) {target.innerHTML=`<div class="empty">${safe(e.message)}</div>`;return;}
  if(id!==state.loadId || state.view!=='search')return;
  loadVisibleItems(results);
  target.innerHTML=results.length?`<div class="section-row"><h2 class="section-title">Результати (${results.length})</h2></div>${posterGrid(results)}`:'<div class="empty"><h2>Нічого не знайдено</h2><p>Спробуйте іншу назву.</p></div>';
}
function episodeKey(item,season=state.selectedSeason,episode=state.selectedEpisode){
  return keyFor(item)+':'+season+':'+episode;
}
function rememberPlayback(item,seconds,finished=false){
  if(!item||!['movie','tv'].includes(item.type))return;
  const key=keyFor(item);
  state.history[key]={...item,watchedAt:Date.now(),completed:finished};
  if(item.type==='tv'){
    const s=state.activePlayer?.season||state.selectedSeason,e=state.activePlayer?.episode||state.selectedEpisode;
    const ek=episodeKey(item,s,e);
    if(finished)delete state.episodeProgress[ek];else state.episodeProgress[ek]=seconds;
    state.lastEpisode[key]={season:s,episode:e};
  }else if(finished)delete state.progress[key];else state.progress[key]=seconds;
  save();
}
function libraryDB(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(Error('Локальне сховище недоступне'));return;}
    const request=indexedDB.open('uaplay-offline',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('videos',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function offlineOperation(mode,method,value){
  const db=await libraryDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('videos',mode);const store=tx.objectStore('videos');
    const r=value===undefined?store[method]():store[method](value);
    tx.oncomplete=()=>{db.close();resolve(r.result);};
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||r.error);};
  });
}
async function importOffline(file){
  if(!file)return;
  if(!file.type.startsWith('video/')&&!/\.(mp4|m4v|mov|webm|ogv)$/i.test(file.name)){toast('Оберіть підтримуваний відеофайл');return;}
  try{
    try{await navigator.storage?.persist?.();}catch{}
    await offlineOperation('readwrite','put',{id:crypto.randomUUID(),name:file.name,size:file.size,blob:file,added:Date.now()});
    toast('Відео збережено для офлайн-перегляду');state.libraryTab='offline';await renderFavorites();
  }catch(e){toast('Не вдалося зберегти файл: '+(e?.message||'ліміт сховища'));}
}
const MAX_LOCAL_DOWNLOAD=256*1024*1024;
function drawDownloads(){
  const target=$('#download-queue');if(!target)return;
  target.innerHTML=state.downloads.map(j=>{
    const progress=j.total?Math.min(100,Math.floor(j.bytes/j.total*100))+'%':(j.bytes/1048576).toFixed(1)+' МБ';
    const label={queued:'У черзі',active:'Завантаження',paused:'Пауза',failed:'Помилка',done:'Готово'}[j.status]||j.status;
    return '<div class="offline-row"><strong>'+safe(j.name)+'</strong> · '+safe(label)+' · '+safe(progress)+' '+safe(j.error||'')+
      (j.status==='active'||j.status==='queued'?'<button class="btn secondary" data-download-pause="'+j.id+'">Пауза</button>':'')+
      (j.status==='paused'||j.status==='failed'?'<button class="btn secondary" data-download-resume="'+j.id+'">Продовжити / повторити</button>':'')+
      '<button class="btn danger" data-download-cancel="'+j.id+'">'+(j.status==='done'?'Прибрати зі списку':'Скасувати')+'</button></div>';
  }).join('');
}
function enqueueDownload(raw){
  let u;try{u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||!/\.(mp4|m4v|webm|mov)$/i.test(u.pathname))throw Error();}catch{return toast('Потрібна пряма HTTPS-адреса дозволеного відеофайлу MP4, MOV або WebM.');}
  if(state.downloads.length>=16)return toast('Черга заповнена');
  const id=crypto.randomUUID(),name=decodeURIComponent(u.pathname.split('/').at(-1)||'video').slice(0,150);
  state.downloads.push({id,url:u.href,name,status:'queued',bytes:0,total:0,error:''});
  drawDownloads();runDownloadQueue();
}
async function runDownloadQueue(){
  if(state.downloadActive||$('#video'))return;
  const job=state.downloads.find(x=>x.status==='queued');if(!job)return;
  const controller=new AbortController();state.downloadActive={id:job.id,controller};
  job.status='active';job.bytes=0;job.total=0;job.error='';drawDownloads();
  try{
    const response=await fetch(job.url,{signal:controller.signal,mode:'cors',credentials:'omit',redirect:'error'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const mime=response.headers.get('content-type')||'';
    if(!/^video\/|^application\/octet-stream/i.test(mime))throw Error('Сервер не повернув відеофайл');
    job.total=Number(response.headers.get('content-length'))||0;
    if(job.total>MAX_LOCAL_DOWNLOAD)throw Error('Ліміт вебзавантаження: 256 МБ на файл');
    const reader=response.body?.getReader();if(!reader)throw Error('Потокове завантаження не підтримується');
    const chunks=[];let lastPaint=0;
    while(true){
      const {done,value}=await reader.read();if(done)break;
      job.bytes+=value.byteLength;
      if(job.bytes>MAX_LOCAL_DOWNLOAD){await reader.cancel();throw Error('Ліміт 256 МБ перевищено');}
      chunks.push(value);if(Date.now()-lastPaint>250){drawDownloads();lastPaint=Date.now();}
    }
    if(controller.signal.aborted||job.status!=='active')return;
    const blob=new Blob(chunks,{type:mime.split(';')[0]});
    await offlineOperation('readwrite','put',{id:job.id,name:job.name,size:blob.size,blob,added:Date.now()});
    if(job.status==='active'){job.status='done';toast('Завантаження завершено');}
    else await offlineOperation('readwrite','delete',job.id);
  }catch(e){if(job.status==='active'){job.status='failed';job.error=e.message||'Мережевий збій';}}
  finally{state.downloadActive=null;drawDownloads();if(state.view==='favorites'&&state.libraryTab==='offline')renderFavorites();runDownloadQueue();}
}
function controlDownload(id,action){
  const j=state.downloads.find(x=>x.id===id);if(!j)return;
  if(action==='pause'){j.status='paused';if(state.downloadActive?.id===id)state.downloadActive.controller.abort();}
  else if(action==='resume'){j.status='queued';j.error='';}
  else{j.status='cancelled';if(state.downloadActive?.id===id)state.downloadActive.controller.abort();state.downloads=state.downloads.filter(x=>x.id!==id);}
  drawDownloads();runDownloadQueue();
}
async function renderFavorites(){
  ++state.loadId;const id=state.loadId;
  const tabs=[['saved','На майбутнє'],['all','Вибране'],['history','Історія'],['offline','Завантажені']];
  const tab=state.libraryTab||'saved';
  const nav='<div class="library-tabs">'+tabs.map(([v,t])=>'<button class="btn '+(v===tab?'primary':'secondary')+'" data-library-tab="'+v+'">'+t+'</button>').join('')+'</div>';
  if(tab==='offline'){
    content.innerHTML='<div class="page-intro"><h1>Вибране</h1></div>'+nav+'<div class="settings-card"><p>Імпортуйте власні відеофайли для перегляду без інтернету. Браузер може очищати локальне сховище.</p><input id="offline-import" type="file" accept="video/*,.mp4,.m4v,.mov,.webm"><form id="offline-download-form" class="player-form"><input class="input-line" id="offline-url" type="url" required placeholder="HTTPS-адреса вашого MP4 / WebM"><button class="btn secondary" type="submit">Завантажити</button></form><p class="section-note">Тільки файли, які дозволено зберігати. Потрібна підтримка CORS. Максимум 256 МБ. Після паузи завантаження починається заново.</p></div><div id="download-queue"></div><div id="offline-list">Завантаження…</div>';drawDownloads();
    const target=$('#offline-list');
    try{
      const rows=await offlineOperation('readonly','getAll');
      if(id!==state.loadId||!target.isConnected)return;
      target.innerHTML=rows.length?rows.map(r=>'<div class="setting-control offline-row"><span>'+safe(r.name)+' · '+(r.size/1048576).toFixed(1)+' МБ</span><button class="btn secondary" data-offline-play="'+safe(r.id)+'">Дивитися</button><button class="btn danger" data-offline-delete="'+safe(r.id)+'">Видалити</button></div>').join(''):'<p class="muted">Немає локальних відео.</p>';
    }catch(e){if(target.isConnected)target.textContent='Сховище недоступне: '+e.message;}
    return;
  }
  const items=tab==='history'?Object.values(state.history).sort((a,b)=>b.watchedAt-a.watchedAt):Object.values(state.favorites).filter(i=>tab==='all'||!state.history[keyFor(i)]);
  loadVisibleItems(items);
  content.innerHTML='<div class="page-intro"><h1>Вибране</h1></div>'+nav+(tab==='history'?'<button class="btn secondary" data-clear-history>Очистити історію</button>':'')+(items.length?posterGrid(items):'<div class="empty"><h2>Тут поки порожньо</h2></div>')+legalNotice();
}
const IPTV_REGIONS=["AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ","BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM","HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RW","SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","UK","UM","US","UY","UZ","VA","VC","VE","VG","VI","VN","VU","WF","WS","XK","YE","YT","ZA","ZM","ZW"];
function countryOptions(){const names=new Intl.DisplayNames(['uk'],{type:'region'});return IPTV_REGIONS.map(c=>[c.toLowerCase(),names.of(c)]).sort((a,b)=>a[1].localeCompare(b[1],'uk')).map(([c,n])=>'<option value="'+c+'">'+safe(n)+'</option>').join('');}
async function renderIptv() {
  const id=++state.loadId;
  content.innerHTML=`<div class="page-intro"><div><h1>IPTV</h1><p>Прямі трансляції з відкритих плейлистів iptv-org</p></div></div>
    <div class="setting-control" style="margin-bottom:20px"><label for="iptv-country">Країна</label><select id="iptv-country" aria-label="Країна IPTV">${countryOptions()}</select></div>
    <label class="search-box">${icon('search')}<input type="search" id="channel-search" value="${safe(state.channelQuery)}" placeholder="Знайти телеканал…" aria-label="Пошук телеканалів"></label><div class="setting-control"><label for="iptv-group">Жанр</label><select id="iptv-group"><option value="">Усі жанри</option></select><button type="button" class="btn secondary" data-iptv-favorites>${state.iptvOnlyFavorites?"Усі канали":"★ Вибране"}</button></div><div id="iptv-results"><p class="muted">Завантажуємо канали…</p></div>${legalNotice()}`;
  $('#iptv-country').value=state.iptvCountry;
  try {const result=await api(`/api/iptv?country=${state.iptvCountry}`);if(id!==state.loadId)return;state.channels=result.channels||[];paintChannels();}
  catch(e){if(id!==state.loadId)return;$('#iptv-results').innerHTML=`<div class="empty"><h2>Не вдалося завантажити IPTV</h2><p>${safe(e.message)}</p><button type="button" class="btn primary" data-refresh-iptv>Спробувати знову</button></div>`;}
}
function paintChannels() {
  const target=$('#iptv-results');if(!target)return;
  const query=state.channelQuery.toLocaleLowerCase('uk');
  const list=state.iptvOnlyFavorites?Object.values(state.iptvFavorites):state.channels;
  const groups=[...new Set(list.map(c=>c.group).filter(Boolean))].sort();
  const select=$('#iptv-group');if(select){select.innerHTML='<option value="">Усі жанри</option>'+groups.map(g=>'<option value="'+safe(g)+'">'+safe(g)+'</option>').join('');if(groups.includes(state.iptvGroup))select.value=state.iptvGroup;else state.iptvGroup='';}
  state.visibleChannels=list.filter(c=>(!state.iptvGroup||c.group===state.iptvGroup)&&`${c.name} ${c.group}`.toLocaleLowerCase('uk').includes(query));
  const channels=state.visibleChannels;
  target.innerHTML=`<p class="section-note">${channels.length} каналів · деякі потоки можуть бути недоступні у Safari</p>
    ${channels.length?`<div class="channel-grid">${channels.map(c=>{
      const index=channels.indexOf(c);const logo=externalImageUrl(c.logo);
      return `<div class="channel-entry"><button type="button" class="channel-card" data-channel="${index}">${logo?`<img class="channel-logo" src="${safe(logo)}" loading="lazy" alt="">`:`<div class="channel-logo" style="display:grid;place-items:center;background:#303140;color:#d7c6ff">${icon('live')}</div>`}<div style="min-width:0;flex:1"><div class="channel-name">${safe(c.name)}</div><div class="channel-group">${safe(c.group||'Прямий ефір')}</div></div>${icon('play')}</button><button class="btn secondary" data-channel-favorite="${index}" aria-label="Вибране IPTV">${state.iptvFavorites[c.url]?'★':'☆'}</button></div>`;
    }).join('')}</div>`:'<div class="empty">За вашим запитом каналів не знайдено.</div>'}`;
}
function uaFlixAccountCard(){
  return `<div class="settings-card" id="uaflix-account"><h3>UAFlix — акаунт</h3>
    <div class="status-line"><span class="status-bullet bad"></span>Акаунт не підключений до UAPlay</div>
    <p>Вхід та реєстрація відбуваються на сайті UAFlix. UAPlay не отримує пароль або сесію сайту.</p>
    <div class="setting-control"><a class="btn secondary" href="https://uafix.net/" target="_blank" rel="noopener noreferrer">Увійти / зареєструватися на UAFlix ↗</a></div>
    <p class="section-note">Авторизація на сайті не переноситься автоматично у Cloudflare Worker. Для підключення акаунта потрібен підтримуваний UAFlix механізм делегованого доступу.</p></div>`;
}
async function renderSettings() {
  ++state.loadId;
  let configured=state.tmdbConfigured;
  try{configured=(await api('/api/health')).tmdbConfigured;}catch{}
  state.tmdbConfigured=configured;
  content.innerHTML=`<div class="page-intro"><div><h1>Налаштування</h1><p>Зовнішній вигляд і дані UAPlay</p></div></div>
    <div class="settings-card"><h3>Колір акценту</h3><p>Налаштуйте оформлення під свій смак.</p>
      <div class="swatches">${[['turquoise','#3DD7BB'],['cyan','#3BADE0'],['yellow','#F5D100'],['orange','#FF6A00'],['red','#FF2247'],['violet','#6A0DAD'],['blue','#1490D7'],['green','#12B89A'],['pink','#F42A9A'],['white','#FFFFFF']].map(([name,color])=>`<button type="button" class="swatch" style="background:${color}" data-accent="${name}" aria-label="Колір: ${name}" aria-pressed="${state.accent===name}"></button>`).join('')}</div></div>
    <div class="settings-card"><h3>Тема</h3><div class="setting-control"><button class="btn secondary" data-theme="dark">Темна</button><button class="btn secondary" data-theme="light">Світла</button></div></div><div class="settings-card"><h3>Джерела</h3>${PROVIDER_FALLBACK.map(([id,name])=>`<div class="setting-control"><span>${safe(name)}</span><button class="btn secondary" data-provider-toggle="${id}">${state.disabledProviders.includes(id)?"Вимкнено":"Увімкнено"}</button></div>`).join("")}</div>${uaFlixAccountCard()}<div class="settings-card"><h3>Шпалери</h3><p>Пошук Wallhaven, як у Switch-версії.</p><button type="button" class="btn secondary" data-wallpapers>Відкрити галерею</button></div>
    <div class="settings-card"><h3>Каталог TMDB</h3><p>Статус API та доступність актуальних назв.</p>
      <div class="status-line"><span class="status-bullet ${configured?'':'bad'}"></span>${configured?'Ключ TMDB задано. Якщо каталог не відкривається, перевірте /api/catalog.':'TMDB_API_KEY або TMDB_TOKEN не задано — увімкнено демонстраційний режим'}</div></div>
    <div class="settings-card"><h3>Збережені дані</h3><p>Вибране, джерела та позиції перегляду зберігаються тільки в цьому браузері.</p>
      <div class="setting-control"><span class="muted">Вибране: ${Object.keys(state.favorites).length} · Прогрес: ${Object.keys(state.progress).length}</span><button type="button" class="btn danger" data-clear-local>${icon('trash')} Очистити дані</button></div></div>
    <div class="settings-card"><h3>Встановити на iPhone</h3><p>Відкрийте сайт через Safari → «Поділитися» → «На початковий екран». UAPlay відкриватиметься як окремий застосунок.</p></div>
    <div class="settings-card"><h3>Про UAPlay</h3><p>UAPlay Web v0.5.4 — Switch-style PWA-порт проєкту UAPlay-nx. Застосунок не містить відеофайлів.</p>
      <a class="see-all" href="https://github.com/Small182/UAPlay-nx" target="_blank" rel="noopener noreferrer">Оригінальний Switch-проєкт</a></div>${legalNotice()}`;
}
async function showView(view) {
  if(!NAV.some(([v])=>v===view)&&!HOME_SHELVES.some(([,v])=>v===view))view='home';
  state.view=view;state.loadId++;buildNav();modal.innerHTML='';
  if(view==='home')await renderHome();
  else if(['movies','series','animation','anime'].includes(view)||HOME_SHELVES.some(([,v])=>v===view))await renderCategory(view);
  else if(view==='search')await renderSearch();
  else if(view==='favorites')renderFavorites();
  else if(view==='iptv')await renderIptv();
  else await renderSettings();
  window.scrollTo({top:0,behavior:'auto'});
}
function toggleFavorite(key) {
  const item=state.lists[key] || state.activeItem;
  if(!item)return;
  if(state.favorites[key]){delete state.favorites[key];toast('Видалено з вибраного');}
  else{state.favorites[key]=item;toast('Додано до вибраного');}
  save();
  if(state.view==='favorites')renderFavorites();
  else if(modal.querySelector('.detail-modal')){const btn=modal.querySelector('[data-favorite]');if(btn){btn.innerHTML=`${icon(state.favorites[key]?'check':'add')} ${state.favorites[key]?'У вибраному':'Вибране'}`;}}
  else if(state.view==='home')renderHome();
}
async function openDetails(key) {
  const basic=state.lists[key] || state.favorites[key];
  if(!basic)return;
  state.activeItem=basic;state.selectedSeason=state.lastEpisode[key]?.season||1;state.selectedEpisode=state.lastEpisode[key]?.episode||1;
  drawDetails(basic,true);
  if(state.demoMode)return;
  try{const data=await api(`/api/title/${basic.type}/${basic.id}`);if(!modal.querySelector('.detail-modal')||keyFor(state.activeItem)!==key)return;state.activeItem={...basic,...data};state.lists[key]=state.activeItem;drawDetails(state.activeItem,false);}
  catch(e){toast(e.message);drawDetails(basic,false);}
}
function drawDetails(item,loading=false) {
  const poster=imageUrl(item.poster,'w500');const key=keyFor(item);
  modal.innerHTML=`<div class="modal-backdrop" data-close><section class="detail-modal switch-detail-screen" role="dialog" aria-modal="true" aria-label="${safe(item.title)}">
    <button type="button" class="close-modal" data-close aria-label="Закрити">${icon('close')}</button>
    <div class="switch-screen-header"><button type="button" class="switch-back" data-close aria-label="Назад">‹</button><h1>Про ${item.type==='tv'?'серіал':'фільм'}</h1><span>UAPlay</span></div>
    <div class="detail-layout"><div class="detail-body"><h2>${safe(item.title)}</h2>
      <div class="hero-meta"><span class="stars">★ ${Number(item.rating||0).toFixed(1)}</span><span>${safe(year(item))}</span><span>${item.type==='tv'?'Серіал':'Фільм'}</span>${item.runtime?`<span>${item.runtime} хв</span>`:''}</div>
      <p class="detail-description">${safe(item.overview || 'Опис відсутній.')}</p>
      ${item.genres?.length?`<p class="section-note">${safe(item.genres.join(' · '))}</p>`:''}
      <div class="detail-buttons"><button class="btn primary" data-sources="${safe(key)}">${icon('play')} Дивитися</button>
      <button class="btn secondary" data-favorite="${safe(key)}">${icon(state.favorites[key]?'check':'add')} ${state.favorites[key]?'У вибраному':'Вибране'}</button><button class="btn secondary" data-mark-watched="${safe(key)}">${state.history[key]?.completed?'Переглянуто':'Позначити переглянутим'}</button></div>
      ${item.type==='tv'?`<div class="detail-extra"><h3>Сезони й серії</h3>${item.seasonList?.length?`<div class="setting-control"><label for="season-select">Сезон</label><select id="season-select">${item.seasonList.map(s=>`<option value="${s.number}">${safe(s.title||`Сезон ${s.number}`)} · ${s.episodes} серій</option>`).join('')}</select></div><div id="episode-list" style="margin-top:13px">Обирайте сезон, щоб переглянути серії.</div>`:`<p class="section-note">${loading?'Завантажуємо список сезонів…':'Інформація про сезони недоступна у деморежимі.'}</p>`}</div>`:''}
      ${loading?'<p class="section-note">Завантажуємо подробиці…</p>':''}
    </div><div class="detail-poster">${poster?`<img src="${poster}" alt="Постер: ${safe(item.title)}">`: ''}</div></div></section></div>`;
  if(item.seasonList?.length){const select=$('#season-select');if(select){select.value=String(state.selectedSeason);if(!select.value)select.selectedIndex=0;loadSeason(select.value);}}
}
async function loadSeason(number) {
  const item=state.activeItem; if(!item||item.type!=='tv'||state.demoMode)return;
  const target=$('#episode-list');if(!target)return;
  target.innerHTML='<span class="muted">Завантажуємо серії…</span>';
  const currentKey=keyFor(item);
  try{
    const data=await api(`/api/title/tv/${item.id}/season/${number}`);
    if(keyFor(state.activeItem)!==currentKey || !$('#episode-list'))return;
    target.innerHTML=(data.episodes||[]).map(ep=>`<button type="button" class="episode" data-episode="${ep.number}" aria-label="Серія ${ep.number}"><span class="episode-num">${ep.number}</span><div class="episode-info"><div class="episode-title">${safe(ep.title)}</div><div class="episode-desc">${safe(ep.overview||'')}</div></div><span>›</span></button>`).join('') || '<p class="muted">Серій не знайдено.</p>';
  }catch(e){if($('#episode-list'))$('#episode-list').innerHTML=`<p class="muted">${safe(e.message)}</p>`;}
}
const PROVIDER_FALLBACK=[['uaflix','UAFlix'],['uaserials','UASerials'],['eneyida','Eneyida'],['uafilm','UAFilm'],['uakino','UAKino'],['mikai','Mikai'],['animeon','AnimeON']];
function switchScreen(title,body,back='close'){
  const backAction=back==='providers'?'data-back-providers':'data-close';
  return `<div class="modal-backdrop switch-modal-backdrop" data-close><section class="switch-screen" role="dialog" aria-modal="true" aria-label="${safe(title)}">
    <header class="switch-screen-header"><button type="button" class="switch-back" ${backAction} aria-label="Назад">‹</button><h1>${safe(title)}</h1></header>
    <div class="switch-screen-body">${body}</div>
  </section></div>`;
}
function showSources(item){
  cleanupPlayer();state.activePlayer=null;state.activeItem=item;state.activeProvider='';
  const extra=item.type==='tv'?`<p class="switch-subtitle">Сезон ${state.selectedSeason} · Серія ${state.selectedEpisode}</p>`:'';
  modal.innerHTML=switchScreen('Оберіть джерело',`${extra}<div class="switch-list-rows">${PROVIDER_FALLBACK.filter(([id])=>!state.disabledProviders.includes(id)).map(([id,name])=>`<button type="button" class="switch-row" data-provider="${id}"><span>${safe(name)}</span><span class="row-trailing">›</span></button>`).join('')}</div>
    <div class="source-bottom"><button class="btn secondary" data-player="${safe(keyFor(item))}">Власне пряме посилання MP4 / HLS</button></div>`);
}
async function loadProvider(provider){
  const item=state.activeItem;if(!item)return;
  state.activeProvider=provider;
  const providerName=PROVIDER_FALLBACK.find(p=>p[0]===provider)?.[1]||provider;
  modal.innerHTML=switchScreen('Джерела відео',`<p class="switch-subtitle">${safe(providerName)} · ${safe(item.title)}</p><div id="source-results" class="switch-list-rows" aria-live="polite"><p class="switch-subtitle">Шукаємо матеріали…</p></div>`, 'providers');
  const chosen=keyFor(item);const box=$('#source-results');
  const releaseYear=String(item.date||'').slice(0,4);
  try{
    let data=await api(`/api/providers/search?provider=${encodeURIComponent(provider)}&q=${encodeURIComponent(item.title)}&type=${encodeURIComponent(item.type)}&original=${encodeURIComponent(item.originalTitle||'')}&year=${encodeURIComponent(releaseYear)}`);
    if(!data.results?.length && item.originalTitle&&item.originalTitle!==item.title)
      data=await api(`/api/providers/search?provider=${encodeURIComponent(provider)}&q=${encodeURIComponent(item.originalTitle)}&type=${encodeURIComponent(item.type)}&original=${encodeURIComponent(item.title)}&year=${encodeURIComponent(releaseYear)}`);
    if(keyFor(state.activeItem)!==chosen||state.activeProvider!==provider||!$('#source-results'))return;
    box.innerHTML=data.results?.length?data.results.map((source,i)=>`<button type="button" class="switch-row" data-media-provider="${safe(provider)}" data-media-id="${safe(source.id)}"><span class="row-index">${i+1}.</span><span>${safe(source.title)}${source.year&&!source.title.includes(String(source.year))?` · ${source.year}`:""}${source.season?` · Сезон ${source.season}`:""}</span><span class="row-trailing">›</span></button>`).join(''):
      '<p class="switch-subtitle">Нічого не знайдено. Джерело може бути недоступне або змінити структуру сайту.</p>';
  }catch(e){if(box.isConnected&&state.activeProvider===provider)box.innerHTML=`<p class="switch-subtitle">${safe(e.message)}</p>${provider==='uaflix'&&/403/.test(e.message)?'<p class="switch-subtitle">UAFlix відхилив запит сервера. Можна перевірити акаунт на сайті, але вхід там не підключає сесію до UAPlay.</p><a class="source-external" href="https://uafix.net/" target="_blank" rel="noopener noreferrer">Відкрити UAFlix ↗</a>':''}<button type="button" class="btn secondary" data-provider="${safe(provider)}">Повторити пошук</button><button type="button" class="btn secondary" data-back-providers>Обрати інше джерело</button>`;}
}
function renderStreamChoices(data){
  const source=state.activeSource;
  if(!source)return;
  const streams=Array.isArray(data.streams)?data.streams:[];
  const episodes=Array.isArray(data.episodes)?data.episodes:[];
  const filtered=episodes.filter(s=>!s.season||s.season===state.selectedSeason).filter(s=>!s.episode||s.episode===state.selectedEpisode);
  const choices=state.activeItem?.type==='tv'&&episodes.some(s=>s.season||s.episode)?filtered:streams;
  const emptyMessage=episodes.length&&streams.length?'Для вибраної серії немає доступного відео.':data.mediaStatus==='access_denied'?'Відеосервер відхилив запит.':data.mediaStatus==='removed'?'Відео недоступне або видалене на стороні джерела.':data.mediaStatus==='upstream_error'?'Не вдалося отримати відповідь відеосервера.':data.mediaStatus==='no_supported_media'?'Сторінка містить вкладений плеєр, але він не надав сумісного MP4/HLS.':'На сторінці немає доступного прямого MP4/HLS.';
  const list=choices.map((stream,i)=>`<button type="button" class="switch-row" data-stream-url="${safe(stream.url)}"><span class="row-index">${i+1}.</span><span>${safe(stream.label||stream.voice||`Варіант ${i+1}`)} · ${stream.type==='hls'?'HLS':'MP4'}</span><span class="row-trailing">▶</span></button>`).join('');
  const fallback=source.url?`<a class="source-external" href="${safe(source.url)}" rel="noopener noreferrer" target="_blank">Відкрити сторінку джерела ↗</a>`:'';
  modal.innerHTML=switchScreen('Вибір відео',`<p class="switch-subtitle">${safe(state.activeItem?.title||'')} ${state.activeItem?.type==='tv'?`· Сезон ${state.selectedSeason} · Серія ${state.selectedEpisode}`:''}</p><div class="switch-list-rows">${list||`<p class="switch-subtitle">${safe(emptyMessage)}</p><button class="btn secondary" data-back-providers>Обрати інше джерело</button>`}</div>${!choices.length&&data.warnings?.length?`<p class="switch-subtitle">${safe(data.warnings[0].message)}</p>`:''}${fallback}`, 'providers');
}
async function playProviderMedia(provider,id){
  const item=state.activeItem;if(!item)return;
  state.activeSource={provider,id,url:!['mikai','animeon'].includes(provider)?id:''};
  modal.innerHTML=switchScreen('Пошук потоку','<p class="switch-subtitle">Отримуємо відео та список серій із джерела…</p>','providers');
  const chosen=keyFor(item);
  try{
    const data=await api(`/api/providers/media?provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(id)}`);
    if(keyFor(state.activeItem)!==chosen||!state.activeSource||state.activeSource.id!==id)return;
    const streams=data.streams||[];
    if(streams.length===1 && (!item.type || item.type!=='tv') && !(data.episodes?.length>1)) {
      openPlayer(item,streams[0].url);return;
    }
    renderStreamChoices(data);
  }catch(e){
    if($('#modal-root .switch-screen')&&state.activeSource?.id===id&&state.activeProvider===provider)modal.innerHTML=switchScreen('Потік недоступний',`<p class="switch-subtitle">${safe(e.message)}</p><button type="button" class="btn secondary" data-back-providers>Обрати інше джерело</button>${state.activeSource?.url?`<a class="source-external" href="${safe(state.activeSource.url)}" target="_blank" rel="noopener noreferrer">Перевірити на сайті джерела ↗</a>`:''}`,'providers');
  }
}

function setPlayerControls(visible, hideAfter=0) {
  const frame=$('.player-frame');
  if(!frame)return;
  clearTimeout(state.playerControlsTimer);
  frame.classList.toggle('controls-hidden', !visible);
  if(visible && hideAfter)state.playerControlsTimer=setTimeout(()=>{
    if($('#video') && !$('#video').paused)frame.classList.add('controls-hidden');
  },hideAfter);
}
function cleanupPlayer() {
  clearTimeout(state.playerControlsTimer);
  if(state.hls){state.hls.destroy();state.hls=null;}
  if(state.wakeLock){state.wakeLock.release().catch(()=>{});state.wakeLock=null;}
  if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;}
  for(const url of state.subtitleUrls)URL.revokeObjectURL(url);state.subtitleUrls=[];
  const video=modal.querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();}
}
function openPlayer(item, presetUrl, localBlob=null) {
  cleanupPlayer();
  if(state.downloadActive){const job=state.downloads.find(j=>j.id===state.downloadActive.id);if(job){job.status='queued';state.downloadActive.controller.abort();}}
  const key=keyFor(item);
  state.activePlayer={key,item,season:state.selectedSeason,episode:state.selectedEpisode};
  const storedUrl= presetUrl || state.sources[key] || '';
  modal.innerHTML=`<div class="modal-backdrop" data-close><section class="player-modal" role="dialog" aria-modal="true" aria-label="Плеєр">
    <div class="player-top"><h2>${safe(item.title)}</h2><button type="button" class="close-modal" data-close aria-label="Закрити">${icon('close')}</button></div>
    <div class="player-frame"><video id="video" playsinline webkit-playsinline preload="metadata" tabindex="0" aria-label="Відео: дотик або клік — показати чи сховати керування" poster="${safe(imageUrl(item.backdrop,'w1280'))}"></video>
      <div class="switch-player-panel" id="switch-player-panel"><div class="switch-player-seek"><span id="time-elapsed">0:00</span><input type="range" id="video-seek" min="0" max="100" step="0.1" value="0" aria-label="Перемотування"><span id="time-total">0:00</span></div>
      <div class="switch-player-actions"><button type="button" class="switch-transport" data-seek="-10" aria-label="Назад 10 секунд">↶</button><button type="button" class="switch-transport switch-play" data-toggle-play aria-label="Плей/пауза">▶</button><button type="button" class="switch-transport" data-seek="10" aria-label="Вперед 10 секунд">↷</button></div><button type="button" class="switch-fullscreen" data-fullscreen>⛶ Повний екран</button></div></div>
    ${presetUrl||localBlob?'':`<form id="stream-form" class="player-form"><input id="stream-url" class="input-line" type="url" spellcheck="false" autocomplete="off" placeholder="https://…/video.m3u8 або .mp4" aria-label="Адреса відеопотоку" value="${safe(storedUrl)}" required><button class="btn primary" type="submit">${icon('play')} Відтворити</button></form>`}
    <div class="player-form player-options"><label>Швидкість <select id="player-rate">${[0.5,0.75,1,1.25,1.5,2].map(v=>`<option value="${v}" ${v===state.playerRate?'selected':''}>${v}×</option>`).join('')}</select></label><label>Гучність <input type="range" id="player-volume" min="0" max="1" step="0.05" value="${state.playerVolume}"></label><label>Яскравість відео <input type="range" id="player-brightness" min="0.4" max="1.4" step="0.05" value="1"></label><label>Якість <select id="player-quality"><option value="-1">Авто</option></select></label><label>Аудіо <select id="player-audio"><option value="-1">За замовчуванням</option></select></label><label>Субтитри <select id="player-track"><option value="-1">Вимкнено</option></select></label><label>Файл субтитрів <input id="local-subtitle" type="file" accept=".vtt,.srt"></label><label>Розмір субтитрів <select id="subtitle-size"><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option></select></label>${['movie','tv'].includes(item.type)?'<button type="button" class="btn secondary" data-subtitles>Шукати субтитри SubDL</button>':''}<div id="subtitle-results"></div>${item.type==='tv'?'<button class="btn secondary" data-episode-step="-1">Попередня серія</button><button class="btn secondary" data-episode-step="1">Наступна серія</button>':''}</div>
    <div class="player-help" id="player-help">${presetUrl?'Потік з джерела. Натисніть ▶, якщо Safari не дозволив автоматичний запуск.':'Введіть пряме HTTPS-посилання MP4 / HLS.'}</div>
    </section></div>`;
  const video=$('#video');
  const timeLabel=seconds=>{if(!Number.isFinite(seconds)||seconds<0)return '0:00';const n=Math.floor(seconds);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
  function updateTransport(){
    const seek=$('#video-seek');if(seek){seek.max=String(Number.isFinite(video.duration)?video.duration:100);seek.value=String(Math.min(video.currentTime||0,Number(seek.max)));seek.disabled=!Number.isFinite(video.duration);}
    const elapsed=$('#time-elapsed');if(elapsed)elapsed.textContent=timeLabel(video.currentTime);
    const total=$('#time-total');if(total)total.textContent=timeLabel(video.duration);
    const toggle=$('[data-toggle-play]');if(toggle)toggle.textContent=video.paused?'▶':'Ⅱ';
  }
  video.playbackRate=state.playerRate;try{video.volume=state.playerVolume;}catch{}
  video.addEventListener('loadedmetadata',()=>{updateTransport();refreshMediaOptions();});
  video.addEventListener('timeupdate',updateTransport);
  video.addEventListener('play',async()=>{updateTransport();setPlayerControls(true,3000);try{const lock=await navigator.wakeLock?.request('screen');if(lock){if($('#video')===video&&!video.paused)state.wakeLock=lock;else lock.release().catch(()=>{});}}catch{}});
  video.addEventListener('pause',()=>{updateTransport();setPlayerControls(true);});
  video.addEventListener('click',()=>{
    const hidden=video.closest('.player-frame')?.classList.contains('controls-hidden');
    setPlayerControls(Boolean(hidden),hidden?3000:0);
  });
  video.addEventListener('loadedmetadata' ,()=>{const seconds=(item.type==='tv'?state.episodeProgress[episodeKey(item,state.activePlayer.season,state.activePlayer.episode)]:state.progress[key])||0;if(seconds>10&&Number.isFinite(video.duration)&&seconds<video.duration-15)video.currentTime=seconds;});
  let lastSave=0;
  video.addEventListener('timeupdate',()=>{if(Date.now()-lastSave>5000&&video.currentTime>0){lastSave=Date.now();rememberPlayback(item,Math.floor(video.currentTime));}});
  video.addEventListener('ended',()=>{rememberPlayback(item,0,true);});
  video.addEventListener('error',()=>{const help=$('#player-help');if(help)help.textContent='Не вдалося відтворити потік. Перевірте кодек, доступність адреси, CORS або обмеження джерела.';});
  if(localBlob){state.objectUrl=URL.createObjectURL(localBlob);video.src=state.objectUrl;video.play().catch(()=>{});}else if(presetUrl)startPlayback(presetUrl); // Browsers may require tapping Play in their native controls.
}
async function startPlayback(raw) {
  const video=$('#video');if(!video)return;
  let url;
  try {url=new URL(raw);if(url.protocol!=='https:')throw new Error();}catch{toast('Потрібне пряме HTTPS-посилання на відео');return;}
  if(!state.activePlayer?.key?.startsWith('iptv:')){state.sources[state.activePlayer.key]=url.href;save();}
  if(state.hls){state.hls.destroy();state.hls=null;}
  const isHls=/\.m3u8(?:$|[?#])/i.test(url.pathname+url.search);
  const help=$('#player-help');
  if(isHls && !video.canPlayType('application/vnd.apple.mpegurl')){
    if(help)help.textContent='Підключаємо HLS для браузера…';
    try {
      const { default:Hls }=await import('https://cdn.jsdelivr.net/npm/hls.js@1.6.14/+esm');
      if(!$('#video')||$('#video')!==video)return;
      if(!Hls.isSupported())throw new Error('HLS не підтримується браузером');
      const hls=new Hls({enableWorker:true});state.hls=hls;hls.loadSource(url.href);hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED,()=>{refreshMediaOptions();video.play().catch(()=>{if(help)help.textContent='Натисніть Play для початку перегляду.';});});
      hls.on(Hls.Events.ERROR,(_e,data)=>{if(data.fatal&&help)help.textContent='Помилка HLS-потоку. Можливо, джерело блокує CORS або доступ.';});
      return;
    } catch(e){if(help)help.textContent='Цей браузер не підтримує потік HLS без додаткового модуля. Спробуйте Safari на iOS або MP4.';return;}
  }
  video.src=url.href;
  video.play().catch(()=>{if(help)help.textContent='Натисніть Play на відео, щоб почати відтворення.';});
}
async function addLocalSubtitle(file){
  const v=$('#video');if(!v||!file)return;
  if(file.size>2*1024*1024)return toast('Завеликий файл субтитрів');
  try{
    let data=(await file.text()).replace(/^\ufeff/,'').replace(/\r\n/g,'\n');
    if(/\.srt$/i.test(file.name))data='WEBVTT\n\n'+data.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2');
    if(!/^WEBVTT\b/.test(data))throw Error('Підтримуються WebVTT і SRT');
    if($('#video')!==v)return;
    const url=URL.createObjectURL(new Blob([data],{type:'text/vtt'}));state.subtitleUrls.push(url);
    const track=document.createElement('track');track.kind='subtitles';track.label=file.name;track.src=url;
    track.addEventListener('load',()=>{Array.from(v.textTracks).forEach(t=>t.mode=t===track.track?'showing':'disabled');refreshMediaOptions();});
    v.append(track);track.track.mode='hidden';refreshMediaOptions();
  }catch(e){toast(e.message);}
}
function refreshMediaOptions(){
  const v=$('#video');if(!v)return;
  const h=state.hls;
  const fill=(selector,rows,defaultLabel)=>{const el=$(selector);if(!el)return;const selected=el.value;el.innerHTML='<option value="-1">'+defaultLabel+'</option>'+rows.map(([i,t])=>'<option value="'+i+'">'+safe(t)+'</option>').join('');if([...el.options].some(o=>o.value===selected))el.value=selected;};
  fill('#player-quality',(h?.levels||[]).map((x,i)=>[i,(x.height||'?')+'p']), 'Авто');
  fill('#player-audio',Array.from(h?.audioTracks||v.audioTracks||[]).map((x,i)=>[i,x.name||x.label||x.lang||x.language||('Доріжка '+(i+1))]),'За замовчуванням');
  fill('#player-track',Array.from(h?.subtitleTracks?.length?h.subtitleTracks:v.textTracks||[]).map((x,i)=>[i,x.name||x.label||x.lang||x.language||('Доріжка '+(i+1))]),'Вимкнено');
}
async function stepEpisode(delta){
  const item=state.activePlayer?.item;
  if(!item||item.type!=='tv')return;
  const season=state.activePlayer.season,episode=state.activePlayer.episode,provider=state.activeProvider;
  try{
    const data=await api('/api/title/tv/'+item.id+'/season/'+season);
    const numbers=(data.episodes||[]).map(e=>e.number).sort((a,b)=>a-b);
    let next=numbers[numbers.indexOf(episode)+delta],nextSeason=season;
    if(!next){
      nextSeason=season+delta;if(nextSeason<1)return toast('Інших серій немає');
      const other=await api('/api/title/tv/'+item.id+'/season/'+nextSeason);
      const list=(other.episodes||[]).map(e=>e.number).sort((a,b)=>a-b);next=delta>0?list[0]:list.at(-1);
    }
    if(!next)return toast('Інших серій немає');
    state.selectedSeason=nextSeason;state.selectedEpisode=next;showSources(item);
    if(provider&&!state.disabledProviders.includes(provider))loadProvider(provider);
  }catch(e){toast(e.message);}
}
function closeModal(){cleanupPlayer();modal.innerHTML='';state.activePlayer=null;runDownloadQueue();}

async function init() {
  applyAccent();buildNav();
  try {state.demo=(await (await fetch('/data/demo.json')).json()).results || [];} catch {state.demo=[];}
  loadVisibleItems(state.demo);
  try {const health=await api('/api/health');state.tmdbConfigured=!!health.tmdbConfigured;state.demoMode=!health.tmdbConfigured;}catch{state.demoMode=true;}
  await showView('home');
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
    if(document.readyState==='complete')navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
}

document.addEventListener('error', event => { if (event.target instanceof HTMLImageElement) event.target.style.display='none'; }, true);
document.addEventListener('click',async event=>{
  const action=event.target.closest('button, [data-close]');if(!action)return;
  if(action.matches('[data-close]')){if(event.target===action || action.matches('button'))closeModal();return;}
  if(action.dataset.downloadPause){controlDownload(action.dataset.downloadPause,'pause');return;}
  if(action.dataset.downloadResume){controlDownload(action.dataset.downloadResume,'resume');return;}
  if(action.dataset.downloadCancel){controlDownload(action.dataset.downloadCancel,'cancel');return;}
  if(action.dataset.libraryTab){state.libraryTab=action.dataset.libraryTab;renderFavorites();return;}
  if(action.hasAttribute('data-clear-history')){if(confirm('Очистити історію і прогрес, зберігши вибране?')){state.history={};state.progress={};state.episodeProgress={};state.lastEpisode={};save();renderFavorites();}return;}
  if(action.dataset.markWatched){const item=state.lists[action.dataset.markWatched]||state.activeItem;if(item){state.history[keyFor(item)]={...item,watchedAt:Date.now(),completed:true};delete state.progress[keyFor(item)];save();drawDetails(item);}return;}
  if(action.dataset.theme){state.theme=action.dataset.theme;applyAccent();save();renderSettings();return;}
  if(action.dataset.providerToggle){const v=action.dataset.providerToggle;state.disabledProviders=state.disabledProviders.includes(v)?state.disabledProviders.filter(x=>x!==v):[...state.disabledProviders,v];save();renderSettings();return;}
  if(action.dataset.offlinePlay){try{const r=await offlineOperation('readonly','get',action.dataset.offlinePlay);if(r)openPlayer({id:r.id,type:'local',title:r.name},null,r.blob);}catch(e){toast(e.message);}return;}
  if(action.dataset.offlineDelete){if(confirm('Видалити локальне відео?'))try{await offlineOperation('readwrite','delete',action.dataset.offlineDelete);renderFavorites();}catch(e){toast(e.message);}return;}
  if(action.dataset.episodeStep){stepEpisode(Number(action.dataset.episodeStep));return;}
  if(action.dataset.shelfStep){state.homeShelf=((state.homeShelf||0)+Number(action.dataset.shelfStep)+HOME_SHELVES.length)%HOME_SHELVES.length;await renderHome();return;}
  if(action.dataset.view){await showView(action.dataset.view);return;}
  if(action.dataset.title){openDetails(action.dataset.title);return;}
  if(action.dataset.favorite){toggleFavorite(action.dataset.favorite);return;}
  if(action.hasAttribute('data-more')){await loadMore();return;}
  if(action.dataset.sources){const key=action.dataset.sources;const item=state.lists[key]||state.activeItem;if(item)showSources(item);return;}
  if(action.dataset.provider){loadProvider(action.dataset.provider);return;}
  if(action.hasAttribute('data-back-providers')){showSources(state.activeItem);return;}
  if(action.dataset.mediaProvider){playProviderMedia(action.dataset.mediaProvider,action.dataset.mediaId);return;}
  if(action.dataset.streamUrl){if(state.activeItem)openPlayer(state.activeItem,action.dataset.streamUrl);return;}
  if(action.dataset.episode){state.selectedEpisode=Number(action.dataset.episode)||1;showSources(state.activeItem);return;}
  if(action.hasAttribute('data-toggle-play')){setPlayerControls(true,3000);const v=$('#video');if(v){if(v.paused)v.play().catch(()=>toast('Не вдалося запустити відео'));else v.pause();}return;}
  if(action.dataset.seek){setPlayerControls(true,3000);const v=$('#video');if(v&&Number.isFinite(v.duration))v.currentTime=Math.min(v.duration,Math.max(0,v.currentTime+Number(action.dataset.seek)));return;}
  if(action.hasAttribute('data-fullscreen')){const v=$('#video');if(v){if(typeof v.webkitEnterFullscreen==='function')v.webkitEnterFullscreen();else if(v.requestFullscreen)v.requestFullscreen().catch(()=>{});}return;}
  if(action.dataset.player){const key=action.dataset.player;const item=state.lists[key]||state.activeItem;if(item)openPlayer(item);return;}
  if(action.dataset.channelFavorite!==undefined){const c=state.visibleChannels?.[Number(action.dataset.channelFavorite)];if(c){if(state.iptvFavorites[c.url])delete state.iptvFavorites[c.url];else state.iptvFavorites[c.url]=c;save();paintChannels();}return;}
  if(action.hasAttribute('data-iptv-favorites')){state.iptvOnlyFavorites=!state.iptvOnlyFavorites;state.iptvGroup='';action.textContent=state.iptvOnlyFavorites?'Усі канали':'★ Вибране';paintChannels();return;}
  if(action.dataset.channel!==undefined){const c=state.visibleChannels?.[Number(action.dataset.channel)];if(c)openPlayer({id:Number(action.dataset.channel),type:'iptv',title:c.name},c.url);return;}
  if(action.hasAttribute('data-wallpapers')){openWallpapers();return;}
  if(action.dataset.setWallpaper){state.wallpaper=action.dataset.setWallpaper;save();applyWallpaper();closeModal();toast('Шпалери застосовано');return;}
  if(action.hasAttribute('data-wallpaper-reset')){state.wallpaper='';save();applyWallpaper();closeModal();toast('Стандартний фон');return;}
  if(action.hasAttribute('data-subtitles')){findSubtitles();return;}
  if(action.dataset.attachSubtitle){attachSubtitle(action.dataset.attachSubtitle);return;}
  if(action.dataset.accent){state.accent=action.dataset.accent;applyAccent();save();renderSettings();return;}
  if(action.hasAttribute('data-refresh-iptv')){renderIptv();return;}
  if(action.hasAttribute('data-clear-local')){if(confirm('Видалити все вибране, збережені потоки та прогрес перегляду?')){state.favorites={};state.progress={};state.sources={};state.history={};state.episodeProgress={};state.lastEpisode={};save();renderSettings();toast('Локальні дані очищено');}return;}
});
document.addEventListener('pointerover',event=>{const card=event.target.closest('.poster-card[data-home-item]');if(card){const item=state.lists[card.dataset.homeItem];if(item)updateHero(item);}});
document.addEventListener('focusin',event=>{const card=event.target.closest('.poster-card[data-home-item]');if(card){const item=state.lists[card.dataset.homeItem];if(item)updateHero(item);}});
let swipeY=0,swipeX=0;document.addEventListener('touchstart',event=>{if(event.target.closest('#home-rail')){swipeY=event.touches[0].clientY;swipeX=event.touches[0].clientX;}else swipeY=0;},{passive:true});
document.addEventListener('touchend',event=>{if(!swipeY||!event.changedTouches[0])return;const dy=event.changedTouches[0].clientY-swipeY,dx=event.changedTouches[0].clientX-swipeX;swipeY=0;if(Math.abs(dy)>65&&Math.abs(dy)>Math.abs(dx)*1.25){state.homeShelf=((state.homeShelf||0)+(dy<0?1:-1)+HOME_SHELVES.length)%HOME_SHELVES.length;renderHome();}},{passive:true});
function updateClock(){const clock=$('#header-clock');if(clock)clock.textContent=new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});}updateClock();setInterval(updateClock,30000);
document.addEventListener('input',event=>{
  if(event.target.id==='search-input'){state.searchQuery=event.target.value;clearTimeout(state.searchTimer);state.searchTimer=setTimeout(performSearch,320);}
  if(event.target.id==='channel-search'){state.channelQuery=event.target.value;paintChannels();}
});
document.addEventListener('change',event=>{
  const el=event.target,v=$('#video');
  if(el.id==='catalog-sort'){state.sort=el.value;save();renderCategory(state.activeCategory);}
  if(el.id==='iptv-group'){state.iptvGroup=el.value;paintChannels();}
  if(el.id==='offline-import')importOffline(el.files?.[0]);
  if(el.id==='player-rate'&&v){state.playerRate=Number(el.value);v.playbackRate=state.playerRate;}
  if(el.id==='player-volume'&&v){state.playerVolume=Number(el.value);try{v.volume=state.playerVolume;if(Math.abs(v.volume-state.playerVolume)>0.01)toast('На iPhone використовуйте системні кнопки гучності');}catch{}}
  if(el.id==='player-brightness'&&v)v.style.filter='brightness('+Number(el.value)+')';
  if(el.id==='player-quality'&&state.hls)state.hls.currentLevel=Number(el.value);
  if(el.id==='player-audio'&&v){const n=Number(el.value);if(n>=0){if(state.hls)state.hls.audioTrack=n;else Array.from(v.audioTracks||[]).forEach((t,i)=>{t.enabled=i===n;});}}
  if(el.id==='local-subtitle')addLocalSubtitle(el.files?.[0]);
  if(el.id==='subtitle-size'&&v)v.style.setProperty('--cue-size',Number(el.value)+'%');
  if(el.id==='player-track'&&v){const n=Number(el.value);if(state.hls?.subtitleTracks?.length)state.hls.subtitleTrack=n;else Array.from(v.textTracks||[]).forEach((t,i)=>{t.mode=i===n?'showing':'disabled';});}
  if(event.target.id==='iptv-country'){state.iptvCountry=event.target.value;state.channelQuery='';renderIptv();}
  if(event.target.id==='season-select'){state.selectedSeason=Number(event.target.value);state.selectedEpisode=1;loadSeason(event.target.value);}
  if(event.target.id==='video-seek'){const v=$('#video');if(v&&Number.isFinite(v.duration))v.currentTime=Number(event.target.value)||0;}
});
document.addEventListener('submit',event=>{
  if(event.target.id==='offline-download-form'){event.preventDefault();enqueueDownload($('#offline-url').value);}
  if(event.target.id==='stream-form'){event.preventDefault();startPlayback($('#stream-url').value.trim());}
  if(event.target.id==='wallpaper-form'){event.preventDefault();loadWallpapers($('#wallpaper-query')?.value||'');}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && modal.innerHTML){event.preventDefault();closeModal();return;}
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  const typing=event.target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName);
  if(typing)return;
  const video=$('#video');
  if(video){
    const key=event.key.toLowerCase();
    if(event.key===' ' || key==='k'){
      event.preventDefault();
      video.paused ? video.play().catch(()=>toast('Не вдалося запустити відео')) : video.pause();
      setPlayerControls(true,3000);
    }else if(event.key==='ArrowLeft'||event.key==='ArrowRight'||event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();
      const offset=event.key==='ArrowLeft'?-10:event.key==='ArrowRight'?10:event.key==='ArrowUp'?60:-60;
      if(Number.isFinite(video.duration))video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+offset));
      setPlayerControls(true,3000);
    }else if(key==='f'){
      event.preventDefault();
      if(typeof video.webkitEnterFullscreen==='function')video.webkitEnterFullscreen();
      else video.requestFullscreen?.().catch(()=>{});
    }else if(key==='m'){
      event.preventDefault();video.muted=!video.muted;setPlayerControls(true,3000);
    }else if(event.key==='Enter'&&event.target===video){
      event.preventDefault();setPlayerControls(video.closest('.player-frame')?.classList.contains('controls-hidden'));
    }
    return;
  }
  if(event.key==='/'&&!modal.innerHTML){event.preventDefault();showView('search').then(()=>$('#search-input')?.focus());}
  if(!modal.innerHTML&&state.view==='home'&&(event.key==='ArrowUp'||event.key==='ArrowDown')){
    event.preventDefault();state.homeShelf=((state.homeShelf||0)+(event.key==='ArrowDown'?1:-1)+HOME_SHELVES.length)%HOME_SHELVES.length;
    renderHome();
  }
});
$('#search-shortcut').addEventListener('click',()=>showView('search').then(()=>$('#search-input')?.focus()));
$('#settings-shortcut').addEventListener('click',()=>showView('settings'));
$('.mobile-brand')?.addEventListener('click',event=>{event.preventDefault();showView('home');});
$('.brand').addEventListener('click',event=>{event.preventDefault();showView('home');});
init();
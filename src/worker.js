import { handleIntegration } from './integrations.js';
const TMDB = 'https://api.themoviedb.org/3';
const IPTV_BASE = 'https://iptv-org.github.io/iptv/countries/';
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' };

function json(value, status = 200, cache = 0) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...JSON_HEADERS,
      'Cache-Control': cache ? `public, max-age=${cache}, s-maxage=${cache}` : 'no-store'
    }
  });
}
function error(message, status = 400) { return json({ error: message }, status); }
function text(value, max = 100) { return String(value || '').trim().slice(0, max); }
function pageNumber(raw) { const n = Number(raw); return Number.isInteger(n) ? Math.max(1, Math.min(500, n)) : 1; }
const ALLOWED_SECTIONS = new Set(['trending', 'movies', 'series', 'animation', 'anime', 'cartoons', 'top', 'genre_28', 'genre_35', 'genre_18', 'genre_27', 'genre_878', 'genre_16', 'genre_10749', 'genre_99']);

function item(m, forcedType) {
  const type = forcedType || m.media_type || (m.first_air_date !== undefined ? 'tv' : 'movie');
  return {
    id: m.id,
    type: type === 'tv' ? 'tv' : 'movie',
    title: m.title || m.name || '',
    originalTitle: m.original_title || m.original_name || '',
    overview: m.overview || '',
    poster: m.poster_path || null,
    backdrop: m.backdrop_path || null,
    date: m.release_date || m.first_air_date || '',
    rating: Number(m.vote_average) || 0,
    genreIds: m.genre_ids || (m.genres || []).map(g => g.id),
    country: m.origin_country || (m.production_countries || []).map(c => c.iso_3166_1),
    seasons: Number(m.number_of_seasons) || 0,
    episodes: Number(m.number_of_episodes) || 0,
    runtime: m.runtime || (m.episode_run_time || [])[0] || 0
  };
}
function allowed(m) {
  const countries = m.origin_country || (m.production_countries || []).map(c => c.iso_3166_1) || [];
  return m.original_language !== 'ru' && !countries.includes('RU');
}
// Both the original Switch v3 API key and a v4 read-access token are accepted.
// Credentials stay server-side in Cloudflare secrets; never expose them in pages.
function tmdbCredentials(env) {
  const v3=String(env?.TMDB_API_KEY||'').trim();
  const other=String(env?.TMDB_TOKEN||'').trim();
  if(v3){
    if(!/^[0-9a-f]{32}$/i.test(v3))throw Object.assign(new Error('TMDB_API_KEY має бути 32-символьним ключем TMDB v3'),{status:503});
    return {apiKey:v3};
  }
  if(!other)return null;
  if(/^[0-9a-f]{32}$/i.test(other))return {apiKey:other};
  return {bearer:other};
}
async function tmdbRequest(path, params, env) {
  const credentials = tmdbCredentials(env);
  if (!credentials) throw Object.assign(new Error('TMDB_NOT_CONFIGURED'), { status: 503 });
  const url = new URL(TMDB + path);
  url.searchParams.set('language', 'uk-UA');
  for (const [key, value] of Object.entries(params || {})) if (value !== null && value !== '') url.searchParams.set(key, String(value));
  if (credentials.apiKey) url.searchParams.set('api_key', credentials.apiKey);
  const headers={Accept:'application/json'};
  if(credentials.bearer)headers.Authorization=`Bearer ${credentials.bearer}`;
  const response = await fetch(url.toString(), {
    headers,
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  if (!response.ok) throw Object.assign(new Error(response.status === 401 ? 'Некоректний TMDB_TOKEN' : 'TMDB тимчасово недоступний'), { status: response.status === 401 ? 502 : 503 });
  return response.json();
}
async function catalogue(params, env) {
  const section = params.get('section') || 'trending';
  if (!ALLOWED_SECTIONS.has(section)) return error('Невідомий розділ');
  const p = pageNumber(params.get('page'));
  const configs = {
    trending: ['/trending/all/week', {}],
    movies: ['/discover/movie', { sort_by: 'popularity.desc', include_adult: 'false' }],
    series: ['/discover/tv', { sort_by: 'popularity.desc', include_adult: 'false' }],
    animation: ['/discover/movie', { with_genres: '16', sort_by: 'popularity.desc', include_adult: 'false' }],
    cartoons: ['/discover/tv', { with_genres: '16', sort_by: 'popularity.desc', include_adult: 'false' }],
    anime: ['/discover/tv', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc', include_adult: 'false' }],
    top: ['/movie/top_rated', {}],
    ...Object.fromEntries(['28','35','18','27','878','16','10749','99'].map(g => ['genre_'+g, ['/discover/movie', {with_genres:g,sort_by:'popularity.desc',include_adult:'false'}]]))
  };
  let [path, opts] = configs[section];
  const sort=params.get('sort')||'popularity';
  const sorting={newest:'desc',oldest:'asc'};
  if(path.startsWith('/discover/')){if(sorting[sort])opts={...opts,sort_by:(path.endsWith('/tv')?'first_air_date':'primary_release_date')+'.'+sorting[sort]};else if(sort==='rating')opts={...opts,sort_by:'vote_average.desc','vote_count.gte':50};}
  const data = await tmdbRequest(path, { ...opts, page: p }, env);
  const forced = path.includes('/tv') ? 'tv' : path.includes('/movie') ? 'movie' : undefined;
  return json({ results: (data.results || []).filter(m => m.media_type !== 'person' && allowed(m)).map(m => item(m, forced)), page: p, totalPages: Math.min(500, data.total_pages || 1) }, 200, 120);
}
async function search(params, env) {
  const query = text(params.get('q'), 90);
  if (query.length < 2) return error('Введіть мінімум два символи');
  const p = pageNumber(params.get('page'));
  const data = await tmdbRequest('/search/multi', { query, page: p, include_adult: 'false' }, env);
  return json({ results: (data.results || []).filter(m => ['tv', 'movie'].includes(m.media_type) && allowed(m)).map(m => item(m)), page: p, totalPages: Math.min(500, data.total_pages || 1) }, 200, 60);
}
async function details(type, id, env) {
  if (!['tv', 'movie'].includes(type) || !/^\d{1,12}$/.test(id)) return error('Некоректний ідентифікатор');
  const data = await tmdbRequest(`/${type}/${id}`, { append_to_response: 'watch/providers' }, env);
  if (!allowed(data)) return error('Цей запис приховано за фільтром країни', 404);
  const base = item(data, type);
  const providers = data['watch/providers']?.results?.UA;
  return json({ ...base, genres: (data.genres || []).map(g => g.name),
    seasonList: (data.seasons || []).filter(s => s.season_number >= 0).map(s => ({ number: s.season_number, title: s.name, episodes: s.episode_count, date: s.air_date || '' })),
    watch: providers ? { url: providers.link || '', services: (providers.flatrate || providers.free || []).map(p => ({ name: p.provider_name, logo: p.logo_path })) } : null
  }, 200, 300);
}
async function season(type, id, seasonNo, env) {
  if (type !== 'tv' || !/^\d{1,12}$/.test(id) || !/^\d{1,3}$/.test(seasonNo)) return error('Некоректний сезон');
  const data = await tmdbRequest(`/tv/${id}/season/${seasonNo}`, {}, env);
  return json({ number: data.season_number, episodes: (data.episodes || []).map(ep => ({ number: ep.episode_number, title: ep.name || `Серія ${ep.episode_number}`, overview: ep.overview || '', still: ep.still_path, duration: ep.runtime || 0 })) }, 200, 300);
}
function parsePlaylist(content, limit = 300) {
  const channels = [];
  const rows = content.split(/\r?\n/);
  let name = '', logo = '', group = '';
  for (const raw of rows) {
    const row = raw.trim();
    if (row.startsWith('#EXTINF:')) {
      name = row.split(/,(.*)/s)[1]?.trim() || 'Без назви';
      logo = row.match(/tvg-logo="([^"]*)"/)?.[1] || '';
      group = row.match(/group-title="([^"]*)"/)?.[1] || '';
    } else if (row && !row.startsWith('#')) {
      try {
        const url = new URL(row);
        // Browsers hosted over HTTPS reject plaintext media streams.
        if (url.protocol === 'https:') channels.push({ name: text(name, 120), logo: logo.startsWith('https://') ? logo : null, group: text(group, 60), url: url.href });
      } catch { /* ignore invalid URL */ }
      name = ''; logo = ''; group = '';
      if (channels.length >= limit) break;
    }
  }
  return channels;
}
async function iptv(params) {
  const country = params.get('country') || 'ua';
  if (!/^[a-z]{2}$/.test(country)) return error('Некоректний код країни');
  const response = await fetch(`${IPTV_BASE}${country}.m3u`, { cf: { cacheTtl: 1800, cacheEverything: true } });
  if (!response.ok) return error('IPTV-плейлист недоступний', 503);
  const content = await response.text();
  if (content.length > 8_000_000) return error('Завеликий плейлист', 413);
  return json({ country, channels: parsePlaylist(content) }, 200, 600);
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return error('Метод не підтримується', 405);
  const path = url.pathname;
  try {
    if (path === '/api/health') return json({ name: 'UAPlay Web', ok: true, tmdbConfigured: !!(env.TMDB_API_KEY||env.TMDB_TOKEN) });
    if (path === '/api/catalog') return await catalogue(url.searchParams, env);
    if (path === '/api/search') return await search(url.searchParams, env);
    if (path === '/api/iptv') return await iptv(url.searchParams);
    const seasonMatch = path.match(/^\/api\/title\/(tv|movie)\/(\d+)\/season\/(\d+)$/);
    if (seasonMatch) return await season(seasonMatch[1], seasonMatch[2], seasonMatch[3], env);
    const titleMatch = path.match(/^\/api\/title\/(tv|movie)\/(\d+)$/);
    if (titleMatch) return await details(titleMatch[1], titleMatch[2], env);
    const integration = await handleIntegration(request, env);
    if (integration) return integration;
    return error('API endpoint не знайдено', 404);
  } catch (e) {
    const status = e.status || 503;
    return error(e.message === 'TMDB_NOT_CONFIGURED' ? 'TMDB_API_KEY або TMDB_TOKEN не налаштований. Використовується демонстраційний каталог.' : (e.message || 'Помилка запиту'), status);
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  }
};
export { parsePlaylist, item, allowed };
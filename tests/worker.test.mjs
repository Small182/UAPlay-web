import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi, parsePlaylist, item, allowed } from '../src/worker.js';

test('health reflects whether TMDB is configured', async () => {
  const response = await handleApi(new Request('https://example.workers.dev/api/health'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name:'UAPlay Web', ok:true, tmdbConfigured:false });
});
test('TMDB routes fail safely without key', async () => {
  const response = await handleApi(new Request('https://example.workers.dev/api/catalog?section=movies'), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).error,/TMDB_API_KEY/);
});
test('unknown and invalid endpoints are rejected', async () => {
  const invalid = await handleApi(new Request('https://example.workers.dev/api/title/movie/not-an-id'), {});
  assert.equal(invalid.status,404);
  const invalidCountry = await handleApi(new Request('https://example.workers.dev/api/iptv?country=../../admin'), {});
  assert.equal(invalidCountry.status,400);
  const invalidMethod=await handleApi(new Request('https://example.workers.dev/api/health',{method:'POST'}),{});
  assert.equal(invalidMethod.status,405);
});
test('IPTV parser excludes HTTP and invalid stream URLs', () => {
  const playlist='#EXTM3U\n#EXTINF:-1 tvg-logo="https://example.com/logo.png" group-title="Новини",Тест HD\nhttps://cdn.example.com/live/index.m3u8\n#EXTINF:-1,Insecure\nhttp://example.com/stream.m3u8\n#EXTINF:-1,Malformed\nnot a valid stream\n';
  assert.deepEqual(parsePlaylist(playlist), [{name:'Тест HD',logo:'https://example.com/logo.png',group:'Новини',url:'https://cdn.example.com/live/index.m3u8'}]);
});
test('TMDB item normalization and country filter', () => {
  assert.equal(item({id:9,name:'Тест',first_air_date:'2025-01-10'}).type,'tv');
  assert.equal(allowed({original_language:'ru'}),false);
  assert.equal(allowed({origin_country:['RU']}),false);
  assert.equal(allowed({production_countries:[{iso_3166_1:'RU'}]}),false);
  assert.equal(allowed({origin_country:['UA'],original_language:'uk'}),true);
});

test('catalogue uses server-side TMDB token and normalizes public response', async () => {
  const originalFetch=globalThis.fetch;
  let requestedUrl,auth;
  globalThis.fetch=async (url,options) => {
    requestedUrl=String(url);
    auth=options.headers.Authorization;
    return new Response(JSON.stringify({results:[
      {id:5,title:'Український фільм',poster_path:'/poster.jpg',release_date:'2026-02-01',original_language:'uk',vote_average:8.4},
      {id:6,title:'Приховано',original_language:'ru',vote_average:1}
    ],total_pages:1}), {status:200});
  };
  try {
    const response=await handleApi(new Request('https://uaplay.test/api/catalog?section=movies&page=1'),{TMDB_TOKEN:'TEST_PRIVATE_TOKEN'});
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.results.length,1);
    assert.equal(data.results[0].title,'Український фільм');
    assert.equal(data.results[0].type,'movie');
    assert.match(requestedUrl,/discover\/movie/);
    assert.equal(auth,'Bearer TEST_PRIVATE_TOKEN');
    assert.ok(!JSON.stringify(data).includes('TEST_PRIVATE_TOKEN'));
  } finally {globalThis.fetch=originalFetch;}
});


test('Switch TMDB v3 API key works server-side without exposing it to the client', async () => {
  const originalFetch=globalThis.fetch;
  const key='0123456789abcdef0123456789abcdef';
  let calledUrl, calledHeaders;
  globalThis.fetch=async (url, options) => {
    calledUrl=new URL(url);
    calledHeaders=options.headers;
    return new Response(JSON.stringify({ results: [{id:42,title:'Кіно',original_language:'uk',vote_average:7.5}], total_pages:1 }), {status:200});
  };
  try {
    const response=await handleApi(new Request('https://uaplay.test/api/catalog?section=movies'), {TMDB_API_KEY:key});
    assert.equal(response.status,200);
    assert.equal(calledUrl.searchParams.get('api_key'),key);
    assert.equal(calledHeaders.Authorization,undefined);
    const payload=await response.json();
    assert.equal(payload.results.length,1);
    assert.ok(!JSON.stringify(payload).includes(key));
    const health=await handleApi(new Request('https://uaplay.test/api/health'), {TMDB_API_KEY:key});
    assert.equal((await health.json()).tmdbConfigured,true);
  } finally {globalThis.fetch=originalFetch;}
});

test('32-character TMDB key in legacy TMDB_TOKEN works as v3 key', async () => {
  const originalFetch=globalThis.fetch;
  const key='abcdef0123456789abcdef0123456789';
  let auth, keyValue;
  globalThis.fetch=async (url, options) => {
    keyValue=new URL(url).searchParams.get('api_key');
    auth=options.headers.Authorization;
    return new Response(JSON.stringify({results:[],total_pages:1}),{status:200});
  };
  try {
    const response=await handleApi(new Request('https://uaplay.test/api/catalog'),{TMDB_TOKEN:key});
    assert.equal(response.status,200);
    assert.equal(keyValue,key);
    assert.equal(auth,undefined);
  } finally {globalThis.fetch=originalFetch;}
});

test('invalid TMDB_API_KEY is rejected without leaking credential', async () => {
  const invalid='this-is-not-a-valid-v3-key';
  const response=await handleApi(new Request('https://uaplay.test/api/catalog'),{TMDB_API_KEY:invalid});
  assert.equal(response.status,503);
  const body=await response.json();
  assert.match(body.error,/TMDB_API_KEY/);
  assert.ok(!JSON.stringify(body).includes(invalid));
});
test('catalogue sort is translated to TMDB date order',async()=>{
  const old=globalThis.fetch;let requested;
  globalThis.fetch=async url=>{requested=new URL(url);return new Response(JSON.stringify({results:[],total_pages:1}));};
  try{const response=await handleApi(new Request('https://uaplay.test/api/catalog?section=series&sort=newest'),{TMDB_API_KEY:'0123456789abcdef0123456789abcdef'});assert.equal(response.status,200);assert.equal(requested.searchParams.get('sort_by'),'first_air_date.desc');}finally{globalThis.fetch=old;}
});

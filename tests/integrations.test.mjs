import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleIntegration, normalizeAnime, parseHtmlSearch, PROVIDERS } from '../src/integrations.js';
const req = (path) => new Request('https://uaplay-web.pages.dev'+path);
async function withMockFetch(mock,fn){const existing=globalThis.fetch;globalThis.fetch=mock;try{return await fn();}finally{globalThis.fetch=existing;}}
test('only five enabled Web catalogue sources are registered',()=>{
  assert.deepEqual(Object.keys(PROVIDERS),['uaserials','eneyida','uafilm','mikai','animeon']);
});
test('normalize Mikai and AnimeON API data',()=>{
  assert.deepEqual(normalizeAnime('mikai',{result:[{mikai:18,ua:'Тестове аніме'}]})[0].id,'18');
  assert.deepEqual(normalizeAnime('animeon',{results:[{id:5,titleUa:'Аніме'}]})[0].title,'Аніме');
});
test('provider HTML parser only accepts URLs on original host',()=>{
  const body='<a class="card-link__text" href="https://klonua.com/filmy/123-test.html">Тестовий фільм</a>'+
    '<a class="card-link__text" href="https://untrusted.example/filmy/123-bad.html">Other</a>';
  const sources=parseHtmlSearch('uafilm',body);
  assert.equal(sources.length,1);assert.equal(sources[0].title,'Тестовий фільм');
});
test('provider directory lists search adapters and reports Movy limitation',async()=>{
  const reply=await handleIntegration(req('/api/providers'),{});
  assert.equal(reply.status,200);const body=await reply.json();
  assert.equal(body.providers.length,5);assert.ok(body.unsupported.some(x=>x.includes('Movy')));
});
test('Mikai search uses the upstream public API without exposing server secrets',async()=>{
  await withMockFetch(async(url,options)=>{
    assert.match(url,/api\.mikai\.me\/public\/v1\/anime\?search=/);
    assert.equal(options.redirect,'manual');
    return new Response(JSON.stringify({result:[{mikai:4,ua:'Аніме UA'}]}),{status:200});
  },async()=>{
    const reply=await handleIntegration(req('/api/providers/search?provider=mikai&q=%D0%90%D0%BD%D1%96%D0%BC%D0%B5'),{});
    assert.equal(reply.status,200);
    const body=await reply.json();assert.equal(body.results[0].title,'Аніме UA');
  });
});
test('SubDL token required and never serialized to browser',async()=>{
  const reply=await handleIntegration(req('/api/subtitles?type=movie&id=123'),{});
  assert.equal(reply.status,503);
  await withMockFetch(async(_url,opts)=>{
    assert.equal(opts.headers.Authorization,'Bearer secret-value');
    return new Response(JSON.stringify({subtitles:[]}),{status:200});
  },async()=>{
    const response=await handleIntegration(req('/api/subtitles?type=movie&id=123'),{SUBDL_TOKEN:'secret-value'});
    assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/secret-value/);
  });
});
test('provider media rejects invalid IDs and URLs',async()=>{
  assert.equal((await handleIntegration(req('/api/providers/media?provider=mikai&id=http%3A%2F%2Flocalhost'),{})).status,400);
  assert.equal((await handleIntegration(req('/api/providers/media?provider=uafilm&id=42'),{})).status,400);
});
test('Wallhaven safe wallpaper search',async()=>{
  await withMockFetch(async(url)=>{
    const q=new URL(url);assert.equal(q.searchParams.get('purity'),'100');
    return new Response(JSON.stringify({data:[{id:'abc123',path:'https://w.wallhaven.cc/full/example.jpg',thumbs:{large:'https://th.wallhaven.cc/abc.jpg'}}]}),{status:200});
  },async()=>{
    const response=await handleIntegration(req('/api/wallpapers?q=sky'),{});
    assert.equal((await response.json()).wallpapers.length,1);
  });
});
test('provider search reports upstream 403',async()=>{
  let n=0;await withMockFetch(async()=>{n++;return new Response('',{status:403});},async()=>{
    const reply=await handleIntegration(req('/api/providers/search?provider=uaserials&q=Test'),{});
    assert.equal(reply.status,502);assert.equal((await reply.json()).upstreamStatus,403);
  });assert.equal(n,1);
});

test('UASerials navigation and season filters never become search results',()=>{
  const menu='<a href="/serials/">Серіали</a><a href="/films/">Фільми</a><a href="/sezon/1/">1 сезон</a>';
  const valid='<a href="/1234-test-film.html"><div class="th-title">Тестовий фільм</div></a>';
  assert.equal(parseHtmlSearch('uaserials',menu).length,0);
  assert.equal(parseHtmlSearch('uaserials',menu+valid).length,1);
  assert.equal(parseHtmlSearch('uaserials',menu+valid)[0].title,'Тестовий фільм');
});
test('exact catalogue title outranks unrelated article and menu',async()=>{
  const html='<a href="/films/">Фільми</a><a href="/111-other.html"><span class="th-title">Other</span></a><a href="/123-test.html"><span class="th-title">Test title</span></a>';
  await withMockFetch(async()=>new Response(html),async()=>{
    const reply=await handleIntegration(req('/api/providers/search?provider=uaserials&q=Test%20title&type=movie'),{});
    assert.equal(reply.status,200);
    const body=await reply.json();
    assert.deepEqual(body.results.map(x=>x.title),['Test title']);
  });
});

test('UAFilm search excludes entirely unrelated titles',async()=>{
  const html='<a class="card-link__text" href="/filmy/12-unrelated.html">Unrelated movie</a>';
  await withMockFetch(async()=>new Response(html),async()=>{
    const response=await handleIntegration(req('/api/providers/search?provider=uafilm&q=Exact%20title&type=movie'),{});
    assert.equal(response.status,200);assert.deepEqual((await response.json()).results,[]);
  });
});

test('catalogue matching normalizes season suffix and release year',async()=>{
  const html='<a href="/111-sample.html"><span class="th-title">Test show 2 сезон (2025)</span></a><a href="/123-other.html"><span class="th-title">Other show</span></a>';
  await withMockFetch(async()=>new Response(html),async()=>{
    const response=await handleIntegration(req('/api/providers/search?provider=uaserials&q=Test%20show&type=tv&year=2022'),{});
    assert.equal(response.status,200);
    const items=(await response.json()).results;
    assert.equal(items.length,1);assert.equal(items[0].season,2);assert.equal(items[0].year,2025);
  });
});
test('same-name movie with matching release year outranks wrong remake',async()=>{
  const html='<a class="card-link__text" href="/filmy/1-sample.html">Sample (1999)</a><a class="card-link__text" href="/filmy/2-sample.html">Sample (2025)</a>';
  await withMockFetch(async()=>new Response(html),async()=>{
    const response=await handleIntegration(req('/api/providers/search?provider=uafilm&q=Sample&type=movie&year=2025'),{});
    const items=(await response.json()).results;
    assert.equal(items.length,1);assert.equal(items[0].year,2025);
  });
});

test('Mikai current documented nested ids and titles schema',()=>{
 const rows=normalizeAnime('mikai',{ok:true,result:[{ids:{mikai:21},titles:{ua:'Аніме',english:'Anime'}}]});
 assert.equal(rows[0].id,'21');assert.equal(rows[0].title,'Аніме');assert.equal(rows[0].original,'Anime');
});


test('removed providers are rejected for both search and media API',async()=>{
 await withMockFetch(async()=>{throw Error('unexpected network request')},async()=>{
  for(const id of ['uaflix','uakino','uakino-best'])for(const route of ['search?q=Test','media?id=123']){
   assert.equal((await handleIntegration(req('/api/providers/'+route+'&provider='+id),{})).status,400);
  }
 });
});

test('UASerials rejects unrelated titles and respects selected season',async()=>{
 const html='<a href="/1-other.html">Unrelated</a><a href="/2-sample.html">Sample 2 сезон (2025)</a><a href="/3-sample.html">Sample 1 сезон (2022)</a>';
 await withMockFetch(async()=>new Response(html),async()=>{
  const query=async(q)=> (await (await handleIntegration(req('/api/providers/search?provider=uaserials&type=tv&season=1&year=2022&q='+q),{})).json()).results;
  assert.deepEqual(await query('Absent'),[]);
  assert.deepEqual((await query('Sample')).map(x=>x.season),[1]);
 });
});
test('UASerials does not pair an empty anchor with another card title',()=>{
 const html='<a href="/1-wrong.html"><img src="/x.jpg"></a><a href="/2-right.html"><span class="th-title">Sample</span></a>';
 assert.deepEqual(parseHtmlSearch('uaserials',html).map(x=>x.id),['https://uaserials.my/2-right.html']);
});

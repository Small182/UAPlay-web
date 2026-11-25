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

test('series first season does not match a later year-only article',async()=>{
 const html='<a href="/9-example-2025.html">Example (2025)</a><a href="/2-example-2011.html"><span class="th-title">Example</span><span class="th-title-oname">Original example</span></a>';
 await withMockFetch(async()=>new Response(html),async()=>{
  const reply=await handleIntegration(req('/api/providers/search?provider=uaserials&type=tv&season=1&year=2011&q=Original%20example'),{});
  assert.deepEqual((await reply.json()).results.map(x=>x.id),['https://uaserials.my/2-example-2011.html']);
 });
});
test('Eneyida does not return unrelated results when no titles match',async()=>{
 await withMockFetch(async()=>new Response('<article><a class="short_title" href="/1-unrelated.html">Unrelated</a></article>'),async()=>{
  const reply=await handleIntegration(req('/api/providers/search?provider=eneyida&type=tv&q=Example'),{});
  assert.deepEqual((await reply.json()).results,[]);
 });
});

test('UASerials accepts the Switch-style adjacent title in the same card',()=>{
 const html='<a href="/1-sample-2011.html"><img src="/poster.jpg"></a><div class="th-title">Sample</div><a href="/2-other.html"><span class="th-title">Other</span></a>';
 assert.deepEqual(parseHtmlSearch('uaserials',html).map(x=>[x.id,x.title]),[['https://uaserials.my/1-sample-2011.html','Sample'],['https://uaserials.my/2-other.html','Other']]);
});

test('UASerials keeps the original title of adjacent same-article links',()=>{
 const html='<a href="/1-sample-2011.html"><img src="/poster.jpg"></a><a href="/1-sample-2011.html"><span class="th-title">Зразок</span></a><span class="th-title-oname">Sample</span><a href="/2-other.html"><span class="th-title">Other</span></a>';
 const rows=parseHtmlSearch('uaserials',html);
 assert.equal(rows[0].title,'Зразок');assert.equal(rows[0].original,'Sample');
 assert.equal(rows.length,2);
});
test('UAFilm reads title and URL from the same short-news card',()=>{
 const html='<div class="short-news__small"><a href="/serialy/1-example.html"><img src="/a.jpg"></a><div class="card-title__block">Example</div></div><div class="short-news__small"><a href="/serialy/2-other.html"><img src="/b.jpg"></a><div class="card-title__block">Other</div></div>';
 assert.deepEqual(parseHtmlSearch('uafilm',html,'tv').map(x=>x.title),['Example','Other']);
});

test('UASerials full-series slug year is not the release year',async()=>{
 const html='<a href="/17-example-2025.html"><span class="th-title">Example 1-7 сезон</span><span class="th-title-oname">Original example</span></a><a href="/21-remake-2025.html"><span class="th-title">Example (2025)</span></a><a href="/22-unrelated.html"><span class="th-title">Unrelated</span></a>';
 await withMockFetch(async()=>new Response(html),async()=>{
  for(const season of [1,7]){
   const reply=await handleIntegration(req('/api/providers/search?provider=uaserials&type=tv&season='+season+'&year=2011&seasonYear='+(season===1?2011:2025)+'&q=Example&original=Original%20example'),{});
   const rows=(await reply.json()).results;
   assert.deepEqual(rows.map(x=>x.id),['https://uaserials.my/17-example-2025.html']);
   assert.equal(rows[0].year,null);
   assert.equal(rows[0].season,null);
  }
 });
});
test('UASerials movies still respect release years in the URL',async()=>{
 const html='<a href="/1-example-1999.html"><span class="th-title">Example</span></a><a href="/2-example-2025.html"><span class="th-title">Example</span></a>';
 await withMockFetch(async()=>new Response(html),async()=>{
  const reply=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&q=Example&year=1999'),{});
  assert.deepEqual((await reply.json()).results.map(x=>x.id),['https://uaserials.my/1-example-1999.html']);
 });
});


test('Wallhaven pagination returns last-page metadata and distinct query pages',async()=>{
 let calls=0;
 await withMockFetch(async url=>{
   calls++;
   const page=Number(new URL(url).searchParams.get('page'));
   return new Response(JSON.stringify({meta:{current_page:page,last_page:2},data:[{id:'page'+page,path:'https://w.wallhaven.cc/full/page'+page+'.jpg',thumbs:{large:'https://th.wallhaven.cc/page'+page+'.jpg'}}]}));
 },async()=>{
   const run=page=>handleIntegration(req('/api/wallpapers?q=pagination-test&page='+page),{}).then(r=>r.json());
   const first=await run(1),second=await run(2);
   assert.equal(first.hasMore,true);assert.equal(second.hasMore,false);
   assert.notEqual(first.wallpapers[0].id,second.wallpapers[0].id);
   assert.equal((await run(2)).cached,true);assert.equal(calls,2);
 });
});

test('Wallhaven caches successful repeated queries and observes upstream cooldown',async()=>{
 let calls=0;
 await withMockFetch(async(url,options)=>{
  calls++;
  assert.equal(options.headers['X-API-Key'],'test-secret');
  const q=new URL(url).searchParams.get('q');
  if(q==='rate-limit-test')return new Response('',{status:429,headers:{'retry-after':'180'}});
  return new Response(JSON.stringify({data:[{id:'wall1',path:'https://w.wallhaven.cc/full/test.jpg',thumbs:{large:'https://th.wallhaven.cc/test.jpg'}}]}));
 },async()=>{
  const run=q=>handleIntegration(req('/api/wallpapers?q='+q),{WALLHAVEN_API_KEY:'test-secret'}).then(r=>r.json());
  assert.equal((await run('cache-test')).wallpapers.length,1);
  assert.equal((await run('cache-test')).cached,true);
  assert.equal(calls,1);
  const limited=await run('rate-limit-test');
  assert.equal(limited.rateLimited,true);assert.ok(limited.retryAfter>=179);
  assert.equal((await run('another-test')).rateLimited,true);
  assert.equal(calls,2);
  assert.equal((await run('cache-test')).wallpapers.length,1);
 });
});

test('UASerials movies reject partial titles, adjacent unrelated metadata and wrong years',async()=>{
 const html='<a href="/1-fantastic-four-2026.html"><img src="/poster.jpg" alt="Fantastic Four"></a><span class="th-title-oname">Step Kids</span><a href="/2-step-kids-2-2026.html"><span class="th-title">Step Kids 2</span></a><a href="/3-step-kids-2025.html"><span class="th-title">Step Kids</span></a>';
 await withMockFetch(async()=>new Response(html),async()=>{
  const response=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&year=2026&q=Step%20Kids'),{});
  assert.deepEqual((await response.json()).results,[]);
 });
});
test('UASerials movie lookup keeps exact local or original titles linked to the same article',async()=>{
 const html='<a href="/1-film-2026.html"><img src="/poster.jpg" alt="Poster"></a><a href="/1-film-2026.html"><span class="th-title">Зразок (2026)</span><span class="th-title-oname">Sample</span></a><a href="/2-other-2026.html"><span class="th-title">Sample Returns</span></a>';
 await withMockFetch(async()=>new Response(html),async()=>{
  const response=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&year=2026&q=Sample'),{});
  assert.deepEqual((await response.json()).results.map(x=>x.id),['https://uaserials.my/1-film-2026.html']);
 });
});
test('UASerials movie matching preserves meaningful title numbers',async()=>{
 const html='<a href="/1-example-2026.html"><span class="th-title">Example 2</span></a><a href="/2-example-2026.html"><span class="th-title">Example</span></a>';
 await withMockFetch(async()=>new Response(html),async()=>{
  const response=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&year=2026&q=Example%202'),{});
  assert.deepEqual((await response.json()).results.map(x=>x.id),['https://uaserials.my/1-example-2026.html']);
 });
});

test('UASerials and UAFilm query both local and original movie titles even with irrelevant first results',async()=>{
 for(const provider of ['uaserials','uafilm']){
  const terms=[];
  await withMockFetch(async(url,options)=>{
   const term=new URL(url).searchParams.get('story')||new URLSearchParams(options.body).get('story');
   terms.push(term);
   const prefix=provider==='uafilm'?'/filmy/':'/';
   return new Response(term==='Inception'
    ?'<a class="card-link__text" href="'+prefix+'1-inception-2010.html">Початок / Inception (2010)</a>'
    :'<a class="card-link__text" href="'+prefix+'2-other-2010.html">Початок іншої історії</a>');
  },async()=>{
   const response=await handleIntegration(req('/api/providers/search?provider='+provider+'&type=movie&year=2010&q='+encodeURIComponent('Початок')+'&original=Inception'),{});
   const data=await response.json();
   assert.deepEqual(terms,['Початок','Inception']);
   assert.equal(data.results.length,1);
   assert.match(data.results[0].id,/1-inception-2010\.html$/);
  });
 }
});
test('dual query deduplicates an exact movie returned by both searches',async()=>{
 let calls=0;
 await withMockFetch(async()=>{calls++;return new Response('<a href="/1-inception-2010.html"><span class="th-title">Початок</span><span class="th-title-oname">Inception</span></a>');},async()=>{
  const response=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&year=2010&q='+encodeURIComponent('Початок')+'&original=Inception'),{});
  assert.equal((await response.json()).results.length,1);assert.equal(calls,2);
 });
});

test('UASerials movie cards read sibling titles only within a balanced single-article card',async()=>{
 const html='<div class="th-item"><a href="/1-other-2010.html"><img alt="Other"></a><div class="th-title">Other</div></div><div class="th-item"><a href="/2045-pochatok.html"><img src="/poster.jpg"></a><div class="th-title">Початок</div><div class="th-title-oname">Inception</div></div>';
 await withMockFetch(async()=>new Response(html),async()=>{
  const r=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&year=2010&q='+encodeURIComponent('Початок')+'&original=Inception'),{});
  assert.deepEqual((await r.json()).results.map(x=>x.id),['https://uaserials.my/2045-pochatok.html']);
 });
});
test('UASerials movie card containing multiple distinct article links cannot borrow a title',()=>{
 const html='<div class="th-item"><a href="/1-other.html"><img alt="Other"></a><a href="/2-another.html"><img alt="Another"></a><div class="th-title">Inception</div></div>';
 assert.equal(parseHtmlSearch('uaserials',html,'movie').some(x=>x.title==='Inception'),false);
});
test('exact slug candidate is confirmed by public article title and release year, not URL alone',async()=>{
 for(const actual of ['Початок','Інший фільм']){
  let pages=0;
  await withMockFetch(async url=>{
   if(new URL(url).pathname==='/2045-pochatok.html'){pages++;return new Response('<h1>'+actual+'</h1><div>Рік: <a>2010</a></div>');}
   return new Response('<a href="/2045-pochatok.html"><img src="/poster.jpg"></a><a href="/2-other.html">Трансформери: Початок</a>');
  },async()=>{
   const r=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&year=2010&q='+encodeURIComponent('Початок')+'&original=Inception'),{});
   const data=await r.json();
   assert.equal(pages,1);assert.equal(data.results.length,actual==='Початок'?1:0);
  });
 }
});

test('numeric DLE article ID is not interpreted as the release year',async()=>{
 const html='<a href="/2045-pochatok.html"><span class="th-title">Початок</span></a>';
 await withMockFetch(async()=>new Response(html),async()=>{
  const r=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&year=2010&q='+encodeURIComponent('Початок')),{});const data=await r.json();
  assert.equal(data.results.length,1);assert.equal(data.results[0].year,null);
 });
});
test('Eneyida searches both names and filters partial film matches',async()=>{
 const terms=[];
 await withMockFetch(async(_url,options)=>{
  const q=new URLSearchParams(options.body).get('story');terms.push(q);
  return new Response(q==='Inception'
   ?'<article><a href="/films/2045-pochatok.html" class="short_title">Початок</a><div class="short_title_original">Inception</div></article><article><a class="short_title" href="/films/1-other.html">Inception Returns</a></article>'
   :'<article><a class="short_title" href="/films/2-other.html">Трансформери: Початок</a></article>');
 },async()=>{
  const r=await handleIntegration(req('/api/providers/search?provider=eneyida&type=movie&year=2010&q='+encodeURIComponent('Початок')+'&original=Inception'),{});
  const data=await r.json();assert.deepEqual(terms,['Початок','Inception']);assert.deepEqual(data.results.map(x=>x.title),['Початок']);assert.equal(data.results[0].original,'Inception');
 });
});
test('Eneyida keeps matching series seasons while rejecting similarly named shows',async()=>{
 const html='<article><a class="short_title" href="/series/1-show.html">Black Mirror 2 сезон (2013)</a></article><article><a class="short_title" href="/series/2-other.html">Black Mirror Returns 2 сезон (2013)</a></article><article><a class="short_title" href="/series/3-other.html">Black Mirror 3 сезон (2016)</a></article>';
 await withMockFetch(async()=>new Response(html),async()=>{
  const r=await handleIntegration(req('/api/providers/search?provider=eneyida&type=tv&year=2011&season=2&seasonYear=2013&q=Black%20Mirror'),{});
  assert.deepEqual((await r.json()).results.map(x=>x.id),['https://eneyida.tv/series/1-show.html']);
 });
});

test('long multipart title can be found with punctuation-free search but part two is rejected',async()=>{
 const title='Голодні ігри: Переспівниця. Частина 1';
 const original='The Hunger Games: Mockingjay - Part 1';
 const terms=[];
 await withMockFetch(async(url)=>{
  const q=new URL(url).searchParams.get('story');terms.push(q);
  return new Response(q==='Голодні ігри Переспівниця Частина 1'
   ?'<a href="/2368-golodni-igry-perespivnycya-chastyna-1.html"><span class="th-title">Голодні ігри: Переспівниця. Частина I 2014 рік</span></a><a href="/2-other.html"><span class="th-title">Голодні ігри: Переспівниця. Частина II</span></a>'
   :'<a href="/2-other.html"><span class="th-title">Голодні ігри: Переспівниця. Частина 2</span></a>');
 },async()=>{
  const r=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&year=2014&q='+encodeURIComponent(title)+'&original='+encodeURIComponent(original)),{});
  assert.deepEqual((await r.json()).results.map(x=>x.id),['https://uaserials.my/2368-golodni-igry-perespivnycya-chastyna-1.html']);
  assert.ok(terms.includes('Голодні ігри Переспівниця Частина 1'));
 });
});
test('legacy transliteration is a candidate hint and cannot substitute for page metadata',async()=>{
 const title='Голодні ігри: Переспівниця. Частина 1';
 const path='/2368-golodni-igry-perespivnycya-chastyna-1.html';
 await withMockFetch(async url=>new Response(new URL(url).pathname===path?'<h1>'+title+'</h1><div>Рік: <a>2014</a></div>':'<a href="'+path+'"><img src="/poster.jpg"></a>'),async()=>{
  const r=await handleIntegration(req('/api/providers/search?provider=uaserials&type=movie&year=2014&q='+encodeURIComponent(title)),{});
  assert.deepEqual((await r.json()).results.map(x=>x.id),['https://uaserials.my'+path]);
 });
});

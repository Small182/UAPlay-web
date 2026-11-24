import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleIntegration, normalizeAnime, parseHtmlSearch, PROVIDERS } from '../src/integrations.js';
const req = (path) => new Request('https://uaplay-web.pages.dev'+path);
async function withMockFetch(mock,fn){const existing=globalThis.fetch;globalThis.fetch=mock;try{return await fn();}finally{globalThis.fetch=existing;}}
test('all seven Nintendo Switch catalog sources are registered',()=>{
  assert.deepEqual(Object.keys(PROVIDERS),['uaflix','uaserials','eneyida','uafilm','uakino','mikai','animeon']);
});
test('normalize Mikai and AnimeON API data',()=>{
  assert.deepEqual(normalizeAnime('mikai',{result:[{mikai:18,ua:'Тестове аніме'}]})[0].id,'18');
  assert.deepEqual(normalizeAnime('animeon',{results:[{id:5,titleUa:'Аніме'}]})[0].title,'Аніме');
});
test('provider HTML parser only accepts URLs on original host',()=>{
  const body='<a class="sres-wrap" href="https://uafix.net/films/test-film/"><h2>Тестовий фільм</h2></a>'+
    '<a class="sres-wrap" href="https://untrusted.example/bad"><h2>Other</h2></a>';
  const sources=parseHtmlSearch('uaflix',body);
  assert.equal(sources.length,1);assert.equal(sources[0].title,'Тестовий фільм');
});
test('provider directory lists search adapters and reports Movy limitation',async()=>{
  const reply=await handleIntegration(req('/api/providers'),{});
  assert.equal(reply.status,200);const body=await reply.json();
  assert.equal(body.providers.length,7);assert.ok(body.unsupported.some(x=>x.includes('Movy')));
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
  assert.equal((await handleIntegration(req('/api/providers/media?provider=uakino&id=42'),{})).status,400);
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
    const reply=await handleIntegration(req('/api/providers/search?provider=uaflix&q=Test'),{});
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
test('UAFlix rejects category and wrong media type links',()=>{
  const html='<a class="sres-wrap" href="/films/action/extra/">Категорія</a><a class="sres-wrap" href="/serials/test-show/"><h2>Серіал</h2></a><a class="sres-wrap" href="/films/test-film/"><h2>Фільм</h2></a>';
  assert.deepEqual(parseHtmlSearch('uaflix',html,'movie').map(x=>x.title),['Фільм']);
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

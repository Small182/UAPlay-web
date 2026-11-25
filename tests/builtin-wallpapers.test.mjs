import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {builtinWallpapers,isBuiltinWallpaper} from '../public/builtin-wallpapers.js';
test('fallback gallery is bundled, nonempty and uses only known local assets',()=>{const rows=builtinWallpapers();assert.equal(rows.length,6);for(const row of rows){assert.ok(isBuiltinWallpaper(row.image));assert.match(readFileSync(new URL('../public'+row.image,import.meta.url),'utf8'),/<svg/);}assert.equal(isBuiltinWallpaper('/wallpapers/unknown.svg'),false);assert.equal(isBuiltinWallpaper('https://example.com/image.svg'),false);});
test('local search still offers wallpapers when no keywords match',()=>{assert.equal(builtinWallpapers('ocean')[0].id,'ocean');assert.ok(builtinWallpapers('unlikely-query').length>0);});

#!/usr/bin/env python3
"""Make a Cloudflare Pages Dashboard Direct Upload ZIP with advanced-mode _worker.js.

Deployment ZIP intentionally has index.html at its root. This also bundles
Cloudflare API routes so the drag-and-drop deployment is not static-only.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZIP_DEFLATED
import shutil
import sys

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
TARGET=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT.parent/'UAPlay-web-cloudflare-pages-v0.5.31.zip'
MEDIA=(ROOT/'src/media.js').read_text()
INTEGRATIONS=(ROOT/'src/integrations.js').read_text()
MEDIA=MEDIA.replace('export const ', 'const ').replace('export async function ', 'async function ').replace('export function ', 'function ')
INTEGRATIONS=INTEGRATIONS.replace("import { resolveProviderMedia, providerRequest } from './media.js';",'')
WORKER=(ROOT/'src/worker.js').read_text()
INTEGRATIONS=INTEGRATIONS.replace('export async function handleIntegration(', 'async function handleIntegration(')
INTEGRATIONS=INTEGRATIONS.replace('export {normalizeAnime,parseHtmlSearch,PROVIDERS};','')
WORKER=WORKER.replace("import { handleIntegration } from './integrations.js';",'')
WORKER=WORKER.replace('export async function handleApi(', 'async function handleApi(')
WORKER=WORKER.replace('export { parsePlaylist, item, allowed };', '')
assert 'export default {' in WORKER and 'import ' not in WORKER and 'export ' not in MEDIA
BUNDLE='/* UAPlay Web / Cloudflare Pages Advanced Mode / no secrets */\n'+MEDIA+'\n'+INTEGRATIONS+'\n'+WORKER
with TemporaryDirectory() as d:
    staging=Path(d)
    shutil.copytree(PUBLIC,staging,dirs_exist_ok=True)
    (staging/'_worker.js').write_text(BUNDLE)
    with ZipFile(TARGET,'w',ZIP_DEFLATED,compresslevel=9) as archive:
        for path in sorted(staging.rglob('*')):
            if path.is_file(): archive.write(path,path.relative_to(staging).as_posix())
print(TARGET)
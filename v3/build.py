from __future__ import annotations

import base64
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
V2 = ROOT.parent / 'v2/battle_craft-v2.html'
ESBUILD = ROOT.parent / 'node_modules/.bin/esbuild'
VENDOR = ROOT.parent / 'vendor'
ASSETS = ROOT.parent / 'assets/3dgarden'

draco_source = (VENDOR / 'addons/loaders/DRACOLoader.js').read_text()
draco_source = draco_source.replace("from '../../three.module.js'", "from 'three'")
draco_source = re.sub(r"new URL\(\s*'([^']+)'\s*,\s*import\.meta\.url\s*\)\.toString\(\)",
                      lambda m: "'" + pathlib.PurePosixPath(m.group(1)).name + "'", draco_source)
(ROOT / 'DRACOLoader.local.js').write_text(draco_source)


def b64(path: pathlib.Path) -> str:
    return base64.b64encode(path.read_bytes()).decode('ascii')


source = (ROOT / 'garden-layer.js').read_text()
source = source.replace('__TREE_GLB__', b64(ASSETS / 'cardboard-tree.glb'))
source = source.replace('__BARREL_GLB__', b64(ASSETS / 'barrel-01.glb'))
source = source.replace('__DRACO_JS__', b64(VENDOR / 'addons/draco/draco_wasm_wrapper.js'))
source = source.replace('__DRACO_WASM__', b64(VENDOR / 'addons/draco/draco_decoder.wasm'))
generated = ROOT / 'garden-layer.generated.js'
generated.write_text(source)
bundle = ROOT / 'garden-layer.bundle.js'
subprocess.run(
    [str(ESBUILD), str(generated), '--bundle', '--format=iife', '--minify',
     '--legal-comments=inline', f'--alias:three={VENDOR / "three.module.js"}', f'--outfile={bundle}'],
    check=True,
)

html = V2.read_text()
html = html.replace('<title>BaattleCraft｜十字對衝</title>', '<title>BaattleCraft｜十字對衝 v3 · 3D Garden</title>')
html = html.replace('v2 · 玩家對電腦', 'BaattleCraft · v3 · 玩家對電腦 · 3D Garden 場景試作')
html = html.replace("a.download='battle_craft-v2.html'", "a.download='battle_craft-v3.html'")
html = html.replace('canvas{display:block;', '#arena{position:relative}#garden-layer{position:absolute;inset:0;width:100%!important;height:100%!important;pointer-events:none;background:transparent!important}canvas{display:block;')
html = html.replace(
    '<canvas id="field" width="760" height="520" tabindex="0" aria-label="十字戰場。點選場外信標，或用方向鍵移動指揮官。"></canvas>',
    '<div id="arena"><canvas id="field" width="760" height="520" tabindex="0" aria-label="十字戰場。點選場外信標，或用方向鍵移動指揮官。"></canvas></div>\n<small id="garden-state" role="status">3D Garden 場景載入中…</small>',
)
html = html.replace('每次進入只買一次，離開再踩可再買。', '金幣不足時站在信標上等待，存夠就自動購買一次；離開再踏入可再次購買。')
html = html.replace('<button id="reset">重新開始</button>', '<button id="reset">重新開始</button><button id="toggle-garden" aria-pressed="true">隱藏 3D 場景</button>')
html = html.replace(
    '<details><summary>本版暫定規則</summary>',
    '<details><summary>本版暫定規則與素材</summary>'
)
html = html.replace(
    '電腦會定期購兵。</p></details>',
    '電腦會定期購兵。3D Garden 的 Cardboard Tree 與 barrel-01 僅用於場景裝飾，不影響碰撞、視野或購兵。素材依 <a href="https://www.3dgarden.app/licence">3D Garden 授權</a>使用。</p></details>'
)
html = html.replace("const url=URL.createObjectURL(new Blob(['<!doctype html>\\n'+document.documentElement.outerHTML],{type:'text/html;charset=utf-8'}));", "const copy=document.documentElement.cloneNode(true);copy.querySelector('#garden-layer')?.remove();const url=URL.createObjectURL(new Blob(['<!doctype html>\\n'+copy.outerHTML],{type:'text/html;charset=utf-8'}));")
html = html.replace('</body>', '')
inline_bundle = bundle.read_text().replace('</script', '<\\/script')
html = html.replace('</html>', '<script>' + inline_bundle + '</script>\n</html>')
output = ROOT / 'battle_craft-v3.html'
output.write_text(html)
print(f'{output} ({output.stat().st_size:,} bytes)')

from __future__ import annotations

import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
VENDOR = ROOT.parent / 'vendor'
ESBUILD = ROOT.parent / 'node_modules/.bin/esbuild'

import base64, json, re
PH = ROOT.parent / 'assets/polyhaven'
data = {name: 'data:image/jpeg;base64,' + base64.b64encode((PH / file).read_bytes()).decode('ascii') for name, file in {
    'floor_diff_512': 'painted_concrete_02_diff_512.jpg', 'floor_rough_512': 'painted_concrete_02_rough_512.jpg',
    'ground_diff_1k': 'aerial_asphalt_01_diff_1k.jpg',
    'floor_diff_2k': 'hi/floor_diff_2k.jpg', 'floor_rough_2k': 'hi/floor_rough_2k.jpg', 'floor_nor_2k': 'hi/floor_nor_gl_2k.jpg', 'ground_diff_4k': 'hi/ground_diff_4k.jpg'}.items()}
(ROOT / 'surface-data.generated.js').write_text('export default ' + json.dumps(data) + ';\nexport const assetBytes = ' + json.dumps({k: len(base64.b64decode(v.split(',', 1)[1])) for k, v in data.items()}) + ';\n')
VEND = VENDOR
# 背景音樂：music-tracks.mjs 列出的循環曲（來源與處理見 assets/music/README.md），以 base64 內嵌供離線單檔使用
MUSIC = ROOT.parent / 'assets/music'
files = re.findall(r"id: '([^']+)', file: '([^']+)'", (ROOT / 'music-tracks.mjs').read_text())
assert len(files) >= 2, files
(ROOT / 'music-data.generated.js').write_text('export default ' + json.dumps({i: base64.b64encode((MUSIC / f).read_bytes()).decode('ascii') for i, f in files}) + ';\n')
GARDEN = ROOT.parent / 'assets/3dgarden'
b64 = lambda p: base64.b64encode(p.read_bytes()).decode('ascii')
(ROOT / 'prop-data.generated.js').write_text('export default ' + json.dumps({
    'lamp': b64(GARDEN / 'portable-lamp.glb'), 'pipes': b64(GARDEN / 'pipes-on-tower.glb'),
    'wrapper': b64(VEND / 'addons/draco/draco_wasm_wrapper.js'), 'wasm': b64(VEND / 'addons/draco/draco_decoder.wasm')}) + ';\n')
import re
draco = (VEND / 'addons/loaders/DRACOLoader.js').read_text().replace("from '../../three.module.js'", "from 'three'")
draco = re.sub(r"new URL\(\s*'([^']+)'\s*,\s*import\.meta\.url\s*\)\.toString\(\)", lambda m: "'" + pathlib.PurePosixPath(m.group(1)).name + "'", draco)
(ROOT / 'DRACOLoader.local.js').write_text(draco)
bundle = ROOT / 'main.bundle.js'
subprocess.run(
    [str(ESBUILD), str(ROOT / 'main.js'), '--bundle', '--format=iife', '--minify',
     '--legal-comments=inline', f'--alias:three={VENDOR / "three.module.js"}', f'--outfile={bundle}'],
    check=True,
)
inline = bundle.read_text().replace('</script', '<\\/script')
template = (ROOT / 'template.html').read_text()
assert template.count('<script>/* BUNDLE */</script>') == 1
dest = ROOT / 'battle_craft-v6-0-offline.html'
dest.write_text(template.replace('<script>/* BUNDLE */</script>', '<script>' + inline + '</script>'))
print(f'{dest} ({dest.stat().st_size:,} bytes)')

# Pages 載入同一份原始模組；依畫質與音樂階段分批抓圖檔，不改歷史 v5-9 離線檔。
web_imports = {
    'three': '../vendor/three.module.js',
    './surface-data.generated.js': './web-surfaces.mjs',
    './music-data.generated.js': './web-music.mjs',
    './prop-data.generated.js': './web-props.mjs',
    './DRACOLoader.local.js': '../vendor/addons/loaders/DRACOLoader.js',
}
web = ROOT / 'battle_craft-v6-0.html'
scripts = '<script type="importmap">' + json.dumps({'imports': web_imports}, indent=2) + '</script>\n<script type="module" src="./main.js"></script>'
web.write_text(template.replace('<script>/* BUNDLE */</script>', scripts))
print(f'{web} ({web.stat().st_size:,} bytes)')

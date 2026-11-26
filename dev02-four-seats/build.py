from __future__ import annotations

import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
VENDOR = ROOT.parent / 'vendor'
ESBUILD = ROOT.parent / 'node_modules/.bin/esbuild'

import base64, json
PH = ROOT.parent / 'assets/polyhaven'
data = {name: 'data:image/jpeg;base64,' + base64.b64encode((PH / file).read_bytes()).decode('ascii') for name, file in {
    'floor_diff_512': 'painted_concrete_02_diff_512.jpg', 'floor_rough_512': 'painted_concrete_02_rough_512.jpg',
    'floor_diff_1k': 'painted_concrete_02_diff_1k.jpg', 'floor_rough_1k': 'painted_concrete_02_rough_1k.jpg',
    'ground_diff_1k': 'aerial_asphalt_01_diff_1k.jpg', 'ground_diff_2k': 'aerial_asphalt_01_diff_2k.jpg',
    'floor_diff_2k': 'hi/floor_diff_2k.jpg', 'floor_rough_2k': 'hi/floor_rough_2k.jpg', 'floor_nor_2k': 'hi/floor_nor_gl_2k.jpg', 'ground_diff_4k': 'hi/ground_diff_4k.jpg'}.items()}
(ROOT / 'surface-data.generated.js').write_text('export default ' + json.dumps(data) + ';\n')
VEND = VENDOR
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
dest = ROOT / 'battle_craft-dev02.html'
dest.write_text(template.replace('<script>/* BUNDLE */</script>', '<script>' + inline + '</script>'))
print(f'{dest} ({dest.stat().st_size:,} bytes)')

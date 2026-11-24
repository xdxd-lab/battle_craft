from __future__ import annotations

import base64
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
VENDOR = ROOT.parent / 'vendor'
ESBUILD = ROOT.parent / 'node_modules/.bin/esbuild'
ASSETS = ROOT.parent / 'assets/3dgarden'


def b64(path: pathlib.Path) -> str:
    return base64.b64encode(path.read_bytes()).decode('ascii')


draco = (VENDOR / 'addons/loaders/DRACOLoader.js').read_text()
draco = draco.replace("from '../../three.module.js'", "from 'three'")
draco = re.sub(
    r"new URL\(\s*'([^']+)'\s*,\s*import\.meta\.url\s*\)\.toString\(\)",
    lambda m: "'" + pathlib.PurePosixPath(m.group(1)).name + "'",
    draco,
)
(ROOT / 'DRACOLoader.local.js').write_text(draco)

source = (ROOT / 'game.js').read_text()
for token, path in {
    '__SMALL_LAMP__': ASSETS / 'small-lamp-01.glb',
    '__PORTABLE_LAMP__': ASSETS / 'portable-lamp.glb',
    '__DRACO_JS__': VENDOR / 'addons/draco/draco_wasm_wrapper.js',
    '__DRACO_WASM__': VENDOR / 'addons/draco/draco_decoder.wasm',
}.items():
    assert token in source
    source = source.replace(token, b64(path))
entry = ROOT / 'game.generated.js'
entry.write_text(source)
bundle = ROOT / 'game.bundle.js'
subprocess.run(
    [str(ESBUILD), str(entry), '--bundle', '--format=iife', '--minify',
     '--legal-comments=inline', f'--alias:three={VENDOR / "three.module.js"}', f'--outfile={bundle}'],
    check=True,
)
inline = bundle.read_text().replace('</script', '<\\/script')
template = (ROOT / 'template.html').read_text()
assert '<script>/* BUNDLE */</script>' in template
output = template.replace('<script>/* BUNDLE */</script>', '<script>' + inline + '</script>')
dest = ROOT / 'battle_craft-v4.html'
dest.write_text(output)
print(f'{dest} ({dest.stat().st_size:,} bytes)')

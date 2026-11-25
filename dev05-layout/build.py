from __future__ import annotations

import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
VENDOR = ROOT.parent / 'vendor'
ESBUILD = ROOT.parent / 'node_modules/.bin/esbuild'

bundle = ROOT / 'scene.bundle.js'
subprocess.run(
    [str(ESBUILD), str(ROOT / 'scene.js'), '--bundle', '--format=iife', '--minify',
     '--legal-comments=inline', f'--alias:three={VENDOR / "three.module.js"}', f'--outfile={bundle}'],
    check=True,
)
inline = bundle.read_text().replace('</script', '<\\/script')
template = (ROOT / 'template.html').read_text()
assert template.count('<script>/* BUNDLE */</script>') == 1
dest = ROOT / 'battle_craft-dev05-layout.html'
dest.write_text(template.replace('<script>/* BUNDLE */</script>', '<script>' + inline + '</script>'))
print(f'{dest} ({dest.stat().st_size:,} bytes)')

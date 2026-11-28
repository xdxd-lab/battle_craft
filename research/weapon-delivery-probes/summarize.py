"""Summarize recordings from openbw-attack-flight-probe (no third-party data embedded)."""
from pathlib import Path
import csv
import math
import sys

header = ['source', 'target', 'start_dist_px', 'mode', 'bullet_visible_frame', 'first_hp_loss_frame', 'frames_between', 'center_dist_at_launch_px', 'first_sample_xy', 'latched_aim_xy', 'first_death_anim_frame', 'first_death_anim_xy', 'victim_at_hp_loss_xy', 'weapon_id', 'hp_shield_delta', 'next_speed_seq_raw']
writer = csv.writer(sys.stdout)
writer.writerow(header)

def bullets(r):
    return {int(raw.split(':')[0]): [int(x) for x in raw.split(':')] for raw in r[-1].strip(';').split(';') if raw}

def xy(vals):
    return ':'.join(str(x) for x in vals)

for f in sorted(Path(sys.argv[1]).glob('*.csv'), key=lambda p: (*map(int,p.stem.split('-')[:3]), '-'.join(p.stem.split('-')[3:]))):
    rows = [r for r in list(csv.reader(f.open()))[1:] if len(r) == 8]
    if len(rows) < 3:
        continue
    name = f.stem.split('-')
    index = next((i for i,r in enumerate(rows) if bullets(r)), None)
    if len(name) == 3:
        name.append('static')
    if index is None:
        writer.writerow(name + [None]*(len(header) - len(name)))
        continue
    a = rows[index]
    b = next(iter(bullets(a).values()))
    born, weapon_id, bound = int(a[0]), b[1], b[0]
    ver = []
    for r in rows[index:]:
        c = bullets(r).get(bound)
        if c is None:
            break
        ver.append((r,c))
    death = next(((r,c) for r,c in ver if c[4] == 5), None)
    # Target in these fixtures is a passive Medic/Dropship without actual shields.
    # Archon and Scourge apply delayed damage after the first death animation sample.
    damage = next(((d, (int(c[5])+int(c[6])-int(d[5])-int(d[6]))/256) for c,d in zip(rows[max(0,index-1):index+29],rows[index:index+30]) if int(c[5])+int(c[6]) > int(d[5])+int(d[6])), None)
    distance = math.hypot(int(a[1])-int(a[3]), int(a[2])-int(a[4]))
    writer.writerow(name + [born, damage[0][0] if damage else None, int(damage[0][0])-born if damage else None, round(distance,1), xy(b[2:4]), xy(b[5:7]), death[0][0] if death else None, xy(death[1][2:4]) if death else None, xy(damage[0][3:5]) if damage else None, weapon_id, damage[1] if damage else None, '|'.join(str(c[8]) for _,c in ver if c[4] != 5)])

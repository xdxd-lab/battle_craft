#!/usr/bin/env python3
"""Emit original-game reference facts from the exact pinned BWAPI lookup arrays.

Run with local copies of UnitType.cpp and WeaponType.cpp from the commit linked
in BC-V6-COMBAT-REFERENCE.md. This is research output, not a game data import.
"""
import argparse
import csv
import hashlib
from pathlib import Path
import re
import sys

SOURCES = (
    '7f16832dac82b8a739a07616ec0e61bc2c68a34b873f779cca8742de4832c76b',
    'e5c392a914ce4b452c4cfcfdb7d4ba581eef39aa6f0d1f62409a03cadcdbde67',
)
BASE = dict(hp='defaultMaxHP', shield='defaultMaxSP', base_armor='defaultArmorAmount',
            top_speed_px_per_frame='unitTopSpeeds', acceleration_raw='unitAcceleration',
            halt_distance_raw='unitHaltDistance', turn_raw='unitTurnRadius')
WEAPON = dict(damage_per_factor='defaultWpnDamageAmt', damage_upgrade_per_factor='defaultWpnDamageBonus',
              damage_factor='wpnDamageFactor', cooldown_frames='wpnDamageCooldowns', max_range_px='wpnMaxRange')
SIDES = ('ground', 'air')


def read_pinned(path, expected):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f'Not the pinned upstream source: {path.name}')
    return data.decode('utf-8')


def array(source, name):
    match = re.search(r'\b' + name + r'\[[^\]]+\]\s*=\s*\{([^}]+)\}', source)
    if not match:
        raise ValueError(f'Array not found: {name}')
    return match[1]


def values(source, name):
    return [s.strip() for s in array(source, name).split(',') if s.strip()]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('unit', type=Path)
    p.add_argument('weapon', type=Path)
    args = p.parse_args()
    unit, weapon = (read_pinned(path, h) for path, h in zip((args.unit, args.weapon), SOURCES))
    units, weapons = (re.findall(r'"([^"]*)"', array(src, 'typeNames')) for src in (unit, weapon))
    numbers = {k: values(unit, name) for k, name in BASE.items()}
    assignments = {side: values(unit, side + 'Weapon') for side in SIDES}
    hits = {side: values(unit, side + 'WeaponHits') for side in SIDES}
    weapon_values = {k: values(weapon, name) for k, name in WEAPON.items()}
    weapon_ids = {name: i for i, name in enumerate(weapons) if name}
    assert units[0] == 'Terran_Marine' and units[70] == 'Protoss_Scout' and units[228] == 'None'
    assert all(len(v) == len(units) for v in [*numbers.values(), *assignments.values(), *hits.values()])
    assert all(len(v) == len(weapons) for v in weapon_values.values())
    assert len(weapons) > 74 and weapon_values['damage_per_factor'][weapon_ids['Anti_Matter_Missiles']] == '14'
    cols = ['bw_unit_id', 'bwapi_unit', *BASE]
    for side in SIDES:
        cols += [f'{side}_weapon', f'{side}_max_hits', *(f'{side}_{k}' for k in WEAPON)]
    out = csv.writer(sys.stdout, lineterminator='\n')
    out.writerow(cols)
    for i, name in enumerate(units[:228]):
        row = [i, name, *(numbers[k][i] for k in BASE)]
        for side in SIDES:
            wid = assignments[side][i]
            row += [wid if wid != 'None' else '', hits[side][i] if wid != 'None' else '',
                    *(weapon_values[k][weapon_ids[wid]] if wid != 'None' else '' for k in WEAPON)]
        out.writerow(row)


if __name__ == '__main__':
    main()

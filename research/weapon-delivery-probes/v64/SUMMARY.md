# BattleCraft unit research: 2009 SPEED and pinned OpenBW

## Evidence boundaries

The [2009 forum SCX](https://www.gamez.com.tw/t/topic/374947/11) has source hash `2c174ba874184625a0e61dd3eea50f5c11ac0918137212206f20de15e922cd29`; extracted `scenario.chk` hash `c30ae248e68f003bccf10efa0bf2a15ad61995449fd39c62ebfaf2e329cbe16f`. Crosschecked independently against [SPEED mirror](https://scmscx.com/map/2tzpVkp9) and [non-SPEED v2.91f](https://scmscx.com/map/7zGY2kzG). Data files are Blizzard StarEdit's units.dat SHA-256 `da2ee6f116b77329048ec6be9e02721a527fde23d4b05b1b1336e634490abcba`, weapons.dat `80de165015519f9bed46ea8858195c2d2d0120b65b9e55e1c0a50b19135f4b62`, flingy.dat `89013fa6d81edad96b68efcfc0bb5342f1c7fa2ef7a0880a71b0169eab13d1ad`. [Pinned OpenBW DAT parsing](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/data_loading.h#L1440-L1660). Stock/ordinary OpenBW test fixture does not apply the SPEED map overrides. Static SCX trigger parse is not Blizzard client runtime verification.

| Unit in official map (ID) | 2009 SPEED unit/weapon overrides; purchase | Engine ordinary stock and other fields |
|---|---|---|
| Valkyrie (58) | 500 HP / 0 shield / 2 armor. Halo Rockets #103 105 +1. TRIG #78: 650 minerals / ten. | 200/0/2, large air; 6 +1 per rocket, explosive air only, 6 tiles/192 px, cooldown 64. Attack box 24/16/24/20 px L/T/R/B. Flingy 190: 1690 raw/65 accel/21901 halt/30 turn. |
| Guardian (44, not hero 56) | 1500/0/5. Acid Spore #46 600 +2. TRIG #89: 1000 minerals / ten. | 150/0/2, large air; 20 +2 normal, ground only, eight tiles/256 px, cooldown 30, no splash, no acid-spore stacking. Attack box 22/22/21/21. Flingy 7: 640/27/7585/20. |
| Warbringer (81, hero of Reaver) | 1200/0/0. Scarab damage weapon #82 300 +0. TRIG #35: 300 minerals / 12, Create Unit (no property slot). | 200/400/3, large ground; no direct unit weapon; Scarab unit 85 carries #82, base 100 +25 stock, normal ground-only 20/40/60 px splash, full/half/quarter; attack box 16/16/15/15. |

## Valkyrie exact emission / spread

[Blizzard Valkyrie unit page](https://classic.battle.net/scc/terran/uvalkyrie.shtml) independently confirms eight rockets per volley. DAT bullet count is two **per pulse**, not total. [Weapon #103 and movement](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/data_loading.h#L1518-L1655): `attack_angle=32` raw (45°), `bullet_heading_offset=64` raw (±90°), muzzle forward 20 px, top velocity 8533/256, acceleration 267/256 per frame, turn 13 raw, lifespan 255. [Heading alternation/RNG](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14392-L14422): alternating signs for consecutive bullets from same source, random initial sign when the previous bullet has another source.

Each launch cycles its aircraft's index in a 14-point [fixed source table](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L69-L72), then tracks [enemy position plus the same offset](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14286-L14298) every frame. The first eight destination offsets from a newly spawned Valkyrie follow the table's initial eight entries, not a fixed funnel of directions sweeping left to right. The engine advances to subsequent entries on the next volley and wraps after index 13. Angled departure + planar orbit offsets produce layered fan visuals, subject to motion. [OpenBW's historical global active-bullet guard](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14478-L14504) refuses to create another Halo rocket when 80 bullets of any kind are already active; not a per-plane count or a modern client claim.

Pinned fixture Valk at (600,704) vs stationary Battlecruiser at (770,704): four pairs at f1/11/21/31; impacts f15,17,27,30,35,40,46,48; each takes 3 hull, totaling 24 from stock E6 versus heavy armor 3. After teleporting target by +300 px Y in response to first pair, same launch schedule, hits f23,27,35,37,44,45,50,53. Air splash is **not** regular radial splash. [Source](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L13774-L13822): point-to-box distance ≤5 gives the original victim priority for one full hit; otherwise one appropriate plane within ≤100 gets full selected by deterministic engine RNG including the original if eligible. A second pass excludes the original victim and interceptors and applies 50% at ≤50 and 25% at ≤100 to eligible nearby units; a secondary full-hit winner can also receive this collateral. Source excludes same owner except the designated target and the shooter, not all allied seats. No ground hit.

## Warbringer capacity, resupply and projectile

[OpenBW hero recognition and max capacity](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L1805-L1819) makes **hero 10 even with no upgrade**, ordinary starts 5 and uses owner Reaver Capacity to reach 10. In the original 2009 SPEED CHK PUPx [according to OpenBW layout](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L21481-L21492), upgrade #36 global max/current 1/1 and P1–4 all use global defaults; raw per-player current bytes 0 are ignored. Scarab Damage #35 effective current 0, and the Scarab weapon's CHK bonus is 0.

Enabled, preserved TRIG #4 `Full Power`, owner **All Players**, Always condition, has [action #53](https://docs.scmjs.dev/triggers/#modify-unit-hanger-count): location64 Anywhere ((0,0)–(3072,3072)); group13 Current Player; amount10; unit81 Hero Warbringer; count0 All. It **adds up to the capacity**, not sets a stockpile value without cap. Each trigger pass replenishes ammo across each player's Warbringers; no recurring payment or manual reload required. Ordinary Create Unit purchase #35 occurs later in trigger list, so do not promise the same creation tick. Hypertrigger #93 with Wait(10) means do not assume a literal wall-clock cadence without native trace. Old non-SPEED mirror instead continuously adds three per pass to ordinary Reaver83 (TRIG #6), and its effective PUPx capacity level is also 1. OpenBW pinned trigger implementation does not implement action53: neither that cadence nor the original map refill is an emulated runtime observation.

The engine release [moves an independent Scarab from hangar to active ground map](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L4152-L4185), starts 25 px ahead, decrements ammo and increments active outside count. [Reaver/Scarab order](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L7396-L7472) evaluates a nominal 256 px range independent from Scarab's own 128 px DAT weapon property, includes allowance for target movement and max terrain route distance <512 px, uses a 60-frame timer and at most one Scarab outside. Scarab initial no-collide lasts about seven frames, follows terrain and moving target, lifetime 90 frames; detonation within 10 px box-gap, 20/40/60 px N enemy-splash damage after the animation (allied seats other than own eligible according to the historical engine). Stock SC1 manual ammo benchmark is 15 minerals / 105 raw DAT build frames via [Train Fighter](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/actions.h#L948-L963); not the custom map resupply rule.

Independent fixture with artificial ammunition and owner upgrade level 0 confirmed Warbringer capacity 10 versus ordinary's 5. Warbringer vs High Templar initially 230 px apart released f2, Scarab ran 16 px/frame after visible startup, found contact f17, damage f22 (100 total: 40 shield, 60 hull). Target teleported 300 px after release, hit f39; teleported 800 px, f72. Caveat that [pinned OpenBW cleanup](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L16052-L16075) tests exact ordinary Reaver ID rather than hero, leaving hero outside_count stuck in this probe; first weapon flight is useful evidence, subsequent firing behavior is not validated native automation.

## Guardian projectile & motion

[Blizzard Guardian page](https://classic.battle.net/scc/zerg/units/guardian.shtml) confirms 20 normal ground-only, armor 2, range 8, slow flyer, no anti-air. Engine #46 is a follow-target, normal-hit single projectile (not Devourer's corrosive stacking effect), flingy 163: 8533 speed, 667 acceleration, 40 turn, lifetime 255. Probe vs Marine at +240 px: f1 launch→f14 hit for 20; after target +300 px Y f1→f18. Unit flingy 7 raw 640 means 2.5 px/frame, inherited 42 ms world speed means about 0.75 world units/s at scale 1.62/128. Valkyrie unit flingy 190 gives about 6.60 px/frame. Guardian's actual range for Web at that scale would be 3.24 world units between DAT boxes.

No source repository edits or proprietary data uploads were made.

Reproduce against the pinned OpenBW header and the existing motion-lab / local StarEdit archive fixture:

```sh
c++ -O0 -std=c++17 -I/path/to/pinned-openbw /path/to/openbw-attack-flight-probe.cpp -o /tmp/attack-flight-probe
c++ -O0 -std=c++17 -I/path/to/pinned-openbw /path/to/bc-warbringer-probe.cpp -o /tmp/warbringer-probe
cd /path/to/engine-data
/tmp/attack-flight-probe 58 12 170
/tmp/attack-flight-probe 58 12 170 teleport
/tmp/attack-flight-probe 44 0 240
/tmp/warbringer-probe 81 230 2 static
/tmp/warbringer-probe 81 230 2 teleport
/tmp/warbringer-probe 83 230 0 static
```

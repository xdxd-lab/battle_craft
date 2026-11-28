# Defense lab 4: Android full view and Dragoon aim

Date: 2026-11-29 (Taiwan time). Development candidate: simulation 14 (aim hold), followed by simulation 15 (range trial). The public game remains on its existing entry/version.

## Portrait desktop-style viewport

Two supplied Android images of Defense Lab 3 show the HUD and game rendering correctly, but display the old 190 CSS-pixel column in portrait. That fits a roughly 980 CSS-pixel layout, numerically beyond the previous 700px activation threshold. A Chromium mobile emulation (393 CSS-pixel device width, 2.132 DPR, 980×2040 page layout) reproduced the old behavior. This does not establish which Android browser setting produced it.

The portrait layout now recognizes that compressed desktop-style layout, uses the existing overhead angle and farther fog distances, and restores the old camera/HUD upon leaving overview. It avoids reinitializing an unchanged WebGL drawing buffer on HUD/visual-viewport resize callbacks. The original screenshots are not included in the repository.

## Dragoon engagement

Two seats buy Dragoons and two buy Battlecruisers at the current real prices/rates. Both Dragoon armies launch in the central clash; not every apparent neighbor is in range. A second, deterministic fixture reproduces a real fault: touching the range boundary repeatedly dropped the aim and sent the Dragoon back through allied bodies.

Version 14 preserves stance and pauses the existing wind-up for at most six source frames only if a previously reachable target has just moved slightly outside reach. There is no new shooting range: every release still requires the physical DAT box gap to be inside the same weapon range. Truly retreating targets cause pursuit again; legally reachable alternatives can be used. No changes to unit prices, damage, occupied dimensions, or projectile delivery. Version 13 combat remains available for replays.

## Follow-up: simulation 15

The user preferred trying three Dragoon movement widths before picking a balance value. Both air and ground use 1.068 × 3 = 3.204 World units under the same DAT-box edge measurement for mobile targets; towers and cores retain their existing radius measurement. The earlier 1.620 value and old replay rules remain for simulations 13–14. Blizzard lists 4 → 6 tiles for the regular Dragoon; recovered SPEED maps start with that upgrade enabled. 3.204 is a prototype balance change, not a claim about stock or historical SPEED. See [the full roster and price/range comparison](BC-V6-PRICING-COMPARISON.md).

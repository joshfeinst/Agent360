# Night log — the v1.10 TLC pass

One pass, eight rounds, each landed as its own commit on
`claude/agent-360-tlc-4e10um`. The rule of the pass: every change ships with
the measurement that said it was needed and the test that proves it landed.

| Round | What changed | Why the numbers said so | How it was verified |
|---|---|---|---|
| **1 · Standards + scroll-safe screens** | `<!DOCTYPE html>`, charset, lang; every `.screen` centres while it fits and top-aligns + scrolls once it does not | The game rendered in **quirks mode** (`compatMode=BackCompat`) everywhere and mojibaked over plain http. Landscape-phone pause hid RESUME/RESTART/ABORT off-screen with **no scroll path** — a soft-lock after app-switch auto-pause — and Controls clipped its BACK button at phone and 700px-desktop heights | Layout probe: all 8 screens × 4 viewports reach every control |
| **2 · Full touch parity** | Direct-drag look (both axes), PAUSE/AIM/RELOAD/CROUCH/sprint on touch, boot tap-skip, portrait rotate chip, 44px minimums | Touch was missing half the game: no pause, no aim, no reload, and the look handler read only `clientX` so pitch was frozen; the free-look reticle gate decayed faster than a thumb could travel to FIRE. Probed: the boot-skip tap's trailing click landed on CONTROLS and left the player one screen deep | Self-tests 77 → **90** (13 touch assertions); 5,400-frame soak faults=0; 844×390 screenshots of the cluster clear of radar and ammo plate |
| **3 · Persistence** | One schema-versioned `localStorage` blob (`a360.v1`): sens, look, invert-Y, aim assist, layout, volumes, scanlines, radar, per-mission bests, campaignDone; invert-Y wired to all four pitch paths | Every setting reset on reload; a best table that recorded cheated runs would shadow honest times forever, so tainted runs never record. Every localStorage touch try/catch-wrapped — private windows throw on ANY access | Self-tests 90 → **98**; headed-equivalent desktop + iPhone-landscape runs |
| **4 · Art engine** | Per-mission palette/fog/sky grades, 9 new 64×64 textures, per-cell floors/ceilings via zones, gun-shaped pickups, wall decals, prop set, integer canvas snap | Plain concrete covered **65–85%** of wall cells in all three missions; all shared `ceil:10` and one fog. Render headroom measured first: per-cell lookup costs +0.3ms on a **0.42ms** render, so unzoned levels keep the uniform loop (0.420/0.456/0.392 → 0.402/0.428/0.393 ms). The 9px canvas font smeared the door '360' into '368' | Self-tests 98 → **108** (palette rebake, zone lookup, sky probe, decal FIFO, render smoke); soak 5,400 frames faults=0 |
| **5 · Map content** | Dressed all three maps (wall variety, zones, scenery), one hidden cache per mission, encounters, per-level `agentSkip` thinning | The `ei%3` raster thinning hack had **deleted M01's only legacy tower and both M02 goons** — accidents, not tuning. M02's terminal sat beside spawn | Self-tests 108 → **131** (row-width lint, flood-fill seal/reach of secrets, roster composition per level); playtest: M03 AGENT duel 15/15 bot wins, scripted traversals of all missions through live physics |
| **6 · Game feel** | Damage-direction arcs, hit/kill ticks, 1s death beat, meltdown pulse + shudders, M03 duel checkpoint, campaign finale, SECRET rung retune | The middle difficulty was a measured cliff: playtest bot **15/15 on AGENT, dead in ~8.8s median on SECRET**. Probing showed **75% of the lethality was roster hitscan**, not the boss — so the whole rung softened (dmg 1.0→.8, acc .78→.7, dodge .22→.30, boss rof/keep/drones eased). Bot median survival **~17.4s (2×)**, wins still 0/40; AGENT stays 12/12 | Self-tests 131 → **158**; 40-run SECRET playtests before/after |
| **7 · Audio** | `sfxAt` distance attenuation + stereo pan, music B-section/menu/boss/meltdown states via pure `musMood()`, escape ticks, stingers, foley, iOS resume paths | All world sounds played full-volume mono from any range; meltdown had no audible fuse; iOS 'interrupted' contexts never resumed | 12 new F4 tests, **170 total**, all AudioContext-free; live-audio probe |
| **8 · Infra / tools / docs** | `VERSION` 1.10 shown on title + boot line, sw.js cache bump + `r.ok` gating + font precache, iOS PWA metas, reduced-motion caps (shake ≤1.2, meltdown wash ≤.05), locked-door keyhole pip on radar + watch, verify.js mobile + frame-rate passes + version lockstep, ported touch.js and visual.js, README refresh, this file | v1.04 cache name would have served the old build to installed copies forever; sw cached 404s; colour alone separated locked amber from open teal for a deutan eye; nothing exercised the touch cluster or overlay glyphs in CI | VERIFY OK (desktop 170/170, mobile 168/168, three soaks faults=0), PHONE OK (32 checks), VISUAL OK (20 screen audits), playtest green |
| **9 · Adversarial review** | Full-diff review of rounds 1–8; the one confirmed finding fixed: the F4 zone test replaced M01's `zones` with scratch rects and then `delete`d the field instead of restoring it, so any self-test run stripped the server-hall grate floor for the rest of the session | Found by a high-effort diff review; reproduced headlessly (post-F4 M01 rendered `G.zoned=false`) | Fix + guard test (**171 total**), guard mutation-verified: reintroducing the `delete` fails exactly that test; full battery re-run green |

## Standing numbers

- **Self-tests:** 171 (F4 in-game; run headlessly on desktop and phone
  contexts by verify.js)
- **The battery:** `tools/verify.js` (selftest + 9-combo soaks at 60Hz
  desktop, 60Hz mobile-touch, and 144Hz/30Hz frame-rate invariance, plus the
  index.html/sw.js version check) · `tools/touch.js` (phone-finger
  walkthrough, landscape + portrait) · `tools/visual.js` (glyph-box audit of
  all overlay screens, desktop + phone) · `tools/playtest.js` (scripted-bot
  M03 duel + escape, the balance instrument)
- **Versions:** game `VERSION = '1.10'` (index.html) ↔ `agent360-v1.10`
  (sw.js CACHE), enforced by verify.js

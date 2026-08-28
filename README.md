# Agent 360 — GoldenShare

A GoldenEye-era first-person shooter about managed IT services, rendered with
GoldenEye-era technology: a software raycaster writing into a 384×216 pixel
buffer, textured floor and ceiling casting, billboard sprites with a per-column
depth buffer, and a procedurally synthesised soundtrack. **No assets, no
libraries, no build step — the entire game is one HTML file.**

Three missions, three difficulties, pointer-lock mouse look, GoldenEye-style
aim assist, cheats unlocked from the start (the results screen just gets an
asterisk), and a face-upload option so every hostile in the building can wear a
colleague's photo. The photo never leaves the browser tab.

## Play it

| Channel | How |
|---|---|
| **Hosted (PWA)** | **Live now:** `https://joshfeinst.github.io/Agent360/`. Installable from the browser's Install button; works offline after the first load. |
| **Single file** | Download `index.html`, double-click it. That's the whole game. Chrome or Edge recommended — the mouse locks the moment you hit ACCEPT. |
| **Local server** | `python3 -m http.server` in the repo, then `http://localhost:8000`. |

### Hosting status

The repo is **public** and Pages deploys are green: every push to `main` puts
the current build at the URL above within a minute or two. The service worker
is network-first, so an already-installed copy picks the new version up on its
next launch.

## Controls (short version)

Move **WASD** · look **mouse** (pointer lock; Esc releases and pauses) · fire
**click / Space** · aim-zoom **right-click / Z** · interact **hold F** · reload
**R** · weapons **Q/E, wheel, 1–4** · floor plan **Tab** · radar **N** ·
self-test **F4** · input diagnostics **F3 / F2**. Every action has a
right-hand mirror for left-handed mouse users; full list on the in-game
CONTROLS screen.

On a **touchscreen** the game switches to its own scheme: left pad moves
(speed follows deflection, full deflection sprints), dragging the view looks,
and an on-screen cluster carries **FIRE**, **AIM** (toggle), **RELOAD**,
**GUN**, **USE**, **CROUCH** (toggle) and **PAUSE**. Every button clears 44px,
and the pause screen's field watch stands in for Tab's floor plan.

## Packaging story

The single HTML file **is** the build artifact — for a zero-dependency game
that is a feature, not a limitation. The repo packages *distribution* around
it:

- **`index.html`** — the game. Also runs bare from disk; the PWA hooks
  (manifest link + guarded service-worker registration) deliberately no-op on
  `file://`.
- **`manifest.webmanifest` + `icons/` + `sw.js`** — installable PWA with
  offline support. The service worker is network-first for the shell (new
  deploys land on next load) and stale-while-revalidate for the Google Fonts.
  Bump the `CACHE` version in `sw.js` when cutting a release.
- **`.github/workflows/pages.yml`** — deploys the repo to GitHub Pages on every
  push to `main`.
- **Releases** — tag a version (`git tag v1.0.3 && git push --tags`), create a
  GitHub Release, and attach `index.html` renamed to `Agent360.html` as the
  downloadable build. That is this project's "package registry".

## Roadmap — SharePoint and multiplayer

The eventual goal is colleagues playing this from the team's M365 world.

**Getting it into SharePoint.** Modern SharePoint will not execute an uploaded
`.html` file, so the realistic paths are, in order of sanity:

1. **Embed web part** (recommended first step): host the game at a real URL —
   the GitHub Pages setup here, or an Azure Static Web App if it should live
   inside the company's Azure tenancy — and embed that URL in a SharePoint
   page. A tenant admin must allow-list the domain (SharePoint admin center →
   Settings → HTML field security). The game already tolerates iframes: where
   the frame refuses pointer lock it falls back to free-look, and giving the
   iframe `allow="pointer-lock"` restores full mouse capture.
2. **SPFx web part**: wrap the game in a SharePoint Framework `.sppkg` package
   — the "proper" M365 route, deployable through the tenant App Catalog.
3. **Legacy `.aspx` upload**: works only where the tenant still allows custom
   script; most don't. Not worth chasing.

**Multiplayer, smallest first.** None of this is built yet; each step stands
alone:

1. **Shared leaderboard** — everyone plays solo, mission time / accuracy / rank
   post to one board. Cheapest backends: a SharePoint List written via Graph, a
   tiny Azure Function, or zero-infrastructure shared state on a hosted
   artifact. Days of work; passes every corporate firewall.
2. **Ghost racing** — record a run (position/yaw stream, a few KB of JSON),
   share it, race the colleague's translucent ghost. The billboard-sprite
   pipeline already in the engine renders the ghost; no netcode, no servers,
   and combined with (1) the sharing is automatic. Best fun-per-effort.
3. **Real-time deathmatch / co-op (2–8 players)** — a WebSocket relay over 443
   (survives corporate networks; peer-to-peer WebRTC usually doesn't without a
   TURN server anyway): ~100-line Node relay on Azure/Fly plus lobby UI, player
   sprites and name tags, interpolation, respawns. Deathmatch first — it needs
   no enemy-AI syncing, each client simulates itself and broadcasts
   position/fire events. Co-op adds host-authoritative enemy state on top.

## What's new in v1.10

A full TLC pass over v1.04: standards mode and scroll-safe menu screens, full
touch parity, persisted settings and per-mission bests (`localStorage`,
schema-versioned, cheats never recorded), per-mission art grades with per-cell
floors/ceilings, dressed maps with one hidden cache per mission, damage-
direction arcs and a proper death beat, an M03 duel checkpoint and campaign
finale, and distance-attenuated audio with music states. The version in the
title-screen corner tracks `VERSION` in `index.html`, which must match the
`CACHE` name in `sw.js` — `tools/verify.js` fails the build if they drift.

## Development

- **F4** runs the in-game self-test suite — now **170 assertions**: level
  reachability audits, input model invariants (pointer-lock linearity,
  free-look symmetry, aim-assist never fighting the player's turn), movement
  and collision checks, touch-cluster behaviour, palette/zone rendering,
  secrets, checkpoint and music-state logic.
- `tools/verify.js` runs that suite headlessly plus a 5,400-frame
  randomized-input soak across all nine mission/difficulty combinations —
  then does it all again in a phone context (844×390, touch events driving
  the real cluster) and once more stepping the sim at 144 Hz and 30 Hz to
  prove frame-rate invariance. It also checks the `index.html`/`sw.js`
  version lockstep: `npm i playwright && node tools/verify.js "$(pwd)/index.html"`.
- `tools/touch.js` is a phone-finger walkthrough: boot skip, every menu, a
  mission started, walked, fired, paused and resumed by taps alone, with
  44px tap-target and screen-utilization measurements.
- `tools/visual.js` measures the rendered glyph boxes of every text element
  on every DOM overlay screen — zero-height, clipped or painted-over text
  fails the run — at desktop and phone viewports.
- `tools/playtest.js` pits a deliberately mediocre scripted bot (bounded turn
  rate, aim jitter, no cheats, no cover play) against the M03 boss and then the
  meltdown escape: `node tools/playtest.js "$(pwd)/index.html" 0 30`. Balance
  changes are judged by its win rate — the AGENT duel is tuned so this bot wins
  ~93% of runs; on SECRET AGENT and 00 AGENT it dies, as it should.
- The game survived three adversarial review rounds (independent finder agents
  cross-examined by paired skeptics); regressions found there become new F4
  assertions.

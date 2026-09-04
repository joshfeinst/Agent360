# Agent 360 — GoldenShare

Somebody at Riverbend Logistics propped the server-room door open. Somebody at
Meridian Freight clicked the link. Somebody stopped paying for cage 40 at the
Northpoint colo, and the crew that noticed is exfiltrating through it tonight.
Somebody bolted a mast to the roof of the parking deck, and every rogue access
point on this contract answers to it.
And somewhere under a building nobody has the keys to, a domain controller
with twenty-two years of uptime has decided that migration is an attack. You are the MSP's field agent. Deploy the agent,
walk the CFO off the floor, decommission the machine, and be out before the
night shift arrives.

It's a GoldenEye-era first-person shooter about managed IT services, rendered
with GoldenEye-era technology: a software raycaster writing into a 384×216
pixel buffer, textured floor and ceiling casting, billboard sprites with a
per-column depth buffer, and a procedurally synthesised soundtrack. No assets,
no libraries, no build step — the whole game is one HTML file. Its sibling
project [Managed](https://github.com/joshfeinst/Managed) covers the desk job;
this is the desk job seen from the field.

Five missions on three clearances, GoldenEye-style aim assist, cheats
unlocked from the start (the results screen just gets an asterisk), and a
face-upload option so every hostile in the building can wear a colleague's
photo. The photo never leaves the browser tab.

## Play it

| | |
|---|---|
| **In a browser** | [joshfeinst.github.io/Agent360](https://joshfeinst.github.io/Agent360/) — installs as an app, works offline after the first load |
| **From a file** | Download `index.html` and double-click it. That's the whole game. Chrome or Edge recommended — the mouse locks the moment you hit ACCEPT. |
| **Locally** | `python3 -m http.server` in the repo, then `http://localhost:8000` |

Every push to `main` deploys within a minute or two. The service worker is
network-first, so an installed copy picks the new build up on its next launch.

## Controls

Move **WASD** · look **mouse** (pointer lock; Esc releases and pauses) · fire
**click / Space** · aim-zoom **right-click / Z** · interact **hold F** · reload
**R** · weapons **Q/E, wheel, 1–4** · floor plan **Tab** · radar **N** ·
self-test **F4** · input diagnostics **F3 / F2**. Every action has a
right-hand mirror for left-handed mouse users; the in-game CONTROLS screen has
the full list.

**On a phone it works out that it's a phone.** Two pads: the left one moves —
push it to the rim and you sprint — and the right one looks, so you can walk
and turn at once instead of choosing. Dragging the view still looks if you
prefer it, a tap on the view shoots, and FIRE, AIM, RLD, GUN, USE, CRCH and
❚❚ (pause) cluster around whichever pad the thumb is already on, every one of
them at least 44px. The pause screen's field watch stands in for Tab's floor plan. Landscape
is the better way to hold it; installed from *Add to Home Screen*, it launches
fullscreen. Settings and per-mission bests survive reloads, and cheated runs
are never recorded.

## Packaging story

The single HTML file **is** the build artifact — for a zero-dependency game
that is a feature, not a limitation. The repo packages *distribution* around
it:

- **`index.html`** — the game. Also runs bare from disk; the PWA hooks
  (manifest link + guarded service-worker registration) deliberately no-op on
  `file://`.
- **`manifest.webmanifest` + `icons/` + `sw.js`** — installable PWA with
  offline support. The service worker is network-first for the shell and
  caches the fonts at install. `VERSION` in `index.html` must match the
  `CACHE` name in `sw.js`; `tools/verify.js` fails the build if they drift.
- **`.github/workflows/pages.yml`** — deploys the repo to GitHub Pages on every
  push to `main`.
- **Releases** — tag a version (`git tag v1.10 && git push --tags`), create a
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

## v1.10

A full TLC pass over v1.04, run the way Managed's overnight rounds were run:
measure first, change second, and a self-test for everything that broke on the
way. The short version — the game now plays properly on a phone, the three
missions stopped sharing one grey wall texture, getting shot tells you where
from, dying gets a beat before the debrief, the finale duel got a checkpoint, the
soundtrack learned the difference between a menu and a meltdown, and every
mission hides one cache behind a wall that doesn't advertise itself. The long
version, with the measurements that forced each change, is
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.20

The campaign grew from three missions to five. Two landed between the phishing floor and the
finale — a colo at 03:15 and a parking-deck roof at dusk, the game's first
open sky — and a scripted objective-chain bot now proves every mission humanly
winnable end to end from a cold pistol start, on every clearance, with each
new mission's par calibrated from its own measured run. Same ledger:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.21

An adversarial bug hunt: four probe-driven finders, twenty-two reproduced
fixes. The ones a player would have met first: a tap on the letterbox no
longer fires the gun or silently drops your AIM, a laggy frame can no longer
eat a tap or a flick, checkpoint wins stopped overwriting honest best times,
the aim assist stopped courting an invulnerable boss, and secret caches
stopped advertising themselves on the radar. Ledger as always:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.22 · v1.23

Ten player sessions, each handed the game cold and told to play it, then every
anomaly they filed cross-examined by a paired skeptic: 39 reported, 29
confirmed, 10 refuted. The phone half landed first — a reachable pause screen,
menus that answer a finger with a thumb already on the glass, one owner per
look drag, held keys that survive a pause, twin-pad tuning. The desk half
followed: the title screen stopped teaching a control scheme it does not ship,
MISSION SELECT stopped promising objective counts three of the five missions
never had, your clearance survives a reload (and stops hiding your own best
times), P actually turns the scanlines off for good, the menus gave up a
blur that cost 38fps at 720p and showed nothing, the mission clock stopped
under-counting on a slow device, and the radar and floor plan gave five
different things five different shapes. Ledger:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.24

Housekeeping with teeth. Two of the fixes are things a player would have felt
without ever knowing why: a mission no longer starts with the last one's walk
cycle, footstep and aim-assist lock still attached, and on a tablet with a
keyboard a tap on MISSION SELECT stopped killing the ENTER shortcut the gold
row advertises. The rest is the test suite growing the habit of asking
generic questions instead of remembered ones — *does any field of the player
survive a mission load*, rather than *did we remember crouch* — which is how
the first two were found. Ledger: [NIGHT_LOG.md](NIGHT_LOG.md).

## v1.25

A round spent asking whether the game's own promises are kept. The field
manual lists thirty-seven keys; a test now presses every one of them, parsed
out of the screen itself rather than a list beside it, so a row that starts
naming a new key is checked the day it is written. Every character a mission
map uses has to leave a mark on the level, because one the loader does not
answer becomes floor in silence — a medkit that simply is not there. Every
sound the code plays has to exist in the sound table, because `sfx()` on a
missing name is not an error, it is quiet. And the one real defect: a stored
best time was checked for a floor but not a ceiling, so a corrupted save could
put `BEST 1.66e+306:56` on MISSION SELECT. Ledger:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.26

Score tables are where a typo hides from a soak: every frame still runs,
nothing throws, and the only symptom is that the middle clearance punishes
harder than the top one, or that missing more shots earns a better review. So
this round asked the *shape* of each table rather than any number in it — no
rung softer than the one below, the roster and task list never shrinking as
clearance rises, and playing worse on any axis never earning a better
performance review, over 240 combinations. That found one latent fault: the
rank ladder's ceiling was the literal `7` rather than the ladder's own length,
so adding a rung would have silently pinned every player to the old top. Six
other reports were chased and refuted. Ledger:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.35

In Windows High Contrast every menu floated over the live mission, because the
backdrop was a gradient and forced-colors drops background images; the worst
text run measured 1.68 to 1. The pinned action row's transparent top half was
swallowing the clicks meant for the controls visible through it, so at 200%
zoom the Music and Scanlines sliders could be seen and not pressed. The
Reduce Motion row said OFF while the operating system was forcing it on. And
the debrief, which takes focus when it opens, had no role and no name to
announce. Ledger, including what browser zoom can and cannot do for a
low-vision player: [NIGHT_LOG.md](NIGHT_LOG.md).

## v1.34

The frame got 27% cheaper without a pixel moving. The floor caster looked its
map cell up once per pixel where the cell only changes where the walk crosses
a grid line, and the chevron's reachability fill — added in v1.31 — rebuilt
itself from scratch every frame, allocating some 2500 arrays to do it. Both
are proved byte-identical across 745 rendered poses. The memo shipped with an
exact key rather than the proposed hash, because the hash collided and drew
the chevron somewhere else in 20 of those poses. Ledger, including the earlier
performance verdict that turned out to be measurement noise, and the five
candidate optimisations that lose:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.33

The mission banner promises you a moment to read it, and v1.32's grace was
seven tenths of a second shorter than the banner itself — long enough for a
phish on M03 to shoot you under it. The two are one constant now. A screen
reader met six sliders it could only call "slider", and heard nothing the
game said out loud; the sliders are named and the toast column announces.
The Options values were the smallest text you must read to know a setting,
at a hardcoded 8px. And now that rounds stop on the CFO, the aim assist was
still locking through him and feeding every round into his back. Ledger,
including the escape route, the objective orders, the ammo economy and the
duel that were measured and left alone:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.32

A level auditor, a gun nut, a streamer at 1080p, a kid mashing a phone, a
low-vision player and a performance reviewer. Ctrl+P turned the scanlines
off and saved it; a thumb a re-fit had let go of was taken back by the moved
pad on its next twitch; a finger the OS never lifted held FIRE forever; a
RETRY mash emptied the pistol into the spawn wall; ABORT sat under the FIRE
thumb; rounds passed through the CFO in silence; a near-full crate vanished
for one round; the aimed crosshair lied about its cone; a phish fired at the
spawn during the mission banner; health had no number. The performance
reviewer's variant measured slower and did not ship. Ledger:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.31

Two reviewers on ground nobody had audited — the self-test suite itself and
what the HUD draws, pixel by pixel — and four players: a touchscreen laptop
that swaps between finger and mouse, a forty-minute marathon, a throttled
office PC, and a copy reader. The suite had eight one-line regressions that
passed the whole battery and, on a phone, could leave a fabricated best in
memory for the next honest save to write; F4 from the pause watch handed back
a fresh M01. A touchscreen laptop with the keyboard folded away could not
move or pause — the input model was one media query at load; the first
finger on the view now opens the cluster beside the mouse. The waypoint
label covered the crosshair the moment you aimed at its target, and the
chevron pointed through locked doors. The clearance blurbs promised a
tasking difference three missions do not have. Ledger:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.30

Six more players on ground the first twelve had not covered: a returning
player over http with the service worker live, an Android phone whose browser
bar comes and goes, a netbook and a trackpad, a headphone player with the
audio graph hooked, a cautious player who dies a lot, and a speedrunner. The
one that mattered: two tabs erased each other's save wholesale, so a settings
click in one tab wiped a mission win from the other. Also: the phone's BACK
gesture left the page mid-mission; a browser bar showing mid-sprint turned
forward into a hard-left strafe; a pinch on the canvas turned the view 30°;
a Mac mouse's small notches collapsed into one weapon step; F4 threw out of
its own suite when site data was blocked, and went red with infinite ammo on;
the finale opened in boss-fight music with the boss unmet; Shift held through
RESTART walked instead of sprinting. Ledger, including
what was reported and did not survive: [NIGHT_LOG.md](NIGHT_LOG.md).

## v1.29

Six more scripted players, told to play rather than probe: an explorer in an
iframe that refuses pointer lock, a commuter holding the phone in portrait, a
keyboard-only player, a left-hander in drag look, a laptop player whose life
keeps interrupting, and a completionist. What they found: Shift+Tab on the
paused watch quietly resumed the mission; a right-click for aim mid-drag
turned the drag's release into a shot; Esc or Enter mashed as you died took
the debrief away unseen; portrait toasts stacked 31px lines across a 216px
picture under a rotate chip that covered them; free look drew two crosshairs
250px apart; the frame that refused the mouse went back to a title screen
that taught mouse capture; a second vest promised +60 for +40. Ledger,
including the two reports that were the harness and not the game:
[NIGHT_LOG.md](NIGHT_LOG.md).

## v1.28

Four reviewers were each handed one section of the file and told to find
what was reproducible, and every claim was reproduced headlessly before it
counted. The one that mattered: sight lines and bullets sampled their path
while the renderer walked the grid, so where two walls touch only at a corner
a hostile could see and shoot you through a wall you could not shoot back
through — four such corners ship, and M01's sits on the terminal you hack.
Also: the briefing still handed out the letters the v1.27 round had fixed
everywhere else, F4 on a debrief brought back a different mission's, a
checkpoint duel was ranked against the whole mission's clock, a key held
through the briefing's ENTER walked nowhere, and free look hitched every
time the cursor crossed onto the letterbox. Ledger, including what was
reported and did not survive: [NIGHT_LOG.md](NIGHT_LOG.md).

## v1.27

Six scripted players were handed the game cold — a first-timer on a laptop, a
speedrunner chasing M03, a commuter on a landscape phone, someone who rotates
mid-mission, a settings tinkerer who barely plays, and a tablet with a keyboard
folio — and each anomaly they filed was cross-examined before it counted. The
one four of them found independently: the HUD counted objectives differently
from the briefing, the field watch and the debrief, so a four-item mission
opened at "3 OBJ LEFT" and went green on "ALL OBJ DONE" with the exit still
seventy metres away. Objective letters skipped the ones a lower clearance
filters out (A, B, C, E). A best time could be filed a second slower than the
debrief that scored it. ENTER on the debrief threw you to the title past the
gold button it advertises. On a tablet, a keyboard tap cancelled a hack, a
sprint or a crouch the thumb was still holding — and Backspace, the key the
manual sells as "Reset stuck input", was what killed the stick. A swipe on the
black surround navigated the browser away mid-run. Ledger, including what was
reported and did not survive:
[NIGHT_LOG.md](NIGHT_LOG.md).

## Development

- **F4** runs the in-game self-test suite — **465 assertions** (457 in a touch
  context): level reachability audits, input
  model invariants (pointer-lock linearity, free-look symmetry, aim-assist
  never fighting the player's turn), movement isotropy and collision, the
  player and audio state a mission load has to hand back, touch-cluster
  behaviour, palette and zone rendering, secrets, checkpoint and music-state
  logic.
- `tools/verify.js` runs that suite headlessly plus a randomized-input soak
  of 600 frames per mission/difficulty combination — the campaign's own
  length, so a new mission is soaked the day it lands —
  then does it all again in a phone context (844×390, touch events driving
  the real cluster) and once more stepping the sim at 144 Hz and 30 Hz to
  prove frame-rate invariance. It also reads the source for the things that
  have to be right before a script runs — the `index.html`/`sw.js` version
  lockstep, the title screen's static how-to matching the look mode the build
  ships, the service worker's cache scoping, clone timing and precache
  freshness, every sound name the code plays existing in the sound table, and
  F4 on a debrief handing that debrief back — then a portrait pass at 390×844
  measuring the rotate chip and the toast type against the real frame, a
  storage-denied pass, the suite run with the cheat menu's toggles on, F4 from
  the watch keeping its mission, and a seeded soak that prints its seed: `npm i playwright && node tools/verify.js "$(pwd)/index.html"`.
- `tools/touch.js` is a phone-finger walkthrough: boot skipped, every menu
  visited, a mission started, walked, fired, paused and resumed by taps
  alone, with 44px tap-target and screen-utilization measurements. It also
  proves the paused watch shows its way out without scrolling, and that a menu
  row still answers a finger while a second one rests on the glass.
- `tools/visual.js` measures the rendered glyph boxes of every text element
  on every DOM overlay screen — zero-height, clipped or painted-over text
  fails the run — at desktop and phone viewports.
- `tools/playtest.js` pits a deliberately mediocre scripted bot (bounded turn
  rate, aim jitter, no cheats, no cover play) against the finale boss and then the
  meltdown escape: `node tools/playtest.js "$(pwd)/index.html" 0 30`. Balance
  changes are judged by its win rate — the AGENT duel is tuned so this bot wins
  ~93% of runs; on SECRET AGENT and 00 AGENT it dies, as it should.
- `tools/runthrough.js` is the proof a mission is humanly playable: an
  objective-chain bot loads each mission cold (no cheats, pistol start),
  BFS-walks the watch's own objective order through live physics, and reports
  time against par. It finishes 14 of the 15 mission x clearance pairs at
  0.27-0.52 of par; the fifteenth is the finale duel on 00 AGENT, the same
  wall the playtest bot measures its 0/8 against, and the campaign's
  deliberate ceiling. `--thumb` re-runs the table with a phone's reflexes —
  stop-and-turn steering at the look pad's own rate — so a map that only works
  with a mouse fails here. New missions calibrate their par from the SECRET
  AGENT time: `node tools/runthrough.js "$(pwd)/index.html" all all`.
- The game has been through repeated adversarial review rounds — independent
  finders cross-examined by paired skeptics — and every confirmed regression
  became an F4 assertion. [NIGHT_LOG.md](NIGHT_LOG.md) is the ledger.

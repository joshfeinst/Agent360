# Changelog

Every shipped version of Agent 360, newest first. Each is a git tag, so
`git show v1.54:index.html` is that exact build; the ledger behind each
entry is [NIGHT_LOG.md](NIGHT_LOG.md).

Play the current build: <https://joshfeinst.github.io/Agent360/>

## v1.54 — a muted player, a back button, a high-DPI phone, a power user

Four players at once. A muted player found that after another window turned
the soundtrack off, MUSIC ON flipped the label and left the bus at zero. A
player who uses the browser's back button found the gesture leaving the site
from the mission list on a first visit, a dead press on the title, and an iOS
edge swipe turning the agent before the browser took it. A player on a folding
phone found the touch cluster laid out in percentages of a frame squarer than
the glass, so a thumb on the look pad fired a round. And a power user with
every browser setting changed found a blocked manifest taking the whole
service worker with it, the gold buttons invisible in Windows High Contrast,
and holes in the music whenever the browser throttled its timers.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.54/NIGHT_LOG.md).

## v1.53 — a screen reader, an alt-tab, a slow network, an ultrawide

A screen-reader player walked M01 keyboard-only and found the one line the
game never spoke: the interact prompt was painted on the canvas and nowhere
else, so a blind player at the first terminal never learned to hold F. It is
announced now, once per target, and the watch names the gun and its magazine,
which had no route off the canvas either. The viewport is an `application`
so a reader hands the keys over, Tab wraps inside every dialog instead of
falling onto the body, and the controls card is a list a reader can walk row
by row. An alt-tab player added one: Enter resumes from the watch even after
the come-back click landed on its stats panel. A player on a train found the
font stylesheet blocking the first paint — a blank tab for as long as the CDN
stalled, 42.7 s measured — and a late face sliding RESTART under RESUME
mid-mission; the sheet is non-blocking now and a face that misses its window
stays out. And an ultrawide player at 67% zoom found the scanline a device
pixel short of the game pixel; both now come from one integer.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.53/NIGHT_LOG.md).

## v1.52 — an old device

A player on old engines — a 2017 Android whose Chrome stopped updating, an
iPad on iOS 12–14, a Chromebook past its update date — found two things that
were not API calls at all. One `??`, the only ES2020 token in the file, made
the whole main script fail to parse on Chrome ≤79 and Safari ≤13, leaving the
static splash up forever. And `inset:0` with no four-side fallback put every
screen below the fold on Chrome 80–86 and Safari 13.4–14 and collapsed the
touch cluster to nothing. The file is ES2018 again and the stylesheet carries
fallbacks an old parser keeps, and verify.js now holds both.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.52/NIGHT_LOG.md).

## v1.51 — the eleventh round, parts one and two

Two windows of the game on one profile: a setting chosen in one was erased by
the other's next save, because the v1.37 merge folded in only bests — and the
other window's save stole this window's keyboard focus through the storage
handler. Settings written next door are adopted now (a live mission keeps its
clearance), and focus stays put. A browser that translates the page rewrote
the watch's ABORT button under a text-gated restore, so on a translated phone
it read "tap again" forever; the arm comes down by state now, keycaps carry
translate="no" so "A" is no longer "UM", and F4 no longer shows four red rows
that were only the suite reading Portuguese.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.51/NIGHT_LOG.md).

## v1.50 — a controller in the hand

A phone paired with a controller that Android registers as a pointing device
answers "fine pointer, hover", and the game dressed it as a desktop: no touch
cluster, a hint about a captured mouse, the keyboard card, and the clearance
chooser back below the fold. A phone-sized screen with touch points is a
touch device now whatever its primary pointer says; touchscreen laptops keep
the mouse profile. And the finger that opens hybrid no longer spends a round
doing it. The game itself ignores a gamepad, and nothing breaks when one is
plugged in. Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.50/NIGHT_LOG.md).

## v1.49 — what the screens never said, and 360 frames a second

A player who acted only on what the screen had said found that thirty-six
lines of text between the cold load and the first fight never named a
movement key; that a loss was a headline and a table of numbers; that on a
landscape phone the clearance chooser and BACK opened two pixels below the
fold with no scrollbar and no fade; that phone toasts were under a millimetre
tall; and that the capture band flashed for six frames. All five are fixed.
A player on a 360 Hz monitor drove the real frame loop at every cadence from
20 to 360 and through a wandering dt: every quantity held except aim and
crouch, which eased with a per-frame fraction and so took 10% longer at
360 Hz than at 30 — now a frame-rate-independent ease.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.49/NIGHT_LOG.md).

## v1.48 — the clocks that lie, and the network that stalls

A browser that coarsens timestamps to 100ms (Firefox resistFingerprinting,
Tor) ran the world at half speed while the SLA clock ran full: physics was
clamped to 0.05s a frame and half of every 0.1s delta was thrown away. The
frame is now simulated in sub-steps up to the same 0.5s ceiling both clocks
share. The mission-start tap swallow compared an event timestamp with
performance.now(); on an engine where those differ it lasted 1.6s, or never
held. And the installed app could be held hostage by a network that stalls
rather than fails — 25.1s to boot with the whole shell cached, most of it a
render-blocking font stylesheet — and lost outright to one missing icon,
since cache.addAll() is all-or-nothing. Both race a 3-second timeout now.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.48/NIGHT_LOG.md).

## v1.47 — the ninth player-session round

A stylus on a Windows or ChromeOS tablet sends pointer events and compat
mouse events and no TouchEvents, and a touch-profile game threw the lot away:
a pen could tap its way into a mission and then do nothing — no shot, no turn,
no pause — under a HUD saying TAP TO SHOOT. A pen's contact is now re-issued
as the touch events a finger would have sent, so every rule the finger has
applies to it; in hybrid, ❚❚ under a pen pauses instead of firing.

Also: every run in this project's history had the web font failing to load. A
player who made it load found RELOADING drawn centred on x=10 — reading
"OADING" even with the fallback — a magazine that ran into a three-digit
reserve with a 0px gap, and the F2 plate and F4 report sized to the narrower
face. A colour-blind audit across all three dichromacies found no colour-only
collapse; the one near miss, the amber cue against the red pain arc under
deuteranopia, now has a different stroke as well as a different radius. And
the economy is sound — no mission can be starved — but a crate refused a
player whose cannon was dry, in silence, and "dry" was never said.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.47/NIGHT_LOG.md).

## v1.46 — two seams in my own work

Two seams between the last three releases, found before the round's players
reported. Opening the field watch wiped the screen reader's live region along
with the toast column, though every reason for that clear is about paint; and
the hold/toggle row's keyboard latch and the touch AIM button were two latches
over one zoom, so on a touchscreen laptop a Z tap and an AIM tap-off left the
view fully zoomed under a lamp that said off. Both are one latch now.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.46/NIGHT_LOG.md).

## v1.45 — the hold/toggle row

Options gains **Aim / crouch / sprint · HOLD · TOGGLE**. On a keyboard these
three have always been holds, which asks for two keys at once — aim and fire,
crouch and walk, sprint and walk — so a player who can only ever have one key
down lost three of the game's verbs: a tap-then-press measures P.aim 0.01
where an aimed shot needs 0.5, P.crouch 0.00, P.speed 1.00. The touch build
has latched AIM and CRCH since v1.20; this is the same offer to a keyboard.
HOLD stays the default. Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.45/NIGHT_LOG.md).

## v1.44 — the seventh player-session round

A player brought a 16000-dpi mouse with side buttons. Two things broke. The
captured look path dropped any single event past 3000 raw counts instead of
clamping it, so the fastest flick turned you least — 2999 counts turned 1.2449
rad and 3001 turned exactly nothing — and since Chrome coalesces mousemove to
the frame, one hitched frame arrives as a single event of thousands. The bound
is now half a turn, in radians, so it scales with the sensitivity. And the
thumb button, which every mouse maps to browser BACK, was swallowed whole by
the pointer lock during play — so the first press that ever landed was the one
on the field watch, where BACK ends the run.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.44/NIGHT_LOG.md).

## v1.43 — what you cannot hear, and what one hand cannot reach

The game had been audited for colour and never for sound. A player with the
volume at zero enumerated all 31 sounds and found two that were the only notice
of their event: a hostile waking behind you — which changed 0 of 82,944 pixels,
from as far as 17.1u, outside the radar entirely — and the legacy tower's 0.4s
wind-up, which the source itself calls the counterplay. Both now put a short
amber arc on the reticle ring, pointing where the noise came from, and only
when the source is off screen. A player with one hand found two more: Sticky
Keys could not reach sprint (1.000 against 1.480), and the promise that every
action has a right-hand mirror was false for aim.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.43/NIGHT_LOG.md).

## v1.42 — the reader hears the settings, and hears them from inside the room

A player drove the whole game through the accessibility tree with Tab, Enter,
Space and the arrows. Two things broke. Tabbing the Options panel announced
"CAPTURE, OFF, SNAP + PULL, WASD, ON, ON, OFF" — two buttons named exactly ON,
two exactly OFF, and nothing saying which setting any of them was; each control
now answers to its own row's label. And every menu toast was raised outside the
dialog that was open, which `aria-modal` tells a screen reader not to render —
including the warning that your save could not be read. There is now one live
region, and it travels into whichever screen is open.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.42/NIGHT_LOG.md).

## v1.41 — the other place a key is named

v1.40 taught the CONTROLS card to name the keys on the player's own keyboard
and left the same lie in the place it costs most: the green band at a terminal,
the prompt that teaches the whole hack, said HOLD F on every keyboard on earth.
On Dvorak that physical key prints U, so after v1.40 the card and the prompt
disagreed with each other on the same board. The prompt now reads the layout
too. Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.41/NIGHT_LOG.md).

## v1.40 — the manual reads the player's own keyboard

The field manual named every key by the glyph a US keyboard prints on it,
while the game binds the physical key — which is why the movement cluster is
the same diamond under every left hand. On a French AZERTY board those two
facts pulled apart and the card began naming each other's keycaps: nine of
sixteen keys wrong, and the worst two a straight swap, its aim key walking you
forward and its forward key zooming. The browser knows what each physical key
prints, so the card now asks it: on a French layout it reads Z Q S D, aim W,
weapons A E · ^ $ · & É " '. Where a browser will not say, the US glyphs stand
and the card admits they are US — and a new line explains that the binding is
positional, which is the part that makes any layout playable.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.40/NIGHT_LOG.md).

## v1.39 — the sixth player-session round

Four ways to lose a run without being told, each with a message or a rule
already written for it that never ran. A save that cannot be read is stashed
aside and announced — except boot runs the self-test before the announcement,
and the self-test nulled it, so no player had ever seen it. A save that fails
mid-session, when a sibling app on the same origin fills the quota, was
swallowed whole: the debrief printed a rank over a run already lost. BACK from
OPTIONS opened over the field watch fell through every branch, spending the
history entry so the next BACK left the page. And the watch's two-tap ABORT
was armed globally, so an arming tap, a RESUME and a second graze of the pause
button threw the run away on one tap. Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.39/NIGHT_LOG.md).

## v1.38 — two halves of two fixes

Two players found halves of fixes. v1.32 ruled that a Ctrl, Alt or Meta chord
is the browser's and never a game key, and put the guard in one of the two
places a keystroke passes through — so Ctrl+X, the cut chord, still fired a
live round, Ctrl+W walked the agent forward, and Alt+Shift, the layout-switch
chord, put them into a sprint. And the rule that a re-fitted frame lets go of
the thumbs on its pads asked only whether the picture had changed width, which
portrait never does: a phone browser sliding its URL bar back in moved the
stick 39.6px under a motionless thumb, and forward became backward. Ledger:
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.38/NIGHT_LOG.md).

## v1.37 — the one weapon that did not get the memo

v1.33 made the CFO you are escorting a body rather than a window, so a round
into him stops and the agent is told. It fixed the path every weapon uses
except one: the patch cannon's slug carries its own target list, tests it for
hit points, and the CFO has none — so the slug flew through him, detonated on
the guard behind for 82.5 HP, said nothing, and counted as a hit. It obeys the
same contract now. Also: USE never checks the wall between you and the
terminal, and every hackable prop in the campaign was measured unreachable
through one by a margin of 0.21u — a level-design margin the maps are now held
to. Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.37/NIGHT_LOG.md).

## v1.36 — a cache you have opened stays open

A secret cache's wall could slide shut with the agent still inside it. The
tight hold radius that keeps a hidden door disguised — 1.10u, against an
ordinary door's 1.61u — stayed tight after the door was found, and the caches
behind those doors run deeper than that: 2.21u to the far corner of M03's. A
found secret now holds on 2.50u, which covers every cache in the game.
Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.36/NIGHT_LOG.md).

## v1.35 — high contrast and the click shield

In Windows High Contrast every menu floated over the live mission, because the
backdrop was a gradient and forced-colors drops background images; the worst
text run measured 1.68 to 1. The pinned action row's transparent top half was
swallowing the clicks meant for the controls visible through it, so at 200%
zoom the Music and Scanlines sliders could be seen and not pressed. The
Reduce Motion row said OFF while the operating system was forcing it on. And
the debrief, which takes focus when it opens, had no role and no name to
announce. Ledger, including what browser zoom can and cannot do for a
low-vision player: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.35/NIGHT_LOG.md).

## v1.34 — the render round

The frame got 27% cheaper without a pixel moving. The floor caster looked its
map cell up once per pixel where the cell only changes where the walk crosses
a grid line, and the chevron's reachability fill — added in v1.31 — rebuilt
itself from scratch every frame, allocating some 2500 arrays to do it. Both
are proved byte-identical across 745 rendered poses. The memo shipped with an
exact key rather than the proposed hash, because the hash collided and drew
the chevron somewhere else in 20 of those poses. Ledger, including the earlier
performance verdict that turned out to be measurement noise, and the five
candidate optimisations that lose:
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.34/NIGHT_LOG.md).

## v1.33 — the grace is the banner

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
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.33/NIGHT_LOG.md).

## v1.32 — the fifth player-session round

A level auditor, a gun nut, a streamer at 1080p, a kid mashing a phone, a
low-vision player and a performance reviewer. Ctrl+P turned the scanlines
off and saved it; a thumb a re-fit had let go of was taken back by the moved
pad on its next twitch; a finger the OS never lifted held FIRE forever; a
RETRY mash emptied the pistol into the spawn wall; ABORT sat under the FIRE
thumb; rounds passed through the CFO in silence; a near-full crate vanished
for one round; the aimed crosshair lied about its cone; a phish fired at the
spawn during the mission banner; health had no number. The performance
reviewer's variant measured slower and did not ship. Ledger:
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.32/NIGHT_LOG.md).

## v1.31 — the suite, the pixels, and the copy

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
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.31/NIGHT_LOG.md).

## v1.30 — the fourth player-session round

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
what was reported and did not survive: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.30/NIGHT_LOG.md).

## v1.29 — the third player-session round

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
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.29/NIGHT_LOG.md).

## v1.28 — the corners round

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
reported and did not survive: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.28/NIGHT_LOG.md).

## v1.27 — player sessions II

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
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.27/NIGHT_LOG.md).

## v1.26 — the tables round

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
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.26/NIGHT_LOG.md).

## v1.25 — the promises round

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
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.25/NIGHT_LOG.md).

## v1.24 — the phone-fairness and method rounds

Housekeeping with teeth. Two of the fixes are things a player would have felt
without ever knowing why: a mission no longer starts with the last one's walk
cycle, footstep and aim-assist lock still attached, and on a tablet with a
keyboard a tap on MISSION SELECT stopped killing the ENTER shortcut the gold
row advertises. The rest is the test suite growing the habit of asking
generic questions instead of remembered ones — *does any field of the player
survive a mission load*, rather than *did we remember crouch* — which is how
the first two were found. Ledger: [NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.24/NIGHT_LOG.md).

## v1.23 — Merge pull request #5 from joshfeinst/claude/agent-360-tlc-4e10um

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
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.23/NIGHT_LOG.md).

## v1.22 — Twin-pad touch controls: a right look pad, tap-to-fire, regrouped cluster (v1.22)

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
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.22/NIGHT_LOG.md).

## v1.21 — Merge pull request #4 from joshfeinst/claude/agent-360-tlc-4e10um

An adversarial bug hunt: four probe-driven finders, twenty-two reproduced
fixes. The ones a player would have met first: a tap on the letterbox no
longer fires the gun or silently drops your AIM, a laggy frame can no longer
eat a tap or a flick, checkpoint wins stopped overwriting honest best times,
the aim assist stopped courting an invulnerable boss, and secret caches
stopped advertising themselves on the radar. Ledger as always:
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.21/NIGHT_LOG.md).

## v1.20 — Merge pull request #3 from joshfeinst/claude/agent-360-tlc-4e10um

The campaign grew from three missions to five. Two landed between the phishing floor and the
finale — a colo at 03:15 and a parking-deck roof at dusk, the game's first
open sky — and a scripted objective-chain bot now proves every mission humanly
winnable end to end from a cold pistol start, on every clearance, with each
new mission's par calibrated from its own measured run. Same ledger:
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.20/NIGHT_LOG.md).

## v1.12 — New mission: M04 · SHADOW UPLINK — the campaign grows to five

The last insertion before the finale, and the first open-air map: the
Riverbend parking deck at roof level, 19:40. Every rogue AP the contract
has pulled was checking in with one mast up here, so the job is the
campaign's connective tissue — kill three uplinks, lift the crew's
credential case, cut the mast before LEGACY-DC01 gets its last sync.
Most of the deck is ceiling 255 under a new two-stop sky band (L.sky2):
violet zenith blending into an amber horizon, because one colour can only
ramp brightness and dusk is a ramp of hue. Dusk grade to match — violet
tint over plum fog, the warmth kept in the sky so M05 keeps sole claim on
hot amber. New texture 21: parking-deck slab with expansion joints, oil
stains and a faded stall stripe per cell.

## v1.11 — New mission: M03 · THE COLD AISLE — the campaign grows to four

The mission the scaffolding round was built to receive: a Northpoint Data
colo at 03:15, inserted between M02 and the finale. Long cage-bar aisles
with rack rows behind them, a glass meet-me room off the staging floor, a
NOC office (carpet and drop-tile under the colo's ducts, keycard on the
desk), and a hazard-slab loading bay behind the L door with the exit and a
drone over it. New COLD grade: pale blue-white tint with near-white fog
that reads as CRAC mist — nothing like M01's dark cyan night (judged
against an M01 control shot). Grate floor zones run the three cold aisles,
tile elsewhere.

## v1.10 — full TLC: mobile parity, mission identity, game feel, audio

A full TLC pass over v1.04, run the way Managed's overnight rounds were run:
measure first, change second, and a self-test for everything that broke on the
way. The short version — the game now plays properly on a phone, the three
missions stopped sharing one grey wall texture, getting shot tells you where
from, dying gets a beat before the debrief, the finale duel got a checkpoint, the
soundtrack learned the difference between a menu and a meltdown, and every
mission hides one cache behind a wall that doesn't advertise itself. The long
version, with the measurements that forced each change, is
[NIGHT_LOG.md](https://github.com/joshfeinst/Agent360/blob/v1.10/NIGHT_LOG.md).

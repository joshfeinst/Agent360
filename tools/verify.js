/* Headless verification for Agent 360: boot cleanly, run the in-file F4 self
   test suite, then soak every mission/difficulty combo with randomized input —
   first on a desktop page, then again in a phone context (844x390, isMobile,
   hasTouch) that drives the touch cluster with real TouchEvents, and finally a
   frame-rate invariance soak stepping the sim at 144Hz and 30Hz.
   Also checks that VERSION in index.html and CACHE in sw.js agree.
   Usage: node verify.js /abs/path/to/index.html [soakFrames] */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const SOAK_FRAMES = +(process.argv[3] || 600);

async function launch() {
  try { return await chromium.launch(); }
  catch (e) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    for (const dir of fs.readdirSync(base).filter(d => d.startsWith('chromium'))) {
      for (const sub of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        const p = path.join(base, dir, sub);
        if (fs.existsSync(p)) { try { return await chromium.launch({ executablePath: p }); } catch (_) {} }
      }
    }
    throw e;
  }
}

/* ---- source discipline: things that must be right BEFORE any script runs ---- */
function sourceCheck() {
  const html = fs.readFileSync(target, 'utf8');
  const sw = fs.readFileSync(path.join(path.dirname(target), 'sw.js'), 'utf8');
  const hv = (html.match(/const VERSION = '([^']+)'/) || [])[1];
  const sv = (sw.match(/const CACHE = 'agent360-v([^']+)'/) || [])[1];
  /* A Cache Storage bucket is per-ORIGIN: this game shares its host with a
     sibling project, so the service worker must only ever delete its OWN
     buckets. Unscoped cleanup threw away the neighbour's offline cache on
     every release of this one. */
  const swScoped = /ks\.filter\(k => MINE\(k\)/.test(sw) && /startsWith\('agent360-'\)/.test(sw);
  console.log('SW CACHE cleanup is scoped to agent360-* ' + (swScoped ? '— yes' : '— NO, IT DELETES THE ORIGIN'));
  /* And a runtime put must clone BEFORE the response reaches the page, or the
     body is already being read and every write throws. */
  /* The exact bug was caches.open(C).then(c => c.put(req, r.clone())): by the
     time open() resolved the page had begun reading the body, so the clone
     threw and the cache only ever held what install() precached. Cloning
     inline is fine where the response was never handed to a page — what must
     never happen is a clone taken INSIDE an open() continuation. So find every
     deferred put and require it to take a copy captured earlier. */
  const deferred = sw.match(/caches\.open\([^)]*\)\.then\([^;]*?\.put\([^)]*\)/g) || [];
  const swClone = deferred.length > 0 && !deferred.some(c => /\.clone\(\)/.test(c));
  console.log('SW runtime caching clones before handing off ' + (swClone ? '— yes' : '— NO, EVERY PUT THROWS'));
  /* sfx(name) returns quietly when the table has no such key, so a renamed or
     mistyped sound is not an error — it is silence, and silence is the one
     symptom nobody notices in a review. Read every name the source hands to
     sfx/sfxAt (first argument only, ternaries included, which is where four of
     them live) and require the table to answer it. */
  const sfxTable = (() => {
    const a = html.indexOf('const SFX = {');
    if (a < 0) return null;
    const body = html.slice(a, html.indexOf('\n};', a));
    return new Set([...body.matchAll(/^ {2}([A-Za-z0-9_]+)\(\)\s*\{/gm)].map(m => m[1]));
  })();
  /* the first argument of each call: scan to the matching top-level comma or
     close paren, then take every bare-word string literal inside it */
  const sfxNamed = new Set();
  for (const m of html.matchAll(/\bsfx(?:At)?\(/g)){
    let i = m.index + m[0].length, depth = 0, arg = '';
    for (; i < html.length; i++){
      const c = html[i];
      if (c === '(' || c === '[') depth++;
      else if (c === ']') depth--;
      else if (c === ')'){ if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) break;
      arg += c;
    }
    /* in a ternary only the RESULT sides are sound names — the condition's own
       literal is something being compared (sfxAt(e.sub==='drone' ? ...)) */
    const q = arg.indexOf('?');
    const results = q >= 0 ? arg.slice(q + 1) : arg;
    for (const lit of results.matchAll(/'([A-Za-z0-9_]+)'/g)) sfxNamed.add(lit[1]);
  }
  const mute = sfxTable ? [...sfxNamed].filter(n => !sfxTable.has(n)) : ['NO SFX TABLE FOUND'];
  const sfxOK = !!sfxTable && sfxNamed.size >= 20 && mute.length === 0;
  console.log('SFX every name the code plays is in the table — ' +
    (sfxOK ? sfxNamed.size + ' names, all answered'
           : (mute.length ? 'SILENT: ' + mute.join(' ')
                          : 'ONLY ' + sfxNamed.size + ' NAMES FOUND — the scan broke')));
  /* The precache is the OFFLINE copy of the shell, and addAll() in its
     default cache mode reads through the HTTP cache — with Pages' max-age=600
     that is the previous build for ten minutes after every deploy. */
  const swFresh = /addAll\(SHELL\.map\(\s*\w+\s*=>\s*new Request\(\s*\w+\s*,\s*\{\s*cache:\s*'reload'/.test(sw);
  console.log('SW precache bypasses the HTTP cache ' + (swFresh ? '— yes' : '— NO, IT CAN PRECACHE THE OLD BUILD'));
  const vOK = hv && sv && hv === sv;
  console.log('VERSION index.html v' + hv + ' / sw.js v' + sv + (vOK ? ' — in step' : ' — MISMATCH'));
  /* syncTitleHint() rewrites the title how-to the moment scripts run, but the
     FIRST paint is the static string — and that string described DRAG while
     desktop ships CAPTURE. The F4 suite can only see the rewritten one. */
  const cap = (html.match(/const TITLE_HINT = \{\s*capture:\s*'([^']+)'/) || [])[1];
  const stat = (html.match(/id="titlehint">([^<]+)</) || [])[1];
  const hOK = !!cap && !!stat && stat.indexOf(cap) === 0;
  console.log('TITLE HINT static default ' + (hOK ? 'matches the shipped look mode' : 'DRIFTED from TITLE_HINT.capture'));
  return vOK && hOK && swScoped && swClone && sfxOK && swFresh;
}

async function wirePage(page, errors, resourceErrs) {
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR/.test(t)) resourceErrs.push(t); else errors.push('console: ' + t);
  });
  await page.goto('file://' + target);
  await page.waitForFunction(() => typeof G !== 'undefined' && typeof selfTest === 'function', { timeout: 15000 });
  await page.waitForTimeout(1200);
}

async function runSelfTest(page, label) {
  /* F4 is a documented control, and the suite it runs scribbles on the live
     settings and once wrote them to disk. Assert the end-to-end property from
     OUT HERE — the suite cannot be trusted to mark its own homework. */
  const f4Safe = await page.evaluate(() => {
    const distinct = { sens:1.93, tsens:1.4, inv:true, aim:0, sfx:0.31, mus:0.11,
                       scan:83, map:false, rm:true, diff:2, look:'drag' };
    M.sens = distinct.sens; M.tsens = distinct.tsens; INVERT_Y = distinct.inv;
    AIM_ASSIST = distinct.aim; A.sfxVol = distinct.sfx; A.musVol = distinct.mus;
    SCANOP = distinct.scan; G.mapOn = distinct.map; RM_OPT = distinct.rm;
    G.diff = distinct.diff; if (!isTouch) LOOK = distinct.look;
    saveSettings();
    const before = localStorage.getItem(SAVE_KEY_REAL);
    const board0 = JSON.stringify(BEST), cd0 = campaignDone;
    selfTest(true);
    const after = localStorage.getItem(SAVE_KEY_REAL);
    /* ...and the BOARD in memory: a scripted win the suite filed to its
       scratch blob used to come back into BEST and reach disk on the next
       honest save */
    const boardMoved = JSON.stringify(BEST) !== board0 || campaignDone !== cd0;
    const live = { sens:M.sens, tsens:M.tsens, inv:INVERT_Y, aim:AIM_ASSIST,
                   sfx:A.sfxVol, mus:A.musVol, scan:SCANOP, map:G.mapOn,
                   rm:RM_OPT, diff:G.diff, look:LOOK };
    const moved = Object.keys(distinct).filter(k =>
      (k === 'look' && isTouch) ? false : live[k] !== distinct[k]);
    if (boardMoved) moved.push('BEST/campaignDone');
    G.state = 'title'; if (typeof show === 'function') show('s-title');
    return { blobHeld: before === after, moved,
             scratchGone: localStorage.getItem(SAVE_KEY_TEST) === null };
  });
  console.log('F4 SAFETY blob held ' + (f4Safe.blobHeld ? 'yes' : 'NO') +
              ' · settings moved: ' + (f4Safe.moved.length ? f4Safe.moved.join(',') : 'none') +
              ' · scratch key cleaned ' + (f4Safe.scratchGone ? 'yes' : 'NO'));
  /* F4 is legal on the debrief too, and the sim files debriefs of its own
     through the real endMission over the same nodes — the player's has to be
     the one on screen when the report closes, buttons and handlers included.
     Asserted from out here for the same reason: the suite cannot run itself. */
  const f4Debrief = await page.evaluate(() => {
    selLevel = 2; G.diff = 1; loadLevel(2, 1); G.state = 'play';
    G.time = 61.2; G.shots = 20; G.hits = 15; G.dmgTaken = 12;
    G.tainted = true;                                    // a tainted run files no best
    for (const o of G.objs){ o.have = o.need || 1; o.done = true; }
    endMission(true, 'exit');
    const snap = () => ['r-eyebrow', 'r-title', 'r-stats'].map(id => document.getElementById(id).textContent).join('|') +
      '|' + [...document.querySelectorAll('#r-actions button')].map(b => b.textContent).join(',');
    const before = snap();
    const f4 = () => dispatchEvent(new KeyboardEvent('keydown', { code: 'F4', key: 'F4', bubbles: true, cancelable: true }));
    f4(); const report = G.showTests === true; f4();
    const after = snap(), state = G.state, screen = G.screenId;
    const next = [...document.querySelectorAll('#r-actions button')].find(b => /NEXT/.test(b.textContent));
    if (next) next.onclick();
    const nextOk = !!next && G.state === 'brief' && selLevel === 3;
    G.tainted = false; G.state = 'title'; if (typeof show === 'function') show('s-title');
    return { report, held: before === after, state, screen, nextOk, before, after };
  });
  /* F4 from the WATCH: the mission behind the report has to be the same one,
     same clock, same objectives — assertions that load levels used to run
     here too, and handed back a fresh M01 under a watch titled M05 */
  const f4Watch = await page.evaluate(() => {
    selLevel = LEVELS.length - 1; G.diff = 0; startMission(false);
    for (let i = 0; i < 120; i++) step(1/60);
    pause();
    const snap = () => ({ code: G.L.code, time: +G.time.toFixed(2), objs: G.objs.length, ents: G.ents.length, x: +P.x.toFixed(2), y: +P.y.toFixed(2) });
    const before = snap();
    const f4 = () => dispatchEvent(new KeyboardEvent('keydown', { code: 'F4', key: 'F4', bubbles: true, cancelable: true }));
    f4(); const report = G.showTests === true; f4();
    const after = snap(), state = G.state;
    resume(false); clearInput(); G.state = 'title'; if (typeof show === 'function') show('s-title');
    return { report, same: JSON.stringify(before) === JSON.stringify(after), state, before, after };
  });
  const f4WatchOK = f4Watch.report && f4Watch.same && f4Watch.state === 'pause';
  console.log('F4 WATCH the paused mission survives the report ' + (f4WatchOK ? '— yes' :
              '— NO: ' + JSON.stringify({ report: f4Watch.report, state: f4Watch.state, before: f4Watch.before, after: f4Watch.after })));
  const f4DebriefOK = f4Debrief.report && f4Debrief.held && f4Debrief.state === 'result' &&
                      f4Debrief.screen === 's-result' && f4Debrief.nextOk;
  console.log('F4 DEBRIEF the player\'s debrief survives the report ' + (f4DebriefOK ? '— yes' :
              '— NO: ' + JSON.stringify({ report: f4Debrief.report, held: f4Debrief.held, state: f4Debrief.state,
                                          nextOk: f4Debrief.nextOk, before: f4Debrief.before.slice(0, 80), after: f4Debrief.after.slice(0, 80) })));
  const f4Bad = (!f4Safe.blobHeld || f4Safe.moved.length || !f4Safe.scratchGone || !f4DebriefOK || !f4WatchOK) ? 1 : 0;

  /* ...and it has to stay green with the cheat menu's toggles left on: it
     pinned INVULNERABLE and nothing else, so INFINITE AMMUNITION turned eight
     magazine-count assertions red for a player who then read a broken game */
  const cheated = await page.evaluate(() => {
    G.cheats.ammo = true; G.cheats.slow = true; G.tscale = .55; G.cheats.bighead = true;
    const R = selfTest(true);
    const back = { ammo: G.cheats.ammo, slow: G.cheats.slow, tscale: G.tscale };
    G.cheats.ammo = G.cheats.slow = G.cheats.bighead = false; G.tscale = 1; G.tainted = false;
    G.state = 'title'; if (typeof show === 'function') show('s-title');
    return { fails: R.filter(r => !r.pass).map(r => r.name), back };
  });
  const cheatOK = cheated.fails.length === 0 && cheated.back.ammo === true && cheated.back.slow === true && cheated.back.tscale === .55;
  console.log('F4 CHEATS ON suite ' + (cheated.fails.length ? 'FAILED ' + cheated.fails.length + ' [' + cheated.fails.slice(0, 3).join(' | ') + ']' : 'green') +
              ' · cheats handed back ' + (cheatOK ? 'yes' : 'NO'));
  if (!cheatOK) return 1;
  const tests = await page.evaluate(() => {
    const R = selfTest(true);
    G.state = 'title';               // selfTest via console leaves state 'play'; F4 path restores it itself
    if (typeof show === 'function') show('s-title');
    return R.map(r => ({ name: r.name, pass: r.pass, detail: r.detail }));
  });
  const fails = tests.filter(t => !t.pass);
  /* a guard branch that passes with "(no X to test on)" is a test that did
     not run; the phone context has every geometry, so none may skip there,
     and on desktop only the look pad (a phone-only control) may */
  const skipped = tests.filter(t => t.pass && /\(no .* to test on\)/.test(t.name + ' ' + t.detail)).map(t => t.name);
  const badSkips = skipped.filter(n => label !== 'desktop' || !/look pad/.test(n));
  console.log('SELFTEST[' + label + '] ' + (tests.length - fails.length) + '/' + tests.length + ' passed' +
              (skipped.length ? ' · skipped: ' + skipped.join(' | ') + (badSkips.length ? ' — SKIPS NOT EXPECTED HERE' : '') : ''));
  if (badSkips.length) fails.push({ name: 'skipped assertions', detail: badSkips.join(' | ') });
  fails.forEach(f => console.log('  FAIL ' + f.name + '  ' + f.detail));
  return fails.length + f4Bad;
}

/* Soak every mission x difficulty combo (the campaign's own length, so a new
   mission is soaked the day it lands). dts is a list of fixed timesteps; each
   frame draws one at random when there are several, or a stretch-per-half split
   for exactly two — the loop's own cap is .05 so nothing here can exceed what a
   real frame can. */
async function runSoak(page, frames, label, dts) {
  /* seeded per combo, so a faulting frame can be replayed: raw rnd()
     made every soak failure a one-off */
  const SEED = +(process.env.SOAK_SEED || (Date.now() % 100000));
  const soak = await page.evaluate(({ FRAMES, DTS, SEED }) => {
    const out = [];
    const savedGod = G.cheats.god;
    for (let li = 0; li < LEVELS.length; li++) for (let di = 0; di < DIFFS.length; di++) {
      let exc = null, frames = 0;
      const f0 = G.faults || 0;
      let a = (SEED + li * 31 + di * 7) | 0;
      const rnd = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      try {
        selLevel = li; G.diff = di;
        startMission(false);
        G.cheats.god = true;
        for (let f = 0; f < FRAMES; f++) {
          if (f % 7 === 0) {
            for (const k of ['fwd','back','left','right','run','crouch','use','fire','aim','reload'])
              held[k] = rnd() < .3;
            /* on a touch context the stick axes are the movement input */
            if (document.body.classList.contains('touch')) {
              held.tx = rnd() * 2 - 1; held.ty = rnd() * 2 - 1;
            }
          }
          M.dx += (rnd() - .5) * 90;
          M.dy += (rnd() - .5) * 30;
          M.lastMove = performance.now();
          if (rnd() < .02) M.wheel += rnd() < .5 ? 1 : -1;
          if (rnd() < .05) { M.fire = rnd() < .5; M.fireEdge = performance.now(); M.pressNew = true; }
          if (G.state !== 'play') break;
          const dt = DTS.length === 2 ? DTS[f < FRAMES / 2 ? 0 : 1] : DTS[0];
          step(dt);
          frames++;
          if (f % 60 === 0) render();          // exercise the renderer too
        }
      } catch (e) { exc = String((e && e.stack) || e).slice(0, 400); }
      out.push({ code: LEVELS[li].code, di, frames, endState: G.state, faults: (G.faults || 0) - f0, exc });
    }
    G.cheats.god = savedGod;
    clearInput(); G.state = 'title';
    if (typeof show === 'function') show('s-title');
    return out;
  }, { FRAMES: frames, DTS: dts, SEED });

  let totalFrames = 0, totalFaults = 0, excs = 0;
  for (const s of soak) {
    totalFrames += s.frames; totalFaults += s.faults; if (s.exc) excs++;
    /* a run that left play with god on ended in something other than a win */
    if (s.endState !== 'play' && s.endState !== 'result') { s.faults++; totalFaults++; s.exc = s.exc || ('ended in state ' + s.endState); }
    if (s.exc || s.faults) console.log('  SOAK ' + s.code + ' diff ' + s.di + ': faults=' + s.faults + ' exc=' + (s.exc || 'none') + ' (SOAK_SEED=' + SEED + ' replays it)');
  }
  console.log('SOAK[' + label + '] ' + totalFrames + ' frames across ' + soak.length + ' combos, faults=' + totalFaults + ', exceptions=' + excs + (totalFaults + excs ? '' : ' · seed ' + SEED));
  return totalFaults + excs;
}

/* Touch cluster, driven the way a finger drives it: TouchEvents constructed at
   the buttons' live client rects, through the same listeners a phone fires. */
/* A stylus on a Windows / ChromeOS tablet sends pointer events (pointerType
   "pen") and compat mouse events and NO TouchEvents, and a touch-profile game
   discarded the lot: a pen could reach a mission and then do nothing. The
   game now re-issues a pen's contact as the finger's touch events, one task
   later (Android pens also fire native touches). That deferral is why this
   lives here and not in the synchronous F4 suite: real CDP pen events on the
   phone page, and the game's own state read afterwards. */
async function runPenDrive(page) {
  const cdp = await page.context().newCDPSession(page);
  const pen = async (type, x, y, buttons) => cdp.send('Input.dispatchMouseEvent',
    { type, x, y, button: 'left', buttons, clickCount: 1, pointerType: 'pen', force: .5 });
  const tap = async (x, y) => { await pen('mousePressed', x, y, 1); await pen('mouseReleased', x, y, 0); await page.waitForTimeout(80); };
  const setup = await page.evaluate(() => {
    selLevel = 0; G.diff = 1; startMission(false); G.state = 'play'; G.cheats.god = true;
    G.startAt = performance.now() - 2000;          // past the tap swallow
    P.mag[P.w] = 7; clearInput();
    const mid = el => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
    const v = view.getBoundingClientRect();
    return { view: [v.left + v.width / 2, v.top + v.height * .35], pause: mid(document.getElementById('tpause')),
             fire: mid(document.getElementById('tfire')), pen0: PEN_SEEN };
  });
  await tap(...setup.view);                          // a quick still touch on the world is a shot
  const afterView = await page.evaluate(() => ({ mag: P.mag[P.w], state: G.state, pen: PEN_SEEN }));
  await tap(...setup.pause);                         // ❚❚ is a button, not the gun
  const afterPause = await page.evaluate(() => ({ mag: P.mag[P.w], state: G.state, pen: PEN_SEEN, press: document.getElementById('tpause').classList.contains('press') }));
  await page.evaluate(() => { resume(true); G.state = 'play'; show(null); clearInput(); });
  const shot = afterView.mag === 6 && afterView.state === 'play';
  const paused = afterPause.state === 'pause' && afterPause.mag === 6 && !afterPause.press;
  const seen = afterPause.pen - setup.pen0 === 2;
  const ok = shot && paused && seen;
  console.log('PEN DRIVE a stylus tap on the view shoots ' + (shot ? 'yes' : 'NO') + ' · on ❚❚ pauses without firing ' +
              (paused ? 'yes' : 'NO') + ' · contacts re-issued as touches ' + (afterPause.pen - setup.pen0) + '/2' + (ok ? '' : ' — FAILED'));
  return ok ? 0 : 1;
}
async function runTouchDrive(page) {
  const r = await page.evaluate(() => {
    const fails = [];
    const ok = (name, pass, detail) => { if (!pass) fails.push(name + (detail ? '  ' + detail : '')); };
    ok('body carries the touch class', document.body.classList.contains('touch'));
    ok('isTouch resolved true in a phone context', isTouch === true);

    selLevel = 0; G.diff = 1; startMission(false);
    ok('touch cluster is shown in play', document.getElementById('touch').classList.contains('on'));

    const at = (x, y) => new Touch({ identifier: 7, target: view, clientX: x, clientY: y });
    const tev = (type, el, t) => el.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true, changedTouches: [t], touches: type === 'touchend' ? [] : [t] }));
    const mid = el => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b]; };

    /* stick: rim-top deflection walks forward at a sprint, release stops */
    const stick = document.getElementById('tstick');
    const [sx, sy, sb] = mid(stick);
    ok('stick has geometry', sb.width > 10, sb.width + 'px');
    tev('touchstart', stick, at(sx, sy - sb.height / 2 * .99));
    ok('full stick deflection sprints', runHeld() === true && held.ty < -.9, 'ty=' + held.ty + ' run=' + runHeld());
    tev('touchend', window, at(sx, sy - sb.height / 2 * .99));
    ok('stick release stops movement', !held.tx && !held.ty && !runHeld());

    /* FIRE holds, AIM latches, PAUSE pauses */
    const fire = document.getElementById('tfire'); const [fx, fy] = mid(fire);
    tev('touchstart', fire, at(fx, fy));
    ok('FIRE press sets M.fire', M.fire === true && M.pressNew === true);
    tev('touchend', fire, at(fx, fy));
    ok('FIRE release clears M.fire', M.fire === false);

    const aim = document.getElementById('taim'); const [ax, ay] = mid(aim);
    tev('touchstart', aim, at(ax, ay));
    ok('AIM toggles on', M.aim === true && aim.getAttribute('aria-pressed') === 'true');
    tev('touchend', aim, at(ax, ay));
    tev('touchstart', aim, at(ax, ay));
    ok('AIM toggles back off', M.aim === false && aim.getAttribute('aria-pressed') === 'false');
    tev('touchend', aim, at(ax, ay));

    const pb = document.getElementById('tpause'); const [px, py] = mid(pb);
    tev('touchstart', pb, at(px, py));
    ok('PAUSE button pauses play', G.state === 'pause');
    tev('touchend', pb, at(px, py));
    resume(false);
    ok('resume returns to play', G.state === 'play');

    clearInput(); G.state = 'title';
    if (typeof show === 'function') show('s-title');
    return fails;
  });
  console.log('TOUCH DRIVE ' + (r.length ? 'FAILED\n  ' + r.join('\n  ') : 'ok — stick, FIRE, AIM, PAUSE all answer'));
  return r.length;
}

(async () => {
  let bad = 0;
  if (!sourceCheck()) bad++;

  const browser = await launch();

  /* ---------------- desktop pass ---------------- */
  const page = await browser.newPage();
  const errors = [], resourceErrs = [];
  await wirePage(page, errors, resourceErrs);
  bad += await runSelfTest(page, 'desktop');
  bad += await runSoak(page, SOAK_FRAMES, 'desktop 60Hz', [1 / 60]);

  /* frame-rate invariance: same combos, half the stretch at 144Hz and half at
     30Hz — the loop caps dt at .05 so 30Hz is the worst honest frame */
  bad += await runSoak(page, Math.min(SOAK_FRAMES, 500), 'dt 1/144 + 1/30', [1 / 144, 1 / 30]);

  /* ---------------- phone pass ---------------- */
  const mctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true
  });
  const mpage = await mctx.newPage();
  await wirePage(mpage, errors, resourceErrs);
  bad += await runTouchDrive(mpage);
  bad += await runPenDrive(mpage);
  bad += await runSelfTest(mpage, 'mobile');
  bad += await runSoak(mpage, Math.min(SOAK_FRAMES, 600), 'mobile 60Hz', [1 / 60]);
  await mctx.close();

  /* ---------------- storage-denied pass ---------------- */
  /* A browser that blocks site data: the localStorage getter itself throws in
     one shape, only writes throw in the other. Play worked in both; F4 did
     not — the suite's own unguarded read threw, the report never came, and
     the sim's mission was left live under the title. */
  for (const shape of ['getter', 'setItem']){
    const dctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await dctx.addInitScript(sh => {
      if (sh === 'getter') Object.defineProperty(window, 'localStorage', { get(){ throw new DOMException('Access is denied', 'SecurityError'); }, configurable: true });
      else Storage.prototype.setItem = function(){ throw new DOMException('QuotaExceededError', 'QuotaExceededError'); };
    }, shape);
    const dpage = await dctx.newPage();
    const derrs = [];
    dpage.on('pageerror', e => derrs.push(e.message));
    await dpage.goto('file://' + target);
    await dpage.waitForFunction(() => typeof G !== 'undefined' && typeof selfTest === 'function', { timeout: 15000 });
    await dpage.waitForTimeout(600);
    const r = await dpage.evaluate(() => {
      bootDone();
      const warned = document.getElementById('toasts').textContent;
      const f4 = () => dispatchEvent(new KeyboardEvent('keydown', { code: 'F4', key: 'F4', bubbles: true, cancelable: true }));
      f4();
      const report = G.showTests === true, tests = (G.tests || []).length, fails = (G.tests || []).filter(t => !t.pass).map(t => t.name);
      f4();
      return { report, tests, fails, state: G.state, warned };
    });
    const warned = /STORAGE IS BLOCKED/.test(r.warned);
    const ok = r.report && r.tests > 300 && r.fails.length === 0 && r.state === 'title' && derrs.length === 0 && warned;
    console.log('STORAGE DENIED (' + shape + ') F4 report ' + (r.report ? 'shown' : 'MISSING') + ' · ' + r.tests + ' tests, ' +
                r.fails.length + ' failed' + (r.fails.length ? ' [' + r.fails.slice(0, 3).join(' | ') + ']' : '') +
                ' · back on ' + r.state + ' · page errors ' + derrs.length + ' · warned ' + (warned ? 'yes' : 'NO') + (ok ? '' : ' — FAILED'));
    if (!ok) bad++;
    await dctx.close();
  }

  /* ---------------- corrupt-save pass ---------------- */
  /* A blob that cannot be parsed is stashed aside and the player is told —
     but boot() runs the self-test BEFORE bootDone() shows that toast, and the
     suite's own corrupt-blob block nulled SAVE_WARN twice, so the message
     existed in the source and never once reached a player. End-to-end here,
     because the suite cannot mark its own homework on a boot-order bug. */
  {
    const cctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await cctx.addInitScript(() => {
      try { localStorage.setItem('a360.v2', '{"v":2,"best":{'); } catch (_) {}
    });
    const cpage = await cctx.newPage();
    const cerrs = [];
    cpage.on('pageerror', e => cerrs.push(e.message));
    await cpage.goto('file://' + target);
    await cpage.waitForFunction(() => typeof G !== 'undefined' && typeof selfTest === 'function', { timeout: 15000 });
    await cpage.waitForTimeout(600);
    const r = await cpage.evaluate(() => {
      bootDone();
      let stash = null; try { stash = localStorage.getItem('a360.v2.bad'); } catch (_) {}
      return { toasts: document.getElementById('toasts').textContent, stash, bests: Object.keys(BEST).length };
    });
    const told = /COULD NOT BE READ/.test(r.toasts);
    const kept = r.stash === '{"v":2,"best":{';
    const ok = told && kept && cerrs.length === 0;
    console.log('CORRUPT SAVE the player is told ' + (told ? 'yes' : 'NO — WIPED IN SILENCE') +
                ' · bytes kept aside ' + (kept ? 'yes' : 'NO') + ' · page errors ' + cerrs.length + (ok ? '' : ' — FAILED'));
    if (!ok) bad++;
    await cctx.close();
  }

  /* ---------------- portrait pass ---------------- */
  /* The F4 suite runs landscape. Portrait is where the toast type read the
     phone's tall axis (9.7px lines four deep across a 216px picture) and the
     rotate chip sat under PAUSE and across the toast column for the whole
     mission — so the picture is measured here, at 390x844. */
  const pctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true
  });
  const ppage = await pctx.newPage();
  await wirePage(ppage, errors, resourceErrs);
  const portrait = await ppage.evaluate(async () => {
    selLevel = 0; G.diff = 0; startMission(false);
    await new Promise(r => setTimeout(r, 300));
    const chip = document.getElementById('rothint'), pb = document.getElementById('tpause'), tw = document.getElementById('toasts');
    const shown = !chip.hidden;
    const c = chip.getBoundingClientRect(), p = pb.getBoundingClientRect(), t = tw.getBoundingClientRect();
    const onPause = !(c.right <= p.left || c.left >= p.right || c.bottom <= p.top || c.top >= p.bottom);
    toast('PORTRAIT PROBE', 'cyan', 4000);
    const el = tw.lastChild, fs = parseFloat(getComputedStyle(el).fontSize), th = el.getBoundingClientRect().height;
    const fh = view.getBoundingClientRect().height;
    await new Promise(r => setTimeout(r, ROT_HINT_MS + 800));
    const gone = chip.hidden;
    clearToasts(); G.state = 'title'; show('s-title');
    return { shown, onPause, aboveToasts: c.bottom <= t.top, fontPx: fs, toastH: th, frameH: fh, gone };
  });
  const pOK = portrait.shown && !portrait.onPause && portrait.aboveToasts && portrait.fontPx <= 6.05 &&
              portrait.toastH <= portrait.frameH * .12 && portrait.gone;
  console.log('PORTRAIT chip shown ' + (portrait.shown ? 'yes' : 'NO') + ' · clear of PAUSE ' + (portrait.onPause ? 'NO' : 'yes') +
              ' · above toasts ' + (portrait.aboveToasts ? 'yes' : 'NO') + ' · toast ' + portrait.fontPx + 'px type, ' +
              portrait.toastH.toFixed(0) + 'px of a ' + portrait.frameH.toFixed(0) + 'px frame · chip gone after ' + '6s ' +
              (portrait.gone ? 'yes' : 'NO') + (pOK ? '' : ' — FAILED'));
  if (!pOK) bad++;
  await pctx.close();

  console.log('PAGE ERRORS ' + errors.length + (errors.length ? '\n  ' + errors.join('\n  ') : ''));
  if (resourceErrs.length) console.log('(resource-load errors, non-fatal: ' + resourceErrs.length + ' — fonts/CDN offline)');

  const okAll = bad === 0 && errors.length === 0;
  console.log(okAll ? 'VERIFY OK' : 'VERIFY FAILED');
  await browser.close();
  process.exit(okAll ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });

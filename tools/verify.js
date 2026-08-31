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
  const vOK = hv && sv && hv === sv;
  console.log('VERSION index.html v' + hv + ' / sw.js v' + sv + (vOK ? ' — in step' : ' — MISMATCH'));
  /* syncTitleHint() rewrites the title how-to the moment scripts run, but the
     FIRST paint is the static string — and that string described DRAG while
     desktop ships CAPTURE. The F4 suite can only see the rewritten one. */
  const cap = (html.match(/const TITLE_HINT = \{\s*capture:\s*'([^']+)'/) || [])[1];
  const stat = (html.match(/id="titlehint">([^<]+)</) || [])[1];
  const hOK = !!cap && !!stat && stat.indexOf(cap) === 0;
  console.log('TITLE HINT static default ' + (hOK ? 'matches the shipped look mode' : 'DRIFTED from TITLE_HINT.capture'));
  return vOK && hOK;
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
  const tests = await page.evaluate(() => {
    const R = selfTest(true);
    G.state = 'title';               // selfTest via console leaves state 'play'; F4 path restores it itself
    if (typeof show === 'function') show('s-title');
    return R.map(r => ({ name: r.name, pass: r.pass, detail: r.detail }));
  });
  const fails = tests.filter(t => !t.pass);
  console.log('SELFTEST[' + label + '] ' + (tests.length - fails.length) + '/' + tests.length + ' passed');
  fails.forEach(f => console.log('  FAIL ' + f.name + '  ' + f.detail));
  return fails.length;
}

/* Soak every mission x difficulty combo (the campaign's own length, so a new
   mission is soaked the day it lands). dts is a list of fixed timesteps; each
   frame draws one at random when there are several, or a stretch-per-half split
   for exactly two — the loop's own cap is .05 so nothing here can exceed what a
   real frame can. */
async function runSoak(page, frames, label, dts) {
  const soak = await page.evaluate(({ FRAMES, DTS }) => {
    const out = [];
    const savedGod = G.cheats.god;
    for (let li = 0; li < LEVELS.length; li++) for (let di = 0; di < DIFFS.length; di++) {
      let exc = null, frames = 0;
      const f0 = G.faults || 0;
      try {
        selLevel = li; G.diff = di;
        startMission(false);
        G.cheats.god = true;
        for (let f = 0; f < FRAMES; f++) {
          if (f % 7 === 0) {
            for (const k of ['fwd','back','left','right','run','crouch','use','fire','aim','reload'])
              held[k] = Math.random() < .3;
            /* on a touch context the stick axes are the movement input */
            if (document.body.classList.contains('touch')) {
              held.tx = Math.random() * 2 - 1; held.ty = Math.random() * 2 - 1;
            }
          }
          M.dx += (Math.random() - .5) * 90;
          M.dy += (Math.random() - .5) * 30;
          M.lastMove = performance.now();
          if (Math.random() < .02) M.wheel += Math.random() < .5 ? 1 : -1;
          if (Math.random() < .05) { M.fire = Math.random() < .5; M.fireEdge = performance.now(); M.pressNew = true; }
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
  }, { FRAMES: frames, DTS: dts });

  let totalFrames = 0, totalFaults = 0, excs = 0;
  for (const s of soak) {
    totalFrames += s.frames; totalFaults += s.faults; if (s.exc) excs++;
    if (s.exc || s.faults) console.log('  SOAK ' + s.code + ' diff ' + s.di + ': faults=' + s.faults + ' exc=' + (s.exc || 'none'));
  }
  console.log('SOAK[' + label + '] ' + totalFrames + ' frames across ' + soak.length + ' combos, faults=' + totalFaults + ', exceptions=' + excs);
  return totalFaults + excs;
}

/* Touch cluster, driven the way a finger drives it: TouchEvents constructed at
   the buttons' live client rects, through the same listeners a phone fires. */
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
    ok('full stick deflection sprints', held.run === true && held.ty < -.9, 'ty=' + held.ty + ' run=' + held.run);
    tev('touchend', window, at(sx, sy - sb.height / 2 * .99));
    ok('stick release stops movement', !held.tx && !held.ty && !held.run);

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
  bad += await runSelfTest(mpage, 'mobile');
  bad += await runSoak(mpage, Math.min(SOAK_FRAMES, 600), 'mobile 60Hz', [1 / 60]);
  await mctx.close();

  console.log('PAGE ERRORS ' + errors.length + (errors.length ? '\n  ' + errors.join('\n  ') : ''));
  if (resourceErrs.length) console.log('(resource-load errors, non-fatal: ' + resourceErrs.length + ' — fonts/CDN offline)');

  const okAll = bad === 0 && errors.length === 0;
  console.log(okAll ? 'VERIFY OK' : 'VERIFY FAILED');
  await browser.close();
  process.exit(okAll ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });

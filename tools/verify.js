/* Headless verification for Agent 360: boot cleanly, run the in-file F4 self
   test suite, then soak all 9 mission/difficulty combos with randomized input.
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

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  const errors = [], resourceErrs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR/.test(t)) resourceErrs.push(t); else errors.push('console: ' + t);
  });
  await page.goto('file://' + target);
  await page.waitForFunction(() => typeof G !== 'undefined' && typeof selfTest === 'function', { timeout: 15000 });
  await page.waitForTimeout(1200);

  const tests = await page.evaluate(() => {
    const R = selfTest(true);
    G.state = 'title';               // selfTest via console leaves state 'play'; F4 path restores it itself
    if (typeof show === 'function') show('s-title');
    return R.map(r => ({ name: r.name, pass: r.pass, detail: r.detail }));
  });
  const tFails = tests.filter(t => !t.pass);
  console.log('SELFTEST ' + (tests.length - tFails.length) + '/' + tests.length + ' passed');
  tFails.forEach(f => console.log('  FAIL ' + f.name + '  ' + f.detail));

  const soak = await page.evaluate((FRAMES) => {
    const out = [];
    const savedGod = G.cheats.god;
    for (let li = 0; li < 3; li++) for (let di = 0; di < 3; di++) {
      let exc = null, frames = 0;
      const f0 = G.faults || 0;
      try {
        selLevel = li; G.diff = di;
        startMission(false);
        G.cheats.god = true;
        for (let f = 0; f < FRAMES; f++) {
          if (f % 7 === 0)
            for (const k of ['fwd','back','left','right','run','crouch','use','fire','aim','reload'])
              held[k] = Math.random() < .3;
          M.dx += (Math.random() - .5) * 90;
          M.dy += (Math.random() - .5) * 30;
          M.lastMove = performance.now();
          if (Math.random() < .02) M.wheel += Math.random() < .5 ? 1 : -1;
          if (Math.random() < .05) { M.fire = Math.random() < .5; M.fireEdge = performance.now(); M.pressNew = true; }
          if (G.state !== 'play') break;
          step(1 / 60);
          frames++;
          if (f % 60 === 0) render();          // exercise the renderer too
        }
      } catch (e) { exc = String((e && e.stack) || e).slice(0, 400); }
      out.push({ li, di, frames, endState: G.state, faults: (G.faults || 0) - f0, exc });
    }
    G.cheats.god = savedGod;
    clearInput(); G.state = 'title';
    if (typeof show === 'function') show('s-title');
    return out;
  }, SOAK_FRAMES);

  let totalFrames = 0, totalFaults = 0, excs = 0;
  for (const s of soak) {
    totalFrames += s.frames; totalFaults += s.faults; if (s.exc) excs++;
    if (s.exc || s.faults) console.log('  SOAK M0' + (s.li + 1) + ' diff ' + s.di + ': faults=' + s.faults + ' exc=' + (s.exc || 'none'));
  }
  console.log('SOAK ' + totalFrames + ' frames across ' + soak.length + ' combos, faults=' + totalFaults + ', exceptions=' + excs);
  console.log('PAGE ERRORS ' + errors.length + (errors.length ? '\n  ' + errors.join('\n  ') : ''));
  if (resourceErrs.length) console.log('(resource-load errors, non-fatal: ' + resourceErrs.length + ' — fonts/CDN offline)');

  const okAll = tFails.length === 0 && totalFaults === 0 && excs === 0 && errors.length === 0;
  console.log(okAll ? 'VERIFY OK' : 'VERIFY FAILED');
  await browser.close();
  process.exit(okAll ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });

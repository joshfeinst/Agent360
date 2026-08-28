/* AGENT 360 ON A PHONE — can a finger play it?
 *
 * A real mobile context: 844x390 at dpr 3, isMobile, hasTouch, no mouse and no
 * keyboard. Menus are driven with page.touchscreen.tap(), which dispatches
 * touch events the way a finger does; the stick and the button cluster are
 * driven with TouchEvents constructed at their live client rects, because they
 * are hold-and-drag surfaces and a tap has no drag. It reports what a phone
 * player can reach and what they cannot, and measures the things a phone makes
 * hard: control size and how much of the screen the game actually uses.
 *
 *   node tools/touch.js [/abs/path/index.html]
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const FILE = process.argv[2] || path.join(__dirname, '..', 'index.html');
async function launch(){ try { return await chromium.launch(); } catch(e){
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of fs.readdirSync(base).filter(x => x.startsWith('chromium'))){
    for (const sub of ['chrome-linux/chrome', 'chrome-linux/headless_shell']){
      const p = path.join(base, d, sub);
      if (fs.existsSync(p)){ try { return await chromium.launch({ executablePath:p }); } catch(_){} }
    }
  }
  throw e; } }

/* the tap target a person can reliably hit; 44 is the number both platform
   guidelines landed on, from the same research */
const MIN_TAP = 44;

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
           '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

(async () => {
  const browser = await launch();
  const fails = [];
  const step = (what, ok, detail) => {
    console.log('  ' + (ok ? 'ok  ' : 'NO  ') + what + (detail ? '   ' + detail : ''));
    if (!ok) fails.push(what);
  };
  const errs = [];

  const boot = async (ctx) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto('file://' + path.resolve(FILE));
    await page.waitForFunction(() => typeof G !== 'undefined' && G.state === 'boot', null, { timeout:25000 });
    return page;
  };
  const shown = (page) => page.evaluate(() =>
    [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id)[0] || '(world)');
  const tapEl = async (page, sel) => {
    const box = await page.evaluate((s) => {
      const e = document.querySelector(s); if (!e) return null;
      /* a finger scrolls a tall screen before tapping what fell below the fold */
      e.scrollIntoView({ block:'center', inline:'nearest' });
      const r = e.getBoundingClientRect();
      return r.width && r.height ? { x:r.left + r.width/2, y:r.top + r.height/2 } : null;
    }, sel);
    if (!box) return false;
    await page.touchscreen.tap(box.x, box.y);
    await page.waitForTimeout(260);
    return true;
  };
  /* hold-surfaces: a synthetic finger with an identity, at real client rects */
  const finger = (page, type, sel, dx, dy) => page.evaluate(([type, sel, dx, dy]) => {
    const el = document.querySelector(sel), r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 9, target: el,
      clientX: r.left + r.width/2 + (dx||0)*r.width/2,
      clientY: r.top + r.height/2 + (dy||0)*r.height/2 });
    (type === 'touchend' ? window : el).dispatchEvent(new TouchEvent(type, {
      bubbles:true, cancelable:true, changedTouches:[t], touches: type==='touchend' ? [] : [t] }));
  }, [type, sel, dx, dy]);

  console.log('AGENT 360 ON A PHONE — 844x390 landscape, taps only, no keyboard\n');

  const ctx = await browser.newContext({
    viewport: { width:844, height:390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, userAgent: UA
  });
  const page = await boot(ctx);

  /* 1. does the game know it is on a phone? */
  const sniff = await page.evaluate(() => ({
    touchClass: document.body.classList.contains('touch'),
    viewportMeta: !!document.querySelector('meta[name=viewport]'),
    touchAction: getComputedStyle(document.getElementById('view')).touchAction,
    hint: (document.getElementById('titlehint') || {}).textContent || ''
  }));
  step('the page knows it is on a touch device', sniff.touchClass, 'body.touch ' + sniff.touchClass);
  step('the title hint speaks touch, not mouse', /pad|drag/i.test(sniff.hint) && !/click/i.test(sniff.hint),
       sniff.hint.slice(0, 60));

  /* 2. the boot splash skips on a tap */
  await page.waitForTimeout(600);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(500);
  step('the boot splash skips on a tap', (await shown(page)) === 's-title', await shown(page));
  /* the skip tap must NOT fall through onto the menu row under the finger */
  step('...and the skip tap does not press a menu row through the splash',
       await page.evaluate(() => G.state === 'title'), 'state ' + await page.evaluate(() => G.state));

  /* 3. the title menu answers taps: controls (a scroller), then options */
  step('CONTROLS opens', await tapEl(page, '#titlemenu [data-act="controls"]') &&
       (await shown(page)) === 's-controls', await shown(page));
  const scrolled = await page.evaluate(() => {
    const s = document.getElementById('s-controls');
    const before = s.scrollTop; s.scrollTop = 9999; const after = s.scrollTop;
    s.scrollTop = before;
    return { can: after > before, need: s.scrollHeight > s.clientHeight };
  });
  step('the controls screen can scroll where it overflows', !scrolled.need || scrolled.can,
       scrolled.need ? 'overflows and scrolls' : 'fits without scrolling');
  step('...touch section is shown, pointer-lock prose hidden', await page.evaluate(() => {
    const t = document.getElementById('ctl-touch');
    const noTouch = document.querySelector('#s-controls .no-touch');
    return t && getComputedStyle(t).display !== 'none' &&
           (!noTouch || getComputedStyle(noTouch).display === 'none');
  }));
  step('BACK returns to the title', await tapEl(page, '#s-controls [data-act="back"]') &&
       (await shown(page)) === 's-title', await shown(page));

  /* 4. options: a slider a finger can set */
  await tapEl(page, '#titlemenu [data-act="options"]');
  step('OPTIONS opens', (await shown(page)) === 's-options');
  const sensBefore = await page.evaluate(() => +document.getElementById('o-sens').value);
  await page.evaluate(() => document.getElementById('o-sens').scrollIntoView({ block:'center' }));
  const sens = await page.evaluate(() => {
    const el = document.getElementById('o-sens'), r = el.getBoundingClientRect();
    return { x: r.left + r.width * .9, y: r.top + r.height/2, w: r.width };
  });
  await page.touchscreen.tap(sens.x, sens.y);
  await page.waitForTimeout(200);
  const sensAfter = await page.evaluate(() => +document.getElementById('o-sens').value);
  step('a slider answers a tap on its track', sensAfter !== sensBefore,
       sensBefore + ' -> ' + sensAfter);
  step('...and the readout follows', await page.evaluate((v) =>
       document.getElementById('v-sens').textContent == String(v), sensAfter));
  step('the touch-look slider is offered on touch', await page.evaluate(() =>
       getComputedStyle(document.getElementById('o-tsens').closest('.ctl')).display !== 'none'));
  await tapEl(page, '#s-options [data-act="back"]');

  /* 5. start a mission with taps alone */
  step('SELECT MISSION opens', await tapEl(page, '#titlemenu [data-act="missions"]') &&
       (await shown(page)) === 's-select', await shown(page));
  step('READ BRIEFING opens the dossier', await tapEl(page, '#misslist .mi:last-child') &&
       (await shown(page)) === 's-brief', await shown(page));
  step('ACCEPT starts the mission', await tapEl(page, '#s-brief [data-act="start"]') &&
       await page.evaluate(() => G.state === 'play'), 'state ' + await page.evaluate(() => G.state));
  await page.waitForTimeout(400);
  step('the touch cluster is up', await page.evaluate(() =>
       document.getElementById('touch').classList.contains('on')));

  /* 6. the stick walks, with sprint on the rim */
  const p0 = await page.evaluate(() => ({ x: P.x, y: P.y }));
  await finger(page, 'touchstart', '#tstick', 0, -.99);
  await page.waitForTimeout(700);
  const walked = await page.evaluate((p0) =>
    ({ d: Math.hypot(P.x - p0.x, P.y - p0.y), run: held.run }), p0);
  await finger(page, 'touchend', '#tstick', 0, -.99);
  step('the stick walks the agent', walked.d > .5, walked.d.toFixed(2) + ' units in .7s');
  step('...at a sprint on the rim', walked.run === true);
  const stopped = await page.evaluate(() => !held.tx && !held.ty && !held.run);
  step('...and stops when the finger lifts', stopped);

  /* 7. FIRE fires, AIM latches */
  const shots0 = await page.evaluate(() => G.shots);
  await finger(page, 'touchstart', '#tfire', 0, 0);
  await page.waitForTimeout(300);
  await finger(page, 'touchend', '#tfire', 0, 0);
  step('FIRE fires the sidearm', await page.evaluate((s) => G.shots > s, shots0),
       'shots ' + shots0 + ' -> ' + await page.evaluate(() => G.shots));
  await finger(page, 'touchstart', '#taim', 0, 0);
  await finger(page, 'touchend', '#taim', 0, 0);
  step('AIM latches without a held thumb', await page.evaluate(() =>
       M.aim === true && document.getElementById('taim').classList.contains('on')));
  await finger(page, 'touchstart', '#taim', 0, 0);
  await finger(page, 'touchend', '#taim', 0, 0);
  step('...and unlatches on the next tap', await page.evaluate(() => M.aim === false));

  /* 8. PAUSE -> field watch -> RESUME, all by tap */
  await finger(page, 'touchstart', '#tpause', 0, 0);
  await finger(page, 'touchend', '#tpause', 0, 0);
  await page.waitForTimeout(300);
  step('the PAUSE button opens the field watch', await page.evaluate(() => G.state === 'pause') &&
       (await shown(page)) === 's-pause', await shown(page));
  step('RESUME returns to play', await tapEl(page, '#s-pause [data-act="resume"]') &&
       await page.evaluate(() => G.state === 'play'), 'state ' + await page.evaluate(() => G.state));

  /* 9. control sizes, in the state that matters — mid-mission cluster */
  const small = await page.evaluate((min) => {
    const out = [];
    for (const el of document.querySelectorAll('.tbtn, #tstick')){
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.height < min || r.width < min)
        out.push((el.id || el.className) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    return out;
  }, MIN_TAP);
  step('every touch control is at least ' + MIN_TAP + 'px', !small.length,
       small.length ? small.join(', ') : '');

  /* 10. how much of the phone does the game use? */
  const fit = await page.evaluate(() => {
    const r = document.getElementById('frame').getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight,
             pct: Math.round((r.width * r.height) / (innerWidth * innerHeight) * 100) };
  });
  step('the game fills the screen in landscape', fit.pct >= 60,
       fit.w + 'x' + fit.h + ' of ' + fit.vw + 'x' + fit.vh + ' = ' + fit.pct + '%');

  /* menu tap targets, back on the title */
  await finger(page, 'touchstart', '#tpause', 0, 0);
  await finger(page, 'touchend', '#tpause', 0, 0);
  await page.waitForTimeout(250);
  await tapEl(page, '#s-pause [data-act="abort"]');
  const smallMenu = await page.evaluate((min) => {
    const out = [];
    for (const el of document.querySelectorAll('#s-title .mi, #s-title .btn')){
      const r = el.getBoundingClientRect();
      if (r.width && r.height && (r.height < min || r.width < min))
        out.push((el.textContent || '').trim().slice(0, 18) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    return out;
  }, MIN_TAP);
  step('every title menu row is at least ' + MIN_TAP + 'px tall', !smallMenu.length,
       smallMenu.length ? smallMenu.join(', ') : '');
  await ctx.close();

  /* 11. portrait: the rotate hint appears in play, and never blocks input */
  console.log('\n  — portrait 390x844 —');
  const pctx = await browser.newContext({
    viewport: { width:390, height:844 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, userAgent: UA
  });
  const pp = await boot(pctx);
  await pp.waitForTimeout(600);
  await pp.touchscreen.tap(195, 500);
  await pp.waitForTimeout(500);
  const hintOnTitle = await pp.evaluate(() => !document.getElementById('rothint').hidden);
  step('no rotate nag on the menus', !hintOnTitle);
  await tapEl(pp, '#titlemenu [data-act="missions"]');
  await tapEl(pp, '#misslist .mi:last-child');
  await tapEl(pp, '#s-brief [data-act="start"]');
  await pp.waitForTimeout(500);
  const hint = await pp.evaluate(() => {
    const el = document.getElementById('rothint');
    return { play: G.state === 'play', up: !el.hidden,
             inert: getComputedStyle(el).pointerEvents === 'none' };
  });
  step('portrait play shows the rotate hint', hint.play && hint.up,
       'state play=' + hint.play + ' hint=' + hint.up);
  step('...and the hint cannot eat a touch', hint.inert);
  await pctx.close();

  console.log('');
  if (errs.length) console.log('page errors: ' + errs.length + '\n  ' + errs[0] + '\n');
  console.log(fails.length
    ? 'PHONE: ' + fails.length + ' thing(s) a finger cannot do:\n  ' + fails.join('\n  ')
    : 'PHONE OK — everything tested here works with taps alone');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });

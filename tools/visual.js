/* Visual integrity sweep: for every DOM overlay screen the game shows, measure
   the RENDERED box of every element that holds text. Correct markup with
   correct colours can still paint nothing — a zero-height line box inside
   overflow:hidden paints no glyphs and no other harness notices, because none
   of them look at pixels. Runs the sweep at a desktop window and again in a
   phone context, where the touch-only rows render and the panels are tightest.
   The canvas HUD draws its own glyphs and is out of scope here — verify.js
   soaks the renderer.
     node tools/visual.js [/abs/path/index.html] */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
async function launch(){ try { return await chromium.launch(); } catch(e){
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of fs.readdirSync(base).filter(x => x.startsWith('chromium'))){
    for (const sub of ['chrome-linux/chrome', 'chrome-linux/headless_shell']){
      const p = path.join(base, d, sub);
      if (fs.existsSync(p)){ try { return await chromium.launch({ executablePath:p }); } catch(_){} }
    }
  }
  throw e; } }

(async () => {
  const b = await launch();
  let bad = 0;
  const errsAll = [];

  const audit = async (p, label) => {
    const found = await p.evaluate(() => {
      const out = [];
      const vis = el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
        for (let a = el.parentElement; a; a = a.parentElement){
          const pc = getComputedStyle(a);
          if (pc.display === 'none' || pc.visibility === 'hidden' || +pc.opacity === 0) return false;
        }
        return true;
      };
      /* where the GLYPHS actually are, not where the box is: a zero-height box
         still paints its text unless something clips it — only the combination
         is a bug */
      const glyphRect = el => {
        const r = document.createRange();
        r.selectNodeContents(el);
        const rects = [...r.getClientRects()].filter(x => x.width > 0 || x.height > 0);
        if (!rects.length) return null;
        const x0 = Math.min(...rects.map(x=>x.left)), y0 = Math.min(...rects.map(x=>x.top));
        const x1 = Math.max(...rects.map(x=>x.right)), y1 = Math.max(...rects.map(x=>x.bottom));
        return { left:x0, top:y0, right:x1, bottom:y1, w:x1-x0, h:y1-y0 };
      };
      for (const el of document.querySelectorAll('.screen *, .toastwrap *')){
        const own = [...el.childNodes].filter(n => n.nodeType === 3)
                      .map(n => n.textContent.trim()).join('');
        if (own.length < 2) continue;
        if (!vis(el)) continue;
        const g = glyphRect(el);
        if (!g || g.w < 1 || g.h < 1){
          out.push({ tag:el.tagName.toLowerCase(), cls:String(el.className).slice(0,40), id:el.id,
                     text:own.slice(0,46), why:'no glyph box',
                     lh:getComputedStyle(el).lineHeight });
          continue;
        }
        /* clipped away by an ancestor? how much of the glyph box survives every
           ancestor that clips, as a fraction of the whole */
        const showing = (box) => {
          let worst = 1, by = null;
          for (let a = el; a; a = a.parentElement){
            const cs = getComputedStyle(a);
            if (!/hidden|clip|auto|scroll/.test(cs.overflowX + cs.overflowY)) continue;
            const c = a.getBoundingClientRect();
            const ix = Math.min(box.right, c.right) - Math.max(box.left, c.left);
            const iy = Math.min(box.bottom, c.bottom) - Math.max(box.top, c.top);
            const f = (Math.max(0, ix) * Math.max(0, iy)) / Math.max(1, box.w * box.h);
            if (f < worst){ worst = f; by = a; }
          }
          return { frac:worst, by };
        };
        /* painted over where it actually sits? ancestors and descendants are
           not occluders, and neither is anything pointer-events:none (the toast
           stack floats over screens by design and hit-testing cannot see it) */
        const coveredBy = (box) => {
          for (let a = el; a; a = a.parentElement)
            if (getComputedStyle(a).pointerEvents === 'none') return null;
          const hit = document.elementFromPoint(Math.round((box.left + box.right) / 2),
                                                Math.round((box.top + box.bottom) / 2));
          if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return null;
          if (getComputedStyle(hit).pointerEvents === 'none') return null;
          return '<' + hit.tagName.toLowerCase() + (hit.id ? '#' + hit.id : '') +
                 (hit.className ? '.' + String(hit.className).slice(0, 24) : '') + '>';
        };
        let seen = showing(g);
        let over = seen.frac >= 0.30 ? coveredBy(g) : null;
        /* A SCROLLER IS NOT A CLIP: every .screen scrolls once it overflows, so
           text below the fold is the second half of a menu, not invisible text.
           Scroll to it and look again; only what STAYS hidden counts. */
        const scrollable = seen.by && /auto|scroll/.test(
              getComputedStyle(seen.by).overflowX + getComputedStyle(seen.by).overflowY);
        if (seen.frac < 0.30 && scrollable){
          const keep = [];
          for (let a = el.parentElement; a; a = a.parentElement) keep.push([a, a.scrollTop]);
          el.scrollIntoView({ block:'center', inline:'nearest' });
          const g2 = glyphRect(el);
          if (g2) seen = showing(g2);
          for (const [a, t] of keep) a.scrollTop = t;
        }
        if (seen.frac < 0.30 || over){
          const a = seen.by;
          out.push({ tag:el.tagName.toLowerCase(), cls:String(el.className).slice(0,40), id:el.id,
                     text:own.slice(0,46),
                     why: over ? 'painted over by ' + over
                        : 'clipped by <' + (a ? a.tagName.toLowerCase() + (a.id?'#'+a.id:'') : '?') + '>',
                     lh:getComputedStyle(el).lineHeight });
        }
      }
      return out;
    });
    if (found.length){ console.log('  ' + label + ': ' + found.length + ' invisible text element(s)');
      found.slice(0,6).forEach(x=>console.log('    <' + x.tag + (x.id?'#'+x.id:'') + (x.cls?'.'+x.cls:'') +
        '> ' + x.why + ', line-height ' + x.lh + '  "' + x.text + '"')); }
    else console.log('  ' + label + ': ok');
    return found.length;
  };

  const sweep = async (ctx, tag) => {
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve(target));
    await p.waitForFunction(() => typeof G !== 'undefined' && typeof selfTest === 'function', null, { timeout:25000 });
    await p.waitForTimeout(600);

    console.log('visual integrity, ' + tag + ':');
    bad += await audit(p, tag + ' boot');
    await p.evaluate(() => { bootDone(); });                     await p.waitForTimeout(250);
    bad += await audit(p, tag + ' title');
    await p.evaluate(() => act('missions'));                     await p.waitForTimeout(250);
    bad += await audit(p, tag + ' mission select');
    await p.evaluate(() => gotoBrief());                         await p.waitForTimeout(250);
    bad += await audit(p, tag + ' briefing');
    await p.evaluate(() => act('controls'));                     await p.waitForTimeout(250);
    bad += await audit(p, tag + ' controls');
    await p.evaluate(() => act('options'));                      await p.waitForTimeout(250);
    bad += await audit(p, tag + ' options');
    await p.evaluate(() => act('cheats'));                       await p.waitForTimeout(250);
    bad += await audit(p, tag + ' cheats');
    /* pause with a live mission behind it, secrets found so the map is honest */
    await p.evaluate(() => { selLevel = 0; G.diff = 1; startMission(false); pause(); });
    await p.waitForTimeout(300);
    bad += await audit(p, tag + ' pause / field watch');
    /* both debrief flavours — a win writes the full SLA table */
    await p.evaluate(() => { resume(false); for (const o of G.objs) o.done = true;
                             G.time = 312; G.shots = 40; G.hits = 31; G.kills = 8;
                             endMission(true, null); });
    await p.waitForTimeout(300);
    bad += await audit(p, tag + ' debrief (win)');
    await p.evaluate(() => { startMission(false); endMission(false, 'AGENT DOWN'); });
    await p.waitForTimeout(300);
    bad += await audit(p, tag + ' debrief (loss)');
    await p.evaluate(() => { G.state = 'title'; show('s-title'); });
    errsAll.push(...errs);
    await p.close();
  };

  const dctx = await b.newContext({ viewport: { width:960, height:540 } });
  await sweep(dctx, 'desktop 960x540');
  await dctx.close();
  /* the phone: touch-only rows render, no-touch prose hides, panels tightest */
  const mctx = await b.newContext({ viewport: { width:844, height:390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await sweep(mctx, 'phone 844x390');
  await mctx.close();

  console.log('page errors:', errsAll.length ? errsAll.join(' | ') : 0);
  console.log(bad === 0 && !errsAll.length ? 'VISUAL OK' : 'VISUAL ISSUES: ' + bad);
  await b.close();
  process.exit(bad === 0 && !errsAll.length ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });

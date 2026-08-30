/* Scripted playtest for the finale boss duel (found by the level's finale
   flag, so mission insertion cannot re-aim it): a deliberately imperfect bot
   (bounded turn rate, aim jitter, periodic strafing, no cheats) fights
   LEGACY-DC01 as a mid-mission player would — vest on, shotgun + patch cannon
   found, consoles done — then runs the meltdown escape to the exit.
   Usage: node tools/playtest.js /abs/path/to/index.html <diff 0-2> [runs=30]
   Prints per-run results and a summary; exits 0 always (it measures, the
   caller judges). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const DIFF = +(process.argv[3] || 0);
const RUNS = +(process.argv[4] || 30);

async function launch() {
  try { return await chromium.launch(); }
  catch (e) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    for (const dir of fs.readdirSync(base).filter(d => d.startsWith('chromium'))) {
      const p = path.join(base, dir, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) { try { return await chromium.launch({ executablePath: p }); } catch (_) {} }
    }
    throw e;
  }
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + target);
  await page.waitForFunction(() => typeof G !== 'undefined' && typeof selfTest === 'function');
  await page.waitForTimeout(800);

  const duel = (D, seed, maxSec) => page.evaluate(({ D, seed, maxSec }) => {
    const mulberry32 = a => () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const saveRandom = Math.random;
    Math.random = mulberry32(seed);
    try {
      /* the boss mission is the one FLAGGED finale — mission insertion moves
         its index, and a hardcoded slot would silently duel the wrong level */
      selLevel = LEVELS.findIndex(L => L.finale); G.diff = D; LOOK = 'free'; resolveLook();
      startMission(false); clearInput();
      const bossCell = (() => {
        const b = G.ents.find(o => o.kind === 'enemy' && o.sub === 'boss');
        return b ? (b.y | 0) * G.W + (b.x | 0) : -1;
      })();
      P.x = 15.5; P.y = 3.5; P.ang = 0;
      P.armor = 60; P.hp = 100;
      P.has = [true, false, true, true]; P.mag = [7, 0, 5, 3];
      P.ammo = { p9: 42, smg: 0, sh: 16, pt: 8 };
      G.shieldDown = true;
      for (const o of G.objs) if (o.kind === 'console') { o.done = true; o.have = o.need; }
      const AA = AIM_ASSIST; AIM_ASSIST = 2;

      // BFS distances to the exit; doors count walkable (they auto-open)
      const dist = new Int32Array(G.W * G.H).fill(-1);
      const exitEnt = G.ents.find(o => o.kind === 'exit');
      const q = [[exitEnt.x | 0, exitEnt.y | 0]];
      dist[(exitEnt.y | 0) * G.W + (exitEnt.x | 0)] = 0;
      while (q.length) {
        const [cx, cy] = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H) continue;
          const c = ny * G.W + nx;
          if (dist[c] >= 0) continue;
          if (G.solid[c] && G.doorIx[c] < 0) continue;
          dist[c] = dist[cy * G.W + cx] + 1; q.push([nx, ny]);
        }
      }

      const rng = Math.random, dt = 1 / 60;
      let strafe = 1, strafeT = 0, t = 0, phase = 'fight', exc = null;
      let stuckT = 0, lx = P.x, ly = P.y;
      try {
        while (t < maxSec) {
          t += dt;
          if (G.state !== 'play') break;
          const boss = G.ents.find(o => o.kind === 'enemy' && o.sub === 'boss' && o.state !== 'dead');
          if (phase === 'fight' && !boss) phase = 'escape';

          let wantAng = P.ang;
          if (phase === 'fight') {
            let tgt = boss, td = boss ? Math.sqrt(dist2(boss.x, boss.y, P.x, P.y)) : 99;
            for (const o of G.ents) if (o.kind === 'enemy' && o.sub === 'drone' && o.state !== 'dead') {
              const dd = Math.sqrt(dist2(o.x, o.y, P.x, P.y));
              if (dd < 3.5 && dd < td) { tgt = o; td = dd; }
            }
            wantAng = Math.atan2(tgt.y - P.y, tgt.x - P.x) + (rng() - .5) * .1;
            held.fwd = td > 8; held.back = td < 5; held.run = true;
            // hurting: break for the nearest visible med/vest like a person would
            if (P.hp < 60) {
              let pk = null, pd = 15;
              for (const o of G.ents) if (o.kind === 'item' && (o.sub === 'med' || o.sub === 'vest')) {
                const dd2 = Math.sqrt(dist2(o.x, o.y, P.x, P.y));
                if (dd2 < pd && los(P.x, P.y, o.x, o.y)) { pk = o; pd = dd2; }
              }
              if (pk) { wantAng = Math.atan2(pk.y - P.y, pk.x - P.x); held.fwd = true; held.back = false; }
            }
            strafeT -= dt;
            if (strafeT <= 0) { strafe = rng() < .5 ? 1 : -1; strafeT = 1 + rng() * .8; }
            for (const o of G.ents) if (o.kind === 'proj' && !o.mine) {
              const dd = Math.sqrt(dist2(o.x, o.y, P.x, P.y));
              if (dd < 3.2) {
                const rel = angDiff(Math.atan2(P.y - o.y, P.x - o.x), o.ang);
                if (Math.abs(rel) < .5) { strafe = rel > 0 ? -1 : 1; strafeT = .5; }
              }
            }
            held.left = strafe < 0; held.right = strafe > 0;
            const pt = P.mag[3] + P.ammo.pt, sh = P.mag[2] + P.ammo.sh;
            const want = (tgt === boss && td > 4.5 && pt > 0) ? 3 : (sh > 0 && td < 10 ? 2 : 0);
            if (P.w !== want && P.has[want]) pickWeapon(want);
            if (P.fireCd <= 0 && P.reload <= 0) { M.fire = true; M.pressNew = true; M.fireEdge = performance.now(); }
            else M.fire = false;
          } else {
            const cx = P.x | 0, cy = P.y | 0;
            let bestC = null, bd = dist[cy * G.W + cx];
            for (const [dx2, dy2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = cx + dx2, ny = cy + dy2;
              if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H) continue;
              const c2 = ny * G.W + nx;
              if (dist[c2] < 0) continue;
              if (bd < 0 || dist[c2] < bd) { bd = dist[c2]; bestC = [nx + .5, ny + .5]; }
            }
            const tgt2 = bestC || [exitEnt.x, exitEnt.y];
            wantAng = Math.atan2(tgt2[1] - P.y, tgt2[0] - P.x);
            held.fwd = true; held.back = false; held.run = true;
            held.left = held.right = false; M.fire = false;
          }
          const dAng = angDiff(P.ang, wantAng);
          P.ang += clamp(dAng, -4.5 * dt, 4.5 * dt);
          if (Math.hypot(P.x - lx, P.y - ly) < .004 && (held.fwd || held.back || held.left || held.right)) {
            stuckT += dt; if (stuckT > .4) { strafe = -strafe; held.left = strafe < 0; held.right = strafe > 0; stuckT = 0; }
          } else stuckT = 0;
          lx = P.x; ly = P.y;
          step(dt);
        }
      } catch (e) { exc = String((e && e.stack) || e).slice(0, 300); }

      const exitDone = !!G.objs.find(o => o.kind === 'exit' && o.done);
      const out = {
        win: exitDone, died: !P.alive,
        bossDead: !G.ents.some(o => o.kind === 'enemy' && o.sub === 'boss' && o.state !== 'dead'),
        end: G.state, t: +t.toFixed(1), hp: Math.round(P.hp), armor: Math.round(P.armor),
        dmg: Math.round(G.dmgTaken), faults: G.faults || 0, exc,
        escapeCells: bossCell >= 0 ? dist[bossCell] : -1   // BFS steps from the boss's own spawn cell to the exit
      };
      AIM_ASSIST = AA; clearInput(); G.state = 'title';
      if (typeof show === 'function') show('s-title');
      return out;
    } finally { Math.random = saveRandom; }
  }, { D, seed, maxSec });

  const rows = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await duel(DIFF, 1000 + i * 7919, 150);
    rows.push(r);
    console.log(`run ${String(i).padStart(2)}: ${r.win ? 'WIN ' : (r.died ? 'DIED' : (r.bossDead ? 'boss dead, no exit' : 'TIMEOUT'))}` +
      `  t=${r.t}s hp=${r.hp} ar=${r.armor} dmgTaken=${r.dmg}${r.exc ? '  EXC=' + r.exc : ''}${r.faults ? ' faults=' + r.faults : ''}`);
  }
  const wins = rows.filter(r => r.win).length;
  const hps = rows.filter(r => r.win).map(r => r.hp).sort((a, b) => a - b);
  const med = hps.length ? hps[hps.length >> 1] : 0;
  console.log(`SUMMARY diff=${DIFF}: ${wins}/${RUNS} wins (${Math.round(wins / RUNS * 100)}%), median hp of winners ${med}, ` +
    `boss killed in ${rows.filter(r => r.bossDead).length}/${RUNS}, escape cells from boss room: ${rows[0] ? rows[0].escapeCells : '?'}`);
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });

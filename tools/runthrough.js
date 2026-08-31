/* Scripted objective-chain runthrough: proof that every mission is HUMANLY
   playable end to end, and the par-calibration instrument for new missions.
   Per mission x difficulty the bot loads the level cold (no cheats, god OFF,
   the game's own default aim assist) and then, like a player following the
   watch: picks the first outstanding objective via objsLeft/nearestFor, BFS-es
   a path on the grid — closed doors count walkable because walking into them
   opens them, locked doors only once the key is held, and hidden 'H' doors
   only when already found, falling back to bumping the wall the waypoint
   points through (exactly how a human finds the credential case) — then walks
   it with real held.* inputs through step() at a synchronous 60Hz, holding USE
   at terminals, collecting items by walking over them, fighting whatever has
   line of sight with an aim-at-nearest policy, and sprinting between fights.
   Dying retries the mission from the top (bounded); the report counts deaths.
   Usage: node tools/runthrough.js /abs/path/to/index.html [levelIndex|all] [diff|all] [--trace]
   Prints one row per combo and a summary; like the playtest, it exits 0
   always — it measures, the caller judges. Known ceiling: the finale duel on
   00 AGENT outfights this bot, as it does the scripted playtest bot (0/8
   there with a STAGED loadout) — the tuned skill wall, not broken geometry:
   the same bot clears the whole mission on SECRET. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const LEVEL_ARG = process.argv[3] || 'all';
const DIFF_ARG = process.argv[4] || 'all';
const TRACE = process.argv.includes('--trace');   // per-half-second bot telemetry, for par calibration
/* --thumb plays the game the way a PHONE does: the right pad's rim rate
   instead of a wrist flick, and a thumb's reaction time before it answers a
   new threat. The desktop bot turns at 4.5 rad/s the instant it decides to;
   a pad tops out at TPAD_TURN and a hand needs ~200ms to start. Difficulty
   that only shows up here is difficulty the phone is carrying alone. */
const THUMB = process.argv.includes('--thumb');
const MAX_TRIES = 5;          // attempts per combo; deaths beyond these fail it
const MAX_SEC = 420;          // sim-seconds per attempt — >2.3x the slowest par

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

  const combos = await page.evaluate(() => ({ levels: LEVELS.map(L => L.code), diffs: DIFFS.map(d => d.name) }));

  const run = (li, di, seed) => page.evaluate(({ li, di, seed, MAX_TRIES, MAX_SEC, TRACE, THUMB }) => {
    /* deterministic runs: a seeded RNG swapped in for the duration */
    const mulberry32 = a => () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const saveRandom = Math.random;
    Math.random = mulberry32(seed);
    const sv0 = A.sfxVol; A.sfxVol = 0;         // the run fires real guns
    const trace = [];
    try {
      const rng = Math.random, dt = 1 / 60;

      /* BFS from the player's cell to (tx,ty). Doors are walkable when their
         rules allow: plain doors always (proximity opens them), locked doors
         once the key is held, secret doors only if found — unless allowSecrets
         says a human would be bumping this wall on purpose. */
      const bfs = (tx, ty, allowSecrets) => {
        const W = G.W, H = G.H;
        const prev = new Int32Array(W * H).fill(-2);
        const start = (P.y | 0) * W + (P.x | 0), goal = (ty | 0) * W + (tx | 0);
        prev[start] = -1;
        const q = [start]; let qh = 0;
        while (qh < q.length) {
          const c = q[qh++];
          if (c === goal) break;
          const cx = c % W, cy = (c / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const n = ny * W + nx;
            if (prev[n] !== -2) continue;
            const dix = G.doorIx[n];
            if (dix >= 0) {
              const d = G.doors[dix];
              if (d.locked && P.keys <= 0) continue;
              if (d.secret && !d.found && !allowSecrets) continue;
            } else if (G.solid[n]) continue;
            prev[n] = c; q.push(n);
          }
        }
        if (prev[goal] === -2) return null;
        const p = []; let c = goal;
        while (prev[c] !== -1) { p.push(c); c = prev[c]; }   // start itself stays off the path
        p.reverse(); return p;
      };

      /* the game's own objective chain: first outstanding objective, else the
         exit; prefer one the grid can actually reach without secret-bumping */
      const pickTarget = () => {
        const cands = objsLeft();
        const ex = G.objs.find(o => o.kind === 'exit' && !o.done);
        if (!cands.length && ex) cands.push(ex);
        /* stock up BEFORE the duel, like a person reading the objective list:
           walking into the boss with no vest and half health is a retry. Only
           while the rack hasn't been engaged — a cross-arena vest run with the
           duel already hot drags the fan through every step of it. */
        const lastCon = cands.length && cands[0].kind === 'console' &&
                        cands[0].need - cands[0].have <= 1;
        const preDuel = cands.length && cands[0].kind === 'boss' && !G.bossSeen;
        /* and mid-duel, when nearly dead, break off for the nearest med the
           GRID can reach — the south service corridor is out of the fan's
           sight, and that retreat is exactly how a person survives this */
        const desperate = G.bossAlive && G.shieldDown && P.hp + P.armor < 60;
        if ((lastCon || preDuel || desperate) && (P.armor < 50 || P.hp < 75)) {
          let kit = null, kd = Infinity;
          for (const o of G.ents) {
            if (o.kind !== 'item') continue;
            if (!((o.sub === 'vest' && P.armor < 50) || (o.sub === 'med' && P.hp < 75))) continue;
            const d = dist2(o.x, o.y, P.x, P.y);
            if (d < kd) { kit = o; kd = d; }
          }
          if (kit) {
            const p = bfs(kit.x, kit.y, false);
            /* short errands only: a cross-map vest pilgrimage through the
               arena bleeds more than the vest gives back */
            if (p && p.length <= 12) return { o: cands[0], e: kit, path: p };
          }
        }
        for (const pass of [false, true]) {          // non-secret paths first
          for (const o of cands) {
            const n = nearestFor(o);
            if (!n) continue;
            const p = bfs(n.e.x, n.e.y, pass);
            if (p) return { o, e: n.e, path: p, secretly: pass };
          }
        }
        return null;
      };

      const USE_KINDS = { term: 1, audit: 1, console: 1, npc: 1 };
      const attempt = () => {
        selLevel = li; G.diff = di; LOOK = 'free'; resolveLook();
        startMission(false); clearInput();
        let t = 0, replan = 0, tgt = null, stuckT = 0, lx = P.x, ly = P.y;
        let strafe = 1, strafeT = 0, swapT = -9, exc = null;
        /* thumb profile: the look pad's rim rate, and a hand's delay before it
           answers. TPAD_TURN is the game's own constant, read live. */
        const THUMB_TURN = (typeof TPAD_TURN === 'number' ? TPAD_TURN : 3.1);
        const THUMB_LAG = .20;
        const aimLag = [{ a: P.ang, t: 0 }];
        try {
          while (t < MAX_SEC && G.state === 'play') {
            t += dt; replan -= dt;
            if (!tgt || replan <= 0 ||
                (tgt.e.dead2 || tgt.o.done)) { tgt = pickTarget(); replan = .75; }

            /* fights: the nearest live hostile with line of sight — plus the
               shootable props (AP, ransomware node) once they're the target.
               A shield-up boss is never a foe: shots bounce, and dueling it
               from the console rooms is how a runthrough dies for nothing. */
            let foe = null, fd = 8.5;
            const duel = G.bossAlive && G.shieldDown;
            for (const e of G.ents) {
              if (e.kind !== 'enemy' || e.state === 'dead' || e.sub === 'boss') continue;
              /* mid-duel, the duel is the fight: sideshow hostiles only matter
                 at knife range — the playtest proved this focus out */
              if (duel && dist2(e.x, e.y, P.x, P.y) > 6.5 * 6.5) continue;
              const d = Math.sqrt(dist2(e.x, e.y, P.x, P.y));
              /* let sleeping guards lie: opening up on an idle one wakes every
                 hostile in earshot, and 00's whole west wing converges at once */
              if (!e.alert && d > 4.5) continue;
              if (d < fd && los(P.x, P.y, e.x, e.y)) { foe = e; fd = d; }
            }
            if (duel && !foe) {
              const b = G.ents.find(e => e.kind === 'enemy' && e.sub === 'boss' && e.state !== 'dead');
              if (b && los(P.x, P.y, b.x, b.y)) { foe = b; fd = Math.sqrt(dist2(b.x, b.y, P.x, P.y)); }
            }
            if (!foe && tgt && tgt.e.kind === 'prop' && (tgt.e.sub === 'ap' || tgt.e.sub === 'infected')) {
              const d = Math.sqrt(dist2(tgt.e.x, tgt.e.y, P.x, P.y));
              if (d < 11 && los(P.x, P.y, tgt.e.x, tgt.e.y)) { foe = tgt.e; fd = d; }
            }
            const escaping = G.meltdown > 0;         // the room is cooking: run
            if (escaping && foe && foe.kind === 'enemy') foe = null;

            /* supplies: break for whatever a person would grab in passing — a
               medkit when hurting, a vest when bare, a gun not yet carried,
               ammo when the reserves run thin. Hurting looks furthest. */
            let pk = null;
            if (!escaping) {
              const lowAmmo = P.ammo.p9 + P.ammo.smg + P.ammo.sh + P.ammo.pt < 20;
              /* how far each kind of kit is worth walking: an uncarried gun is
                 mission-critical (the finale duel is unwinnable on a pistol),
                 a medkit is worth a real detour once hurting */
              const reach = o => {
                if (o.sub === 'med') return P.hp < 75 ? 13 : 0;
                if (o.sub === 'vest') return P.armor < 50 ? 6 : 0;
                if (o.sub === 'ammo') return lowAmmo ? 6 : 0;
                if (o.sub.slice(0, 3) === 'wpn') return P.has[+o.sub[3]] ? 0 : 10;
                return 0;
              };
              let pd = 99;
              for (const o of G.ents) if (o.kind === 'item') {
                const d = Math.sqrt(dist2(o.x, o.y, P.x, P.y));
                if (d < reach(o) && d < pd && los(P.x, P.y, o.x, o.y)) { pk = o; pd = d; }
              }
            }

            let wantAng = P.ang;
            held.use = false; M.fire = false;
            /* strafing with eyes on a target: move by the world bearing while
               the view stays on the fight — how a player actually walks */
            const moveToward = (mx, my) => {
              const rel = angDiff(P.ang, Math.atan2(my - P.y, mx - P.x));
              held.fwd = Math.abs(rel) < 1.2; held.back = Math.abs(rel) > 1.9;
              held.left = rel < -.35; held.right = rel > .35;
            };
            if (foe) {
              /* stand and fight: face the hostile, keep 3.5-8u, strafe, and
                 pick the gun the range asks for (never the cannon up close) */
              wantAng = Math.atan2(foe.y - P.y, foe.x - P.x) + (rng() - .5) * .08;
              /* stand ground and let them come — chasing a hostile into an
                 open room is how one fight becomes four. Props don't walk, so
                 those are closed to shotgun range. Always at a sprint: moving
                 fast IS the game's evasion (aimPenalty), and the boss fires
                 unled slugs at where the agent stands — a constant-direction
                 sprint circle walks out from under the whole fan, where the
                 old random strafe-flip walked back INTO it. */
              const boss = foe.sub === 'boss';
              held.run = true;
              if (duel) {
                /* orbit the rack for the WHOLE duel, even while a knife-range
                   drone has the reticle: the slugs fly at where the agent IS,
                   so an unbroken sprint circle walks out from under every fan
                   — any pause or direction flip is a 27-damage clip on 00 */
                const b = boss ? foe :
                  G.ents.find(e => e.kind === 'enemy' && e.sub === 'boss' && e.state !== 'dead');
                const bd = b ? Math.sqrt(dist2(b.x, b.y, P.x, P.y)) : fd;
                held.fwd = bd > 9; held.back = bd < 6.5;
                /* don't back into a rack island and stand there eating fans */
                if (held.back && isSolid(P.x - Math.cos(P.ang), P.y - Math.sin(P.ang))) held.back = false;
              } else {
                const keep = P.hp < 40 ? 6.5 : 3.5;
                held.fwd = fd > 6 && foe.kind === 'prop';
                held.back = fd < keep;
                strafeT -= dt;
                if (strafeT <= 0) { strafe = rng() < .5 ? 1 : -1; strafeT = 1 + rng() * .8; }
                for (const o of G.ents) if (o.kind === 'proj' && !o.mine) {
                  const d = Math.sqrt(dist2(o.x, o.y, P.x, P.y));
                  if (d < 3.2) {
                    const rel = angDiff(Math.atan2(P.y - o.y, P.x - o.x), o.ang);
                    if (Math.abs(rel) < .5) { strafe = rel > 0 ? -1 : 1; strafeT = .5; }
                  }
                }
              }
              /* never strafe INTO geometry: probe a body-length sideways and
                 flip early — wedging in a corner under boss fire is death */
              const sa = P.ang + Math.PI / 2 * strafe;
              if (isSolid(P.x + Math.cos(sa), P.y + Math.sin(sa))) strafe = -strafe;
              held.left = strafe < 0; held.right = strafe > 0;
              const pt = P.mag[3] + P.ammo.pt, sh = P.mag[2] + P.ammo.sh, sm = P.mag[1] + P.ammo.smg;
              let want = 0;
              if (P.has[2] && sh > 0 && fd < 9) want = 2;
              else if (P.has[1] && sm > 0) want = 1;
              /* a drone is a small fast body: snapped Klobb/PP7 fire beats a
                 pellet pattern that mostly misses it beyond point blank */
              if (foe.sub === 'drone' && fd > 3.5) want = (P.has[1] && sm > 0) ? 1 : 0;
              /* the rack is a barn door: inside 9u the full pellet pattern
                 lands, so the cannon only earns its reload past that or dry */
              if (foe.sub === 'boss' && P.has[3] && pt > 0 && (fd > 9 || sh <= 0)) want = 3;
              /* swap with hysteresis: pickWeapon re-arms a .18s fire cooldown,
                 and a choice that flaps across a range boundary every frame
                 silences the guns entirely */
              if (want !== P.w && P.has[want] &&
                  (t - swapT > 1.2 || P.mag[P.w] + P.ammo[WEAPS[P.w].ammo] <= 0)) {
                pickWeapon(want); swapT = t;
              }
              /* kit on the floor mid-fight: run it down WITHOUT ceasing fire */
              if (pk) moveToward(pk.x, pk.y);
              else if (!boss && !duel) {
                /* outnumbered and worn down: give ground the way we came, so
                   the pack has to feed through the last doorway one at a time */
                let packN = 0, cx = 0, cy = 0;
                for (const e of G.ents) {
                  if (e.kind !== 'enemy' || e.state === 'dead' || e.sub === 'boss') continue;
                  if (dist2(e.x, e.y, P.x, P.y) < 100 && los(P.x, P.y, e.x, e.y)) { packN++; cx += e.x; cy += e.y; }
                }
                if (packN && (packN >= 2 ? P.hp + P.armor < 120 : P.hp + P.armor < 90))
                  moveToward(P.x * 2 - cx / packN, P.y * 2 - cy / packN);
              }
              if (P.fireCd <= 0 && P.reload <= 0) {
                M.fire = true; M.pressNew = true; M.fireEdge = performance.now();
              }
            } else if (pk) {
              wantAng = Math.atan2(pk.y - P.y, pk.x - P.x);
              held.fwd = true; held.back = false; held.run = true;
              held.left = held.right = false;
              /* final approach at a walk: at a sprint the 4.5 rad/s turn cap
                 makes a pursuit orbit around anything smaller than its turning
                 circle — the bot literally cannot fall onto the pickup */
              const gd = Math.sqrt(dist2(P.x, P.y, pk.x, pk.y));
              if (gd < 2) held.run = false;
              if (gd < 1.2 && Math.abs(angDiff(P.ang, wantAng)) > .6) held.fwd = false;
            } else if (tgt) {
              /* walk the BFS path; the last leg heads at the entity itself */
              while (tgt.path.length) {
                const c = tgt.path[0], wx = c % G.W + .5, wy = (c / G.W | 0) + .5;
                if (dist2(P.x, P.y, wx, wy) < .16) tgt.path.shift(); else break;
              }
              const wx = tgt.path.length ? tgt.path[0] % G.W + .5 : tgt.e.x;
              const wy = tgt.path.length ? (tgt.path[0] / G.W | 0) + .5 : tgt.e.y;
              wantAng = Math.atan2(wy - P.y, wx - P.x);
              held.fwd = true; held.back = false; held.run = true;
              held.left = held.right = false;
              /* final approach at a walk — same pursuit-orbit trap as above */
              if (!tgt.path.length) {
                const gd = Math.sqrt(dist2(P.x, P.y, tgt.e.x, tgt.e.y));
                if (gd < 2) held.run = false;
                if (gd < 1.2 && Math.abs(angDiff(P.ang, wantAng)) > .6) held.fwd = false;
              }
              /* consoles and the CFO take a held USE, up close and facing */
              if (USE_KINDS[tgt.e.sub] && dist2(P.x, P.y, tgt.e.x, tgt.e.y) < 1.6) {
                wantAng = Math.atan2(tgt.e.y - P.y, tgt.e.x - P.x);
                held.fwd = false; held.run = false;
                if (Math.abs(angDiff(P.ang, wantAng)) < .5) held.use = true;
              }
            } else { held.fwd = held.back = held.left = held.right = false; }

            /* a human turn, not a teleport: bounded toward the goal. On thumb
               profile the bound is the look pad's own rim rate, and the goal
               is one reaction-time stale, because that is what a phone can
               actually deliver. */
            if (THUMB){
              /* A thumb turns at the pad's rim rate, and a phone player who is
                 badly mis-aimed STOPS and turns rather than walking a wide arc
                 — the desktop bot's 4.5 rad/s hides that entirely. Reaction
                 lag belongs on answering a NEW threat, not on steering, or the
                 bot cannot navigate at all (measured: 0 objectives in 420s). */
              const err = Math.abs(angDiff(P.ang, wantAng));
              if (err > .9){ held.fwd = false; held.run = false; }
              else if (err > .45) held.run = false;
              P.ang += clamp(angDiff(P.ang, wantAng), -THUMB_TURN * dt, THUMB_TURN * dt);
            } else
            P.ang += clamp(angDiff(P.ang, wantAng), -4.5 * dt, 4.5 * dt);

            /* wedged against geometry (or waiting out a door): sidestep, and
               if that fails long enough, throw the plan away and re-path */
            if (Math.hypot(P.x - lx, P.y - ly) < .004 &&
                (held.fwd || held.back || held.left || held.right)) {
              stuckT += dt;
              if (stuckT > .9) { strafe = -strafe; held.left = strafe < 0; held.right = strafe > 0; }
              if (stuckT > 2.5) { tgt = null; replan = 0; stuckT = 0; }
            } else stuckT = 0;
            lx = P.x; ly = P.y;
            step(dt);
            if (TRACE && (t * 2 | 0) !== ((t - dt) * 2 | 0))
              trace.push(t.toFixed(1) + 's ' + (P.x).toFixed(1) + ',' + (P.y).toFixed(1) +
                ' hp' + Math.round(P.hp) + '+' + Math.round(P.armor) + ' w' + P.w +
                ' ' + (foe ? 'foe:' + foe.sub + '@' + fd.toFixed(1) : pk ? 'pk:' + pk.sub : 'walk') +
                (tgt ? ' -> ' + tgt.o.tag + '/' + tgt.e.sub + ' path:' + tgt.path.length : ' -> none'));
          }
        } catch (e) { exc = String((e && e.stack) || e).slice(0, 300); }
        return {
          win: !!G.objs.find(o => o.kind === 'exit' && o.done),
          died: !P.alive, t: +t.toFixed(1), hp: Math.round(P.hp),
          shots: G.shots, hits: G.hits, kills: G.kills,
          objs: G.objs.filter(o => o.done).length + '/' + G.objs.length, exc
        };
      };

      let deaths = 0, last = null;
      for (let i = 0; i < MAX_TRIES; i++) {
        if (TRACE) trace.push('--- attempt ' + (i + 1) + ' ---');
        last = attempt();
        if (last.win || last.exc) break;
        deaths++;
      }
      const out = Object.assign({ code: G.L.code, par: G.L.par, diff: DIFFS[di].name, deaths, trace }, last);
      clearInput(); G.state = 'title';
      if (typeof show === 'function') show('s-title');
      return out;
    } finally { Math.random = saveRandom; A.sfxVol = sv0; }
  }, { li, di, seed, MAX_TRIES, MAX_SEC, TRACE, THUMB });

  const wantL = LEVEL_ARG === 'all' ? combos.levels.map((_, i) => i) : [+LEVEL_ARG];
  const wantD = DIFF_ARG === 'all' ? combos.diffs.map((_, i) => i) : [+DIFF_ARG];
  const rows = [];
  for (const li of wantL) for (const di of wantD) {
    const r = await run(li, di, 4242 + li * 101 + di * 13);
    rows.push(r);
    if (TRACE) for (const line of r.trace) console.log('  ' + line);
    const acc = r.shots ? Math.round(r.hits / r.shots * 100) : 0;
    console.log(`${r.code} ${r.diff.padEnd(12)} ${r.win ? 'WIN     ' : (r.died ? 'DEAD    ' : 'TIMEOUT ')}` +
      `t=${String(r.t).padStart(6)}s  par=${r.par}  t/par=${(r.t / r.par).toFixed(2)}  deaths=${r.deaths}` +
      `  hp=${String(r.hp).padStart(3)}  objs=${r.objs}  shots=${r.shots} hits=${r.hits} (${acc}%)` +
      (r.exc ? '  EXC=' + r.exc : ''));
  }
  const bad = rows.filter(r => !r.win);
  console.log(`RUNTHROUGH ${rows.length - bad.length}/${rows.length} combos completed` +
    (bad.length ? ' — INCOMPLETE: ' + bad.map(r => r.code + '/' + r.diff).join(', ') : ' — all missions humanly playable'));
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });

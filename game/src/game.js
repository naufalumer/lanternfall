// Lanternfall — the game itself: state, the fixed-step loop and every
// rule that ties the pieces together. One file, one job: it owns the
// simulation, so the other files only know their own slice of it.
import { CONFIG, MINUTE_TABLE } from './config.js';
import { Rng } from './rng.js';
import { AudioEngine } from './audio.js';
import { Particles } from './particles.js';
import { Input } from './input.js';
import {
  makePlayer, playerSpeed, pickupRadius, addXp, applyBlessing,
  hurtPlayer, healPlayer, loadBest, saveBest,
} from './player.js';
import {
  makeEnemy, makeWarden, makeKing, pickKind, hpScaleAt, speedScaleAt, spawnPoint,
  steerEnemy, steerWarden, steerKing,
} from './enemies.js';
import { fireWeapon, weaponCooldown, weaponStats, killEnemy } from './weapons.js';
import { drawWorld } from './render.js';
import { drawHud, drawTitle, drawLevelUp, drawPause, drawGameOver, drawVictory } from './ui.js';

export const STEP = 1 / 60;

export function createState(seed, canvas) {
  const rng = new Rng(seed);
  const state = {
    seed,
    rng,
    time: 0,
    screen: 'title',
    score: 0,
    stats: { kills: 0, gems: 0, damage: 0 },
    combo: { count: 0, timer: 0 },
    player: makePlayer(CONFIG.worldWidth / 2, CONFIG.worldHeight / 2),
    passives: {},
    enemies: [],
    gems: [],
    pickups: [],
    bullets: [],
    spawnQueue: [],
    spawnTimer: 1.2,
    wardenMinute: 0,
    kingSpawned: false,
    kingDead: false,
    pendingLevels: 0,
    choices: [],
    uiCards: [],
    banner: 0,
    bannerText: '',
    shake: 0,
    hitStop: 0,
    beams: [],
    camera: { x: 0, y: 0 },
    particles: new Particles(),
    audio: new AudioEngine(),
    input: canvas ? new Input(canvas) : null,
    mouse: { x: 0, y: 0 },
    best: loadBest(),
    fireflies: [],
    moss: [],
    fire: null,
  };
  for (let i = 0; i < 60; i++) {
    state.fireflies.push({
      x: rng.range(0, CONFIG.viewWidth),
      y: rng.range(0, CONFIG.viewHeight),
      r: rng.range(1, 2.6),
      tw: rng.range(0.6, 2.2),
      ph: rng.range(0, Math.PI * 2),
    });
  }
  for (let i = 0; i < 130; i++) {
    state.moss.push({
      x: rng.range(0, CONFIG.worldWidth),
      y: rng.range(0, CONFIG.worldHeight),
      r: rng.range(14, 60),
      rot: rng.range(0, Math.PI),
      color: rng.pick(['#1d2b1e', '#232a1e', '#1a2436']),
    });
  }
  state.fire = makeFire(state);
  return state;
}

// The visual events weapons emit; render reads them through particles.
function makeFire(state) {
  return {
    ring(x, y, color, maxR) {
      state.particles.ring(x, y, color, maxR);
    },
    beam(x1, y1, x2, y2) {
      state.beams.push({ x1, y1, x2, y2, life: 0.18, maxLife: 0.18 });
    },
    spark(x1, y1, x2, y2) {
      state.beams.push({ x1, y1, x2, y2, life: 0.14, maxLife: 0.14, spark: true });
    },
  };
}

export function startRun(state) {
  const keepBest = state.best;
  const fresh = createState((Math.random() * 0xffffffff) >>> 0, null);
  fresh.best = keepBest;
  fresh.input = state.input;
  fresh.audio = state.audio;
  Object.assign(state, fresh);
  // Rebind the fire callbacks to this state object: the fresh copy closed
  // over its own object, and the loop keeps using this one.
  state.fire = makeFire(state);
  state.screen = 'play';
  state.banner = 2;
  state.bannerText = 'Minute 1 — the Hollow stirs';
  state.audio.ensure();
}

// One fixed step of the simulation. Pure except for audio + particles.
export function step(state, dt) {
  if (state.screen === 'play') {
    state.time += dt;
    updatePlayer(state, dt);
    updateWeapons(state, dt);
    updateDirector(state, dt);
    updateEnemies(state, dt);
    updateBullets(state, dt);
    updateGems(state, dt);
    updatePickups(state, dt);
    updateCombo(state, dt);
    if (state.banner > 0) state.banner -= dt;
  }
  state.particles.update(dt);
  if (state.beams) {
    for (let i = state.beams.length - 1; i >= 0; i--) {
      state.beams[i].life -= dt;
      if (state.beams[i].life <= 0) state.beams.splice(i, 1);
    }
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
  if (state.hitStop > 0) state.hitStop -= dt;
  updateCamera(state, dt);
}

function updatePlayer(state, dt) {
  const p = state.player;
  const input = state.input;
  const mv = input ? input.moveVector() : { x: 0, y: 0 };
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    p.facing = mv.x !== 0 ? Math.sign(mv.x) : p.facing;
    p.walkCycle += dt * 11;
  }
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (input && input.pressed(' ') && p.dashCd <= 0) {
    const dir = p.moving ? Math.atan2(mv.y, mv.x) : p.facing >= 0 ? 0 : Math.PI;
    p.dashDir = dir;
    p.dashT = CONFIG.player.dashTime;
    p.dashCd = CONFIG.player.dashCooldown;
    p.invuln = Math.max(p.invuln, CONFIG.player.dashInvuln);
    state.audio.play('dash');
    state.particles.burst(p.x, p.y, 10, '#ffe9a8', 160, 0.4, 3);
  }
  const speed = playerSpeed(state);
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += Math.cos(p.dashDir) * CONFIG.player.dashSpeed * dt;
    p.y += Math.sin(p.dashDir) * CONFIG.player.dashSpeed * dt;
  } else {
    p.x += mv.x * speed * dt;
    p.y += mv.y * speed * dt;
  }
  p.x = Math.max(30, Math.min(CONFIG.worldWidth - 30, p.x));
  p.y = Math.max(30, Math.min(CONFIG.worldHeight - 30, p.y));
  p.orbitAngle += dt * (2.6 + ((p.weapons.orbit || 1) - 1) * 0.35);
}

function updateWeapons(state, dt) {
  const p = state.player;
  for (const [id, level] of Object.entries(p.weapons)) {
    if (id === 'orbit' || id === 'thorn') continue;
    p.timers[id] = (p.timers[id] || 0) - dt;
    if (p.timers[id] <= 0) {
      fireWeapon(state, id, level, state.fire);
      p.timers[id] = weaponCooldown(id, level, state.passives);
    }
  }
  // Orbit embers: contact damage with a per-enemy cooldown.
  const orbitLvl = p.weapons.orbit || 0;
  if (orbitLvl > 0) {
    const stats = weaponStats('orbit', orbitLvl, state.passives);
    const count = stats.count;
    for (let i = 0; i < count; i++) {
      const a = p.orbitAngle + (i / count) * Math.PI * 2;
      const ex = p.x + Math.cos(a) * stats.radius;
      const ey = p.y + Math.sin(a) * stats.radius;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const dx = e.x - ex;
        const dy = e.y - ey;
        if (dx * dx + dy * dy < (e.radius + 12) * (e.radius + 12)) {
          e.orbitCd = e.orbitCd || 0;
          if (e.orbitCd <= 0) {
            e.orbitCd = 0.45;
            hurtEnemyContact(state, e, stats.damage, ex, ey);
          }
        }
      }
    }
  }
  // Thorn ward: contact damage + slow with a per-enemy cooldown.
  const thornLvl = p.weapons.thorn || 0;
  if (thornLvl > 0) {
    const stats = weaponStats('thorn', thornLvl, state.passives);
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = stats.radius + e.radius;
      if (dx * dx + dy * dy < rr * rr) {
        e.slow = stats.slow;
        e.slowT = 0.3;
        e.thornCd = e.thornCd || 0;
        if (e.thornCd <= 0) {
          e.thornCd = 0.5;
          hurtEnemyContact(state, e, stats.damage, p.x, p.y);
        }
      }
    }
  }
  for (const e of state.enemies) {
    if (e.orbitCd > 0) e.orbitCd -= dt;
    if (e.thornCd > 0) e.thornCd -= dt;
  }
}

function hurtEnemyContact(state, e, dmg, fromX, fromY) {
  e.hp -= dmg;
  e.flash = 0.1;
  state.stats.damage += dmg;
  state.particles.text(e.x, e.y - e.radius - 6, String(dmg), '#ffe9a8', 13);
  if (e.hp <= 0) {
    killEnemy(state, e);
  }
}

function updateDirector(state, dt) {
  const t = state.time;
  // Wardens arrive on every minute mark.
  const minute = Math.floor(t / 60);
  if (minute > state.wardenMinute && minute >= 1 && minute <= 4) {
    state.wardenMinute = minute;
    const pos = spawnPoint(state.rng, state.player, CONFIG.viewWidth, CONFIG.viewHeight);
    state.enemies.push(makeWarden(pos.x, pos.y, minute));
    state.banner = 2.2;
    state.bannerText = 'A WARDEN APPROACHES';
    state.audio.play('boss');
  }
  // The Hollow King arrives at 5:00.
  if (!state.kingSpawned && t >= CONFIG.kingArrivesAt) {
    state.kingSpawned = true;
    const pos = spawnPoint(state.rng, state.player, CONFIG.viewWidth, CONFIG.viewHeight);
    state.enemies.push(makeKing(pos.x, pos.y));
    state.banner = 2.6;
    state.bannerText = 'THE HOLLOW KING';
    state.audio.play('boss');
    state.shake = Math.max(state.shake, 10);
  }
  // Regular spawns from the queue first (shade splits, king summons).
  while (state.spawnQueue.length > 0) {
    const s = state.spawnQueue.shift();
    state.enemies.push(makeEnemy(s.kind, s.x, s.y, s.hpScale || hpScaleAt(t), false, speedScaleAt(t)));
  }
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && state.enemies.length < CONFIG.maxAlive) {
    state.spawnTimer = CONFIG.spawnIntervalAt(t);
    const batch = CONFIG.batchAt(t);
    for (let i = 0; i < batch; i++) {
      const kind = pickKind(state.rng, t);
      const pos = spawnPoint(state.rng, state.player, CONFIG.viewWidth, CONFIG.viewHeight);
      const elite = t > 120 && state.rng.chance(0.02);
      state.enemies.push(makeEnemy(kind, pos.x, pos.y, hpScaleAt(t), elite, speedScaleAt(t)));
    }
  }
}

function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.kind === 'warden') steerWarden(state, e, dt);
    else if (e.kind === 'king') steerKing(state, e, dt);
    else steerEnemy(state, e, dt);
    // Spitters fire.
    if (e.kind === 'spitter') {
      e.spitCd -= dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.spitCd <= 0 && d < 420) {
        e.spitCd = 2.6;
        state.bullets.push({
          x: e.x, y: e.y,
          vx: (dx / d) * 170, vy: (dy / d) * 170,
          radius: 7, damage: e.damage, life: 3.5, hostile: true, color: '#7dff8a',
        });
      }
    }
    // Touch damage.
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const rr = p.radius + e.radius;
    if (dx * dx + dy * dy < rr * rr && e.touchCd <= 0) {
      e.touchCd = 0.8;
      hurtPlayer(state, e.damage);
    }
  }
  // Gentle separation so the swarm does not stack into one blob.
  const list = state.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < rr * rr) {
        const d = Math.sqrt(d2);
        const push = (rr - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push * 0.5;
        a.y -= ny * push * 0.5;
        b.x += nx * push * 0.5;
        b.y += ny * push * 0.5;
      }
    }
  }
  // Sweep the dead.
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].dead) {
      if (list[i].kind === 'king' && !state.kingDead) {
        state.kingDead = true;
        state.screen = 'victory';
        state.audio.play('victory');
        saveBest(state, true);
      }
      list.splice(i, 1);
    }
  }
}

function updateBullets(state, dt) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0) { state.bullets.splice(i, 1); continue; }
    if (b.hostile) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const rr = p.radius + b.radius;
      if (dx * dx + dy * dy < rr * rr) {
        hurtPlayer(state, b.damage);
        state.bullets.splice(i, 1);
      }
    }
  }
}

function updateGems(state, dt) {
  const p = state.player;
  const magnetR = pickupRadius(state);
  for (let i = state.gems.length - 1; i >= 0; i--) {
    const g = state.gems[i];
    g.life -= dt;
    if (g.life <= 0) { state.gems.splice(i, 1); continue; }
    g.x += (g.vx || 0) * dt;
    g.y += (g.vy || 0) * dt;
    g.vx = (g.vx || 0) * 0.9;
    g.vy = (g.vy || 0) * 0.9;
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d < magnetR) {
      const pull = 620 * (1 - d / (magnetR + 1)) + 120;
      g.x += (dx / (d || 1)) * pull * dt;
      g.y += (dy / (d || 1)) * pull * dt;
    }
    if (d < 24) {
      state.gems.splice(i, 1);
      state.audio.play('gem', state.combo.count);
      addXp(state, g.value);
      if (state.screen !== 'play') return;
    }
  }
}

function updatePickups(state, dt) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    pk.life -= dt;
    if (pk.life <= 0) { state.pickups.splice(i, 1); continue; }
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    if (dx * dx + dy * dy < 30 * 30) {
      state.pickups.splice(i, 1);
      if (pk.kind === 'heart') {
        healPlayer(state, pk.small ? 15 : 30);
        state.audio.play('pick');
      }
    }
  }
}

function updateCombo(state, dt) {
  if (state.combo.timer > 0) {
    state.combo.timer -= dt;
    if (state.combo.timer <= 0) state.combo.count = 0;
  }
}

function updateCamera(state) {
  const p = state.player;
  const tx = Math.max(0, Math.min(CONFIG.worldWidth - CONFIG.viewWidth, p.x - CONFIG.viewWidth / 2));
  const ty = Math.max(0, Math.min(CONFIG.worldHeight - CONFIG.viewHeight, p.y - CONFIG.viewHeight / 2));
  state.camera.x += (tx - state.camera.x) * 0.12;
  state.camera.y += (ty - state.camera.y) * 0.12;
  if (state.shake > 0) {
    state.camera.x += (Math.random() - 0.5) * state.shake;
    state.camera.y += (Math.random() - 0.5) * state.shake;
  }
}

// Render one frame for the current screen.
export function render(state, ctx) {
  const { viewWidth: W, viewHeight: H } = CONFIG;
  ctx.clearRect(0, 0, W, H);
  if (state.screen === 'title') {
    drawWorld(ctx, state);
    drawTitle(ctx, state);
    return;
  }
  drawWorld(ctx, state);
  drawBeams(ctx, state);
  if (state.screen === 'play' || state.screen === 'pause') {
    drawHud(ctx, state);
  }
  if (state.screen === 'levelup') {
    drawHud(ctx, state);
    drawLevelUp(ctx, state);
  } else if (state.screen === 'pause') {
    drawPause(ctx, state);
  } else if (state.screen === 'gameover') {
    drawGameOver(ctx, state);
  } else if (state.screen === 'victory') {
    drawVictory(ctx, state);
  }
}

function drawBeams(ctx, state) {
  if (!state.beams) return;
  const cam = state.camera;
  for (const b of state.beams) {
    const a = Math.max(0, b.life / b.maxLife);
    ctx.globalAlpha = a;
    if (b.spark) {
      ctx.strokeStyle = '#c9b8ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const mx = (b.x1 + b.x2) / 2 + (Math.random() - 0.5) * 18;
      const my = (b.y1 + b.y2) / 2 + (Math.random() - 0.5) * 18;
      ctx.moveTo(b.x1 - cam.x, b.y1 - cam.y);
      ctx.lineTo(mx - cam.x, my - cam.y);
      ctx.lineTo(b.x2 - cam.x, b.y2 - cam.y);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 10 * a + 2;
      ctx.beginPath();
      ctx.moveTo(b.x1 - cam.x, b.y1 - cam.y);
      ctx.lineTo(b.x2 - cam.x, b.y2 - cam.y);
      ctx.stroke();
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.x1 - cam.x, b.y1 - cam.y);
      ctx.lineTo(b.x2 - cam.x, b.y2 - cam.y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// Click handling for menus: title, level-up cards, results screens.
export function handleClick(state, x, y) {
  if (state.screen === 'title') {
    startRun(state);
    return;
  }
  if (state.screen === 'levelup') {
    for (const card of state.uiCards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        applyBlessing(state, state.choices[card.index]);
        return;
      }
    }
    return;
  }
  if (state.screen === 'gameover' || state.screen === 'victory') {
    startRun(state);
  }
}

export { MINUTE_TABLE };

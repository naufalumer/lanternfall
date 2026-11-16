// Lanternfall — the Hollow's creatures. One file, one job: it knows how
// each kind moves and fights, and how the director picks what to send.
import { CONFIG, ENEMY_TYPES, MINUTE_TABLE } from './config.js';

export function makeEnemy(kind, x, y, hpScale, elite, speedScale) {
  const t = ENEMY_TYPES[kind];
  const hp = Math.round(t.hp * hpScale * (elite ? 3.2 : 1));
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    hp,
    maxHp: hp,
    speed: t.speed * (elite ? 0.85 : 1) * (speedScale || 1),
    damage: t.damage * (elite ? 1.5 : 1),
    radius: t.radius * (elite ? 1.5 : 1),
    xp: t.xp * (elite ? 4 : 1),
    score: t.score * (elite ? 4 : 1),
    color: t.color,
    elite: !!elite,
    flash: 0,
    dead: false,
    touchCd: 0,
    spitCd: 2,
    slow: 0,
    slowT: 0,
    phase: Math.random() * Math.PI * 2,
  };
}

export function makeWarden(x, y, minute) {
  const hp = Math.round(CONFIG.wardenHp * (1 + (minute - 1) * 0.45));
  return {
    kind: 'warden',
    x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    hp, maxHp: hp,
    speed: 52, damage: 25, radius: 42, xp: 25, score: 250,
    color: '#c98aff', elite: true, flash: 0, dead: false,
    touchCd: 0, spitCd: 3, slow: 0, slowT: 0,
    phase: 0, charging: 0, chargeDir: 0,
  };
}

export function makeKing(x, y) {
  const hp = CONFIG.kingHp;
  return {
    kind: 'king',
    x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    hp, maxHp: hp,
    speed: 46, damage: 30, radius: 56, xp: 60, score: 1000,
    color: '#ff5c7a', elite: true, flash: 0, dead: false,
    touchCd: 0, spitCd: 4, slow: 0, slowT: 0,
    phase: 0, charging: 0, chargeDir: 0, summonCd: 6, burstCd: 8,
  };
}

// The director: how many creatures, of which kinds, this minute.
export function pickKind(rng, t) {
  const minute = Math.min(MINUTE_TABLE.length - 1, Math.floor(t / 60));
  const table = MINUTE_TABLE[minute];
  return rng.pick(table);
}

export function hpScaleAt(t) {
  return 1 + (t / 60) * 0.55;
}

// The Hollow gets faster as the night deepens.
export function speedScaleAt(t) {
  return 1 + (t / 60) * 0.07;
}

export function spawnPoint(rng, player, viewW, viewH) {
  // Just outside the visible ring, on a random bearing from the player.
  const a = rng.angle();
  const r = Math.hypot(viewW, viewH) / 2 + rng.range(30, 120);
  return { x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r };
}

// One enemy's steering for a frame. Returns nothing; mutates the enemy.
export function steerEnemy(state, e, dt) {
  const p = state.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  let mx = nx;
  let my = ny;
  if (e.kind === 'spitter') {
    // Keep a firing distance: approach when far, back off when close.
    if (d < 230) { mx = -nx; my = -ny; }
    else if (d < 300) { mx = 0; my = 0; }
  }
  if (e.kind === 'skitter') {
    // Weave side to side so the swarm never walks in a straight line.
    const wob = Math.sin(state.time * 5 + e.phase) * 0.7;
    const px = -ny * wob;
    const py = nx * wob;
    mx += px;
    my += py;
    const m = Math.hypot(mx, my) || 1;
    mx /= m;
    my /= m;
  }
  const slowMul = e.slowT > 0 ? 1 - e.slow : 1;
  const sp = e.speed * slowMul;
  e.vx = mx * sp;
  e.vy = my * sp;
  e.x += (e.vx + e.kx) * dt;
  e.y += (e.vy + e.ky) * dt;
  e.kx *= 0.86;
  e.ky *= 0.86;
  if (e.slowT > 0) e.slowT -= dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.touchCd > 0) e.touchCd -= dt;
}

// Warden charge: telegraph, then a fast lunge at the player.
export function steerWarden(state, e, dt) {
  const p = state.player;
  if (e.charging > 0) {
    e.charging -= dt;
    if (e.charging <= 0) {
      e.vx = Math.cos(e.chargeDir) * 520;
      e.vy = Math.sin(e.chargeDir) * 520;
      state.shake = Math.max(state.shake, 6);
    }
    return;
  }
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d < 420 && state.rng.chance(dt * 0.5)) {
    e.charging = 0.7;
    e.chargeDir = Math.atan2(dy, dx);
    e.vx = 0;
    e.vy = 0;
    return;
  }
  e.vx = (dx / d) * e.speed;
  e.vy = (dy / d) * e.speed;
  e.x += (e.vx + e.kx) * dt;
  e.y += (e.vy + e.ky) * dt;
  e.kx *= 0.86;
  e.ky *= 0.86;
  if (e.flash > 0) e.flash -= dt;
  if (e.touchCd > 0) e.touchCd -= dt;
}

// The Hollow King: slow pursuit, summons wisps, fires radial bursts.
export function steerKing(state, e, dt) {
  steerWarden(state, e, dt);
  e.summonCd -= dt;
  if (e.summonCd <= 0) {
    e.summonCd = 6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + state.rng.range(-0.3, 0.3);
      state.spawnQueue.push({ kind: 'wisp', x: e.x + Math.cos(a) * 70, y: e.y + Math.sin(a) * 70, hpScale: 1 });
    }
    state.particles.ring(e.x, e.y, '#ff5c7a', 130);
  }
  e.burstCd -= dt;
  if (e.burstCd <= 0) {
    e.burstCd = 8;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      state.bullets.push({
        x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
        radius: 8, damage: 12, life: 4, hostile: true, color: '#ff5c7a',
      });
    }
    state.audio.play('boss');
  }
}

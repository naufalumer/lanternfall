// Lanternfall — the five weapons. One file, one job: it knows what each
// weapon does at each level and fires it, so the game only ticks timers
// and asks for the nearest targets.
import { WEAPONS } from './config.js';

export function weaponStats(id, level, passives) {
  const def = WEAPONS[id];
  const s = {};
  for (const key of Object.keys(def.base)) {
    s[key] = def.base[key] + def.perLevel[key] * (level - 1);
  }
  const might = (passives.might || 0) * 0.12;
  const lantern = (passives.lantern || 0) * 0.05;
  s.damage = Math.round(s.damage * (1 + might + lantern));
  if (s.radius !== undefined) s.radius *= 1 + (passives.lantern || 0) * 0.0;
  return s;
}

export function weaponCooldown(id, level, passives) {
  const base = WEAPONS[id].cooldown;
  if (base === 0) return 0;
  const haste = (passives.haste || 0) * 0.1;
  return base * (1 - Math.min(0.5, haste));
}

// Distance from (x, y) to the closest enemy, and that enemy.
export function nearestEnemy(enemies, x, y, maxRange) {
  let best = null;
  let bestD = maxRange * maxRange;
  for (const e of enemies) {
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

export function enemiesInRadius(enemies, x, y, radius) {
  const out = [];
  const r2 = radius * radius;
  for (const e of enemies) {
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= r2) out.push(e);
  }
  return out;
}

// Fire one weapon. `fire` collects the visual events the game should show
// (beams, sparks, rings) so weapons stay pure damage logic.
export function fireWeapon(state, id, level, fire) {
  const p = state.player;
  const stats = weaponStats(id, level, state.passives);
  const dmg = stats.damage;
  if (id === 'flare') {
    const hit = enemiesInRadius(state.enemies, p.x, p.y, stats.radius);
    for (const e of hit) {
      damageEnemy(state, e, dmg, p.x, p.y, stats.knock);
    }
    fire.ring(p.x, p.y, '#ffd98a', stats.radius);
    state.audio.play('flare');
  } else if (id === 'beam') {
    const target = nearestEnemy(state.enemies, p.x, p.y, stats.range);
    if (!target) return;
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let pierced = 0;
    const sorted = state.enemies
      .map((e) => ({ e, t: (e.x - p.x) * dx + (e.y - p.y) * dy, d: Math.abs((e.x - p.x) * -dy + (e.y - p.y) * dx) }))
      .filter((o) => o.t > 0 && o.t < stats.range && o.d < eRadius(o.e) + stats.width)
      .sort((a, b) => a.t - b.t);
    for (const o of sorted) {
      if (pierced >= stats.pierce) break;
      damageEnemy(state, o.e, dmg, p.x, p.y, 60);
      pierced++;
    }
    fire.beam(p.x, p.y, p.x + dx * stats.range, p.y + dy * stats.range);
    state.audio.play('beam');
  } else if (id === 'spark') {
    let from = { x: p.x, y: p.y };
    const hitSet = new Set();
    let jumps = stats.jumps;
    let last = null;
    while (jumps > 0) {
      const target = nearestEnemy(state.enemies.filter((e) => !hitSet.has(e)), from.x, from.y, stats.range);
      if (!target) break;
      damageEnemy(state, target, dmg, from.x, from.y, 40);
      fire.spark(from.x, from.y, target.x, target.y);
      hitSet.add(target);
      last = target;
      from = target;
      jumps--;
    }
    if (last) state.audio.play('spark');
  }
}

function eRadius(e) {
  return e.radius;
}

// Shared damage path: hurt the enemy, show the number, kill it if spent.
export function damageEnemy(state, e, dmg, fromX, fromY, knock) {
  if (e.dead) return;
  e.hp -= dmg;
  e.flash = 0.12;
  state.particles.text(e.x, e.y - e.radius - 6, String(dmg), '#ffe9a8', 14);
  state.stats.damage += dmg;
  if (knock && knock > 0) {
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    e.kx += (dx / d) * knock;
    e.ky += (dy / d) * knock;
  }
  if (e.hp <= 0) killEnemy(state, e);
}

export function killEnemy(state, e) {
  if (e.dead) return;
  e.dead = true;
  state.stats.kills++;
  const combo = state.combo;
  const mult = 1 + combo.count * 0.05;
  const gained = Math.round(e.score * mult);
  state.score += gained;
  state.combo.count = Math.min(40, state.combo.count + 1);
  state.combo.timer = 2.5;
  state.particles.burst(e.x, e.y, e.kind === 'brute' || e.kind === 'warden' || e.kind === 'king' ? 26 : 12, e.color, 190, 0.6, 3.5);
  state.particles.souls(e.x, e.y, 3);
  state.audio.play('kill');
  dropGems(state, e);
  // A small mercy: one kill in thirty leaves a heart behind.
  if (state.rng.chance(0.03)) {
    state.pickups.push({ kind: 'heart', x: e.x, y: e.y, life: 18, small: true });
  }
  if (e.kind === 'shade') {
    for (let i = 0; i < 2; i++) {
      state.spawnQueue.push({ kind: 'wisp', x: e.x + (i === 0 ? -14 : 14), y: e.y, hpScale: 0.7 });
    }
  }
  if (e.kind === 'warden' || e.kind === 'king') {
    state.particles.ring(e.x, e.y, '#ffd98a', 200);
    state.shake = Math.max(state.shake, 10);
    state.audio.play('boss');
    dropHeart(state, e.x, e.y);
  }
}

function dropGems(state, e) {
  const n = e.xp;
  for (let i = 0; i < n; i++) {
    const a = state.rng.angle();
    const d = state.rng.range(6, 26);
    state.gems.push({
      x: e.x + Math.cos(a) * d,
      y: e.y + Math.sin(a) * d,
      value: 1,
      vx: Math.cos(a) * 30,
      vy: Math.sin(a) * 30,
      life: 25,
    });
  }
}

function dropHeart(state, x, y) {
  state.pickups.push({ kind: 'heart', x, y, life: 20 });
}

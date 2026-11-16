// Lanternfall — the Keeper: health, experience, levels and the blessing
// draft. One file, one job: it owns progression, so the game only asks
// it to add experience and to roll the three choices.
import { CONFIG, WEAPONS, PASSIVES, MAX_WEAPONS } from './config.js';

export function makePlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    radius: CONFIG.player.radius,
    hp: CONFIG.player.maxHp,
    maxHp: CONFIG.player.maxHp,
    level: 1,
    xp: 0,
    xpNext: CONFIG.xpForLevel(1),
    speed: CONFIG.player.speed,
    facing: 0,
    moving: false,
    dashCd: 0,
    dashT: 0,
    dashDir: 0,
    invuln: 0,
    hurtFlash: 0,
    weapons: { flare: 1 },
    timers: { flare: 0, beam: 0, spark: 0 },
    orbitAngle: 0,
    walkCycle: 0,
  };
}

export function playerSpeed(state) {
  const p = state.player;
  return p.speed * (1 + (state.passives.swift || 0) * 0.08);
}

export function pickupRadius(state) {
  return CONFIG.player.pickupRadius * (1 + (state.passives.magnet || 0) * 0.45);
}

export function lightRadius(state) {
  return CONFIG.player.lightRadius + (state.passives.lantern || 0) * 35;
}

export function addXp(state, amount) {
  const p = state.player;
  p.xp += amount;
  state.stats.gems += amount;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = CONFIG.xpForLevel(p.level);
    state.pendingLevels += 1;
  }
  if (state.pendingLevels > 0 && state.screen === 'play') {
    openBlessings(state);
  }
}

// Roll three blessing choices. Weapons the Keeper does not own yet appear
// as new weapons; owned ones as upgrades; passives round out the draft.
export function rollBlessings(state, rng) {
  const p = state.player;
  const pool = [];
  for (const [id, def] of Object.entries(WEAPONS)) {
    const lvl = p.weapons[id] || 0;
    if (lvl === 0 && Object.keys(p.weapons).length < MAX_WEAPONS) {
      pool.push({ type: 'new', id, name: def.name, blurb: def.blurb, weight: 3 });
    } else if (lvl > 0 && lvl < def.maxLevel) {
      pool.push({ type: 'upgrade', id, name: def.name, blurb: `Raise ${def.name} to level ${lvl + 1}.`, weight: 3 });
    }
  }
  for (const [id, def] of Object.entries(PASSIVES)) {
    const lvl = state.passives[id] || 0;
    if (lvl < def.max) {
      pool.push({ type: 'passive', id, name: def.name, blurb: def.blurb, weight: 2 });
    }
  }
  if (pool.length === 0) {
    pool.push({ type: 'heal', id: 'heal', name: 'Warm Meal', blurb: 'Restore 40 health.', weight: 1 });
  }
  const picks = [];
  const bag = [...pool];
  while (picks.length < 3 && bag.length > 0) {
    let total = 0;
    for (const c of bag) total += c.weight;
    let roll = rng.float() * total;
    let idx = 0;
    for (let i = 0; i < bag.length; i++) {
      roll -= bag[i].weight;
      if (roll <= 0) { idx = i; break; }
    }
    picks.push(bag.splice(idx, 1)[0]);
  }
  return picks;
}

export function openBlessings(state) {
  state.pendingLevels -= 1;
  state.choices = rollBlessings(state, state.rng);
  state.screen = 'levelup';
  state.audio.play('levelup');
  state.particles.ring(state.player.x, state.player.y, '#ffd98a', 160);
}

export function applyBlessing(state, choice) {
  const p = state.player;
  if (choice.type === 'new') {
    p.weapons[choice.id] = 1;
    p.timers[choice.id] = 0;
  } else if (choice.type === 'upgrade') {
    p.weapons[choice.id] += 1;
  } else if (choice.type === 'passive') {
    state.passives[choice.id] = (state.passives[choice.id] || 0) + 1;
    if (choice.id === 'vitality') {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    }
  } else if (choice.type === 'heal') {
    p.hp = Math.min(p.maxHp, p.hp + 40);
  }
  state.audio.play('pick');
  if (state.pendingLevels > 0) {
    openBlessings(state);
  } else {
    state.screen = 'play';
  }
}

export function hurtPlayer(state, dmg) {
  const p = state.player;
  if (p.invuln > 0 || p.dashT > 0 || state.screen !== 'play') return;
  p.hp -= dmg;
  p.invuln = CONFIG.player.hurtInvuln;
  p.hurtFlash = 0.25;
  state.shake = Math.max(state.shake, 7);
  state.hitStop = 0.06;
  state.particles.burst(p.x, p.y, 14, '#ff5c7a', 200, 0.5, 3.5);
  state.audio.play('hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    state.screen = 'gameover';
    state.audio.play('defeat');
    state.particles.burst(p.x, p.y, 40, '#ffd98a', 260, 1.0, 4);
    state.particles.ring(p.x, p.y, '#ff5c7a', 220);
    saveBest(state, false);
  }
}

export function healPlayer(state, amount) {
  const p = state.player;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  state.particles.text(p.x, p.y - 30, `+${amount}`, '#7dff8a', 16);
}

export function saveBest(state, victory) {
  try {
    const prev = JSON.parse(localStorage.getItem('lanternfall-best') || '{}');
    const best = {
      time: Math.max(prev.time || 0, Math.floor(state.time)),
      kills: Math.max(prev.kills || 0, state.stats.kills),
      level: Math.max(prev.level || 0, state.player.level),
      wins: (prev.wins || 0) + (victory ? 1 : 0),
    };
    localStorage.setItem('lanternfall-best', JSON.stringify(best));
    state.best = best;
  } catch (err) {
    state.best = state.best || { time: 0, kills: 0, level: 0, wins: 0 };
  }
}

export function loadBest() {
  try {
    return JSON.parse(localStorage.getItem('lanternfall-best') || '{}');
  } catch (err) {
    return {};
  }
}

// Lanternfall — staged screenshot scenes. One file, one job: it builds a
// deterministic view of each screen (?shot=title|play|levelup|victory)
// from a fixed seed, so the screenshots are real renders of the game's
// own code and repeatable to the pixel.
import { CONFIG } from './config.js';
import { createState, startRun, step, STEP } from './game.js';
import { damageEnemy } from './weapons.js';
import { applyBlessing, openBlessings } from './player.js';

// A simple bot that plays through the real input path: it chases the
// nearest ember, circles when there is none, and dashes out of crowds.
function botInput(state) {
  return {
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    moveVector() {
      const p = state.player;
      // Kite: if a shadow is about to touch us, run from it first.
      let near = null;
      let nearD = 95 * 95;
      for (const e of state.enemies) {
        const dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
        if (d < nearD) { nearD = d; near = e; }
      }
      if (near) {
        const dx = p.x - near.x, dy = p.y - near.y, d = Math.hypot(dx, dy) || 1;
        return { x: dx / d, y: dy / d };
      }
      let tx = CONFIG.worldWidth / 2;
      let ty = CONFIG.worldHeight / 2;
      let best = null;
      let bestD = 320 * 320;
      for (const g of state.gems) {
        const dx = g.x - p.x;
        const dy = g.y - p.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = g; }
      }
      if (best) { tx = best.x; ty = best.y; }
      else {
        const a = state.time * 0.45;
        tx = p.x + Math.cos(a) * 120;
        ty = p.y + Math.sin(a) * 120;
      }
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    },
    pressed(key) {
      if (key === ' ') {
        let near = 0;
        for (const e of state.enemies) {
          const dx = e.x - state.player.x;
          const dy = e.y - state.player.y;
          if (dx * dx + dy * dy < 130 * 130) near++;
        }
        return near >= 6 && state.player.dashCd <= 0;
      }
      return false;
    },
    endFrame() {},
  };
}

// Run the simulation forward, letting the bot pick the first blessing
// whenever a level-up opens, until `seconds` have passed or the run ends.
function simulate(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (state.screen === 'levelup') {
      applyBlessing(state, state.choices[0]);
      continue;
    }
    if (state.screen !== 'play') break;
    step(state, STEP);
  }
}

export function stageShot(scene, seed) {
  const state = createState(seed);
  state.audio.enabled = false;
  if (scene === 'title') {
    state.time = 3.2;
    state.screen = 'title';
    return state;
  }
  state.input = botInput(state);
  startRun(state);
  if (scene === 'play') {
    simulate(state, 72);
    if (state.screen === 'levelup') applyBlessing(state, state.choices[0]);
    state.screen = 'play';
    state.time = 72;
    return state;
  }
  if (scene === 'levelup') {
    simulate(state, 55);
    // If no level-up opened yet, grant the experience for one.
    if (state.screen !== 'levelup') {
      state.player.xp = state.player.xpNext - 1;
      state.gems.push({ x: state.player.x + 10, y: state.player.y, value: 2, vx: 0, vy: 0, life: 25 });
      simulate(state, 2);
    }
    if (state.screen !== 'levelup') {
      // Fall back: force the draft open so the scene still shows it.
      state.pendingLevels = 1;
      openBlessings(state);
    }
    return state;
  }
  if (scene === 'victory') {
    // Play a full run for real with a strong late-game build, then fell
    // the Hollow King: the results screen shows the run's true numbers.
    state.player.weapons = { flare: 5, orbit: 5, beam: 5, spark: 5 };
    state.player.maxHp = 1000;
    state.player.hp = 1000;
    state.passives = { might: 3, haste: 3, magnet: 1 };
    simulate(state, 310);
    const king = state.enemies.find((e) => e.kind === 'king');
    if (king) {
      damageEnemy(state, king, 999999, state.player.x, state.player.y, 0);
      step(state, STEP);
    }
    state.screen = 'victory';
    return state;
  }
  return state;
}

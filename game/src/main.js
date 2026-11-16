// Lanternfall — bootstrap and the main loop. One file, one job: it wires
// the canvas, the input and the simulation together, runs the fixed-step
// loop, and stages deterministic screenshot scenes from ?shot=.
import { CONFIG } from './config.js';
import { createState, startRun, step, render, handleClick, STEP } from './game.js';
import { applyBlessing } from './player.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.viewWidth;
canvas.height = CONFIG.viewHeight;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '7', 10) || 7;

let state;

if (shot) {
  // Screenshot mode: stage the scene, render one frame, signal ready.
  state = stageShot(shot, seed);
  state.mouse = { x: 0, y: 0 };
  render(state, ctx);
  window.__game = { state };
  window.__shotReady = true;
} else {
  state = createState((Math.random() * 0xffffffff) >>> 0, canvas);
  window.__game = { state, startRun, step, createState, STEP };
  wireInput(state);
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    state.mouse.x = state.input.mouse.x;
    state.mouse.y = state.input.mouse.y;
    if (state.hitStop > 0) {
      state.hitStop -= dt;
    } else {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        step(state, STEP);
        acc -= STEP;
        n++;
      }
      if (n === 5) acc = 0;
    }
    render(state, ctx);
    state.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function wireInput(state) {
  const input = state.input;
  input.onKey = (key) => {
    state.audio.ensure();
    if (key === 'enter') {
      if (state.screen === 'title') startRun(state);
      else if (state.screen === 'gameover' || state.screen === 'victory') startRun(state);
    } else if (key === 'p' || key === 'escape') {
      if (state.screen === 'play') state.screen = 'pause';
      else if (state.screen === 'pause') state.screen = 'play';
    } else if (key === 'm') {
      state.audio.setMuted(!state.audio.muted);
    } else if (key === 'r') {
      if (state.screen !== 'title') startRun(state);
    } else if (state.screen === 'levelup' && ['1', '2', '3'].includes(key)) {
      const idx = Number.parseInt(key, 10) - 1;
      if (state.choices[idx]) applyBlessing(state, state.choices[idx]);
    }
  };
  input.onClick = (x, y) => {
    state.audio.ensure();
    handleClick(state, x, y);
  };
}

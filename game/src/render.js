// Lanternfall — every pixel of the world. One file, one job: it draws
// the forest, the creatures and the light, so the game only updates
// positions and never touches the canvas itself.
import { CONFIG, PLAYER_COLORS } from './config.js';
import { lightRadius } from './player.js';

let darkCanvas = null;

function getDarkCanvas(w, h) {
  if (!darkCanvas || darkCanvas.width !== w || darkCanvas.height !== h) {
    darkCanvas = document.createElement('canvas');
    darkCanvas.width = w;
    darkCanvas.height = h;
  }
  return darkCanvas;
}

export function drawWorld(ctx, state) {
  const { viewWidth: W, viewHeight: H } = CONFIG;
  const cam = state.camera;
  ctx.save();
  drawSky(ctx, state);
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawGround(ctx, state);
  drawGems(ctx, state);
  drawPickups(ctx, state);
  drawBullets(ctx, state);
  drawEnemies(ctx, state);
  drawOrbit(ctx, state);
  drawPlayer(ctx, state);
  state.particles.draw(ctx);
  ctx.restore();
  drawDarkness(ctx, state);
  drawEyes(ctx, state);
}

function drawSky(ctx, state) {
  const { viewWidth: W, viewHeight: H } = CONFIG;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0d24');
  g.addColorStop(0.55, '#131736');
  g.addColorStop(1, '#1d1440');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Parallax tree ridges: two dark silhouettes drifting with the camera.
  const cam = state.camera;
  drawRidge(ctx, state, 0.25, '#0d1030', 90, 26);
  drawRidge(ctx, state, 0.5, '#0a0c26', 130, 40);
  // Fireflies drift through the dark.
  ctx.fillStyle = '#ffe9a8';
  for (const f of state.fireflies) {
    const sx = ((f.x - cam.x * 0.7) % W + W) % W;
    const sy = ((f.y - cam.y * 0.7) % H + H) % H;
    ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(state.time * f.tw + f.ph));
    ctx.beginPath();
    ctx.arc(sx, sy, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawRidge(ctx, state, par, color, base, amp) {
  const { viewWidth: W, viewHeight: H } = CONFIG;
  const cam = state.camera;
  const off = cam.x * par;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 40) {
    const wx = x + off;
    const h = base + Math.sin(wx * 0.011) * amp + Math.sin(wx * 0.027 + 1.7) * amp * 0.5;
    ctx.lineTo(x, H - h);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

function drawGround(ctx, state) {
  const cam = state.camera;
  const { worldWidth, worldHeight } = CONFIG;
  // Forest floor.
  ctx.fillStyle = '#171a2e';
  ctx.fillRect(0, 0, worldWidth, worldHeight);
  // Mossy patches.
  for (const m of state.moss) {
    if (m.x < cam.x - 60 || m.x > cam.x + CONFIG.viewWidth + 60) continue;
    if (m.y < cam.y - 60 || m.y > cam.y + CONFIG.viewHeight + 60) continue;
    ctx.fillStyle = m.color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.r, m.r * 0.6, m.rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // World edge: a ring of thorns hemming the clearing in.
  ctx.strokeStyle = '#2a2350';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, worldWidth - 10, worldHeight - 10);
  ctx.strokeStyle = '#3d2f6b';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, worldWidth - 28, worldHeight - 28);
}

function drawGems(ctx, state) {
  for (const g of state.gems) {
    const bob = Math.sin(state.time * 4 + g.x) * 2;
    ctx.fillStyle = '#8be9ff';
    ctx.beginPath();
    ctx.moveTo(g.x, g.y - 7 + bob);
    ctx.lineTo(g.x + 5, g.y + bob);
    ctx.lineTo(g.x, g.y + 7 + bob);
    ctx.lineTo(g.x - 5, g.y + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e6fbff';
    ctx.beginPath();
    ctx.arc(g.x, g.y + bob, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups(ctx, state) {
  for (const pk of state.pickups) {
    if (pk.kind === 'heart') {
      const s = 10 + Math.sin(state.time * 5) * 2;
      ctx.fillStyle = '#ff5c7a';
      ctx.beginPath();
      ctx.arc(pk.x - s * 0.4, pk.y - s * 0.2, s * 0.55, 0, Math.PI * 2);
      ctx.arc(pk.x + s * 0.4, pk.y - s * 0.2, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pk.x - s * 0.95, pk.y);
      ctx.lineTo(pk.x + s * 0.95, pk.y);
      ctx.lineTo(pk.x, pk.y + s);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawBullets(ctx, state) {
  for (const b of state.bullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies(ctx, state) {
  for (const e of state.enemies) {
    if (e.dead) continue;
    const flash = e.flash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    drawEnemyBody(ctx, e, flash);
    ctx.restore();
    if (e.elite && e.maxHp > 100) {
      const w = e.radius * 2.2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 16, w, 6);
      ctx.fillStyle = e.kind === 'king' ? '#ff5c7a' : '#c98aff';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 16, w * Math.max(0, e.hp / e.maxHp), 6);
    }
  }
}

function drawEnemyBody(ctx, e, flash) {
  const r = e.radius;
  const body = flash ? '#ffffff' : e.color;
  ctx.fillStyle = body;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  if (e.kind === 'wisp') {
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r * 0.9, Math.PI, 0);
    ctx.lineTo(r * 0.9, r * 0.5);
    ctx.lineTo(r * 0.45, r * 0.9);
    ctx.lineTo(0, r * 0.5);
    ctx.lineTo(-r * 0.45, r * 0.9);
    ctx.lineTo(-r * 0.9, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (e.kind === 'skitter') {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.55;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (e.kind === 'brute') {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'spitter') {
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'shade') {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r, -r * 0.2, r * 0.8, r * 0.8);
    ctx.lineTo(0, r * 0.4);
    ctx.lineTo(-r * 0.8, r * 0.8);
    ctx.quadraticCurveTo(-r, -r * 0.2, 0, -r);
    ctx.fill();
    ctx.stroke();
  } else {
    // Warden and King: horned shadow with a crown of spikes.
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const a = -Math.PI / 2 + i * 0.45;
      ctx.moveTo(Math.cos(a - 0.12) * r * 0.8, Math.sin(a - 0.12) * r * 0.8);
      ctx.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45);
      ctx.lineTo(Math.cos(a + 0.12) * r * 0.8, Math.sin(a + 0.12) * r * 0.8);
    }
    ctx.fillStyle = flash ? '#ffffff' : '#2a1b4d';
    ctx.fill();
    if (e.kind === 'king') {
      ctx.strokeStyle = '#ffd98a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Eyes: two pale dots that stare at the Keeper.
  ctx.fillStyle = '#ffffff';
  const ex = r * 0.34;
  const ey = -r * 0.15;
  ctx.beginPath();
  ctx.arc(-ex, ey, Math.max(2, r * 0.14), 0, Math.PI * 2);
  ctx.arc(ex, ey, Math.max(2, r * 0.14), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.kind === 'king' ? '#ff2e55' : '#1a1030';
  ctx.beginPath();
  ctx.arc(-ex, ey, Math.max(1, r * 0.07), 0, Math.PI * 2);
  ctx.arc(ex, ey, Math.max(1, r * 0.07), 0, Math.PI * 2);
  ctx.fill();
}

function drawOrbit(ctx, state) {
  const p = state.player;
  const lvl = p.weapons.orbit || 0;
  if (lvl === 0) return;
  const count = 2 + (lvl - 1);
  const radius = 95 + (lvl - 1) * 8;
  for (let i = 0; i < count; i++) {
    const a = p.orbitAngle + (i / count) * Math.PI * 2;
    const x = p.x + Math.cos(a) * radius;
    const y = p.y + Math.sin(a) * radius;
    const g = ctx.createRadialGradient(x, y, 1, x, y, 14);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.4, '#ffb347');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (state.screen === 'gameover') return;
  const bob = p.moving ? Math.sin(p.walkCycle) * 2 : Math.sin(state.time * 2) * 1.2;
  const blink = p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.4);
  if (blink) ctx.globalAlpha = 0.35;
  // Cloak.
  ctx.fillStyle = PLAYER_COLORS.cloak;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(14, -8, 16, 14);
  ctx.lineTo(-16, 14);
  ctx.quadraticCurveTo(-14, -8, 0, -20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Trim.
  ctx.strokeStyle = PLAYER_COLORS.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, 8);
  ctx.lineTo(13, 8);
  ctx.stroke();
  // Hood and face.
  ctx.fillStyle = '#3a2a12';
  ctx.beginPath();
  ctx.arc(0, -16, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PLAYER_COLORS.skin;
  ctx.beginPath();
  ctx.arc(p.facing >= 0 ? 2 : -2, -15, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1030';
  ctx.beginPath();
  ctx.arc(p.facing >= 0 ? 4 : -4, -16, 1.6, 0, Math.PI * 2);
  ctx.arc(p.facing >= 0 ? 0 : 0, -16, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // The lantern, swinging at the Keeper's side.
  const swing = Math.sin(state.time * 2.2) * 0.25 + (p.moving ? Math.sin(p.walkCycle) * 0.15 : 0);
  const lx = 20;
  const ly = 2 + Math.sin(swing) * 3;
  ctx.strokeStyle = '#6b4a1f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, -2);
  ctx.lineTo(lx, ly - 6);
  ctx.stroke();
  const lg = ctx.createRadialGradient(lx, ly + 4, 1, lx, ly + 4, 16);
  lg.addColorStop(0, '#fff6d8');
  lg.addColorStop(0.5, '#ffc95e');
  lg.addColorStop(1, 'rgba(255,150,50,0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(lx, ly + 4, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1a08';
  ctx.fillRect(lx - 5, ly - 4, 10, 12);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(lx - 3, ly - 1, 6, 7);
  ctx.restore();
}

function drawDarkness(ctx, state) {
  const { viewWidth: W, viewHeight: H } = CONFIG;
  const cam = state.camera;
  const dark = getDarkCanvas(W, H);
  const dctx = dark.getContext('2d');
  dctx.clearRect(0, 0, W, H);
  dctx.globalCompositeOperation = 'source-over';
  dctx.fillStyle = 'rgba(3,4,16,0.78)';
  dctx.fillRect(0, 0, W, H);
  dctx.globalCompositeOperation = 'destination-out';
  punchHole(dctx, state.player.x - cam.x, state.player.y - cam.y, lightRadius(state));
  for (const g of state.gems) {
    punchHole(dctx, g.x - cam.x, g.y - cam.y, 26);
  }
  for (const pk of state.pickups) {
    punchHole(dctx, pk.x - cam.x, pk.y - cam.y, 40);
  }
  ctx.drawImage(dark, 0, 0);
}

function punchHole(dctx, x, y, r) {
  const g = dctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  dctx.fillStyle = g;
  dctx.beginPath();
  dctx.arc(x, y, r, 0, Math.PI * 2);
  dctx.fill();
}

// After the dark, the Hollow's eyes glow back at the player.
function drawEyes(ctx, state) {
  const cam = state.camera;
  ctx.fillStyle = '#ffd7ef';
  for (const e of state.enemies) {
    if (e.dead) continue;
    const sx = e.x - cam.x;
    const sy = e.y - cam.y;
    if (sx < -60 || sx > CONFIG.viewWidth + 60 || sy < -60 || sy > CONFIG.viewHeight + 60) continue;
    const ex = e.radius * 0.34;
    const ey = -e.radius * 0.15;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(sx - ex, sy + ey, Math.max(1.5, e.radius * 0.1), 0, Math.PI * 2);
    ctx.arc(sx + ex, sy + ey, Math.max(1.5, e.radius * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

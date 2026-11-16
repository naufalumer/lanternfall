// Lanternfall — the HUD and every screen. One file, one job: it draws
// all text and menus on the canvas, so the game never mixes interface
// code into its simulation.
import { CONFIG, WEAPONS } from './config.js';

const TITLE_FONT = 'Georgia, serif';
const UI_FONT = 'system-ui, -apple-system, sans-serif';

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function drawHud(ctx, state) {
  const { viewWidth: W } = CONFIG;
  const p = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top bar.
  ctx.fillStyle = 'rgba(5,6,20,0.55)';
  ctx.fillRect(0, 0, W, 64);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(20, 16, 220, 16);
  ctx.fillStyle = p.hp / p.maxHp > 0.35 ? '#ff5c7a' : '#ff2e55';
  ctx.fillRect(20, 16, 220 * Math.max(0, p.hp / p.maxHp), 16);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 16, 220, 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 13px ${UI_FONT}`;
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp} HP`, 28, 28);
  // Experience bar.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(20, 38, 220, 8);
  ctx.fillStyle = '#8be9ff';
  ctx.fillRect(20, 38, 220 * Math.min(1, p.xp / p.xpNext), 8);
  ctx.fillStyle = '#cfeeff';
  ctx.font = `12px ${UI_FONT}`;
  ctx.fillText(`Level ${p.level}`, 250, 28);
  // Timer, centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `bold 26px ${TITLE_FONT}`;
  ctx.fillText(fmtTime(state.time), W / 2, 32);
  ctx.fillStyle = '#b9c0e8';
  ctx.font = `12px ${UI_FONT}`;
  const minute = Math.floor(state.time / 60) + 1;
  const untilKing = Math.max(0, CONFIG.kingArrivesAt - state.time);
  ctx.fillText(state.kingSpawned ? 'THE HOLLOW KING' : `Minute ${minute}  ·  King in ${fmtTime(untilKing)}`, W / 2, 50);
  // Kills and score, right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 15px ${UI_FONT}`;
  ctx.fillText(`Score ${state.score}`, W - 20, 24);
  ctx.fillStyle = '#b9c0e8';
  ctx.font = `13px ${UI_FONT}`;
  ctx.fillText(`${state.stats.kills} banished`, W - 20, 44);
  // Combo.
  if (state.combo.count >= 5) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd98a';
    ctx.font = `bold ${16 + Math.min(10, state.combo.count)}px ${TITLE_FONT}`;
    ctx.fillText(`x${state.combo.count} COMBO`, W / 2, 88);
  }
  // Weapon row, bottom left.
  let wx = 20;
  ctx.textAlign = 'left';
  for (const [id, lvl] of Object.entries(p.weapons)) {
    drawWeaponChip(ctx, wx, CONFIG.viewHeight - 46, WEAPONS[id].name, lvl);
    wx += 132;
  }
  // Dash indicator, bottom right.
  const dashReady = p.dashCd <= 0;
  ctx.textAlign = 'right';
  ctx.fillStyle = dashReady ? '#ffe9a8' : 'rgba(255,255,255,0.4)';
  ctx.font = `bold 13px ${UI_FONT}`;
  ctx.fillText(dashReady ? 'DASH READY  [Space]' : `Dash ${p.dashCd.toFixed(1)}s`, W - 20, CONFIG.viewHeight - 22);
  // Minute banner.
  if (state.banner > 0) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, state.banner);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `bold 34px ${TITLE_FONT}`;
    ctx.fillText(state.bannerText, W / 2, 150);
    ctx.globalAlpha = 1;
  }
}

function drawWeaponChip(ctx, x, y, name, level) {
  ctx.fillStyle = 'rgba(5,6,20,0.6)';
  ctx.fillRect(x, y, 122, 30);
  ctx.strokeStyle = 'rgba(255,233,168,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 122, 30);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `bold 12px ${UI_FONT}`;
  ctx.fillText(name, x + 8, y + 13);
  ctx.fillStyle = '#ffb347';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + 12 + i * 14, y + 23, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = i < level ? '#ffb347' : 'rgba(255,255,255,0.25)';
    ctx.fill();
  }
}

export function drawTitle(ctx, state) {
  const { viewWidth: W, viewHeight: H } = CONFIG;
  ctx.fillStyle = 'rgba(4,5,18,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const glow = 0.75 + Math.sin(state.time * 2) * 0.25;
  ctx.globalAlpha = glow;
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `bold 76px ${TITLE_FONT}`;
  ctx.fillText('LANTERNFALL', W / 2, 190);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#c9b8ff';
  ctx.font = `italic 22px ${TITLE_FONT}`;
  ctx.fillText('Hold the last light against the Hollow.', W / 2, 232);
  ctx.fillStyle = '#e8e4ff';
  ctx.font = `16px ${UI_FONT}`;
  const lines = [
    'WASD or arrows to move  ·  Space to dash through shadows',
    'Your lantern fights on its own. Gather embers, level up,',
    'choose blessings, and banish the Hollow King at 5:00.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 300 + i * 26));
  if (state.best && (state.best.wins > 0 || state.best.time > 0)) {
    ctx.fillStyle = '#8be9ff';
    ctx.font = `15px ${UI_FONT}`;
    ctx.fillText(`Best: ${fmtTime(state.best.time || 0)} survived · ${state.best.kills || 0} banished · ${state.best.wins || 0} kings fallen`, W / 2, 410);
  }
  const pulse = 0.6 + Math.sin(state.time * 3) * 0.4;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `bold 24px ${TITLE_FONT}`;
  ctx.fillText('Press Enter or click to begin', W / 2, 500);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#8a90b8';
  ctx.font = `13px ${UI_FONT}`;
  ctx.fillText('P pause · M mute · R restart', W / 2, 540);
}

export function drawLevelUp(ctx, state) {
  const { viewWidth: W, viewHeight: H } = CONFIG;
  ctx.fillStyle = 'rgba(4,5,18,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `bold 40px ${TITLE_FONT}`;
  ctx.fillText('LEVEL UP', W / 2, 120);
  ctx.fillStyle = '#e8e4ff';
  ctx.font = `18px ${UI_FONT}`;
  ctx.fillText(`The lantern burns brighter. Choose a blessing — press 1, 2 or 3, or click.`, W / 2, 156);
  const cards = state.choices;
  const cw = 300;
  const ch = 210;
  const gap = 28;
  const total = cards.length * cw + (cards.length - 1) * gap;
  let x = (W - total) / 2;
  const y = 210;
  state.uiCards = [];
  cards.forEach((c, i) => {
    const hover = state.mouse.x >= x && state.mouse.x <= x + cw && state.mouse.y >= y && state.mouse.y <= y + ch;
    ctx.fillStyle = hover ? 'rgba(70,52,18,0.95)' : 'rgba(20,18,44,0.95)';
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = hover ? '#ffd98a' : 'rgba(255,233,168,0.45)';
    ctx.lineWidth = hover ? 3 : 1;
    ctx.strokeRect(x, y, cw, ch);
    ctx.fillStyle = '#8be9ff';
    ctx.font = `bold 13px ${UI_FONT}`;
    ctx.fillText(c.type === 'new' ? 'NEW WEAPON' : c.type === 'upgrade' ? 'UPGRADE' : c.type === 'passive' ? 'BLESSING' : 'RELIEF', x + cw / 2, y + 34);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `bold 22px ${TITLE_FONT}`;
    ctx.fillText(c.name, x + cw / 2, y + 74);
    ctx.fillStyle = '#e8e4ff';
    ctx.font = `15px ${UI_FONT}`;
    wrapText(ctx, c.blurb, x + cw / 2, y + 108, cw - 36, 22);
    ctx.fillStyle = '#8a90b8';
    ctx.font = `bold 15px ${UI_FONT}`;
    ctx.fillText(`[${i + 1}]`, x + cw / 2, y + ch - 18);
    state.uiCards.push({ x, y, w: cw, h: ch, index: i });
    x += cw + gap;
  });
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
}

export function drawPause(ctx, state) {
  const { viewWidth: W, viewHeight: H } = CONFIG;
  ctx.fillStyle = 'rgba(4,5,18,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `bold 52px ${TITLE_FONT}`;
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.fillStyle = '#e8e4ff';
  ctx.font = `18px ${UI_FONT}`;
  ctx.fillText('Press P or Esc to return to the dark.  R restarts the run.', W / 2, H / 2 + 34);
}

function drawResults(ctx, state, title, subtitle, color) {
  const { viewWidth: W, viewHeight: H } = CONFIG;
  ctx.fillStyle = 'rgba(4,5,18,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = `bold 56px ${TITLE_FONT}`;
  ctx.fillText(title, W / 2, 170);
  ctx.fillStyle = '#e8e4ff';
  ctx.font = `italic 20px ${TITLE_FONT}`;
  ctx.fillText(subtitle, W / 2, 208);
  const rows = [
    ['Time survived', fmtTime(state.time)],
    ['Shadows banished', String(state.stats.kills)],
    ['Level reached', String(state.player.level)],
    ['Embers gathered', String(state.stats.gems)],
    ['Damage dealt', String(state.stats.damage)],
    ['Score', String(state.score)],
  ];
  ctx.font = `18px ${UI_FONT}`;
  rows.forEach(([label, value], i) => {
    const y = 280 + i * 34;
    ctx.fillStyle = '#b9c0e8';
    ctx.textAlign = 'right';
    ctx.fillText(label, W / 2 - 20, y);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(value, W / 2 + 20, y);
  });
  const pulse = 0.6 + Math.sin(state.time * 3) * 0.4;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `bold 24px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Press R or click to play again', W / 2, 540);
  ctx.globalAlpha = 1;
}

export function drawGameOver(ctx, state) {
  drawResults(ctx, state, 'THE LIGHT GOES OUT', 'The Hollow takes the forest... this time.', '#ff5c7a');
}

export function drawVictory(ctx, state) {
  drawResults(ctx, state, 'THE DAWN RETURNS', 'The Hollow King is banished. The forest breathes again.', '#ffd98a');
}

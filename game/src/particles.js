// Lanternfall — particles, shockwaves and floating text. One file, one
// job: it owns every short-lived visual effect and draws them all, so the
// game only spawns effects and never manages their lifetimes.
import { CONFIG } from './config.js';

export class Particles {
  constructor() {
    this.list = [];
    this.rings = [];
    this.texts = [];
  }

  spawn(x, y, vx, vy, life, size, color, gravity) {
    if (this.list.length >= CONFIG.maxParticles) this.list.shift();
    this.list.push({ x, y, vx, vy, life, maxLife: life, size, color, gravity: gravity || 0 });
  }

  burst(x, y, count, color, speed, life, size) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, 60);
    }
  }

  souls(x, y, count) {
    for (let i = 0; i < count; i++) {
      this.spawn(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 24, -40 - Math.random() * 50,
        0.9 + Math.random() * 0.5, 3 + Math.random() * 3, '#c9b8ff', -30);
    }
  }

  ring(x, y, color, maxR) {
    this.rings.push({ x, y, r: 8, maxR: maxR || 120, life: 0.45, maxLife: 0.45, color });
  }

  text(x, y, str, color, size) {
    if (this.texts.length >= CONFIG.maxTexts) this.texts.shift();
    this.texts.push({ x, y, str, color, size: size || 15, life: 0.85, maxLife: 0.85 });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      const t = 1 - r.life / r.maxLife;
      r.r = 8 + (r.maxR - 8) * (1 - (1 - t) * (1 - t));
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 42 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 + 3 * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.font = `bold ${t.size}px Georgia, serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
  }
}

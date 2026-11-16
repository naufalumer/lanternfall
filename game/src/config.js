// Lanternfall — tuning constants. One file, one job: every number that
// shapes how the game feels lives here so balancing never touches logic.
export const CONFIG = {
  // Canvas and world.
  viewWidth: 1280,
  viewHeight: 720,
  worldWidth: 2600,
  worldHeight: 1900,

  // The run: survive until the Hollow King falls. He arrives at 5:00.
  runMinutes: 5,
  kingArrivesAt: 300,

  // The Keeper.
  player: {
    radius: 16,
    maxHp: 110,
    speed: 205,
    pickupRadius: 85,
    lightRadius: 250,
    dashCooldown: 2.4,
    dashTime: 0.22,
    dashSpeed: 640,
    dashInvuln: 0.4,
    hurtInvuln: 0.7,
  },

  // Experience curve: gems needed to reach the next level.
  xpForLevel(level) {
    return Math.round(5 + level * 4 + Math.pow(level, 1.6) * 1.5);
  },

  // Kill combo: each kill inside the window raises the multiplier.
  comboWindow: 2.5,
  comboStep: 0.05,

  // Enemy population cap keeps the frame budget sane.
  maxAlive: 130,
  maxParticles: 420,
  maxTexts: 40,

  // Spawn director: base interval shrinks as the minutes pass.
  spawnIntervalAt(t) {
    const minute = Math.floor(t / 60);
    return Math.max(0.24, 0.9 - minute * 0.11);
  },
  batchAt(t) {
    const minute = Math.floor(t / 60);
    return 1 + Math.floor(minute / 2);
  },

  // Bosses.
  wardenEvery: 60,
  wardenHp: 950,
  kingHp: 4200,
};

// Enemy kinds. hp, speed, damage, radius, xp gems dropped, score value.
export const ENEMY_TYPES = {
  wisp:   { hp: 14,  speed: 66,  damage: 6,  radius: 14, xp: 1, score: 10, color: '#8f7bff' },
  skitter:{ hp: 9,   speed: 165, damage: 5,  radius: 10, xp: 1, score: 10, color: '#ff7ad9' },
  brute:  { hp: 70,  speed: 36,  damage: 14, radius: 25, xp: 3, score: 25, color: '#ff9a5c' },
  spitter:{ hp: 22,  speed: 46,  damage: 10, radius: 14, xp: 2, score: 20, color: '#7dff8a' },
  shade:  { hp: 34,  speed: 78,  damage: 12, radius: 16, xp: 2, score: 20, color: '#5cc8ff' },
};

// Which kinds the director may send in each minute of the run.
export const MINUTE_TABLE = [
  ['wisp'],
  ['wisp', 'skitter'],
  ['wisp', 'skitter', 'brute'],
  ['wisp', 'skitter', 'brute', 'spitter'],
  ['wisp', 'skitter', 'brute', 'spitter', 'shade'],
  ['wisp', 'skitter', 'brute', 'spitter', 'shade'],
];

// Weapons. level scales: damage, count, area, rate.
export const WEAPONS = {
  flare: {
    name: 'Lantern Flare',
    blurb: 'A pulse of light sears every shadow close by.',
    maxLevel: 5,
    cooldown: 1.45,
    base: { damage: 18, radius: 175, knock: 220 },
    perLevel: { damage: 9, radius: 26, knock: 30 },
  },
  orbit: {
    name: 'Ember Orbit',
    blurb: 'Burning embers circle you and scorch what they touch.',
    maxLevel: 5,
    cooldown: 0,
    base: { damage: 11, count: 2, radius: 95, rot: 2.6 },
    perLevel: { damage: 6, count: 1, radius: 8, rot: 0.35 },
  },
  beam: {
    name: 'Dawn Beam',
    blurb: 'A lance of dawn pierces the nearest shadow and all behind it.',
    maxLevel: 5,
    cooldown: 2.3,
    base: { damage: 30, range: 540, width: 16, pierce: 3 },
    perLevel: { damage: 14, range: 40, width: 3, pierce: 1 },
  },
  spark: {
    name: 'Spark Burst',
    blurb: 'Lightning leaps between the closest shadows.',
    maxLevel: 5,
    cooldown: 1.15,
    base: { damage: 13, jumps: 3, range: 320 },
    perLevel: { damage: 7, jumps: 1, range: 25 },
  },
  thorn: {
    name: 'Thorn Ward',
    blurb: 'Briars ring you: shadows that touch them bleed and slow.',
    maxLevel: 5,
    cooldown: 0,
    base: { damage: 9, radius: 62, slow: 0.45 },
    perLevel: { damage: 5, radius: 9, slow: 0.05 },
  },
};

// Passive blessings offered at level-up.
export const PASSIVES = {
  might:    { name: 'Might',       blurb: '+12% damage on everything.', max: 5 },
  haste:    { name: 'Haste',       blurb: 'Weapons ready 10% sooner.', max: 5 },
  swift:    { name: 'Swift Boots', blurb: '+8% move speed.', max: 5 },
  magnet:   { name: 'Lodestone',   blurb: '+45% pickup radius.', max: 5 },
  vitality: { name: 'Vitality',    blurb: '+25 max health and heal 25.', max: 5 },
  lantern:  { name: 'Bright Wick', blurb: '+35 light radius, +5% damage.', max: 5 },
};

export const MAX_WEAPONS = 4;
export const PLAYER_COLORS = {
  cloak: '#f2b544',
  trim: '#fff3c4',
  skin: '#f7d9a8',
};

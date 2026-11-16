// Lanternfall — seeded random numbers. One file, one job: every random
// choice in the game flows through here, so a staged screenshot scene can
// replay the exact same run from its seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  float() {
    return this.next();
  }
  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }
  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  // Pick one element of an array.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  // Angle in [0, 2 PI).
  angle() {
    return this.next() * Math.PI * 2;
  }
  // True with probability p.
  chance(p) {
    return this.next() < p;
  }
}

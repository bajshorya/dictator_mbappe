// Seedable RNG so the Daily Challenge is identical for everyone.
// When no seed is set, falls back to Math.random (normal play).

let seeded: (() => number) | null = null;

export function setSeed(seed: number | null) {
  if (seed == null) {
    seeded = null;
    return;
  }
  // mulberry32
  let a = seed >>> 0;
  seeded = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random in [0,1) — seeded when a seed is active, else Math.random. */
export function rnd(): number {
  return seeded ? seeded() : Math.random();
}

export function isSeeded(): boolean {
  return seeded != null;
}

/** YYYYMMDD for today's daily challenge. */
export function dailySeed(d = new Date()): number {
  return Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`);
}

export function dailyKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

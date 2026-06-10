import type { Formation, Position, Slot } from "@/lib/types";

// Build slots from rows. Each row is a position category placed at a vertical
// band (y%), with players spread evenly across the width (x%).
// y: 88 = own goal line (GK), 18 = attacking third.
function row(position: Position, y: number, xs: number[]): Slot[] {
  return xs.map((x, i) => ({ id: `${position}-${y}-${i}`, position, x, y }));
}

function spread(n: number): number[] {
  // evenly spaced across 12..88
  if (n === 1) return [50];
  const lo = 14;
  const hi = 86;
  return Array.from({ length: n }, (_, i) => lo + (i * (hi - lo)) / (n - 1));
}

function make(name: string, def: number, mids: number[], fwd: number): Formation {
  const slots: Slot[] = [
    ...row("GK", 90, [50]),
    ...row("DEF", 72, spread(def)),
  ];
  // midfield bands (supports split midfields like 4-2-3-1)
  const bandStart = 56;
  const bandStep = mids.length > 1 ? 18 : 0;
  mids.forEach((count, i) => {
    slots.push(...row("MID", bandStart - i * bandStep, spread(count)));
  });
  slots.push(...row("FWD", 20, spread(fwd)));
  return { name, slots };
}

export const FORMATIONS: Formation[] = [
  make("4-3-3", 4, [3], 3),
  make("4-4-2", 4, [4], 2),
  make("4-2-3-1", 4, [2, 3], 1),
  make("3-5-2", 3, [5], 2),
  make("3-4-3", 3, [4], 3),
  make("5-3-2", 5, [3], 2),
];

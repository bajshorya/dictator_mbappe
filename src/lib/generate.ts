import { NOTABLE_POOL, SQUADS } from "@/data/players";
import { rnd } from "@/lib/rng";
import type { Player, Position, Squad } from "@/lib/types";

// Precompute per-position pools ONCE (instead of filtering NOTABLE_POOL on every draw).
const NOTABLE_BY_POS: Record<Position, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
for (const p of NOTABLE_POOL) NOTABLE_BY_POS[p.position].push(p);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Position-draft mode: one candidate per still-open slot (`need`), drawn from
 * the recognisable pool. All distinct, biased towards varied team+year combos.
 */
export function generateCandidates(
  need: Record<Position, number>,
  excludeIds: Set<string>,
): Player[] {
  const usedCombos = new Set<string>();
  const usedNames = new Set<string>();
  const picked: Player[] = [];
  const combo = (p: Player) => `${p.team}-${p.year}`;

  (["GK", "DEF", "MID", "FWD"] as const).forEach((pos) => {
    const pool = shuffle(NOTABLE_BY_POS[pos].filter((p) => !excludeIds.has(p.id)));
    for (let n = 0; n < need[pos]; n++) {
      const fresh = pool.find((p) => !usedNames.has(p.name) && !usedCombos.has(combo(p)) && !picked.includes(p));
      const fallback = pool.find((p) => !usedNames.has(p.name) && !picked.includes(p));
      const choice = fresh ?? fallback ?? pool.find((p) => !picked.includes(p));
      if (!choice) break;
      picked.push(choice);
      usedNames.add(choice.name);
      usedCombos.add(combo(choice));
    }
  });
  return shuffle(picked);
}

/** Position-draft mode: a set of mixed-position candidates to fill the bench. */
export function generateBench(count: number, excludeIds: Set<string>): Player[] {
  const usedNames = new Set<string>();
  const usedCombos = new Set<string>();
  const pool = shuffle(NOTABLE_POOL.filter((p) => !excludeIds.has(p.id)));
  const picked: Player[] = [];
  for (const p of pool) {
    if (picked.length >= count) break;
    if (usedNames.has(p.name)) continue;
    if (usedCombos.has(`${p.team}-${p.year}`)) continue;
    picked.push(p);
    usedNames.add(p.name);
    usedCombos.add(`${p.team}-${p.year}`);
  }
  return picked;
}

/** By-nation mode: a random full squad, avoiding the most recent few shown. */
export function drawNationSquad(recentKeys: Set<string>): Squad {
  const eligible = SQUADS.filter((s) => !recentKeys.has(`${s.team}-${s.year}`));
  const pool = eligible.length > 0 ? eligible : SQUADS;
  return pool[Math.floor(rnd() * pool.length)];
}

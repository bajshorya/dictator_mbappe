import type { Player } from "@/lib/types";

const KEY = "footy:hof:v1";

export interface SquadLite {
  name: string;
  team: string;
  year: number;
  rating: number;
  pos: string;
}

export interface HallOfFame {
  plays: number;
  titles: number;
  bestRank: number; // 0 = never played
  bestPlacement: string;
  champXi?: SquadLite[]; // the most recent title-winning XI
  champFormation?: string;
  updated?: string;
}

const EMPTY: HallOfFame = { plays: 0, titles: 0, bestRank: 0, bestPlacement: "—" };

/** Higher = better finish. Note: "Semi-Finals"/"Quarter-Finals" also contain
 *  "Final", so those are tested before the runner-up ("the Final") check. */
export function placementRank(placement: string): number {
  if (placement.includes("Champions")) return 7;
  if (placement.includes("Semi")) return 5;
  if (placement.includes("Quarter")) return 4;
  if (placement.includes("Round of 16")) return 3;
  if (placement.includes("Round of 32")) return 2;
  if (placement.includes("Final")) return 6; // lost the final → runner-up
  return 1; // group stage
}

// ---- Daily Challenge ----
export interface DailyResult {
  placement: string;
  won: boolean;
  grade: string;
}
export function getDaily(key: string): DailyResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`footy:daily:${key}`);
    return raw ? (JSON.parse(raw) as DailyResult) : null;
  } catch {
    return null;
  }
}
export function saveDaily(key: string, r: DailyResult) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`footy:daily:${key}`, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

export function getHallOfFame(): HallOfFame {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function liteSquad(xi: Player[]): SquadLite[] {
  return xi.map((p) => ({ name: p.name, team: p.team, year: p.year, rating: p.rating, pos: p.position }));
}

/** Records a finished run; updates bests and title-winning XI. Returns new HOF. */
export function recordResult(input: {
  placement: string;
  won: boolean;
  xi: Player[];
  formation?: string;
}): HallOfFame {
  const hof = getHallOfFame();
  const rank = placementRank(input.placement);
  const next: HallOfFame = {
    plays: hof.plays + 1,
    titles: hof.titles + (input.won ? 1 : 0),
    bestRank: Math.max(hof.bestRank, rank),
    bestPlacement: rank >= hof.bestRank ? input.placement : hof.bestPlacement,
    champXi: input.won ? liteSquad(input.xi) : hof.champXi,
    champFormation: input.won ? input.formation : hof.champFormation,
    updated: new Date().toISOString().slice(0, 10),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
  }
  return next;
}

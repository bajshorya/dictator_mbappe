import type { Player, Position, Squad } from "@/lib/types";
import wc from "@/data/wc-squads.json";

/**
 * World Cup squad data (1982–2022), generated from the Fjelstul World Cup
 * Database (CC-BY-SA 4.0) by `scripts/build-wc-squads.mjs`. Ratings are
 * data-driven from each player's goals, starts/appearances, how far their team
 * advanced, and individual awards in THAT tournament. See the script for the
 * exact formula. To refresh: `node scripts/build-wc-squads.mjs`.
 */

interface RawPlayer {
  name: string;
  pos: Position;
  num: number;
  rating: number;
  goals: number;
  apps: number;
  starts: number;
  award?: string;
}
interface RawTeam {
  code: string;
  finish: string;
  reachedKnockout: boolean;
  players: RawPlayer[];
}
const SOURCE = wc as unknown as {
  squads: Record<string, Record<string, RawTeam>>;
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const SQUADS: Squad[] = [];
export const PLAYERS: Player[] = [];

for (const [yearKey, teams] of Object.entries(SOURCE.squads)) {
  const year = Number(yearKey);
  for (const [team, t] of Object.entries(teams)) {
    const players: Player[] = t.players.map((p) => ({
      id: `${slug(p.name)}-${year}-${t.code}-${p.num}`,
      name: p.name,
      team,
      year,
      position: p.pos,
      rating: p.rating,
      goals: p.goals,
      apps: p.apps,
      starts: p.starts,
      award: p.award,
      reachedKnockout: t.reachedKnockout,
      finish: t.finish,
    }));
    SQUADS.push({ year, team, code: t.code, finish: t.finish, reachedKnockout: t.reachedKnockout, players });
    PLAYERS.push(...players);
  }
}

/**
 * Pool for position-draft mode: recognisable players only — those whose team
 * reached the knockout stage and who actually featured (or are highly rated).
 */
export const NOTABLE_POOL: Player[] = PLAYERS.filter(
  (p) => p.reachedKnockout && (p.starts >= 1 || p.rating >= 75),
);

export const WORLD_CUP_YEARS = [...new Set(SQUADS.map((s) => s.year))].sort((a, b) => a - b);

export function notableByPosition(pos: Position): Player[] {
  return NOTABLE_POOL.filter((p) => p.position === pos);
}

import type { Player } from "@/lib/types";

export interface Chemistry {
  score: number; // 0-100
  links: number; // number of same-nation pairs (teammate connections)
  bonus: number; // strength bonus added in the simulation (0-4)
}

/**
 * Chemistry rewards cohesive squads — real teammates (same nation + same World
 * Cup), then same nation across eras, then same-era players. It's a bonus only:
 * a galáctico mix simply earns less, it's never penalised.
 */
export function computeChemistry(xi: Player[]): Chemistry {
  let points = 0;
  let links = 0;
  for (let i = 0; i < xi.length; i++) {
    for (let j = i + 1; j < xi.length; j++) {
      const a = xi[i];
      const b = xi[j];
      if (a.team === b.team && a.year === b.year) {
        points += 3; // genuine teammates
        links++;
      } else if (a.team === b.team) {
        points += 1.5; // same nation, different era
        links++;
      } else if (a.year === b.year) {
        points += 0.75; // same World Cup, different nation
      }
    }
  }
  const maxPoints = xi.length >= 2 ? (xi.length * (xi.length - 1)) / 2 * 3 : 1;
  const score = Math.min(100, Math.round((points / maxPoints) * 100));
  const bonus = Math.min(4, Math.round(score / 25));
  return { score, links, bonus };
}

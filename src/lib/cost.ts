import type { Difficulty, Player } from "@/lib/types";

// Star-points cost — convex so elite players are disproportionately expensive.
export function playerCost(rating: number): number {
  const r = Math.max(0, rating - 50);
  return Math.round(r * (1 + r / 100));
}

export function squadCost(players: Player[]): number {
  return players.reduce((s, p) => s + playerCost(p.rating), 0);
}

// Total star-points budget for the 18-man squad, tighter on harder difficulties.
export const BUDGET: Record<Difficulty, number> = { easy: 780, normal: 700, hard: 630 };

// Reserve this much per still-unfilled STARTING slot so you can never get
// locked out of completing your XI.
export const MIN_SLOT_COST = 11;

/**
 * Can this player be added given current spend, budget, and how many starting
 * slots remain? We always keep enough budget to fill the mandatory XI.
 */
export function canAfford(
  player: Player,
  spent: number,
  budget: number,
  xiRemaining: number,
): boolean {
  // Reserve for the OTHER remaining starting slots (this pick may take one).
  const reserve = MIN_SLOT_COST * Math.max(0, xiRemaining - 1);
  return spent + playerCost(player.rating) + reserve <= budget;
}

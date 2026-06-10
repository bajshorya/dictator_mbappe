// Core domain types for the World Cup Lineup Maker.

export type Position = "GK" | "DEF" | "MID" | "FWD";

export type GameMode = "position" | "nation";

export type Difficulty = "easy" | "normal" | "hard";

/** A single player as they performed in one specific World Cup. */
export interface Player {
  id: string; // unique: name + year + team code + shirt number
  name: string;
  team: string; // national team
  year: number; // the World Cup edition
  position: Position;
  rating: number; // 58-99, reflecting performance in THAT tournament
  goals: number; // goals scored in that World Cup
  apps: number; // matches played in that World Cup
  starts: number; // matches started
  award?: string; // individual award won (e.g. "Golden Ball")
  reachedKnockout: boolean; // did the player's team reach the knockout stage
  finish: string; // how far the team went, e.g. "Winner", "Group stage"
}

/** A full national-team squad from one World Cup (for by-nation mode). */
export interface Squad {
  year: number;
  team: string;
  code: string;
  finish: string;
  reachedKnockout: boolean;
  players: Player[];
}

/** A position on the pitch for a given formation. */
export interface Slot {
  id: string;
  position: Position;
  x: number; // 0-100, left→right
  y: number; // 0-100, top(opponent goal)→bottom(own goal)
}

export interface Formation {
  name: string; // e.g. "4-3-3"
  slots: Slot[];
}

/** A player placed into a specific slot of the user's lineup. */
export type Lineup = Record<string, Player | undefined>; // keyed by slot id

/** A national team used in the simulated tournament. */
export interface NationalTeam {
  name: string;
  flag: string; // emoji
  strength: number; // 60-95
}

export interface MatchResult {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  homePens?: number;
  awayPens?: number;
  winner: string;
  isUser: boolean;
  scorers?: { name: string; goals: number }[]; // your scorers (user matches only)
  redHome?: number; // red cards
  redAway?: number;
  extraTime?: boolean; // knockout went to extra time
  mvp?: string; // your player of the match (user matches only)
  notes?: string[]; // squad news for user matches (injuries, suspensions, subs)
  oppStyle?: string; // opponent manager's style (user matches only)
  pendingShootout?: boolean; // user knockout decided on pens — play it interactively
}

export interface RoundResult {
  name: string; // "Group Stage", "Round of 16", ...
  matches: MatchResult[];
}

export interface PlayerStat {
  player: Player;
  goals: number;
  apps: number;
}

export interface GroupStanding {
  name: string;
  flag: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
  qualified: boolean;
  isUser: boolean;
  pot?: number; // seeding pot 1-4
}

/** A single match the user played, tagged with the round it belongs to. */
export interface JourneyStep {
  stage: string;
  match: MatchResult;
}

export interface TournamentMvp {
  name: string;
  team: string;
  year: number;
  goals: number;
  apps: number;
  motm: number;
}

export interface TournamentResult {
  rounds: RoundResult[];
  champion: string;
  userPlacement: string; // e.g. "Champions 🏆", "Eliminated in Quarter-Finals"
  userWon: boolean;
  playerStats: PlayerStat[];
  userPath: MatchResult[];
  userJourney: JourneyStep[];
  userGroupName: string;
  userGroupTable: GroupStanding[];
  tournamentMvp?: TournamentMvp;
}

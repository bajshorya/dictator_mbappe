import { NATIONAL_TEAMS, USER_TEAM_FLAG, USER_TEAM_NAME } from "@/data/teams";
import { computeChemistry } from "@/lib/chemistry";
import type {
  Difficulty,
  GroupStanding,
  JourneyStep,
  MatchResult,
  NationalTeam,
  Player,
  PlayerStat,
  RoundResult,
  TournamentResult,
} from "@/lib/types";

const DIFFICULTY_OFFSET: Record<Difficulty, number> = { easy: -4, normal: 0, hard: 4 };

// Rival "manager" personalities — distinct attacking/defensive profiles.
interface Style {
  name: string;
  atk: number;
  def: number;
}
const PERSONAS: Style[] = [
  { name: "Catenaccio", atk: 0.9, def: 1.14 },
  { name: "Total Football", atk: 1.13, def: 0.96 },
  { name: "Gegenpress", atk: 1.08, def: 1.0 },
  { name: "Tiki-Taka", atk: 1.06, def: 1.05 },
  { name: "Counter-Attack", atk: 0.97, def: 1.09 },
  { name: "Direct Football", atk: 1.06, def: 0.97 },
];
const NEUTRAL: Style = { name: "Balanced", atk: 1, def: 1 };
function personaFor(name: string): Style {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PERSONAS[h % PERSONAS.length];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function poisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function depthBonus(bench: Player[]): number {
  if (bench.length === 0) return 0;
  return clamp((mean(bench.map((p) => p.rating)) - 72) / 6, 0, 3);
}

/** Static team strength used for the build-screen meter (no fatigue). */
export function teamStrength(xi: Player[], bench: Player[] = [], captainId?: string | null): number {
  if (xi.length === 0) return 75;
  const chem = computeChemistry(xi).bonus;
  const captain = captainId && xi.some((p) => p.id === captainId) ? 1 : 0;
  return Math.round(mean(xi.map((p) => p.rating)) + depthBonus(bench) + chem + captain);
}

interface Side {
  name: string;
  flag: string;
  strength: number;
  isUser: boolean;
  style: Style;
}

function simulateMatch(home: Side, away: Side, knockout: boolean, tactics: number): MatchResult {
  const diff = home.strength - away.strength;
  const formH = 0.82 + Math.random() * 0.36;
  const formA = 0.82 + Math.random() * 0.36;
  let xgH = clamp((1.35 + diff * 0.055) * formH, 0.15, 5);
  let xgA = clamp((1.35 - diff * 0.055) * formA, 0.15, 5);

  // Manager styles: own attack up, opponent's defence brings you down.
  xgH = (xgH * home.style.atk) / away.style.def;
  xgA = (xgA * away.style.atk) / home.style.def;

  // User tactics: attacking opens the game (more xG both ways), defensive shuts it.
  if (home.isUser) {
    xgH *= 1 + 0.18 * tactics;
    xgA *= 1 + 0.12 * tactics;
  } else if (away.isUser) {
    xgA *= 1 + 0.18 * tactics;
    xgH *= 1 + 0.12 * tactics;
  }

  let redH = 0;
  let redA = 0;
  if (Math.random() < 0.07) {
    redH = 1;
    xgH *= 0.72;
    xgA *= 1.15;
  }
  if (Math.random() < 0.07) {
    redA = 1;
    xgA *= 0.72;
    xgH *= 1.15;
  }

  let hg = poisson(clamp(xgH, 0.1, 6));
  let ag = poisson(clamp(xgA, 0.1, 6));

  const result: MatchResult = {
    home: home.name,
    away: away.name,
    homeGoals: hg,
    awayGoals: ag,
    winner: "",
    isUser: home.isUser || away.isUser,
    ...(redH ? { redHome: redH } : {}),
    ...(redA ? { redAway: redA } : {}),
  };

  if (hg === ag && knockout) {
    hg += poisson(clamp(0.45 + diff * 0.02, 0.05, 2));
    ag += poisson(clamp(0.45 - diff * 0.02, 0.05, 2));
    result.homeGoals = hg;
    result.awayGoals = ag;
    result.extraTime = true;
  }

  if (hg === ag) {
    if (knockout) {
      let homePens = 0;
      let awayPens = 0;
      const pHome = clamp(0.72 + diff * 0.004, 0.55, 0.85);
      for (let i = 0; i < 5; i++) {
        if (Math.random() < pHome) homePens++;
        if (Math.random() < 1.44 - pHome) awayPens++;
      }
      while (homePens === awayPens) {
        if (Math.random() < pHome) homePens++;
        if (Math.random() < 1.44 - pHome) awayPens++;
      }
      result.homePens = homePens;
      result.awayPens = awayPens;
      result.winner = homePens > awayPens ? home.name : away.name;
    } else {
      result.winner = "draw";
    }
  } else {
    result.winner = hg > ag ? home.name : away.name;
  }
  return result;
}

interface Standing {
  side: Side;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
}
const newStanding = (side: Side): Standing => ({ side, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 });

function applyResult(home: Standing, away: Standing, m: MatchResult) {
  home.played++;
  away.played++;
  home.gf += m.homeGoals;
  home.ga += m.awayGoals;
  away.gf += m.awayGoals;
  away.ga += m.homeGoals;
  if (m.winner === "draw") {
    home.pts++;
    away.pts++;
    home.drawn++;
    away.drawn++;
  } else if (m.winner === home.side.name) {
    home.pts += 3;
    home.won++;
    away.lost++;
  } else {
    away.pts += 3;
    away.won++;
    home.lost++;
  }
}

const rank = (a: Standing, b: Standing) =>
  b.pts - a.pts ||
  b.gf - b.ga - (a.gf - a.ga) ||
  b.gf - a.gf ||
  (a.side.isUser ? -1 : b.side.isUser ? 1 : a.side.strength - b.side.strength);

const scoreWeight = (p: Player) =>
  (p.position === "FWD" ? 5 : p.position === "MID" ? 2.5 : p.position === "DEF" ? 0.6 : 0.05) * (p.rating / 80);

function weightedSample(pool: Player[], n: number): Player[] {
  const out: Player[] = [];
  const rest = [...pool];
  for (let k = 0; k < n && rest.length; k++) {
    const total = rest.reduce((s, p) => s + p.rating, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < rest.length; i++) {
      r -= rest[i].rating;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}

/** Distribute a match's goals across the players on the pitch; records subs used. */
function attributeMatch(
  pitch: Player[],
  bench: Player[],
  goals: number,
  appMap: Map<string, number>,
  goalMap: Map<string, number>,
  captainId: string | null | undefined,
  subsOut: Player[],
): { name: string; goals: number }[] {
  for (const p of pitch) appMap.set(p.id, (appMap.get(p.id) ?? 0) + 1);
  const nSubs = Math.min(bench.length, [0, 1, 1, 2, 2, 3][Math.floor(Math.random() * 6)]);
  const subs = weightedSample(bench, nSubs);
  for (const p of subs) {
    appMap.set(p.id, (appMap.get(p.id) ?? 0) + 1);
    subsOut.push(p);
  }

  const cap = (p: Player) => (p.id === captainId ? 1.4 : 1);
  const scorers = [
    ...pitch.map((p) => ({ p, w: scoreWeight(p) * cap(p) })),
    ...subs.map((p) => ({ p, w: scoreWeight(p) * 0.5 })),
  ];
  const total = scorers.reduce((s, x) => s + x.w, 0) || 1;
  const matchGoals = new Map<string, { name: string; goals: number }>();
  for (let g = 0; g < goals; g++) {
    let r = Math.random() * total;
    for (const x of scorers) {
      r -= x.w;
      if (r <= 0) {
        goalMap.set(x.p.id, (goalMap.get(x.p.id) ?? 0) + 1);
        const m = matchGoals.get(x.p.id) ?? { name: x.p.name, goals: 0 };
        m.goals++;
        matchGoals.set(x.p.id, m);
        break;
      }
    }
  }
  return [...matchGoals.values()].sort((a, b) => b.goals - a.goals);
}

function pickMvp(pitch: Player[], scorers: { name: string; goals: number }[], goalsAgainst: number): string {
  if (scorers.length) return scorers[0].name;
  if (goalsAgainst === 0) {
    const gk = pitch.find((p) => p.position === "GK");
    if (gk) return gk.name;
  }
  const best = [...pitch].sort((a, b) => b.rating - a.rating)[0];
  return best ? best.name : "—";
}

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");
const KO_NAMES = ["Round of 32", "Round of 16", "Quarter-Finals", "Semi-Finals", "Final"];

export function simulateTournament(
  xi: Player[],
  bench: Player[] = [],
  opts: { captainId?: string | null; difficulty?: Difficulty; tactics?: number } = {},
): TournamentResult {
  const { captainId, difficulty = "normal", tactics = 0 } = opts;
  const offset = DIFFICULTY_OFFSET[difficulty];

  // ---- per-player condition that carries across the tournament ----
  type Cond = { fatigue: number; ban: number; injured: boolean };
  const cond = new Map<string, Cond>();
  const st = (id: string): Cond => {
    let c = cond.get(id);
    if (!c) {
      c = { fatigue: 0, ban: 0, injured: false };
      cond.set(id, c);
    }
    return c;
  };
  const effRating = (p: Player) => p.rating * (1 - 0.16 * st(p.id).fatigue);
  const chemBonus = computeChemistry(xi).bonus;

  function availableXI(): { players: Player[]; used: Set<string>; notes: string[] } {
    const used = new Set<string>();
    const notes: string[] = [];
    const players: Player[] = [];
    const benchPool = bench.filter((b) => !st(b.id).injured && st(b.id).ban === 0);
    for (const starter of xi) {
      const c = st(starter.id);
      if (!c.injured && c.ban === 0) {
        players.push(starter);
        used.add(starter.id);
      } else {
        const rep = benchPool.find((b) => b.position === starter.position && !used.has(b.id));
        if (rep) {
          players.push(rep);
          used.add(rep.id);
          notes.push(`${rep.name} replaces ${starter.name}`);
        } else {
          notes.push(`${starter.name} unavailable — a man short`);
        }
      }
    }
    return { players, used, notes };
  }
  const matchStrength = (players: Player[], usedBench: Set<string>) => {
    const restBench = bench.filter((b) => !usedBench.has(b.id) && !st(b.id).injured && st(b.id).ban === 0);
    const cap = captainId && players.some((p) => p.id === captainId) ? 1 : 0;
    return Math.round(mean(players.map(effRating)) + depthBonus(restBench) + chemBonus + cap);
  };

  const userSide: Side = {
    name: USER_TEAM_NAME,
    flag: USER_TEAM_FLAG,
    strength: teamStrength(xi, bench, captainId),
    isUser: true,
    style: NEUTRAL,
  };
  const realSides: Side[] = shuffle(NATIONAL_TEAMS as NationalTeam[])
    .slice(0, 47)
    .map((t) => ({ name: t.name, flag: t.flag, strength: t.strength + offset, isUser: false, style: personaFor(t.name) }));

  const allSides = shuffle([userSide, ...realSides]);
  const groups: Side[][] = Array.from({ length: 12 }, (_, i) => allSides.slice(i * 4, i * 4 + 4));

  const rounds: RoundResult[] = [];
  const userJourney: JourneyStep[] = [];
  const appMap = new Map<string, number>();
  const goalMap = new Map<string, number>();

  // Set the user's strength for the next match based on current condition.
  let pending: { players: Player[]; used: Set<string>; notes: string[] } | null = null;
  const prepUser = (opponent: Side) => {
    pending = availableXI();
    userSide.strength = matchStrength(pending.players, pending.used);
    userSide.style = NEUTRAL;
    void opponent;
  };

  const recordUser = (stage: string, m: MatchResult, opponent: Side) => {
    if (!m.isUser || !pending) return;
    const avail = pending;
    const userIsHome = m.home === USER_TEAM_NAME;
    const gf = userIsHome ? m.homeGoals : m.awayGoals;
    const ga = userIsHome ? m.awayGoals : m.homeGoals;
    const userRed = userIsHome ? !!m.redHome : !!m.redAway;

    const availBench = bench.filter((b) => !avail.used.has(b.id) && !st(b.id).injured && st(b.id).ban === 0);
    const subsUsed: Player[] = [];
    m.scorers = attributeMatch(avail.players, availBench, gf, appMap, goalMap, captainId, subsUsed);
    m.mvp = pickMvp(avail.players, m.scorers, ga);
    m.oppStyle = opponent.style.name;

    const notes = [...avail.notes];
    // Update condition for everyone after the match.
    const played = new Set([...avail.players, ...subsUsed].map((p) => p.id));
    for (const p of [...xi, ...bench]) {
      const c = st(p.id);
      if (c.ban > 0) c.ban--;
      if (played.has(p.id)) c.fatigue = Math.min(1, c.fatigue + 0.34);
      else c.fatigue = Math.max(0, c.fatigue - 0.45);
    }
    for (const p of avail.players) {
      if (!st(p.id).injured && Math.random() < 0.025) {
        st(p.id).injured = true;
        notes.push(`${p.name} picks up a tournament-ending injury`);
      }
    }
    if (userRed && avail.players.length) {
      const victim = avail.players[Math.floor(Math.random() * avail.players.length)];
      st(victim.id).ban = Math.max(st(victim.id).ban, 1);
      notes.push(`${victim.name} sent off — suspended for the next match`);
    }
    if (notes.length) m.notes = notes;
    if (m.homePens != null) m.pendingShootout = true;
    userJourney.push({ stage, match: m });
  };

  // ---- Group stage ----
  const groupMatches: MatchResult[] = [];
  const winners: Side[] = [];
  const runnersUp: Side[] = [];
  const thirds: Standing[] = [];
  let userGroupName = "";
  let userGroupStandings: Standing[] = [];

  groups.forEach((g, gi) => {
    const table = g.map(newStanding);
    const byName = new Map(table.map((s) => [s.side.name, s]));
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const a = g[i];
        const b = g[j];
        if (a.isUser) prepUser(b);
        else if (b.isUser) prepUser(a);
        const m = simulateMatch(a, b, false, tactics);
        groupMatches.push(m);
        recordUser("Group Stage", m, a.isUser ? b : a);
        applyResult(byName.get(a.name)!, byName.get(b.name)!, m);
      }
    }
    table.sort(rank);
    winners.push(table[0].side);
    runnersUp.push(table[1].side);
    thirds.push(table[2]);
    if (g.some((s) => s.isUser)) {
      userGroupName = `Group ${GROUP_LETTERS[gi]}`;
      userGroupStandings = table;
    }
  });
  rounds.push({ name: "Group Stage", matches: groupMatches });

  const bestThirds = [...thirds].sort(rank).slice(0, 8).map((s) => s.side);
  const qualifiedNames = new Set([...winners, ...runnersUp, ...bestThirds].map((s) => s.name));

  const userGroupTable: GroupStanding[] = userGroupStandings.map((s) => ({
    name: s.side.name,
    flag: s.side.flag,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    gf: s.gf,
    ga: s.ga,
    pts: s.pts,
    qualified: qualifiedNames.has(s.side.name),
    isUser: s.side.isUser,
  }));

  // ---- Knockout bracket ----
  let bracket = shuffle([...winners, ...runnersUp, ...bestThirds]);
  let champion = "";
  let userPlacement = "Eliminated in the Group Stage";
  let userWon = false;
  let userAlive = bracket.some((s) => s.isUser);
  if (userAlive) userPlacement = "Reached the Round of 32";

  for (let r = 0; r < KO_NAMES.length && bracket.length >= 2; r++) {
    const matches: MatchResult[] = [];
    const next: Side[] = [];
    for (let i = 0; i < bracket.length; i += 2) {
      const a = bracket[i];
      const b = bracket[i + 1];
      if (a.isUser) prepUser(b);
      else if (b.isUser) prepUser(a);
      const m = simulateMatch(a, b, true, tactics);
      matches.push(m);
      recordUser(KO_NAMES[r], m, a.isUser ? b : a);
      next.push(m.winner === a.name ? a : b);
    }
    rounds.push({ name: KO_NAMES[r], matches });
    const userStillIn = next.some((s) => s.isUser);
    if (userAlive && !userStillIn) userPlacement = `Eliminated in the ${KO_NAMES[r]}`;
    userAlive = userStillIn;
    if (bracket.length === 2) {
      champion = next[0].name;
      if (next[0].isUser) {
        userWon = true;
        userPlacement = "World Champions";
      }
    }
    bracket = next;
  }

  const squad = [...xi, ...bench];
  const playerStats: PlayerStat[] = squad
    .map((p) => ({ player: p, goals: goalMap.get(p.id) ?? 0, apps: appMap.get(p.id) ?? 0 }))
    .sort((a, b) => b.goals - a.goals || b.apps - a.apps || b.player.rating - a.player.rating);

  return {
    rounds,
    champion,
    userPlacement,
    userWon,
    playerStats,
    userPath: userJourney.map((j) => j.match),
    userJourney,
    userGroupName,
    userGroupTable,
  };
}

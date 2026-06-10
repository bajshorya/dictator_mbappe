// Builds src/data/wc-squads.json from the Fjelstul World Cup Database (CC-BY-SA).
// Computes a data-driven "performance in that tournament" rating per player from
// goals, starts/appearances, how far the team advanced, and individual awards.
//
// Run with:  node scripts/build-wc-squads.mjs
// Source:    https://github.com/jfjelstul/worldcup

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv";
const MIN_YEAR = 1982; // recognisable era; keeps the file size sane
const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = join(__dirname, ".wc-cache");
const OUT = join(__dirname, "..", "src", "data", "wc-squads.json");

const FILES = ["tournaments", "squads", "goals", "player_appearances", "team_appearances", "award_winners"];

// ---------- tiny CSV parser (handles quoted fields with commas) ----------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

async function load(name) {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const cached = join(CACHE, name + ".csv");
  let text;
  if (existsSync(cached)) {
    text = readFileSync(cached, "utf8");
  } else {
    process.stdout.write(`  fetching ${name}.csv … `);
    const res = await fetch(`${BASE}/${name}.csv`);
    text = await res.text();
    writeFileSync(cached, text);
    console.log("ok");
  }
  return parseCSV(text);
}

const POS = { GK: "GK", DF: "DEF", MF: "MID", FW: "FWD" };
const yearOf = (id) => Number(id.slice(3));
let isMen = () => false; // replaced in main() once tournaments.csv is loaded

function stageRank(name) {
  const n = name.toLowerCase();
  if (n === "final") return 11;
  if (n.includes("third")) return 9;
  if (n.includes("semi")) return 9;
  if (n.includes("quarter")) return 7;
  if (n.includes("round of 16")) return 5;
  if (n.includes("second group") || n.includes("final round")) return 6;
  return 1; // group stage
}
function finishLabel(rank, isWinner, isRunnerUp) {
  if (isWinner) return "Winner";
  if (isRunnerUp) return "Runner-up";
  if (rank >= 9) return "Semi-finals";
  if (rank >= 7) return "Quarter-finals";
  if (rank >= 5) return "Round of 16";
  if (rank === 6) return "Second group stage";
  return "Group stage";
}
const stageScore = { Winner: 14, "Runner-up": 11, "Semi-finals": 9, "Quarter-finals": 7, "Round of 16": 5, "Second group stage": 6, "Group stage": 2 };

const AWARD_PTS = {
  "Golden Ball": 12, "Silver Ball": 8, "Bronze Ball": 6,
  "Golden Boot": 10, "Silver Boot": 7, "Bronze Boot": 5,
  "Golden Glove": 8, "Best Young Player": 6,
};
const goalWeight = { GK: 7, DEF: 5, MID: 3.2, FWD: 2.4 };

// Only recognisable footballing nations — keeps by-nation mode fun (people know
// the players). West Germany kept so 1982–90 squads (Matthäus etc.) appear.
const TOP_NATIONS = new Set([
  "Argentina", "Brazil", "France", "Germany", "West Germany", "Spain", "Italy",
  "England", "Netherlands", "Portugal", "Belgium", "Croatia", "Uruguay",
  "Colombia", "Mexico", "Denmark", "Sweden", "Switzerland", "Poland", "Serbia",
  "Nigeria", "Cameroon", "Ghana", "Senegal", "Ivory Coast", "Morocco",
  "Japan", "South Korea", "United States", "Chile",
]);

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(x))); }

// Drop placeholder given names ("not applicable") so mononyms render cleanly.
function cleanName(given, family) {
  const ok = (s) => s && !s.toLowerCase().includes("not applicable") && s.toLowerCase() !== "n/a";
  const g = ok(given) ? given.trim() : "";
  const f = ok(family) ? family.trim() : "";
  return [g, f].filter(Boolean).join(" ") || f || g || "Unknown";
}

// Raw single-tournament performance score (before career-peak blending).
function perfRating({ starts, sub, goals, pos, finish, award }) {
  const playTime = starts + 0.5 * sub;
  const involvement = Math.min(1, playTime / 5);
  const startScore = Math.min(18, 2.0 * starts);
  const subScore = 0.6 * sub;
  const goalScore = Math.min(14, goals * goalWeight[pos]);
  const runBonus = (stageScore[finish] || 2) * (0.35 + 0.65 * involvement);
  const awardBonus = AWARD_PTS[award] || 0;
  return clamp(58 + startScore + subScore + goalScore + runBonus + awardBonus, 50, 99);
}

async function main() {
  console.log("Building WC squads dataset (1982–2022)…");
  const [tournaments, squads, goals, apps, teamApps, awards] = await Promise.all(FILES.map(load));

  // men's tournaments only (women's editions share the WC-YYYY id format)
  const menIds = new Set(tournaments.filter((t) => t.tournament_name.includes("Men's")).map((t) => t.tournament_id));
  isMen = (id) => menIds.has(id);

  // tournament winners
  const winnerByT = {};
  for (const t of tournaments) if (isMen(t.tournament_id)) winnerByT[t.tournament_id] = t.winner;

  // team deepest stage + final losers (runner-up)
  const deepest = {}; // tid|team -> rank
  const finalists = {}; // tid -> Set(team) who played the final
  for (const r of teamApps) {
    const tid = r.tournament_id;
    if (!isMen(tid) || yearOf(tid) < MIN_YEAR) continue;
    const k = tid + "|" + r.team_name;
    const rank = stageRank(r.stage_name);
    deepest[k] = Math.max(deepest[k] || 0, rank);
    if (r.stage_name.toLowerCase() === "final") (finalists[tid] ||= new Set()).add(r.team_name);
  }

  // appearances: starts / sub apps per player per tournament
  const appStat = {}; // tid|pid -> {starts, sub}
  for (const r of apps) {
    const tid = r.tournament_id;
    if (!isMen(tid) || yearOf(tid) < MIN_YEAR) continue;
    const k = tid + "|" + r.player_id;
    const s = (appStat[k] ||= { starts: 0, sub: 0 });
    if (r.starter === "1") s.starts++; else s.sub++;
  }

  // goals per player per tournament (exclude own goals)
  const goalStat = {}; // tid|pid -> count
  for (const r of goals) {
    const tid = r.tournament_id;
    if (!isMen(tid) || yearOf(tid) < MIN_YEAR) continue;
    if (r.own_goal === "1") continue;
    const k = tid + "|" + r.player_id;
    goalStat[k] = (goalStat[k] || 0) + 1;
  }

  // awards per player per tournament
  const awardStat = {}; // tid|pid -> award name (highest pts)
  for (const r of awards) {
    const tid = r.tournament_id;
    if (!isMen(tid) || yearOf(tid) < MIN_YEAR) continue;
    const k = tid + "|" + r.player_id;
    const pts = AWARD_PTS[r.award_name] || 0;
    if (!awardStat[k] || pts > (AWARD_PTS[awardStat[k]] || 0)) awardStat[k] = r.award_name;
  }

  // ---- Pass 1: raw per-tournament performance for every top-nation entry ----
  const entries = [];
  const peakByPlayer = {}; // player_id -> max perf across their tournaments
  for (const s of squads) {
    const tid = s.tournament_id;
    if (!isMen(tid) || yearOf(tid) < MIN_YEAR) continue;
    const team = s.team_name;
    if (!TOP_NATIONS.has(team)) continue;
    const pos = POS[s.position_code] || "MID";
    const k = tid + "|" + s.player_id;
    const a = appStat[k] || { starts: 0, sub: 0 };
    const g = goalStat[k] || 0;
    const award = awardStat[k];
    const rankNum = deepest[tid + "|" + team] || 1;
    const isWinner = winnerByT[tid] === team;
    const isRunnerUp = !isWinner && finalists[tid]?.has(team);
    const finish = finishLabel(rankNum, isWinner, isRunnerUp);

    const perf = perfRating({ starts: a.starts, sub: a.sub, goals: g, pos, finish, award });
    peakByPlayer[s.player_id] = Math.max(peakByPlayer[s.player_id] || 0, perf);

    entries.push({
      year: yearOf(tid),
      team,
      code: s.team_code,
      finish,
      reachedKnockout: rankNum >= 5 || finish === "Second group stage",
      playerId: s.player_id,
      name: cleanName(s.given_name, s.family_name),
      pos,
      num: Number(s.shirt_number) || 0,
      perf,
      goals: g,
      apps: a.starts + a.sub,
      starts: a.starts,
      award,
      tid,
    });
  }

  // ---- Pass 2: blend performance with the player's career-peak WC rating ----
  const out = { meta: { source: "Fjelstul World Cup Database (CC-BY-SA 4.0)", url: "https://github.com/jfjelstul/worldcup", generated: new Date().toISOString().slice(0, 10), minYear: MIN_YEAR, nations: [...TOP_NATIONS].sort() }, squads: {} };
  const tournamentInfo = {};
  for (const e of entries) {
    const peak = peakByPlayer[e.playerId] || e.perf;
    const rating = clamp(0.4 * e.perf + 0.6 * peak, 50, 99);
    const yearKey = String(e.year);
    (out.squads[yearKey] ||= {});
    const teamObj = (out.squads[yearKey][e.team] ||= {
      code: e.code,
      finish: e.finish,
      reachedKnockout: e.reachedKnockout,
      players: [],
    });
    teamObj.players.push({
      name: e.name,
      pos: e.pos,
      num: e.num,
      rating,
      goals: e.goals,
      apps: e.apps,
      starts: e.starts,
      ...(e.award ? { award: e.award } : {}),
    });
    (tournamentInfo[yearKey] ||= { winner: winnerByT[e.tid] }).winner = winnerByT[e.tid];
  }

  // sort each squad by rating desc, then shirt number
  for (const y of Object.keys(out.squads))
    for (const team of Object.keys(out.squads[y]))
      out.squads[y][team].players.sort((a, b) => b.rating - a.rating || a.num - b.num);

  out.tournaments = tournamentInfo;

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  const years = Object.keys(out.squads).sort();
  let totalPlayers = 0, totalTeams = 0;
  for (const y of years) { totalTeams += Object.keys(out.squads[y]).length; for (const t of Object.keys(out.squads[y])) totalPlayers += out.squads[y][t].players.length; }
  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log(`\nWrote ${OUT}`);
  console.log(`Years: ${years.join(", ")}`);
  console.log(`Teams: ${totalTeams} · Players: ${totalPlayers} · File: ${kb}KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });

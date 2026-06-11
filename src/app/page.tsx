"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronLeft, Coins, Dices, HelpCircle, Layers, Link2, PlusCircle, RefreshCw, Shuffle, Sliders, Sparkles, Trophy, Users, Volume2, VolumeX, Wand2 } from "lucide-react";
import type { Difficulty, Formation, GameMode, Lineup, Player, Position, Squad, TournamentResult } from "@/lib/types";
import { FORMATIONS } from "@/data/formations";
import { simulateTournament, teamStrength } from "@/lib/simulate";
import { computeChemistry } from "@/lib/chemistry";
import { BUDGET, canAfford, playerCost, squadCost } from "@/lib/cost";
import { isMuted, setMuted, sound } from "@/lib/sound";
import { dailyKey, dailySeed, setSeed } from "@/lib/rng";
import { getDaily, getHallOfFame, placementRank, saveDaily, type HallOfFame } from "@/lib/storage";
import { flagFor } from "@/lib/flags";
import PitchView from "@/components/PitchView";
import PlayerCard from "@/components/PlayerCard";
import NationSquadPanel from "@/components/NationSquadPanel";
import ResultsView from "@/components/ResultsView";
import SimulationView from "@/components/SimulationView";
import HowToPlay from "@/components/HowToPlay";

const HOWTO_KEY = "footy:howto";

type Phase = "mode" | "formation" | "build" | "simulating" | "results";
type Loc = { kind: "xi"; slotId: string } | { kind: "bench"; index: number };
type Origin = { kind: "draw" } | Loc;

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const BENCH_SIZE = 7;
const REROLL_BUDGET: Record<Difficulty, number> = { easy: 15, normal: 10, hard: 6 };
const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "normal", label: "Normal" },
  { key: "hard", label: "Hard" },
];

// Lazily load the draft data + generators so the ~426KB squad JSON is only
// fetched once the player actually enters the draft (keeps home/formation light).
type DraftMod = {
  generateCandidates: typeof import("@/lib/generate").generateCandidates;
  generateBench: typeof import("@/lib/generate").generateBench;
  drawNationSquad: typeof import("@/lib/generate").drawNationSquad;
  notablePool: () => Player[];
};
let draftModPromise: Promise<DraftMod> | null = null;
function loadDraft(): Promise<DraftMod> {
  if (!draftModPromise) {
    draftModPromise = Promise.all([import("@/lib/generate"), import("@/data/players")]).then(([g, d]) => ({
      generateCandidates: g.generateCandidates,
      generateBench: g.generateBench,
      drawNationSquad: g.drawNationSquad,
      notablePool: () => d.NOTABLE_POOL,
    }));
  }
  return draftModPromise;
}

function needFor(l: Lineup, f: Formation): Record<Position, number> {
  const need: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const slot of f.slots) if (!l[slot.id]) need[slot.position]++;
  return need;
}

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.28 },
};

export default function Home() {
  const [phase, setPhase] = useState<Phase>("mode");
  const [mode, setMode] = useState<GameMode>("position");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [tactics, setTactics] = useState(0); // -1 defensive .. +1 attacking
  const [formation, setFormation] = useState<Formation | null>(null);
  const [lineup, setLineup] = useState<Lineup>({});
  const [bench, setBench] = useState<(Player | undefined)[]>(Array(BENCH_SIZE).fill(undefined));
  const [candidates, setCandidates] = useState<Player[]>([]);
  const [nation, setNation] = useState<Squad | null>(null);
  const [sel, setSel] = useState<{ player: Player; origin: Origin } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [rerolls, setRerolls] = useState(REROLL_BUDGET.normal);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [isDaily, setIsDaily] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [subsMode, setSubsMode] = useState(false);
  const recentNations = useRef<Set<string>>(new Set());

  // Show the how-to once (first time entering the build screen).
  function maybeShowHowTo() {
    try {
      if (window.localStorage.getItem(HOWTO_KEY) !== "1") setShowHowTo(true);
    } catch {
      /* ignore */
    }
  }
  function closeHowTo() {
    setShowHowTo(false);
    try {
      window.localStorage.setItem(HOWTO_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => setMutedState(isMuted()), 0);
    return () => window.clearTimeout(id);
  }, []);
  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) sound.tap();
  }

  // ---- browser history so the Back button rolls between screens, not off-site ----
  const go = useCallback((p: Phase) => {
    setPhase(p);
    if (typeof window !== "undefined") window.history.pushState({ footyPhase: p }, "");
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState({ footyPhase: "mode" }, "");
    const onPop = (e: PopStateEvent) => {
      const target = (e.state?.footyPhase as Phase) ?? "mode";
      setPhase(target);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const xiPlayers = useMemo(() => Object.values(lineup).filter(Boolean) as Player[], [lineup]);
  const benchPlayers = useMemo(() => bench.filter(Boolean) as Player[], [bench]);
  const placedIds = useMemo(() => new Set([...xiPlayers, ...benchPlayers].map((p) => p.id)), [xiPlayers, benchPlayers]);
  const xiCount = xiPlayers.length;
  const benchCount = benchPlayers.length;
  const xiComplete = xiCount === 11;
  const chemistry = useMemo(() => computeChemistry(xiPlayers), [xiPlayers]);
  const strength = xiCount > 0 ? teamStrength(xiPlayers, benchPlayers, captainId) : 0;
  const selectedPlayer = sel?.player ?? null;

  // Star-points budget
  const budget = BUDGET[difficulty];
  const spent = useMemo(() => squadCost([...xiPlayers, ...benchPlayers]), [xiPlayers, benchPlayers]);
  const affordable = useCallback(
    (p: Player) => p.id === selectedPlayer?.id || canAfford(p, spent, budget, 11 - xiCount),
    [spent, budget, xiCount, selectedPlayer],
  );

  // ---- drawing (lazy data) ----
  // `subs` = we're explicitly adding substitutes (XI already complete).
  const draw = useCallback(
    (l: Lineup, b: (Player | undefined)[], f: Formation | null, m: GameMode, subs: boolean) => {
      setSel(null);
      setGenerating(true);
      const placed = new Set(
        [...(Object.values(l).filter(Boolean) as Player[]), ...(b.filter(Boolean) as Player[])].map((p) => p.id),
      );
      const need = f ? needFor(l, f) : { GK: 0, DEF: 0, MID: 0, FWD: 0 };
      const open = need.GK + need.DEF + need.MID + need.FWD;
      const benchFilled = (b.filter(Boolean) as Player[]).length;
      loadDraft().then((draftMod) => {
        window.setTimeout(() => {
          if (open > 0) {
            // still drafting the XI
            if (m === "nation") {
              const sq = draftMod.drawNationSquad(recentNations.current);
              recentNations.current.add(`${sq.team}-${sq.year}`);
              if (recentNations.current.size > 12) {
                recentNations.current = new Set([...recentNations.current].slice(-12));
              }
              setNation(sq);
            } else {
              setCandidates(draftMod.generateCandidates(need, placed));
            }
          } else if (subs && benchFilled < BENCH_SIZE) {
            setNation(null);
            setCandidates(draftMod.generateBench(6, placed));
          } else {
            // XI complete and not adding subs → clear the board, show kickoff
            setNation(null);
            setCandidates([]);
          }
          setGenerating(false);
        }, 340);
      });
    },
    [],
  );

  // ---- navigation ----
  function pickMode(m: GameMode) {
    setMode(m);
    go("formation");
  }
  function chooseFormation(f: Formation) {
    setSeed(null);
    setIsDaily(false);
    setFormation(f);
    setLineup({});
    setBench(Array(BENCH_SIZE).fill(undefined));
    setResult(null);
    setCaptainId(null);
    setTactics(0);
    setSubsMode(false);
    setRerolls(REROLL_BUDGET[difficulty]);
    recentNations.current = new Set();
    go("build");
    maybeShowHowTo();
    draw({}, Array(BENCH_SIZE).fill(undefined), f, mode, false);
  }
  function goHome() {
    setLineup({});
    setBench(Array(BENCH_SIZE).fill(undefined));
    setCandidates([]);
    setNation(null);
    setSel(null);
    setCaptainId(null);
    setResult(null);
    setFormation(null);
    setIsDaily(false);
    setSubsMode(false);
    setSeed(null);
    recentNations.current = new Set();
    go("mode");
  }

  function startAddSubs() {
    setSubsMode(true);
    draw(lineup, bench, formation, mode, true);
  }
  function finishSubs() {
    setSubsMode(false);
    setSel(null);
    setCandidates([]);
  }

  // Daily Challenge — seeded so everyone gets the same draws today.
  function startDaily() {
    setSeed(dailySeed());
    setIsDaily(true);
    setMode("position");
    setDifficulty("normal");
    const f = FORMATIONS.find((x) => x.name === "4-3-3") ?? FORMATIONS[0];
    setFormation(f);
    setLineup({});
    setBench(Array(BENCH_SIZE).fill(undefined));
    setResult(null);
    setCaptainId(null);
    setTactics(0);
    setSubsMode(false);
    setRerolls(8);
    recentNations.current = new Set();
    go("build");
    maybeShowHowTo();
    draw({}, Array(BENCH_SIZE).fill(undefined), f, "position", false);
  }

  function manualReshuffle() {
    if (generating) return;
    if (rerolls <= 0 && !budgetBlocked) return;
    // Reshuffling is free when you're over budget, so you can never get stuck.
    if (!budgetBlocked) setRerolls((r) => r - 1);
    draw(lineup, bench, formation, mode, subsMode);
  }
  function toggleCaptain(playerId: string) {
    setCaptainId((cur) => (cur === playerId ? null : playerId));
  }

  // ---- placement & swapping ----
  function commit(nl: Lineup, nb: (Player | undefined)[]) {
    setLineup(nl);
    setBench(nb);
  }
  function setLoc(nl: Lineup, nb: (Player | undefined)[], loc: Loc, p: Player | undefined) {
    if (loc.kind === "xi") nl[loc.slotId] = p;
    else nb[loc.index] = p;
  }

  function placeInXI(slotId: string) {
    if (!formation) return;
    const slotPos = formation.slots.find((s) => s.id === slotId)!.position;
    const occupant = lineup[slotId];
    if (!sel) {
      if (occupant) setSel({ player: occupant, origin: { kind: "xi", slotId } });
      return;
    }
    const { player: p, origin } = sel;
    const target: Loc = { kind: "xi", slotId };
    if (occupant) {
      // filled slot: swap (if compatible) else reselect occupant
      if (origin.kind !== "draw" && p.position === slotPos) {
        const nl = { ...lineup };
        const nb = [...bench];
        setLoc(nl, nb, target, p);
        setLoc(nl, nb, origin, occupant);
        commit(nl, nb);
        setSel(null);
      } else {
        setSel({ player: occupant, origin: { kind: "xi", slotId } });
      }
      return;
    }
    // empty slot — position must match
    if (p.position !== slotPos) return;
    if (origin.kind === "draw") {
      const nl = { ...lineup, [slotId]: p };
      commit(nl, bench);
      draw(nl, bench, formation, mode, subsMode);
    } else {
      const nl = { ...lineup };
      const nb = [...bench];
      setLoc(nl, nb, origin, undefined);
      setLoc(nl, nb, target, p);
      commit(nl, nb);
      setSel(null);
    }
  }

  function placeInBench(index: number) {
    const occupant = bench[index];
    if (!sel) {
      if (occupant) setSel({ player: occupant, origin: { kind: "bench", index } });
      return;
    }
    const { player: p, origin } = sel;
    const target: Loc = { kind: "bench", index };
    if (occupant) {
      if (origin.kind !== "draw") {
        const nl = { ...lineup };
        const nb = [...bench];
        setLoc(nl, nb, target, p);
        setLoc(nl, nb, origin, occupant);
        commit(nl, nb);
        setSel(null);
      } else {
        setSel({ player: occupant, origin: { kind: "bench", index } });
      }
      return;
    }
    if (origin.kind === "draw") {
      const nb = [...bench];
      nb[index] = p;
      commit(lineup, nb);
      const benchFull = (nb.filter(Boolean) as Player[]).length >= BENCH_SIZE;
      if (benchFull) {
        setSubsMode(false);
        setSel(null);
        setCandidates([]);
      } else {
        draw(lineup, nb, formation, mode, true);
      }
    } else {
      const nl = { ...lineup };
      const nb = [...bench];
      setLoc(nl, nb, origin, undefined);
      nb[index] = p;
      commit(nl, nb);
      setSel(null);
    }
  }

  function selectFromDraw(p: Player) {
    setSel((cur) => (cur?.player.id === p.id && cur.origin.kind === "draw" ? null : { player: p, origin: { kind: "draw" } }));
  }

  function autoFillRest() {
    if (!formation) return;
    loadDraft().then(({ notablePool }) => {
      const pool = notablePool();
      const used = new Set(placedIds);
      const nl: Lineup = { ...lineup };
      const nb = [...bench];
      let spend = spent;
      const cheapest = (opts: Player[]) => [...opts].sort((a, b) => playerCost(a.rating) - playerCost(b.rating))[0];
      // Budget-aware pick: prefer a random affordable player, else the cheapest.
      const pickWithin = (opts: Player[], xiLeft: number) => {
        const aff = opts.filter((p) => canAfford(p, spend, budget, xiLeft));
        const choice = aff.length ? aff[Math.floor(Math.random() * aff.length)] : cheapest(opts);
        if (choice) spend += playerCost(choice.rating);
        return choice;
      };
      const xiOpen = () => formation.slots.filter((s) => !nl[s.id]).length;
      for (const slot of formation.slots) {
        if (nl[slot.id]) continue;
        const opts = pool.filter((p) => p.position === slot.position && !used.has(p.id));
        const pick = pickWithin(opts, xiOpen());
        if (pick) {
          nl[slot.id] = pick;
          used.add(pick.id);
        }
      }
      for (let i = 0; i < BENCH_SIZE; i++) {
        if (nb[i]) continue;
        const opts = pool.filter((p) => !used.has(p.id) && canAfford(p, spend, budget, 0));
        if (!opts.length) break; // out of budget for subs
        const pick = opts[Math.floor(Math.random() * opts.length)];
        if (pick) {
          nb[i] = pick;
          used.add(pick.id);
          spend += playerCost(pick.rating);
        }
      }
      commit(nl, nb);
      setSel(null);
      setCandidates([]);
    });
  }

  function runSimulation() {
    if (!xiComplete || result) return;
    const seed = isDaily ? dailySeed() + 7 : null; // reproducible result for the daily
    const r = simulateTournament(xiPlayers, benchPlayers, { captainId, difficulty, tactics, seed });
    setResult(r);
    if (isDaily) {
      const grade = ["F", "F", "E", "D", "C", "B", "A", "S"][placementRank(r.userPlacement)] ?? "F";
      saveDaily(dailyKey(), { placement: r.userPlacement, won: r.userWon, grade });
    }
    setPhase("simulating");
  }

  const visibleCandidates = candidates.filter((c) => !placedIds.has(c.id));
  const benchEligible = sel != null;

  // What does the draft panel show right now?
  const showReady = xiComplete && !subsMode; // XI done → kickoff screen (cards hidden)
  const showNation = mode === "nation" && !xiComplete && !subsMode;
  const showToolbar = !showReady;

  // Is the budget the reason nothing can be picked right now?
  const remaining = budget - spent;
  const pickPool =
    showNation
      ? (nation?.players.filter((p) => !placedIds.has(p.id)) ?? [])
      : visibleCandidates;
  const budgetBlocked = !showReady && !sel && pickPool.length > 0 && pickPool.every((p) => !affordable(p));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6">
      <header className="relative mb-7 text-center">
        <button
          onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}
          className="absolute right-0 top-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10"
        >
          {muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-emerald-300" />}
        </button>
        <button onClick={goHome} className="group cursor-pointer">
          <span className="headline block text-4xl leading-none sm:text-5xl">
            <span className="brand-gradient">DICTATOR</span>{" "}
            <span className="text-slate-50 text-stroke">MBAPPÉ</span>
            <span className="ml-1 inline-block text-emerald-400 transition group-hover:rotate-12">⚽</span>
          </span>
        </button>
        <Stepper phase={phase} />
      </header>

      <AnimatePresence mode="wait">
        {phase === "mode" && (
          <motion.div key="mode" {...fade}>
            <ModePicker onPick={pickMode} onDaily={startDaily} difficulty={difficulty} onDifficulty={setDifficulty} />
          </motion.div>
        )}

        {phase === "formation" && (
          <motion.div key="formation" {...fade}>
            <div className="mb-4 flex justify-center">
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/10 hover:bg-white/10"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            </div>
            <FormationPicker onChoose={chooseFormation} />
          </motion.div>
        )}

        {phase === "build" && formation && (
          <motion.div key="build" {...fade} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Pitch + bench */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-sm font-bold text-emerald-300">
                    {formation.name}
                  </span>
                  <span className="text-sm text-slate-400">
                    XI {xiCount}/11 · Subs {benchCount}/{BENCH_SIZE}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-400/20">
                    One shot · no re-sim
                  </span>
                  <button
                    onClick={() => setShowHowTo(true)}
                    title="How to play"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10"
                  >
                    <HelpCircle className="h-4 w-4 text-slate-300" />
                  </button>
                </div>
              </div>

              <PitchView
                formation={formation}
                lineup={lineup}
                eligible={selectedPlayer?.position ?? null}
                onSlotClick={placeInXI}
                captainId={captainId}
                onSetCaptain={toggleCaptain}
                selectedId={sel?.origin.kind === "xi" ? selectedPlayer?.id : null}
              />

              {/* Bench */}
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Substitutes · tap to swap with the XI
                </div>
                <div className="flex flex-wrap gap-2">
                  {bench.map((p, i) =>
                    p ? (
                      <button
                        key={i}
                        onClick={() => placeInBench(i)}
                        className={[
                          "flex h-14 w-14 flex-col items-center justify-center rounded-xl text-center ring-1 transition",
                          sel?.origin.kind === "bench" && sel.origin.index === i
                            ? "bg-slate-900/70 ring-yellow-300"
                            : "bg-slate-900/70 ring-white/10 hover:ring-emerald-400/50",
                        ].join(" ")}
                      >
                        <span className="text-base leading-none">{flagFor(p.team)}</span>
                        <span className="mt-0.5 max-w-full truncate px-0.5 text-[9px] font-bold leading-tight">
                          {p.name.split(" ").slice(-1)[0]}
                        </span>
                        <span className="font-mono text-[8px] text-emerald-300">{p.rating}</span>
                      </button>
                    ) : (
                      <button
                        key={i}
                        onClick={() => placeInBench(i)}
                        className={[
                          "flex h-14 w-14 flex-col items-center justify-center rounded-xl text-center transition",
                          benchEligible ? "slot-open bg-yellow-300/15" : "border border-dashed border-white/20 bg-white/5",
                        ].join(" ")}
                      >
                        <span className="text-[10px] font-semibold text-white/40">SUB</span>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="glass mt-4 space-y-3 rounded-2xl p-3.5">
                <Meter label="Team Strength" value={strength || 0} display={strength || "—"} from="from-emerald-500" via="via-teal-400" to="to-yellow-300" />
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                      <Coins className="h-4 w-4 text-yellow-300" /> Star Budget
                    </span>
                    <span className="font-mono text-sm font-bold text-yellow-300">
                      {budget - spent}
                      <span className="text-slate-500"> / {budget}</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500"
                      animate={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                      <Link2 className="h-4 w-4 text-violet-300" /> Chemistry
                    </span>
                    <span className="font-mono text-sm font-bold text-violet-300">
                      {chemistry.score}
                      {chemistry.bonus > 0 && <span className="ml-1 text-emerald-300">+{chemistry.bonus}</span>}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                      animate={{ width: `${chemistry.score}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    />
                  </div>
                </div>
                {/* Tactics slider */}
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                      <Sliders className="h-4 w-4 text-sky-300" /> Tactics
                    </span>
                    <span className="text-xs font-semibold text-sky-300">
                      {tactics < -0.33 ? "Defensive" : tactics > 0.33 ? "Attacking" : "Balanced"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={10}
                    value={Math.round(tactics * 100)}
                    onChange={(e) => setTactics(Number(e.target.value) / 100)}
                    className="mt-2 w-full accent-sky-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Park the bus</span>
                    <span>All-out attack</span>
                  </div>
                </div>
                <p className="border-t border-white/5 pt-2 text-[11px] text-slate-500">
                  {captainId
                    ? `Captain: ${xiPlayers.find((p) => p.id === captainId)?.name ?? "—"}`
                    : "Tap the crown on a starter to name your captain"}
                </p>
              </div>
            </div>

            {/* Draft panel */}
            <div>
              {showToolbar && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={manualReshuffle}
                    disabled={generating || (rerolls <= 0 && !budgetBlocked)}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-2.5 font-semibold text-emerald-950 shadow-lg shadow-emerald-900/40 transition hover:brightness-110 disabled:opacity-40"
                  >
                    {mode === "nation" && !subsMode ? <Dices className="h-4 w-4" /> : <Shuffle className="h-4 w-4" />}
                    {generating
                      ? "Drawing…"
                      : budgetBlocked && rerolls <= 0
                        ? "Free reshuffle"
                        : mode === "nation" && !subsMode
                          ? "New Nation"
                          : "Reshuffle"}
                  </button>
                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ring-1",
                      rerolls <= 2 ? "bg-rose-500/15 text-rose-200 ring-rose-400/30" : "bg-white/5 text-slate-300 ring-white/10",
                    ].join(" ")}
                    title="Manual rerolls left (placing a player draws the next set free)"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> {rerolls} left
                  </span>
                  {!subsMode ? (
                    <button
                      onClick={autoFillRest}
                      className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      <Wand2 className="h-4 w-4" /> Auto-fill
                    </button>
                  ) : (
                    <button
                      onClick={finishSubs}
                      className="inline-flex items-center gap-2 rounded-full bg-yellow-400/90 px-4 py-2.5 text-sm font-bold text-amber-950 transition hover:brightness-110"
                    >
                      <Trophy className="h-4 w-4" /> Done — to kickoff
                    </button>
                  )}
                </div>
              )}

              <AnimatePresence>
                {selectedPlayer && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3 overflow-hidden rounded-xl bg-yellow-300/10 px-3 py-2 text-sm text-yellow-100 ring-1 ring-yellow-300/30"
                  >
                    <strong>{selectedPlayer.name}</strong> selected — tap a glowing{" "}
                    <strong>{selectedPlayer.position}</strong> slot or a sub spot.
                  </motion.p>
                )}
              </AnimatePresence>

              {!generating && budgetBlocked && (
                <div className="mb-3 rounded-xl bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100 ring-1 ring-amber-300/30">
                  <strong>Out of star points.</strong> You&apos;ve spent ★{spent} of ★{budget} on big
                  names — only <strong>★{remaining}</strong> left, and {mode === "nation" ? "every remaining player in this squad" : "every player drawn"}{" "}
                  costs more than that. You front-loaded too many stars: hit{" "}
                  <strong>{mode === "nation" ? "New Nation" : "Reshuffle"}</strong> for cheaper
                  options{xiComplete ? "" : ", or fill your remaining starters with budget players"}.
                </div>
              )}

              {generating ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="shimmer h-36 rounded-2xl" />
                  ))}
                </div>
              ) : showReady ? (
                <KickoffPanel
                  strength={strength}
                  chemistry={chemistry.score}
                  benchCount={benchCount}
                  benchSize={BENCH_SIZE}
                  captainName={captainId ? (xiPlayers.find((p) => p.id === captainId)?.name ?? null) : null}
                  tacticsLabel={tactics < -0.33 ? "Defensive" : tactics > 0.33 ? "Attacking" : "Balanced"}
                  onSimulate={runSimulation}
                  onAddSubs={startAddSubs}
                />
              ) : showNation && nation ? (
                <NationSquadPanel
                  squad={nation}
                  takenIds={placedIds}
                  affordable={affordable}
                  selectedId={sel?.origin.kind === "draw" ? selectedPlayer?.id ?? null : null}
                  onPick={selectFromDraw}
                />
              ) : visibleCandidates.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {subsMode ? "Pick your substitutes" : "Pick for your XI"}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {visibleCandidates.map((c) => (
                        <PlayerCard
                          key={c.id}
                          player={c}
                          selected={c.id === selectedPlayer?.id && sel?.origin.kind === "draw"}
                          disabled={!affordable(c)}
                          disabledLabel="Over budget"
                          cost={playerCost(c.rating)}
                          size="sm"
                          onClick={() => selectFromDraw(c)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <EmptyHint title="No draw" text="Hit the draw button for a fresh set." />
              )}
            </div>
          </motion.div>
        )}

        {phase === "simulating" && result && (
          <motion.div key="sim" {...fade}>
            <SimulationView result={result} onDone={() => go("results")} />
          </motion.div>
        )}

        {phase === "results" && result && (
          <motion.div key="results" {...fade}>
            <ResultsView
              result={result}
              xi={xiPlayers}
              formation={formation}
              captainId={captainId}
              difficulty={difficulty}
              onPlayAgain={goHome}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{showHowTo && <HowToPlay onClose={closeHowTo} />}</AnimatePresence>

      <footer className="mt-14 border-t border-white/5 pt-6 pb-8 text-center text-xs text-slate-500">
        <p className="text-sm">
          Built by{" "}
          <span className="font-semibold brand-gradient">Shorya Baj</span>
        </p>
        <p className="mt-1.5">
          <a
            href="https://github.com/bajshorya/dictator_mbappe"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 font-medium text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Open source on GitHub
          </a>
        </p>
        <p className="mt-3 text-[11px] text-slate-600">
          Squad data: Fjelstul World Cup Database (CC-BY-SA). Ratings reflect each player&apos;s
          performance in that specific World Cup.
        </p>
      </footer>
    </main>
  );
}

function Meter({
  label,
  value,
  display,
  from,
  via,
  to,
}: {
  label: string;
  value: number;
  display: string | number;
  from: string;
  via: string;
  to: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="font-mono text-lg font-bold text-emerald-300">{display}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${from} ${via} ${to}`}
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

function Stepper({ phase }: { phase: Phase }) {
  const labels = ["Mode", "Formation", "Squad", "World Cup"];
  const idx = phase === "mode" ? 0 : phase === "formation" ? 1 : phase === "build" ? 2 : 3;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-xs font-semibold">
      {labels.map((l, i) => (
        <span
          key={l}
          className={[
            "rounded-full px-3 py-1 transition",
            i <= idx ? "bg-emerald-500/25 text-emerald-300" : "bg-white/5 text-slate-500",
          ].join(" ")}
        >
          {i + 1} · {l}
        </span>
      ))}
    </div>
  );
}

function EmptyHint({ title, text }: { title: string; text: string }) {
  return (
    <div className="glass flex h-48 flex-col items-center justify-center rounded-2xl px-6 text-center">
      <p className="font-semibold text-slate-200">{title}</p>
      <p className="mt-2 max-w-xs text-sm text-slate-400">{text}</p>
    </div>
  );
}

function KickoffPanel({
  strength,
  chemistry,
  benchCount,
  benchSize,
  captainName,
  tacticsLabel,
  onSimulate,
  onAddSubs,
}: {
  strength: number;
  chemistry: number;
  benchCount: number;
  benchSize: number;
  captainName: string | null;
  tacticsLabel: string;
  onSimulate: () => void;
  onAddSubs: () => void;
}) {
  const stats = [
    { label: "Strength", value: strength, color: "text-emerald-300" },
    { label: "Chemistry", value: chemistry, color: "text-violet-300" },
    { label: "Subs", value: `${benchCount}/${benchSize}`, color: "text-sky-300" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
      className="surface relative overflow-hidden rounded-3xl p-6 text-center"
    >
      <motion.div
        className="floaty pointer-events-none absolute -right-6 -top-6 text-7xl opacity-20"
        aria-hidden
      >
        ⚽
      </motion.div>
      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300">
        <Sparkles className="h-3.5 w-3.5" /> Squad locked in
      </div>
      <h3 className="headline mt-3 text-3xl">Ready for kickoff</h3>
      <p className="mt-1 text-sm text-slate-400">
        {tacticsLabel} setup{captainName ? ` · ©️ ${captainName}` : ""}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white/5 px-2 py-2.5 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className={`font-mono text-xl font-black ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <button
        onClick={onSimulate}
        className="btn-hero headline mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-2xl"
      >
        <Trophy className="h-6 w-6" /> RULE THE WORLD CUP
      </button>

      {benchCount < benchSize && (
        <button
          onClick={onAddSubs}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 transition hover:text-white"
        >
          <PlusCircle className="h-4 w-4" /> Add {benchSize - benchCount} substitute{benchSize - benchCount === 1 ? "" : "s"} (optional)
        </button>
      )}
    </motion.div>
  );
}

function ModePicker({
  onPick,
  onDaily,
  difficulty,
  onDifficulty,
}: {
  onPick: (m: GameMode) => void;
  onDaily: () => void;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
}) {
  const [hof, setHof] = useState<HallOfFame | null>(null);
  const [daily, setDaily] = useState<ReturnType<typeof getDaily>>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setHof(getHallOfFame());
      setDaily(getDaily(dailyKey()));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const cards: { mode: GameMode; icon: typeof Shuffle; title: string; desc: string; chip: string; ring: string }[] = [
    {
      mode: "position",
      icon: Layers,
      title: "Position Draft",
      desc: "Each draw offers a player for every open spot. Pick one, place him, and a fresh set appears — build your XI position by position.",
      chip: "bg-emerald-400/15 text-emerald-300",
      ring: "hover:ring-emerald-400/70",
    },
    {
      mode: "nation",
      icon: Users,
      title: "By Nation",
      desc: "Each draw shows a full national squad from a random World Cup. Take one player, then a new nation appears. Build a squad from across the globe.",
      chip: "bg-sky-400/15 text-sky-300",
      ring: "hover:ring-sky-400/70",
    },
  ];
  const legends =
    "Maradona ’86 · Messi ’22 · Ronaldo ’02 · Zidane ’98 · Mbappé ’18 · Pelé-era greats · Cannavaro ’06 · Iniesta ’10 · Schillaci ’90 · Romário ’94 · Modrić ’18 · Müller ’14 · Baggio ’94 · Klose · Suárez · ";
  return (
    <div>
      {/* Hero */}
      <div className="mb-8 text-center">
        <h1 className="headline text-balance text-3xl sm:text-5xl">
          Assemble the greatest <span className="brand-gradient">World Cup XI</span> ever assembled.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
          Draft legends from 1982–2022, build chemistry, set your tactics — then watch your dream
          squad rule a 48-team World Cup. One shot. No mercy.
        </p>
        <div className="marquee mt-5 text-sm font-semibold text-slate-500">
          <div>
            {legends}
            {legends}
          </div>
        </div>
      </div>

      {hof && hof.plays > 0 && (
        <div className="glass mx-auto mb-6 max-w-2xl rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-yellow-300">Hall of Fame</span>
            <span className="text-[11px] text-slate-400">
              {hof.plays} run{hof.plays === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="text-slate-400">Best: </span>
              <strong className="text-emerald-300">{hof.bestPlacement}</strong>
            </span>
            <span>
              <span className="text-slate-400">Titles: </span>
              <strong className="text-yellow-300">{hof.titles}</strong>
            </span>
          </div>
          {hof.champXi && hof.champXi.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="mr-1 text-[11px] text-slate-500">Champion XI:</span>
              {hof.champXi.map((p, i) => (
                <span key={i} className="text-[11px] text-slate-300" title={`${p.name} · WC ${p.year}`}>
                  {flagFor(p.team)} {p.name.split(" ").slice(-1)[0]}
                  {i < hof.champXi!.length - 1 ? "," : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Daily Challenge */}
      <div className="mx-auto mb-6 max-w-2xl">
        <button
          onClick={onDaily}
          className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-600/30 to-fuchsia-600/20 p-4 text-left ring-1 ring-violet-400/40 transition hover:ring-violet-300/70"
        >
          <div className="flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-violet-200" />
            <div>
              <div className="font-display text-lg">Daily Challenge</div>
              <div className="text-xs text-slate-300">
                Same seeded draws for everyone today · 4-3-3 · 8 rerolls
              </div>
            </div>
          </div>
          {daily ? (
            <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-emerald-300">
              Today: {daily.grade} · {daily.placement.replace("Eliminated in the ", "")}
            </span>
          ) : (
            <span className="rounded-full bg-violet-400/20 px-3 py-1 text-xs font-bold text-violet-100">Play ▸</span>
          )}
        </button>
      </div>

      <div className="mb-6 flex flex-col items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Difficulty</span>
        <div className="inline-flex rounded-full bg-white/5 p-1 ring-1 ring-white/10">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.key}
              onClick={() => onDifficulty(d.key)}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                difficulty === d.key ? "bg-emerald-500 text-emerald-950" : "text-slate-300 hover:text-white",
              ].join(" ")}
            >
              {d.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500">
          Stronger rivals & fewer rerolls on harder settings ({REROLL_BUDGET[difficulty]} rerolls)
        </span>
      </div>

      <h2 className="mb-5 text-center text-lg font-semibold text-slate-200">Choose how you draft</h2>
      <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
        {cards.map((c, i) => (
          <motion.button
            key={c.mode}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -6 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPick(c.mode)}
            className={`surface group rounded-2xl p-6 text-left transition ${c.ring}`}
          >
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${c.chip}`}>
              <c.icon className="h-6 w-6" />
            </div>
            <h3 className="headline mt-4 text-2xl">{c.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{c.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-300 transition group-hover:gap-2 group-hover:text-white">
              Start drafting →
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function FormationPicker({ onChoose }: { onChoose: (f: Formation) => void }) {
  const empty: Lineup = {};
  return (
    <div>
      <h2 className="headline mb-1 text-center text-3xl">Pick your shape</h2>
      <p className="mb-5 text-center text-sm text-slate-400">Your formation sets the slots you’ll draft into.</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {FORMATIONS.map((f, i) => {
          const counts = POSITIONS.map((p) => `${f.slots.filter((s) => s.position === p).length}${p[0]}`);
          return (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.98 }}
              role="button"
              tabIndex={0}
              onClick={() => onChoose(f)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChoose(f)}
              className="surface group cursor-pointer rounded-2xl p-3 transition hover:ring-emerald-400/70"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="headline text-2xl brand-gradient">{f.name}</span>
                <span className="font-mono text-[10px] text-slate-500">{counts.join(" ")}</span>
              </div>
              <div className="pointer-events-none mx-auto max-w-[150px]">
                <PitchView formation={f} lineup={empty} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

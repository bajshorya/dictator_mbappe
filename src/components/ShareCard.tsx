"use client";

import { forwardRef } from "react";
import type { Difficulty, Player, TournamentResult } from "@/lib/types";
import { flagFor, teamFlag } from "@/lib/flags";
import { placementRank } from "@/lib/storage";

const POS_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
const GRADE = ["F", "F", "E", "D", "C", "B", "A", "S"];

interface Props {
  result: TournamentResult;
  xi: Player[];
  formationName?: string;
  difficulty: Difficulty;
  strength: number;
  chemistry: number;
}

/** A self-contained card designed to be exported as an image and shared. */
const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard(
  { result, xi, formationName, difficulty, strength, chemistry },
  ref,
) {
  const grade = GRADE[placementRank(result.userPlacement)] ?? "F";
  const sorted = [...xi].sort((a, b) => POS_ORDER[a.position] - POS_ORDER[b.position] || b.rating - a.rating);
  const topScorer = result.playerStats.find((s) => s.goals > 0);

  return (
    <div
      ref={ref}
      style={{
        width: 380,
        background: "linear-gradient(160deg, #0b1830 0%, #071018 55%, #0a0f1a 100%)",
        color: "#eef2f7",
      }}
      className="overflow-hidden rounded-3xl p-6 ring-1 ring-white/10"
    >
      <div className="flex items-center justify-between">
        <div className="font-display text-2xl tracking-tight">
          <span className="text-emerald-400">FOOTY</span>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {difficulty} · {formationName}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-400">Final result</div>
          <div className="font-display text-2xl leading-tight">{result.userPlacement}</div>
          <div className="mt-1 text-xs text-slate-400">
            Won by {teamFlag(result.champion)} {result.champion}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Grade</div>
          <div
            className="font-display text-5xl leading-none"
            style={{ color: grade === "S" ? "#fde047" : grade === "A" ? "#34d399" : "#7dd3fc" }}
          >
            {grade}
          </div>
        </div>
      </div>

      {/* XI */}
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {sorted.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5 text-[11px]"
          >
            <span className="text-sm">{flagFor(p.team)}</span>
            <span className="flex-1 truncate font-semibold">{p.name}</span>
            <span className="font-mono text-emerald-300">{p.rating}</span>
          </div>
        ))}
      </div>

      {/* stats */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Strength" value={strength} />
        <Stat label="Chemistry" value={chemistry} />
        <Stat label="Top scorer" value={topScorer ? `${topScorer.goals}` : "0"} sub={topScorer?.player.name.split(" ").slice(-1)[0]} />
      </div>

      {result.tournamentMvp && (
        <div className="mt-3 rounded-xl bg-violet-300/10 px-3 py-2 text-center text-[11px] text-violet-200 ring-1 ring-violet-300/20">
          ★ Player of the Tournament: {flagFor(result.tournamentMvp.team)} {result.tournamentMvp.name}
        </div>
      )}

      <div className="mt-4 text-center text-[10px] text-slate-500">
        Build your all-time World Cup XI · Footy
      </div>
    </div>
  );
});

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-2 py-2 ring-1 ring-white/10">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-mono text-lg font-bold text-emerald-300">{value}</div>
      {sub && <div className="truncate text-[9px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default ShareCard;

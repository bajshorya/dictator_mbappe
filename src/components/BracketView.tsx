"use client";

import type { RoundResult } from "@/lib/types";
import { USER_TEAM_NAME } from "@/data/teams";
import { teamFlag } from "@/lib/flags";

const SHORT: Record<string, string> = {
  "Round of 32": "R32",
  "Round of 16": "R16",
  "Quarter-Finals": "QF",
  "Semi-Finals": "SF",
  Final: "Final",
};

function short(name: string) {
  return name === USER_TEAM_NAME ? "Your XI" : name;
}

function Cell({
  home,
  away,
  hg,
  ag,
  winner,
}: {
  home: string;
  away: string;
  hg: number;
  ag: number;
  winner: string;
}) {
  const row = (name: string, goals: number) => {
    const isUser = name === USER_TEAM_NAME;
    const won = winner === name;
    return (
      <div
        className={[
          "flex items-center justify-between gap-1 px-1.5 py-1 text-[10px] leading-none",
          won ? "font-bold text-white" : "text-slate-400",
          isUser ? "bg-yellow-300/15" : "",
        ].join(" ")}
      >
        <span className="flex items-center gap-1 truncate">
          <span>{teamFlag(name)}</span>
          <span className="max-w-[64px] truncate">{short(name)}</span>
        </span>
        <span className="font-mono">{goals}</span>
      </div>
    );
  };
  return (
    <div className="w-[110px] overflow-hidden rounded-md bg-slate-900/60 ring-1 ring-white/10">
      {row(home, hg)}
      <div className="h-px bg-white/10" />
      {row(away, ag)}
    </div>
  );
}

export default function BracketView({ koRounds }: { koRounds: RoundResult[] }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {koRounds.map((round) => (
          <div key={round.name} className="flex flex-col">
            <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              {SHORT[round.name] ?? round.name}
            </div>
            <div className="flex flex-1 flex-col justify-around gap-1.5">
              {round.matches.map((m, i) => (
                <Cell
                  key={i}
                  home={m.home}
                  away={m.away}
                  hg={m.homeGoals}
                  ag={m.awayGoals}
                  winner={m.winner === "draw" ? "" : m.winner}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

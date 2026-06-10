"use client";

import { motion } from "motion/react";
import type { Player, Squad } from "@/lib/types";
import { flagFor } from "@/lib/flags";
import PlayerCard from "@/components/PlayerCard";

const FINISH_COLOR: Record<string, string> = {
  Winner: "bg-yellow-300/20 text-yellow-200 ring-yellow-300/40",
  "Runner-up": "bg-slate-200/15 text-slate-100 ring-slate-300/40",
  "Semi-finals": "bg-emerald-300/15 text-emerald-200 ring-emerald-300/30",
  "Quarter-finals": "bg-sky-300/15 text-sky-200 ring-sky-300/30",
};

interface Props {
  squad: Squad;
  takenIds: Set<string>;
  selectedId: string | null;
  onPick: (p: Player) => void;
}

export default function NationSquadPanel({ squad, takenIds, selectedId, onPick }: Props) {
  return (
    <motion.div
      key={`${squad.team}-${squad.year}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl">{flagFor(squad.team)}</span>
          <div>
            <div className="font-display text-xl leading-none">{squad.team}</div>
            <div className="font-mono text-xs text-slate-400">World Cup {squad.year}</div>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
            FINISH_COLOR[squad.finish] ?? "bg-white/5 text-slate-300 ring-white/10"
          }`}
        >
          {squad.finish}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {squad.players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            size="sm"
            disabled={takenIds.has(p.id)}
            selected={p.id === selectedId}
            onClick={() => onPick(p)}
          />
        ))}
      </div>
    </motion.div>
  );
}

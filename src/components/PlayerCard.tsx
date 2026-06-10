"use client";

import { motion } from "motion/react";
import { Award, Target } from "lucide-react";
import type { Player } from "@/lib/types";
import { flagFor } from "@/lib/flags";

const POS_COLOR: Record<string, string> = {
  GK: "bg-amber-400 text-amber-950",
  DEF: "bg-sky-400 text-sky-950",
  MID: "bg-emerald-400 text-emerald-950",
  FWD: "bg-rose-400 text-rose-950",
};

// Card tint by rating tier — gold / silver / bronze.
function tier(rating: number): string {
  if (rating >= 88) return "from-yellow-300/25 via-amber-500/10 to-transparent ring-yellow-300/50";
  if (rating >= 80) return "from-slate-200/15 via-slate-400/5 to-transparent ring-slate-300/40";
  return "from-orange-300/15 via-orange-600/5 to-transparent ring-orange-400/40";
}

interface Props {
  player: Player;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean; // taken or unaffordable
  disabledLabel?: string; // why it's blocked, e.g. "Over budget"
  cost?: number; // star-points cost
  size?: "sm" | "md";
}

export default function PlayerCard({
  player,
  onClick,
  selected,
  disabled,
  disabledLabel = "Picked",
  cost,
  size = "md",
}: Props) {
  const overBudget = disabledLabel === "Over budget";
  const interactive = !!onClick && !disabled;
  return (
    <motion.button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      layout
      initial={{ opacity: 0, y: 14, scale: 0.92 }}
      animate={{ opacity: disabled ? 0.4 : 1, y: 0, scale: selected ? 1.04 : 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      whileHover={interactive ? { y: -5 } : undefined}
      whileTap={interactive ? { scale: 0.97 } : undefined}
      className={[
        "group relative w-full overflow-hidden rounded-2xl bg-gradient-to-b text-left ring-1 backdrop-blur",
        tier(player.rating),
        size === "md" ? "p-3.5" : "p-2.5",
        interactive ? "cursor-pointer" : disabled ? "cursor-not-allowed" : "",
        selected ? "ring-2 ring-yellow-300 shadow-lg shadow-yellow-400/20" : "",
      ].join(" ")}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 transition group-hover:opacity-100" />

      <div className="flex items-start justify-between">
        <div className="flex flex-col items-center leading-none">
          <span
            className={[
              "font-mono font-bold tabular-nums",
              size === "md" ? "text-2xl" : "text-xl",
              player.rating >= 88 ? "text-yellow-300" : "text-slate-100",
            ].join(" ")}
          >
            {player.rating}
          </span>
          <span className={`mt-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${POS_COLOR[player.position]}`}>
            {player.position}
          </span>
        </div>
        <span className={size === "md" ? "text-2xl" : "text-xl"}>{flagFor(player.team)}</span>
      </div>

      <div className="mt-2.5">
        <div
          className={`truncate font-semibold leading-tight ${size === "md" ? "text-sm" : "text-[13px]"}`}
          title={player.name}
        >
          {player.name}
        </div>
        <div className="mt-1 truncate text-[11px] text-slate-300">{player.team}</div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
          WC {player.year}
        </span>
        <div className="flex items-center gap-1.5">
          {cost != null && (
            <span className="rounded bg-yellow-300/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-yellow-200">
              ★{cost}
            </span>
          )}
          {player.award ? (
            <span className="text-yellow-200" title={player.award}>
              <Award className="h-3 w-3" />
            </span>
          ) : player.goals > 0 ? (
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-amber-200/90">
              <Target className="h-3 w-3" />
              {player.goals}
            </span>
          ) : null}
        </div>
      </div>

      {disabled && (
        <span
          className={[
            "absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-slate-950/55 text-center text-[11px] font-bold uppercase tracking-wide",
            overBudget ? "text-amber-300" : "text-slate-300",
          ].join(" ")}
        >
          {disabledLabel}
          {overBudget && cost != null && (
            <span className="text-[9px] font-medium normal-case text-amber-200/80">costs ★{cost}</span>
          )}
        </span>
      )}
    </motion.button>
  );
}

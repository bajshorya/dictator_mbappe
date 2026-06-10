"use client";

import { AnimatePresence, motion } from "motion/react";
import { Crown } from "lucide-react";
import type { Formation, Lineup, Position } from "@/lib/types";
import { flagFor } from "@/lib/flags";

const POS_RING: Record<Position, string> = {
  GK: "ring-amber-400/80",
  DEF: "ring-sky-400/80",
  MID: "ring-emerald-400/80",
  FWD: "ring-rose-400/80",
};

interface Props {
  formation: Formation;
  lineup: Lineup;
  eligible?: Position | null;
  onSlotClick?: (slotId: string) => void;
  captainId?: string | null;
  onSetCaptain?: (playerId: string) => void;
  selectedId?: string | null;
}

export default function PitchView({
  formation,
  lineup,
  eligible,
  onSlotClick,
  captainId,
  onSetCaptain,
  selectedId,
}: Props) {
  return (
    <div className="pitch mx-auto aspect-[3/4] w-full max-w-md shadow-2xl shadow-emerald-950/50">
      <div className="pitch-circle" />
      <div className="pitch-box top" />
      <div className="pitch-box bottom" />
      {formation.slots.map((slot) => {
        const player = lineup[slot.id];
        const isOpenTarget = !player && eligible === slot.position;
        const isCaptain = player && player.id === captainId;
        return (
          <div
            key={slot.id}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <AnimatePresence mode="popLayout">
              {player ? (
                <motion.div
                  key={player.id}
                  initial={{ scale: 0, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => onSlotClick?.(slot.id)}
                    title="Tap to select / swap"
                    className={[
                      "flex w-16 flex-col items-center rounded-xl bg-slate-950/80 px-1 py-1 text-center ring-2 backdrop-blur transition",
                      player.id === selectedId ? "ring-yellow-300 scale-105" : POS_RING[slot.position],
                    ].join(" ")}
                  >
                    <span className="text-lg leading-none">{flagFor(player.team)}</span>
                    <span className="mt-0.5 max-w-full truncate text-[10px] font-bold leading-tight">
                      {player.name.split(" ").slice(-1)[0]}
                    </span>
                    <span className="font-mono text-[9px] text-emerald-300">{player.rating}</span>
                  </button>
                  {onSetCaptain && (
                    <button
                      type="button"
                      onClick={() => onSetCaptain(player.id)}
                      title={isCaptain ? "Captain" : "Make captain"}
                      className={[
                        "absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-1 transition",
                        isCaptain
                          ? "bg-yellow-400 text-yellow-950 ring-yellow-300"
                          : "bg-slate-800 text-slate-400 ring-white/15 hover:text-yellow-300",
                      ].join(" ")}
                    >
                      <Crown className="h-3 w-3" />
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.button
                  key="empty"
                  type="button"
                  onClick={() => onSlotClick?.(slot.id)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={[
                    "flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed text-[11px] font-bold",
                    onSlotClick ? "cursor-pointer" : "cursor-default",
                    isOpenTarget
                      ? "slot-open border-yellow-300 bg-yellow-300/20 text-yellow-100"
                      : "border-white/45 bg-black/25 text-white/75",
                  ].join(" ")}
                >
                  {slot.position}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

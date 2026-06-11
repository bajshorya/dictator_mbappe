"use client";

import { motion } from "motion/react";
import { Award, Coins, Link2, RefreshCw, Shuffle, Sliders, Trophy, X } from "lucide-react";

const STEPS: { icon: typeof Shuffle; title: string; text: string }[] = [
  {
    icon: Shuffle,
    title: "Draft 11 + 7 subs",
    text: "Tap a drawn player, then tap a matching pitch slot or sub spot. Placing one auto-draws the next set.",
  },
  {
    icon: Coins,
    title: "Mind the star budget",
    text: "Every legend costs star points — you can't field eleven 99s. Cards you can't afford show ‘Over budget’.",
  },
  {
    icon: Link2,
    title: "Build chemistry",
    text: "Players from the same nation or era link up and boost your team strength. A themed spine pays off.",
  },
  {
    icon: Award,
    title: "Name a captain",
    text: "Tap the crown on a starter — your captain adds strength and is your go-to scorer.",
  },
  {
    icon: Sliders,
    title: "Set your tactics",
    text: "Slide between defensive and attacking to trade goals scored for goals conceded.",
  },
  {
    icon: RefreshCw,
    title: "Rerolls are limited",
    text: "Manual reshuffles are capped (free if you’re ever stuck over budget). Choose wisely.",
  },
  {
    icon: Trophy,
    title: "Picks are final — then play",
    text: "You can swap starters with subs, but placed players stay in the squad. Build it, then it’s ONE shot at the World Cup.",
  },
];

export default function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 ring-1 ring-white/10"
      >
        <div className="sticky top-0 flex items-center justify-between bg-slate-900/90 px-6 py-4 backdrop-blur">
          <h3 className="font-display text-2xl">How to play</h3>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm text-slate-400">{s.text}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-slate-950/90 px-6 py-4 backdrop-blur">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 text-lg font-bold text-emerald-950 transition hover:brightness-110"
          >
            Let&apos;s build it
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

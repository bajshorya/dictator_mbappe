"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { MatchResult } from "@/lib/types";
import { teamFlag } from "@/lib/flags";
import { USER_TEAM_NAME } from "@/data/teams";

function placeMakes(n: number): boolean[] {
  const arr = Array(5).fill(false);
  const idx = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, Math.max(0, Math.min(5, n)));
  for (const i of idx) arr[i] = true;
  return arr;
}

function Dots({ kicks, taken }: { kicks: boolean[]; taken: number }) {
  return (
    <div className="flex gap-1.5">
      {kicks.map((made, i) => (
        <span
          key={i}
          className={[
            "h-3.5 w-3.5 rounded-full ring-1",
            i >= taken
              ? "bg-slate-700 ring-white/10"
              : made
                ? "bg-emerald-400 ring-emerald-300"
                : "bg-rose-500 ring-rose-400",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

interface Props {
  match: MatchResult;
  onDone: () => void;
}

/** Choreographed but interactive shootout — taps reveal the sim's outcome. */
export default function Shootout({ match, onDone }: Props) {
  const userIsHome = match.home === USER_TEAM_NAME;
  const userPens = (userIsHome ? match.homePens : match.awayPens) ?? 0;
  const oppPens = (userIsHome ? match.awayPens : match.homePens) ?? 0;
  const oppName = userIsHome ? match.away : match.home;
  const userWon = match.winner === USER_TEAM_NAME;

  const script = useMemo(() => ({ user: placeMakes(userPens), opp: placeMakes(oppPens) }), [userPens, oppPens]);
  const [step, setStep] = useState(0); // 0..10 (even = user shoots, odd = opp shoots)
  const [flash, setFlash] = useState<string | null>(null);

  const userTaken = Math.ceil(step / 2);
  const oppTaken = Math.floor(step / 2);
  const userScore = script.user.slice(0, userTaken).filter(Boolean).length;
  const oppScore = script.opp.slice(0, oppTaken).filter(Boolean).length;
  const finished = step >= 10;
  const yourTurn = step % 2 === 0;

  function tap() {
    if (finished) return;
    const made = yourTurn ? script.user[userTaken] : script.opp[oppTaken];
    setFlash(yourTurn ? (made ? "GOAL!" : "Saved!") : made ? "Scored" : "SAVED!");
    setStep((s) => s + 1);
    window.setTimeout(() => setFlash(null), 700);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center ring-1 ring-white/10"
      >
        <h3 className="font-display text-2xl">Penalty Shootout</h3>
        <p className="mt-1 text-sm text-slate-400">
          {teamFlag(USER_TEAM_NAME)} Your XI vs {teamFlag(oppName)} {oppName}
        </p>

        {/* goal */}
        <div className="relative mx-auto mt-5 h-28 w-full max-w-xs rounded-lg border-4 border-white/70 bg-emerald-700/30">
          <motion.div
            key={step}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center text-3xl font-black"
          >
            {flash ? (
              <span className={flash.includes("GOAL") || flash === "Scored" ? "text-emerald-300" : "text-rose-300"}>
                {flash}
              </span>
            ) : (
              <span className="text-5xl">⚽</span>
            )}
          </motion.div>
        </div>

        <div className="mt-5 space-y-2 text-left">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{teamFlag(USER_TEAM_NAME)} You</span>
            <Dots kicks={script.user} taken={userTaken} />
            <span className="font-mono text-lg font-bold text-emerald-300">{userScore}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">
              {teamFlag(oppName)} {oppName}
            </span>
            <Dots kicks={script.opp} taken={oppTaken} />
            <span className="font-mono text-lg font-bold text-slate-300">{oppScore}</span>
          </div>
        </div>

        {finished ? (
          <div className="mt-6">
            <p className={`font-display text-2xl ${userWon ? "text-emerald-300" : "text-rose-300"}`}>
              {userWon ? "You win the shootout!" : "Heartbreak — knocked out."}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {userPens}–{oppPens} on penalties
            </p>
            <button
              onClick={onDone}
              className="mt-4 rounded-full bg-emerald-500 px-6 py-2.5 font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              Continue
            </button>
          </div>
        ) : (
          <button
            onClick={tap}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 px-6 py-4 text-lg font-black text-amber-950 transition hover:brightness-110"
          >
            {yourTurn ? "SHOOT ⚽" : "DIVE 🧤"}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

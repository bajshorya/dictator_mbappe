"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { MatchResult } from "@/lib/types";
import { teamFlag } from "@/lib/flags";
import { sound } from "@/lib/sound";
import { USER_TEAM_NAME } from "@/data/teams";

function placeMakes(n: number): boolean[] {
  const arr = Array(5).fill(false);
  const idx = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, Math.max(0, Math.min(5, n)));
  for (const i of idx) arr[i] = true;
  return arr;
}

function Dots({ kicks, taken, color }: { kicks: boolean[]; taken: number; color: string }) {
  return (
    <div className="flex gap-1.5">
      {kicks.map((made, i) => (
        <motion.span
          key={i}
          animate={i === taken - 1 ? { scale: [1.6, 1] } : {}}
          className={[
            "h-4 w-4 rounded-full ring-2",
            i >= taken ? "bg-slate-700 ring-white/10" : made ? `${color} ring-white/40` : "bg-rose-600 ring-rose-400/60",
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

export default function Shootout({ match, onDone }: Props) {
  const userIsHome = match.home === USER_TEAM_NAME;
  const userPens = (userIsHome ? match.homePens : match.awayPens) ?? 0;
  const oppPens = (userIsHome ? match.awayPens : match.homePens) ?? 0;
  const oppName = userIsHome ? match.away : match.home;
  const userWon = match.winner === USER_TEAM_NAME;

  const script = useMemo(() => ({ user: placeMakes(userPens), opp: placeMakes(oppPens) }), [userPens, oppPens]);
  const [phase, setPhase] = useState<"intro" | "play">("intro");
  const [step, setStep] = useState(0); // 0..10
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [ball, setBall] = useState<{ x: number; rot: number } | null>(null);
  const [dive, setDive] = useState(0);

  const userTaken = Math.ceil(step / 2);
  const oppTaken = Math.floor(step / 2);
  const userScore = script.user.slice(0, userTaken).filter(Boolean).length;
  const oppScore = script.opp.slice(0, oppTaken).filter(Boolean).length;
  const yourTurn = step % 2 === 0;
  const done = step >= 10;

  function tap() {
    if (done) return;
    const made = yourTurn ? script.user[userTaken] : script.opp[oppTaken];
    const goodForUser = yourTurn ? made : !made;
    if (goodForUser) sound.goal();
    else sound.miss();
    // animate ball + keeper
    setBall({ x: [-90, 0, 90][Math.floor(Math.random() * 3)], rot: Math.random() * 360 });
    setDive([-1, 0, 1][Math.floor(Math.random() * 3)]);
    setFlash({ text: yourTurn ? (made ? "GOAL!" : "SAVED!") : made ? "Scored" : "SAVED!", good: goodForUser });
    const last = step + 1 >= 10;
    setStep((s) => s + 1);
    window.setTimeout(() => {
      setFlash(null);
      setBall(null);
      if (last) (userWon ? sound.win : sound.lose)();
    }, 750);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur"
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 ring-1 ring-white/10"
      >
        {/* header banner */}
        <div className="bg-gradient-to-r from-rose-600/40 via-amber-500/30 to-emerald-500/30 px-6 py-3 text-center">
          <motion.h3
            initial={{ scale: 0.8 }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="font-display text-2xl tracking-wide text-white"
          >
            ⚽ PENALTY SHOOTOUT
          </motion.h3>
          <p className="text-xs text-slate-200">
            {teamFlag(USER_TEAM_NAME)} Your XI vs {teamFlag(oppName)} {oppName}
          </p>
        </div>

        {phase === "intro" && (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-300">
              Level after extra time — it&apos;s down to spot-kicks. Take them yourself for the drama, or
              simulate the result.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                onClick={() => setPhase("play")}
                className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3.5 text-lg font-black text-emerald-950 transition hover:brightness-110"
              >
                ⚽ Take them yourself
              </button>
              <button
                onClick={onDone}
                className="rounded-2xl bg-white/5 px-6 py-3 font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10"
              >
                ⏩ Simulate the shootout
              </button>
            </div>
          </div>
        )}

        {phase !== "intro" && (
          <div className="p-6 text-center">
            {/* goal + keeper + ball */}
            <div className="relative mx-auto h-32 w-full max-w-xs overflow-hidden rounded-lg border-4 border-white/80"
              style={{ backgroundImage: "repeating-linear-gradient(90deg,#0d3b22 0 14px,#0f4a2b 14px 28px)" }}
            >
              {/* keeper */}
              <motion.div
                animate={{ x: dive * 70 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="absolute bottom-2 left-1/2 h-12 w-8 -translate-x-1/2 rounded-md bg-yellow-400"
              />
              {/* ball */}
              <AnimatePresence>
                {ball && (
                  <motion.div
                    initial={{ bottom: 4, left: "50%", opacity: 1 }}
                    animate={{ bottom: 70, left: `calc(50% + ${ball.x}px)`, rotate: ball.rot }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45 }}
                    className="absolute -translate-x-1/2 text-2xl"
                  >
                    ⚽
                  </motion.div>
                )}
              </AnimatePresence>
              {/* flash */}
              <AnimatePresence>
                {flash && (
                  <motion.div
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 flex items-center justify-center text-4xl font-black ${flash.good ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {flash.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* scoreboard */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{teamFlag(USER_TEAM_NAME)} You</span>
                <Dots kicks={script.user} taken={userTaken} color="bg-emerald-400" />
                <span className="w-6 font-mono text-xl font-black text-emerald-300">{userScore}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  {teamFlag(oppName)} {oppName}
                </span>
                <Dots kicks={script.opp} taken={oppTaken} color="bg-sky-400" />
                <span className="w-6 font-mono text-xl font-black text-sky-300">{oppScore}</span>
              </div>
            </div>

            {done ? (
              <div className="mt-6">
                <motion.p
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`font-display text-2xl ${userWon ? "text-emerald-300" : "text-rose-300"}`}
                >
                  {userWon ? "🎉 You win the shootout!" : "💔 Knocked out on penalties"}
                </motion.p>
                <p className="mt-1 text-sm text-slate-400">
                  {userPens}–{oppPens} on penalties
                </p>
                <button
                  onClick={onDone}
                  className="mt-4 rounded-full bg-emerald-500 px-8 py-2.5 font-bold text-emerald-950 transition hover:bg-emerald-400"
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
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

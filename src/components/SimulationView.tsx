"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Flag, Radio, SkipForward, Sparkles, X } from "lucide-react";
import type { MatchResult, TournamentResult } from "@/lib/types";
import { USER_TEAM_NAME } from "@/data/teams";
import { teamFlag } from "@/lib/flags";
import Shootout from "@/components/Shootout";

type SimEvent = { type: "match"; stage: string; match: MatchResult } | { type: "table" };

const MATCH_LIVE_MS = 950;
const MATCH_HOLD_MS = 1350;
const TABLE_MS = 1900;

function MatchRow({ m, revealed }: { m: MatchResult; revealed: boolean }) {
  const userIsHome = m.home === USER_TEAM_NAME;
  const won = m.winner === USER_TEAM_NAME;
  const lost = m.isUser && !won && m.winner !== "draw";
  const scorers = (m.scorers ?? []).map((s) => (s.goals > 1 ? `${s.name} ×${s.goals}` : s.name));
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
      className={[
        "rounded-xl px-4 py-3 ring-1",
        !revealed
          ? "bg-white/5 ring-white/10"
          : won
            ? "bg-emerald-500/15 ring-emerald-400/50"
            : lost
              ? "bg-rose-500/15 ring-rose-400/50"
              : "bg-white/5 ring-white/10",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className={`flex-1 truncate text-sm ${userIsHome ? "font-bold" : ""}`}>
          {teamFlag(m.home)} {m.home}
        </span>
        <span className="mx-3 flex flex-col items-center">
          {revealed ? (
            <span className="font-mono text-lg font-bold tabular-nums">
              {m.homeGoals}–{m.awayGoals}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /> LIVE
            </span>
          )}
          {revealed && m.homePens != null && (
            <span className="text-[10px] text-slate-400">
              {m.homePens}–{m.awayPens} pens
            </span>
          )}
        </span>
        <span className={`flex-1 truncate text-right text-sm ${!userIsHome ? "font-bold" : ""}`}>
          {m.away} {teamFlag(m.away)}
        </span>
      </div>
      {revealed && scorers.length > 0 && (
        <div className="mt-1 truncate text-center text-[11px] text-amber-200/80">⚽ {scorers.join(", ")}</div>
      )}
      {revealed && (m.extraTime || m.redHome || m.redAway || m.mvp || m.oppStyle) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center text-[10px] text-slate-400">
          {m.oppStyle && <span className="text-sky-300">vs {m.oppStyle}</span>}
          {m.extraTime && <span>{m.homePens != null ? "a.e.t. · penalties" : "after extra time"}</span>}
          {!!m.redHome && <span className="text-rose-300">🟥 {m.home}</span>}
          {!!m.redAway && <span className="text-rose-300">🟥 {m.away}</span>}
          {m.mvp && <span className="text-violet-300">★ MOTM: {m.mvp}</span>}
        </div>
      )}
      {revealed && m.notes && m.notes.length > 0 && (
        <div className="mt-1 space-y-0.5 text-center text-[10px] text-amber-300/80">
          {m.notes.map((n, k) => (
            <div key={k}>📋 {n}</div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

interface Props {
  result: TournamentResult;
  onDone: () => void;
}

export default function SimulationView({ result, onDone }: Props) {
  const events = useMemo<SimEvent[]>(() => {
    const group = result.userJourney
      .filter((j) => j.stage === "Group Stage")
      .map((j) => ({ type: "match" as const, stage: j.stage, match: j.match }));
    const ko = result.userJourney
      .filter((j) => j.stage !== "Group Stage")
      .map((j) => ({ type: "match" as const, stage: j.stage, match: j.match }));
    return [...group, { type: "table" as const }, ...ko];
  }, [result]);

  // One state object so the effect only mutates state inside timeouts.
  const [{ idx, scoreShown }, setStep] = useState({ idx: 0, scoreShown: false });
  const [inShootout, setInShootout] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const curEvent = idx < events.length ? events[idx] : null;
  const needsShootout =
    curEvent?.type === "match" && !!curEvent.match.pendingShootout && !scoreShown;

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (idx >= events.length) return;
    const ev = events[idx];
    // Pause auto-playback for an interactive penalty shootout.
    if (ev.type === "match" && ev.match.pendingShootout) return;

    const advance = () => setStep({ idx: idx + 1, scoreShown: false });
    if (ev.type === "match") {
      timers.current.push(setTimeout(() => setStep((s) => ({ ...s, scoreShown: true })), MATCH_LIVE_MS));
      timers.current.push(setTimeout(advance, MATCH_LIVE_MS + MATCH_HOLD_MS));
    } else {
      timers.current.push(setTimeout(advance, TABLE_MS));
    }
    return () => timers.current.forEach(clearTimeout);
  }, [idx, events]);

  const finished = idx >= events.length;
  const tableIndex = events.findIndex((e) => e.type === "table");
  const tableShown = idx > tableIndex;
  const groupMatches = events.map((e, i) => ({ e, i })).filter(({ e }) => e.type === "match" && e.stage === "Group Stage");
  const koMatches = events.map((e, i) => ({ e, i })).filter(({ e }) => e.type === "match" && e.stage !== "Group Stage");

  const userRow = result.userGroupTable.find((r) => r.isUser);
  const qualified = userRow?.qualified ?? false;

  const stageLabel = finished
    ? "Full Time"
    : events[idx].type === "table"
      ? "Group standings"
      : (events[idx] as { stage: string }).stage;

  function skip() {
    timers.current.forEach(clearTimeout);
    onDone();
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display flex items-center gap-2 text-2xl">
            <Radio className="h-5 w-5 text-rose-400" /> World Cup — Live
          </h2>
          <p className="text-sm text-slate-400">
            Now: <span className="font-semibold text-emerald-300">{stageLabel}</span>
          </p>
        </div>
        <button
          onClick={skip}
          className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 transition hover:bg-white/10"
        >
          <SkipForward className="h-4 w-4" /> Skip
        </button>
      </div>

      {/* Group stage */}
      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
          {result.userGroupName} · Your Group
        </h3>
        {/* Group draw reveal */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {result.userGroupTable.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.12 }}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs ring-1 ${
                r.isUser ? "bg-yellow-300/10 font-bold ring-yellow-300/30" : "bg-white/5 ring-white/10"
              }`}
            >
              <span className="text-base">{r.flag}</span>
              <span className="truncate">{r.name}</span>
            </motion.div>
          ))}
        </div>
        <div className="space-y-2">
          {groupMatches.map(({ e, i }) =>
            i <= idx ? (
              <MatchRow
                key={i}
                m={(e as { match: MatchResult }).match}
                revealed={i < idx || (i === idx && scoreShown)}
              />
            ) : null,
          )}
        </div>

        {tableShown && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass mt-3 overflow-hidden rounded-xl"
          >
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-2 py-2 text-center">P</th>
                  <th className="px-2 py-2 text-center">GD</th>
                  <th className="px-2 py-2 text-center">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {result.userGroupTable.map((r) => (
                  <tr key={r.name} className={r.isUser ? "bg-yellow-300/10 font-bold" : ""}>
                    <td className="flex items-center gap-2 px-3 py-2">
                      <span
                        className={`h-2 w-2 rounded-full ${r.qualified ? "bg-emerald-400" : "bg-slate-600"}`}
                      />
                      {r.flag} {r.name}
                    </td>
                    <td className="px-2 py-2 text-center font-mono">{r.played}</td>
                    <td className="px-2 py-2 text-center font-mono">
                      {r.gf - r.ga >= 0 ? "+" : ""}
                      {r.gf - r.ga}
                    </td>
                    <td className="px-2 py-2 text-center font-mono">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${qualified ? "text-emerald-300" : "text-rose-300"}`}
            >
              {qualified ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {qualified ? "Through to the knockout rounds" : "Out at the group stage"}
            </p>
          </motion.div>
        )}
      </section>

      {/* Knockouts */}
      {qualified && koMatches.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
            Knockout Bracket
          </h3>
          <div className="space-y-3 border-l-2 border-emerald-400/30 pl-3">
            {koMatches.map(({ e, i }) =>
              i <= idx ? (
                <div key={i} className="relative">
                  <span className="absolute -left-[17px] top-3 h-2 w-2 rounded-full bg-emerald-400" />
                  <p className="mb-1 text-xs font-semibold text-emerald-300">
                    {(e as { stage: string }).stage}
                  </p>
                  <MatchRow
                    m={(e as { match: MatchResult }).match}
                    revealed={i < idx || (i === idx && scoreShown)}
                  />
                </div>
              ) : null,
            )}
          </div>
        </section>
      )}

      {/* Penalty shootout prompt */}
      {needsShootout && !inShootout && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-2 pt-1"
        >
          <p className="text-sm text-slate-300">It&apos;s level — your match goes to penalties!</p>
          <button
            onClick={() => setInShootout(true)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-3 font-bold text-amber-950 transition hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" /> Take the shootout
          </button>
        </motion.div>
      )}

      {finished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center pt-2"
        >
          <button
            onClick={onDone}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-8 py-3 text-lg font-bold text-amber-950 shadow-xl shadow-amber-900/40 transition hover:brightness-110"
          >
            <Flag className="h-5 w-5" /> See Full Results
          </button>
        </motion.div>
      )}

      {inShootout && curEvent?.type === "match" && (
        <Shootout
          match={curEvent.match}
          onDone={() => {
            setInShootout(false);
            setStep({ idx: idx + 1, scoreShown: false });
          }}
        />
      )}
    </div>
  );
}

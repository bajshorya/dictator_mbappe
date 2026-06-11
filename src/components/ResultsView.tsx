"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { toPng } from "html-to-image";
import confetti from "canvas-confetti";
import { Award, BarChart3, Download, Layers, RotateCcw, Share2, Swords, Trophy } from "lucide-react";
import type { Difficulty, Formation, MatchResult, Player, TournamentResult } from "@/lib/types";
import { USER_TEAM_NAME } from "@/data/teams";
import { flagFor, teamFlag } from "@/lib/flags";
import { computeChemistry } from "@/lib/chemistry";
import { teamStrength } from "@/lib/simulate";
import { placementRank, recordResult } from "@/lib/storage";
import ShareCard from "@/components/ShareCard";
import BracketView from "@/components/BracketView";

function Scoreline({ m, showScorers }: { m: MatchResult; showScorers?: boolean }) {
  const userIsHome = m.home === USER_TEAM_NAME;
  const won = m.winner === USER_TEAM_NAME;
  const drawNonUser = m.winner === "draw";
  const scorers = (m.scorers ?? []).map((s) => (s.goals > 1 ? `${s.name} ×${s.goals}` : s.name));
  return (
    <div
      className={[
        "rounded-lg px-3 py-2 text-sm ring-1",
        m.isUser
          ? won
            ? "bg-emerald-500/15 ring-emerald-400/40"
            : drawNonUser
              ? "bg-white/5 ring-white/10"
              : "bg-rose-500/15 ring-rose-400/40"
          : "bg-white/5 ring-white/5",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className={`flex-1 truncate ${userIsHome ? "font-bold" : ""}`}>
          {teamFlag(m.home)} {m.home}
        </span>
        <span className="mx-2 whitespace-nowrap font-mono font-bold tabular-nums">
          {m.homeGoals}–{m.awayGoals}
          {m.homePens != null && (
            <span className="ml-1 text-[11px] text-slate-400">
              ({m.homePens}–{m.awayPens})
            </span>
          )}
        </span>
        <span className={`flex-1 truncate text-right ${!userIsHome ? "font-bold" : ""}`}>
          {m.away} {teamFlag(m.away)}
        </span>
      </div>
      {showScorers && scorers.length > 0 && (
        <div className="mt-1 truncate text-[11px] text-amber-200/80">⚽ {scorers.join(", ")}</div>
      )}
    </div>
  );
}

const GRADE_BY_RANK: Record<number, { grade: string; color: string }> = {
  7: { grade: "S", color: "text-yellow-300" },
  6: { grade: "A", color: "text-emerald-300" },
  5: { grade: "B", color: "text-emerald-300" },
  4: { grade: "C", color: "text-sky-300" },
  3: { grade: "D", color: "text-sky-300" },
  2: { grade: "E", color: "text-slate-300" },
  1: { grade: "F", color: "text-rose-300" },
};
function gradeFor(placement: string) {
  return GRADE_BY_RANK[placementRank(placement)] ?? { grade: "F", color: "text-rose-300" };
}

interface Props {
  result: TournamentResult;
  xi: Player[];
  formation: Formation | null;
  captainId: string | null;
  difficulty: Difficulty;
  onPlayAgain: () => void;
}

export default function ResultsView({ result, xi, formation, captainId, difficulty, onPlayAgain }: Props) {
  const topScorer = result.playerStats.find((s) => s.goals > 0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const strength = teamStrength(xi, [], captainId);
  const chemistry = computeChemistry(xi).score;

  // Save to the Hall of Fame once, when results first appear.
  useEffect(() => {
    recordResult({
      placement: result.userPlacement,
      won: result.userWon,
      xi,
      formation: formation?.name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Confetti shower for champions.
  useEffect(() => {
    if (!result.userWon) return;
    const end = Date.now() + 1400;
    const colors = ["#fbbf24", "#34d399", "#38bdf8", "#f472b6", "#ffffff"];
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 65, origin: { x: 0 }, colors });
      confetti({ particleCount: 5, angle: 120, spread: 65, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [result.userWon]);

  async function exportPng(): Promise<{ url: string; blob: Blob } | null> {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
    const blob = await (await fetch(dataUrl)).blob();
    return { url: dataUrl, blob };
  }

  async function downloadCard() {
    setBusy(true);
    try {
      const out = await exportPng();
      if (out) {
        const a = document.createElement("a");
        a.href = out.url;
        a.download = "footy-squad.png";
        a.click();
      }
    } finally {
      setBusy(false);
    }
  }

  async function shareCard() {
    setBusy(true);
    try {
      const out = await exportPng();
      if (!out) return;
      const file = new File([out.blob], "footy-squad.png", { type: "image/png" });
      const text = `My all-time World Cup XI just finished: ${result.userPlacement}! Build yours on Dictator Mbappé.`;
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "Dictator Mbappé", text });
      } else {
        // Fallback: download the image + open an X/Twitter compose window.
        const a = document.createElement("a");
        a.href = out.url;
        a.download = "footy-squad.png";
        a.click();
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
      }
    } catch {
      /* user cancelled share */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Outcome banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className={[
          "rounded-3xl p-7 text-center ring-1",
          result.userWon
            ? "bg-gradient-to-b from-yellow-400/25 to-amber-600/10 ring-yellow-300/60"
            : "glass",
        ].join(" ")}
      >
        <div className="flex items-center justify-center gap-4">
          <Trophy className={`h-12 w-12 ${result.userWon ? "text-yellow-300" : "text-slate-500"}`} />
          <div className="text-left">
            <div className="text-[11px] uppercase tracking-widest text-slate-400">Manager grade</div>
            <div className={`font-display text-5xl leading-none ${gradeFor(result.userPlacement).color}`}>
              {gradeFor(result.userPlacement).grade}
            </div>
          </div>
        </div>
        <h2 className="font-display mt-3 text-3xl">{result.userPlacement}</h2>
        <p className="mt-1 text-sm text-slate-300">
          Won by {teamFlag(result.champion)} <strong>{result.champion}</strong>
        </p>
        {topScorer && topScorer.goals > 0 && (
          <p className="mt-2 text-sm text-amber-200">
            Your top scorer: <strong>{topScorer.player.name}</strong> — {topScorer.goals} goal
            {topScorer.goals === 1 ? "" : "s"}
          </p>
        )}
      </motion.div>

      {result.tournamentMvp && (
        <div className="glass flex items-center gap-3 rounded-2xl p-4">
          <Award className="h-8 w-8 shrink-0 text-violet-300" />
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">Player of the Tournament</div>
            <div className="font-display text-xl">
              {flagFor(result.tournamentMvp.team)} {result.tournamentMvp.name}{" "}
              <span className="text-sm text-emerald-300">WC {result.tournamentMvp.year}</span>
            </div>
            <div className="text-xs text-slate-400">
              {result.tournamentMvp.motm} MOTM · {result.tournamentMvp.goals} goals · {result.tournamentMvp.apps} apps
            </div>
          </div>
        </div>
      )}

      <Section icon={Swords} title="Your Run">
        <div className="space-y-2">
          {result.userPath.length === 0 ? (
            <p className="text-sm text-slate-400">No matches played.</p>
          ) : (
            result.userPath.map((m, i) => <Scoreline key={i} m={m} showScorers />)
          )}
        </div>
      </Section>

      <Section icon={BarChart3} title="Squad Stats">
        <div className="glass overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Edition</th>
                <th className="px-2 py-2 text-center">Pos</th>
                <th className="px-2 py-2 text-center">Rtg</th>
                <th className="px-2 py-2 text-center">Apps</th>
                <th className="px-2 py-2 text-center">Goals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {result.playerStats.map((s) => (
                <tr key={s.player.id}>
                  <td className="px-3 py-2 font-medium">
                    {flagFor(s.player.team)} {s.player.name}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">WC {s.player.year}</td>
                  <td className="px-2 py-2 text-center text-slate-300">{s.player.position}</td>
                  <td className="px-2 py-2 text-center font-mono">{s.player.rating}</td>
                  <td className="px-2 py-2 text-center font-mono text-slate-400">{s.apps}</td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-amber-200">
                    {s.goals}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section icon={Layers} title="Knockout Bracket">
        <div className="glass rounded-xl p-3">
          <BracketView koRounds={result.rounds.filter((r) => r.name !== "Group Stage")} />
        </div>
      </Section>

      <details className="glass rounded-xl">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold">
          <Layers className="h-4 w-4 text-emerald-300" /> All match results
        </summary>
        <div className="space-y-4 px-4 pb-4">
          {result.rounds.map((round) => (
            <div key={round.name}>
              <h4 className="mb-2 mt-2 text-sm font-bold text-emerald-300">{round.name}</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {round.matches.map((m, i) => (
                  <Scoreline key={i} m={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* Shareable card */}
      <Section icon={Share2} title="Share your card">
        <div className="flex flex-col items-center gap-4">
          <ShareCard
            ref={cardRef}
            result={result}
            xi={xi}
            formationName={formation?.name}
            difficulty={difficulty}
            strength={strength}
            chemistry={chemistry}
          />
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={shareCard}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 font-semibold text-emerald-950 transition hover:brightness-110 disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" /> {busy ? "Working…" : "Share"}
            </button>
            <button
              onClick={downloadCard}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-white/5 px-6 py-3 font-semibold ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        </div>
      </Section>

      <div className="flex justify-center pb-10">
        <button
          onClick={onPlayAgain}
          className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-8 py-3 font-bold text-amber-950 transition hover:brightness-110"
        >
          <RotateCcw className="h-4 w-4" /> Play Again
        </button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Swords;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <Icon className="h-5 w-5 text-emerald-300" /> {title}
      </h3>
      {children}
    </section>
  );
}

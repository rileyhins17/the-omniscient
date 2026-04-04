"use client";

import { Badge } from "@/components/ui/badge";
import { getScoreBand } from "@/lib/lead-qualification";
import { cn } from "@/lib/utils";

export function AxiomScoreDial({
  score,
  label,
  businessName,
  tier,
  websiteLabel,
  emailLabel,
  pulsing,
}: {
  score: number;
  label: string;
  businessName: string;
  tier: string;
  websiteLabel: string;
  emailLabel: string;
  pulsing: boolean;
}) {
  const circumference = 2 * Math.PI * 72;
  const progress = Math.max(0, Math.min(score, 100));
  const dashOffset = circumference - (progress / 100) * circumference;
  const band = getScoreBand(score, emailLabel === "Pipeline Ready");

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),transparent_42%),repeating-linear-gradient(180deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_10px)] opacity-35" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Live Axiom Score</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Real-time lead analysis</h2>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em]",
              band.accentClass,
            )}
          >
            {label}
          </Badge>
        </div>

        <div className="mt-8 flex flex-col items-center gap-6 text-center">
          <div className={cn("relative flex h-56 w-56 items-center justify-center rounded-full", band.glowClass)}>
            <svg viewBox="0 0 180 180" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="90" cy="90" r="72" className="fill-none stroke-white/[0.08]" strokeWidth="12" />
              <circle
                cx="90"
                cy="90"
                r="72"
                className={cn(
                  "fill-none transition-all duration-700 ease-out",
                  pulsing && "drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]",
                )}
                stroke="url(#axiom-score-gradient)"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                strokeWidth="12"
              />
              <defs>
                <linearGradient id="axiom-score-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="rgb(34,197,94)" />
                  <stop offset="50%" stopColor="rgb(56,189,248)" />
                  <stop offset="100%" stopColor="rgb(59,130,246)" />
                </linearGradient>
              </defs>
            </svg>
            <div
              className={cn(
                "relative flex h-[172px] w-[172px] flex-col items-center justify-center rounded-full border border-white/[0.08] bg-black/60 transition-transform duration-500",
                pulsing && "scale-[1.02]",
              )}
            >
              <div className="text-[11px] font-mono uppercase tracking-[0.28em] text-zinc-500">Score</div>
              <div className={cn("mt-3 text-6xl font-semibold tracking-tight", band.textClass)}>{score}</div>
              <div className="mt-2 text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">
                Tier {tier}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-lg font-semibold text-white">{businessName}</div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-300">
                {websiteLabel}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full border",
                  emailLabel === "Pipeline Ready"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-500/20 bg-rose-500/10 text-rose-200",
                )}
              >
                {emailLabel}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

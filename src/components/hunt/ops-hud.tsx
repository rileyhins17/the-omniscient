"use client";
import { cn } from "@/lib/utils";
import { type PipelineStage } from "@/lib/hunt/sse-parser";
import { type HuntCounters, type SessionStatus, type CurrentJob } from "@/lib/hunt/hunt-session-store";
import {
    Search, Filter, Cpu, ShieldCheck, Database, Check,
    Pause, Play, X, HelpCircle, Radar,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ═══════════════════════════════════════════════
// PIPELINE STEPPER
// ═══════════════════════════════════════════════
const STAGES: { key: PipelineStage; label: string; icon: any }[] = [
    { key: "extracting", label: "Extract", icon: Search },
    { key: "dedupe", label: "Dedupe", icon: Filter },
    { key: "enrich", label: "Enrich", icon: Cpu },
    { key: "disqualify", label: "Disqualify", icon: ShieldCheck },
    { key: "write", label: "Write", icon: Database },
];

function getStageIndex(stage: PipelineStage): number {
    const idx = STAGES.findIndex(s => s.key === stage);
    return idx >= 0 ? idx : -1;
}

function PipelineStepper({ stage }: { stage: PipelineStage }) {
    const activeIdx = getStageIndex(stage);
    const isDone = stage === "done";

    return (
        <div className="flex items-center gap-1">
            {STAGES.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === activeIdx;
                const isPast = isDone || i < activeIdx;
                return (
                    <div key={s.key} className="flex items-center gap-1">
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-medium transition-all duration-300 border",
                            isActive && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10",
                            isPast && !isActive && "bg-white/[0.03] text-zinc-500 border-white/[0.04]",
                            !isActive && !isPast && "bg-transparent text-zinc-700 border-white/[0.02]",
                        )}>
                            {isPast && !isActive ? (
                                <Check className="w-3 h-3 text-emerald-500/50" />
                            ) : (
                                <Icon className={cn("w-3 h-3", isActive && "animate-pulse")} />
                            )}
                            {s.label}
                        </div>
                        {i < STAGES.length - 1 && (
                            <div className={cn(
                                "w-4 h-px transition-colors",
                                isPast ? "bg-emerald-500/30" : "bg-white/[0.04]"
                            )} />
                        )}
                    </div>
                );
            })}
            {isDone && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ml-1">
                    <Check className="w-3 h-3" /> Done
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════
// LIVE COUNTERS
// ═══════════════════════════════════════════════
const COUNTER_ITEMS: { key: keyof HuntCounters; label: string; color: string }[] = [
    { key: "found", label: "Found", color: "text-zinc-300" },
    { key: "accepted", label: "Accepted", color: "text-emerald-400" },
    { key: "duplicates", label: "Dupes", color: "text-zinc-500" },
    { key: "disqualified", label: "DQ'd", color: "text-red-400/70" },
    { key: "enriched", label: "Enriched", color: "text-cyan-400" },
    { key: "callable", label: "Callable", color: "text-amber-400" },
    { key: "errors", label: "Errors", color: "text-red-500" },
];

function LiveCounters({ counters }: { counters: HuntCounters }) {
    return (
        <div className="flex items-center gap-3">
            {COUNTER_ITEMS.map(c => (
                <div key={c.key} className="text-center min-w-[42px]">
                    <div className={cn("text-base font-bold font-mono leading-none", c.color)}>
                        {counters[c.key]}
                    </div>
                    <div className="text-[8px] uppercase tracking-wider text-zinc-600 mt-0.5">{c.label}</div>
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════
// MAIN OPS HUD
// ═══════════════════════════════════════════════
interface OpsHudProps {
    status: SessionStatus;
    stage: PipelineStage;
    counters: HuntCounters;
    currentJob: CurrentJob | null;
    lastEvent: string | null;
    elapsed: number;
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
}

export function OpsHud({
    status, stage, counters, currentJob, lastEvent, elapsed,
    onPause, onResume, onCancel,
}: OpsHudProps) {
    const isRunning = status === "running";
    const isPaused = status === "paused";
    const isIdle = status === "idle";
    const isCompleted = status === "completed";

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, "0");
        const s = (secs % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    return (
        <div className="glass-ultra rounded-xl p-4 space-y-3 sticky top-0 z-30">
            {/* Row 1: Pipeline + Status */}
            <div className="flex items-center justify-between gap-4">
                <PipelineStepper stage={stage} />

                <div className="flex items-center gap-2">
                    {/* Status badge */}
                    {isRunning && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider">Live</span>
                        </div>
                    )}
                    {isPaused && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                            <Pause className="w-2.5 h-2.5 text-amber-400" />
                            <span className="text-[9px] font-mono text-amber-400 uppercase tracking-wider">Paused (buffering)</span>
                        </div>
                    )}
                    {isCompleted && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider">Complete</span>
                        </div>
                    )}

                    {/* Controls */}
                    {(isRunning || isPaused) && (
                        <div className="flex items-center gap-1.5 ml-2">
                            {isRunning && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={onPause}
                                            className="p-1.5 rounded-lg border border-amber-500/20 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 transition-all"
                                        >
                                            <Pause className="w-3.5 h-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">Pause (Space)</TooltipContent>
                                </Tooltip>
                            )}
                            {isPaused && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={onResume}
                                            className="p-1.5 rounded-lg border border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all"
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">Resume (Space)</TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={onCancel}
                                        className="p-1.5 rounded-lg border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-all"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">Cancel (Esc)</TooltipContent>
                            </Tooltip>
                        </div>
                    )}
                </div>
            </div>

            {/* Row 2: Counters + Current Job */}
            <div className="flex items-center justify-between gap-4">
                <LiveCounters counters={counters} />

                {/* Current job card */}
                {currentJob && (isRunning || isPaused) && (
                    <div className="flex items-center gap-3 glass rounded-lg px-3 py-2">
                        <div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                                Job {currentJob.index}/{currentJob.total}
                            </div>
                            <div className="text-xs font-medium text-white">
                                {currentJob.niche} <span className="text-cyan-400/60">in</span> {currentJob.city}
                            </div>
                        </div>
                        <div className="h-6 w-px bg-white/[0.06]" />
                        <div className="text-right">
                            <div className="text-xs font-mono text-amber-400">{formatTime(elapsed)}</div>
                            {lastEvent && (
                                <div className="text-[9px] text-zinc-500 truncate max-w-[200px]">{lastEvent}</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

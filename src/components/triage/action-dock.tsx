"use client";
import { cn } from "@/lib/utils";
import { type TriageAction } from "@/lib/ui/triage-store";
import {
    Check, Archive, PhoneCall, Clock, CornerDownLeft, Undo2,
    ChevronLeft, ChevronRight,
} from "lucide-react";

interface ActionDockProps {
    onAction: (action: TriageAction) => void;
    onOpenDossier: () => void;
    onUndo: () => void;
    onPrev: () => void;
    onNext: () => void;
    canUndo: boolean;
    canPrev: boolean;
    canNext: boolean;
    hasPhone: boolean;
    disabled?: boolean;
}

const ACTIONS: {
    key: string;
    action: TriageAction;
    label: string;
    icon: any;
    color: string;
    activeColor: string;
}[] = [
        {
            key: "1", action: "keep", label: "Keep", icon: Check,
            color: "border-emerald-500/20 text-emerald-400", activeColor: "bg-emerald-500/15 shadow-emerald-500/10",
        },
        {
            key: "2", action: "archive", label: "Archive", icon: Archive,
            color: "border-red-500/20 text-red-400", activeColor: "bg-red-500/15 shadow-red-500/10",
        },
        {
            key: "3", action: "call_now", label: "Call Now", icon: PhoneCall,
            color: "border-cyan-500/20 text-cyan-400", activeColor: "bg-cyan-500/15 shadow-cyan-500/10",
        },
        {
            key: "4", action: "follow_up", label: "Follow Up", icon: Clock,
            color: "border-amber-500/20 text-amber-400", activeColor: "bg-amber-500/15 shadow-amber-500/10",
        },
    ];

export function ActionDock({
    onAction, onOpenDossier, onUndo, onPrev, onNext,
    canUndo, canPrev, canNext, hasPhone, disabled,
}: ActionDockProps) {
    return (
        <div className="glass-ultra rounded-xl px-6 py-4 flex items-center gap-3 justify-center">
            {/* Navigation */}
            <div className="flex items-center gap-1 mr-2">
                <button
                    onClick={onPrev}
                    disabled={!canPrev || disabled}
                    className={cn(
                        "p-2 rounded-lg border transition-all",
                        canPrev && !disabled
                            ? "border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12]"
                            : "border-white/[0.02] text-zinc-800 cursor-not-allowed"
                    )}
                    title="Previous (K / ←)"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={onNext}
                    disabled={!canNext || disabled}
                    className={cn(
                        "p-2 rounded-lg border transition-all",
                        canNext && !disabled
                            ? "border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12]"
                            : "border-white/[0.02] text-zinc-800 cursor-not-allowed"
                    )}
                    title="Next (J / →)"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            <div className="h-6 w-px bg-white/[0.06]" />

            {/* Main actions */}
            {ACTIONS.map(a => {
                const isCallDisabled = a.action === "call_now" && !hasPhone;
                const Icon = a.icon;
                return (
                    <button
                        key={a.action}
                        onClick={() => !isCallDisabled && onAction(a.action)}
                        disabled={disabled || isCallDisabled}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200",
                            "hover:shadow-lg active:scale-[0.97]",
                            a.color, a.activeColor,
                            (disabled || isCallDisabled) && "opacity-30 cursor-not-allowed hover:shadow-none active:scale-100"
                        )}
                        title={`${a.label} (${a.key})`}
                    >
                        <Icon className="w-4 h-4" />
                        <span>{a.label}</span>
                        <kbd className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-white/[0.06] opacity-60">
                            {a.key}
                        </kbd>
                    </button>
                );
            })}

            <div className="h-6 w-px bg-white/[0.06]" />

            {/* Secondary */}
            <button
                onClick={onOpenDossier}
                disabled={disabled}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                    !disabled
                        ? "border-purple-500/20 text-purple-400 bg-purple-500/5 hover:bg-purple-500/10"
                        : "border-white/[0.02] text-zinc-800 cursor-not-allowed"
                )}
                title="Open Dossier (Enter)"
            >
                <CornerDownLeft className="w-3.5 h-3.5" />
                Dossier
                <kbd className="ml-0.5 text-[9px] font-mono px-1 py-0.5 rounded bg-black/30 border border-white/[0.06] opacity-60">↵</kbd>
            </button>

            <button
                onClick={onUndo}
                disabled={!canUndo || disabled}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                    canUndo && !disabled
                        ? "border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/[0.15]"
                        : "border-white/[0.02] text-zinc-800 cursor-not-allowed"
                )}
                title="Undo (Z)"
            >
                <Undo2 className="w-3.5 h-3.5" />
                Undo
                <kbd className="ml-0.5 text-[9px] font-mono px-1 py-0.5 rounded bg-black/30 border border-white/[0.06] opacity-60">Z</kbd>
            </button>
        </div>
    );
}

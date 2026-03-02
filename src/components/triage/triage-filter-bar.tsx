"use client";
import { cn } from "@/lib/utils";
import { type TriageFilters, DEFAULT_FILTERS } from "@/lib/ui/triage-store";
import { SlidersHorizontal, RotateCcw, HelpCircle, ListChecks, Globe, Mail, Phone, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TriageFilterBarProps {
    filters: TriageFilters;
    onFiltersChange: (filters: TriageFilters) => void;
    stats: { remaining: number; kept: number; archived: number; followUp: number; called: number };
    onOpenCallList: () => void;
    onResetSession: () => void;
    onOpenHelp: () => void;
}

const ALL_TIERS = ["S", "A", "B", "C", "D"];
const TIER_COLORS: Record<string, string> = {
    S: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
    A: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30",
    B: "bg-amber-400/15 text-amber-400 border-amber-400/30",
    C: "bg-orange-400/15 text-orange-400 border-orange-400/30",
    D: "bg-red-400/15 text-red-400/70 border-red-400/20",
};

export function TriageFilterBar({
    filters, onFiltersChange, stats, onOpenCallList, onResetSession, onOpenHelp,
}: TriageFilterBarProps) {
    const toggleTier = (tier: string) => {
        const tiers = filters.tiers.includes(tier)
            ? filters.tiers.filter(t => t !== tier)
            : [...filters.tiers, tier];
        onFiltersChange({ ...filters, tiers: tiers.length > 0 ? tiers : [tier] });
    };

    const toggleBool = (key: "noWebsite" | "hasEmail" | "hasPhone") => {
        onFiltersChange({ ...filters, [key]: !filters[key] });
    };

    const setMinRating = (val: number) => {
        onFiltersChange({ ...filters, minRating: val });
    };

    return (
        <div className="glass-ultra rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            {/* Title + Stats */}
            <div className="flex items-center gap-3 mr-2">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Triage</span>
                </div>
                <div className="h-4 w-px bg-white/[0.06]" />
                <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span className="text-zinc-500">{stats.remaining} left</span>
                    <span className="text-emerald-400">{stats.kept} kept</span>
                    <span className="text-red-400/70">{stats.archived} archived</span>
                    <span className="text-cyan-400">{stats.followUp} follow-up</span>
                </div>
            </div>

            <div className="h-4 w-px bg-white/[0.06]" />

            {/* Tier pills */}
            <div className="flex items-center gap-1">
                {ALL_TIERS.map(tier => (
                    <button
                        key={tier}
                        onClick={() => toggleTier(tier)}
                        className={cn(
                            "text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-all duration-150",
                            filters.tiers.includes(tier)
                                ? TIER_COLORS[tier]
                                : "border-white/[0.04] text-zinc-700 hover:text-zinc-400"
                        )}
                    >
                        {tier}
                    </button>
                ))}
            </div>

            <div className="h-4 w-px bg-white/[0.06]" />

            {/* Toggle pills */}
            <div className="flex items-center gap-1.5">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => toggleBool("noWebsite")}
                            className={cn(
                                "flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-all",
                                filters.noWebsite
                                    ? "bg-red-400/10 text-red-400 border-red-400/20"
                                    : "border-white/[0.04] text-zinc-600 hover:text-zinc-300"
                            )}
                        >
                            <Globe className="w-3 h-3" /> No Site
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Only leads without a website</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => toggleBool("hasEmail")}
                            className={cn(
                                "flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-all",
                                filters.hasEmail
                                    ? "bg-cyan-400/10 text-cyan-400 border-cyan-400/20"
                                    : "border-white/[0.04] text-zinc-600 hover:text-zinc-300"
                            )}
                        >
                            <Mail className="w-3 h-3" /> Email
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Only leads with email</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => toggleBool("hasPhone")}
                            className={cn(
                                "flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-all",
                                filters.hasPhone
                                    ? "bg-amber-400/10 text-amber-400 border-amber-400/20"
                                    : "border-white/[0.04] text-zinc-600 hover:text-zinc-300"
                            )}
                        >
                            <Phone className="w-3 h-3" /> Phone
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Only leads with phone</TooltipContent>
                </Tooltip>

                {/* Min rating */}
                <select
                    value={filters.minRating}
                    onChange={e => setMinRating(parseFloat(e.target.value))}
                    className={cn(
                        "text-[10px] px-2 py-1 rounded-md border bg-transparent outline-none cursor-pointer transition-all appearance-none",
                        filters.minRating > 0
                            ? "border-amber-400/20 text-amber-400"
                            : "border-white/[0.04] text-zinc-600"
                    )}
                >
                    <option value={0}>★ Any</option>
                    <option value={3}>★ 3+</option>
                    <option value={3.5}>★ 3.5+</option>
                    <option value={4}>★ 4+</option>
                    <option value={4.5}>★ 4.5+</option>
                </select>
            </div>

            {/* Right side buttons */}
            <div className="ml-auto flex items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onOpenCallList}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all"
                        >
                            <ListChecks className="w-3.5 h-3.5" />
                            Call List
                            {stats.kept > 0 && (
                                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-[9px] font-bold">
                                    {stats.kept}
                                </span>
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Open call list drawer</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onResetSession}
                            className="p-1.5 rounded-lg border border-white/[0.04] text-zinc-600 hover:text-white hover:border-white/[0.08] transition-all"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Reset triage session</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onOpenHelp}
                            className="p-1.5 rounded-lg border border-white/[0.04] text-zinc-600 hover:text-white hover:border-white/[0.08] transition-all"
                        >
                            <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Keyboard shortcuts (?)</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}

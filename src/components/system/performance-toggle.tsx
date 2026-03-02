"use client";
import { usePerformance } from "@/lib/ui/performance";
import { cn } from "@/lib/utils";
import { Zap, ZapOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Performance mode toggle — placed in Settings and optionally in the header.
 * Compact pill that shows current state.
 */
export function PerformanceToggle({ className }: { className?: string }) {
    const { reducedMotion, toggle } = usePerformance();

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={toggle}
                    className={cn(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-all",
                        reducedMotion
                            ? "glass-strong text-amber-400 border border-amber-400/20"
                            : "glass text-muted-foreground hover:text-foreground border border-white/[0.04]",
                        className
                    )}
                >
                    {reducedMotion ? (
                        <><ZapOff className="w-3 h-3" /> Perf Mode</>
                    ) : (
                        <><Zap className="w-3 h-3" /> Full FX</>
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {reducedMotion
                    ? "Performance Mode ON — reduced animations, no particles, shorter transitions"
                    : "Full effects enabled — click to reduce motion for better performance"
                }
            </TooltipContent>
        </Tooltip>
    );
}

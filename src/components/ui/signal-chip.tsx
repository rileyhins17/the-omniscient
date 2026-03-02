"use client";
import { cn } from "@/lib/utils";
import { getSignalConfig } from "@/lib/ui/tokens";

interface SignalChipProps {
    type: string;
    severity?: number;
    evidence?: string;
    compact?: boolean;
    className?: string;
}

/**
 * Pain signal chip for lead dossiers and inline display.
 */
export function SignalChip({ type, severity, evidence, compact, className }: SignalChipProps) {
    const config = getSignalConfig(type);

    if (compact) {
        return (
            <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded",
                config.bg, config.text,
                className
            )}>
                {config.label}
                {severity !== undefined && <span className="opacity-60">×{severity}</span>}
            </span>
        );
    }

    return (
        <div className={cn(
            "flex items-start gap-2 text-xs rounded-lg px-2.5 py-2 border",
            config.bg, config.text, "border-white/[0.04]",
            className
        )}>
            <div className="flex-shrink-0 mt-0.5">
                <span className={cn("w-1.5 h-1.5 rounded-full block", config.text.replace("text-", "bg-"))} />
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[10px] uppercase">{config.label}</span>
                    {severity !== undefined && (
                        <span className="text-[10px] opacity-50">SEV {severity}/5</span>
                    )}
                </div>
                {evidence && (
                    <p className="text-[11px] opacity-70 mt-0.5 leading-relaxed">{evidence}</p>
                )}
            </div>
        </div>
    );
}

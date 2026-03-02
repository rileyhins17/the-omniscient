"use client";
import { cn } from "@/lib/utils";
import { getTierConfig, type Tier } from "@/lib/ui/tokens";

interface TierBadgeProps {
    tier: string | null | undefined;
    score?: number | null;
    size?: "xs" | "sm" | "md";
    showLabel?: boolean;
    className?: string;
}

/**
 * Consistent tier badge with optional score display.
 * Uses design tokens for color mapping.
 */
export function TierBadge({ tier, score, size = "sm", showLabel = false, className }: TierBadgeProps) {
    const config = getTierConfig(tier);

    const sizes = {
        xs: "text-[10px] px-1.5 py-0.5 gap-1",
        sm: "text-xs px-2 py-0.5 gap-1.5",
        md: "text-sm px-2.5 py-1 gap-2",
    };

    return (
        <span
            className={cn(
                "inline-flex items-center font-mono font-bold rounded-md border tabular-nums",
                config.bg, config.text, config.border,
                sizes[size],
                className
            )}
        >
            <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
            {tier || "—"}
            {score !== undefined && score !== null && (
                <span className="opacity-70 font-medium">{score}</span>
            )}
            {showLabel && <span className="font-normal opacity-60">{config.label}</span>}
        </span>
    );
}

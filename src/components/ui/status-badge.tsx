"use client";
import { cn } from "@/lib/utils";
import { getStatusConfig, type Status } from "@/lib/ui/tokens";

interface StatusBadgeProps {
    status: string;
    pulse?: boolean;
    className?: string;
}

/**
 * Status indicator badge for queue items and operations.
 */
export function StatusBadge({ status, pulse, className }: StatusBadgeProps) {
    const config = getStatusConfig(status);
    const shouldPulse = pulse ?? status === "running";

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border",
                config.bg, config.text, config.border,
                className
            )}
        >
            <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                config.dot,
                shouldPulse && "animate-pulse"
            )} />
            {config.label}
        </span>
    );
}

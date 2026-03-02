"use client";
import { cn } from "@/lib/utils";
import { type LucideIcon, Search, Crosshair, Database, Inbox } from "lucide-react";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
    variant?: "default" | "hunt" | "vault" | "search";
    className?: string;
}

const VARIANT_ICONS: Record<string, LucideIcon> = {
    default: Inbox,
    hunt: Crosshair,
    vault: Database,
    search: Search,
};

/**
 * Themed empty state for tables, panels, and pages.
 * Uses operator console language.
 */
export function EmptyState({
    icon, title, description, action, variant = "default", className,
}: EmptyStateProps) {
    const Icon = icon || VARIANT_ICONS[variant] || Inbox;

    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-16 px-6 text-center",
            className
        )}>
            <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl glass-strong flex items-center justify-center">
                    <Icon className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <div className="absolute -inset-2 rounded-3xl border border-dashed border-white/[0.06]" />
            </div>
            <h3 className="text-sm font-semibold text-foreground/80 mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">{description}</p>
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

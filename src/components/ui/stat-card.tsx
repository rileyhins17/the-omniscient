"use client";
import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    label: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    iconColor?: string;
    glowClass?: string;
    trend?: { value: number; label?: string };
    className?: string;
}

/**
 * Unified KPI / stat card with consistent layout.
 * All dashboard and vault stat cards should use this.
 */
export function StatCard({
    label, value, subtitle, icon, iconColor = "text-emerald-400",
    glowClass = "glow-emerald", trend, className,
}: StatCardProps) {
    return (
        <div className={cn(
            "glass-strong rounded-xl p-4 stat-card group",
            glowClass,
            className
        )}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                    {label}
                </span>
                <div className={cn("transition-transform group-hover:scale-110 [&>svg]:w-4 [&>svg]:h-4", iconColor)}>
                    {icon}
                </div>
            </div>
            <div className={cn("text-3xl font-bold font-mono leading-none", iconColor)}>
                {value}
            </div>
            {subtitle && (
                <div className="text-[10px] text-muted-foreground mt-1.5">{subtitle}</div>
            )}
            {trend && (
                <div className={cn(
                    "text-[10px] mt-2 font-mono flex items-center gap-1",
                    trend.value > 0 ? "text-emerald-400" : trend.value < 0 ? "text-red-400" : "text-zinc-500"
                )}>
                    {trend.value > 0 ? "↑" : trend.value < 0 ? "↓" : "→"} {Math.abs(trend.value)}
                    {trend.label && <span className="text-muted-foreground font-sans">{trend.label}</span>}
                </div>
            )}
        </div>
    );
}

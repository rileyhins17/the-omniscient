"use client";
import { cn } from "@/lib/utils";
import { AlertOctagon, XCircle } from "lucide-react";

interface DisqualifiersPanelProps {
    disqualifiers: string[];
    disqualifyReason: string | null;
}

export function DisqualifiersPanel({ disqualifiers, disqualifyReason }: DisqualifiersPanelProps) {
    if ((!disqualifiers || disqualifiers.length === 0) && !disqualifyReason) return null;

    return (
        <div className="glass-ultra rounded-xl p-6 border border-red-500/10">
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-4">
                <AlertOctagon className="w-4 h-4" />
                Disqualifiers
            </h3>

            {disqualifyReason && (
                <div className="glass rounded-lg p-3 mb-3 border border-red-500/10">
                    <div className="text-[10px] uppercase tracking-widest text-red-400/60 mb-1">Primary Reason</div>
                    <p className="text-xs text-red-300">{disqualifyReason}</p>
                </div>
            )}

            {disqualifiers && disqualifiers.length > 0 && (
                <ul className="space-y-1.5">
                    {disqualifiers.map((dq, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-400">
                            <XCircle className="w-3 h-3 text-red-400/50 mt-0.5 flex-shrink-0" />
                            <span>{dq}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

"use client";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";
import { Copy, PhoneCall, MessageCircle, Lightbulb, ArrowRight } from "lucide-react";

interface PainSignal { type: string; severity: number; evidence: string; }

interface CallSheetProps {
    callOpener: string | null;
    followUpQuestion: string | null;
    painSignals: PainSignal[];
}

const OBJECTION_TEMPLATES: Record<string, { trigger: string; handler: string }> = {
    NO_WEBSITE: {
        trigger: "No Website",
        handler: "Most people find you on Google first — without a site, you're invisible to the majority of potential customers searching right now.",
    },
    SPEED: {
        trigger: "Slow Speed",
        handler: "Mobile speed is killing conversions — 53% of visitors leave if your page takes more than 3 seconds to load.",
    },
    CONVERSION: {
        trigger: "Conversion Issues",
        handler: "No clear booking or quote path means visitors can't take the next step — even if they want to hire you.",
    },
    TRUST: {
        trigger: "Trust Gaps",
        handler: "Without reviews, testimonials, or certifications visible, visitors don't have enough confidence to reach out.",
    },
    SEO: {
        trigger: "SEO Weakness",
        handler: "You can't measure or improve lead flow if search engines can't properly index your business.",
    },
};

const NEXT_STEP = "If I could show you a 30-second example of what we'd change, would you want to see it?";

export function CallSheet({ callOpener, followUpQuestion, painSignals }: CallSheetProps) {
    const { toast } = useToast();

    const copyBlock = useCallback(async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast(`Copied ${label}`, { icon: "copy" });
        } catch {
            toast("Failed to copy", { type: "error" });
        }
    }, [toast]);

    // Determine relevant objection handlers
    const painTypes = new Set(painSignals.map(s => s.type));
    const relevantObjections = Object.entries(OBJECTION_TEMPLATES)
        .filter(([key]) => painTypes.has(key))
        .slice(0, 4);

    return (
        <div className="space-y-4">
            {/* Call Opener */}
            {callOpener && (
                <div className="glass-ultra rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <PhoneCall className="w-4 h-4 text-emerald-400" />
                            Call Opener
                        </h3>
                        <button
                            onClick={() => copyBlock(callOpener, "opener")}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                            <Copy className="w-3 h-3" /> Copy
                        </button>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed bg-black/20 rounded-lg p-3 border border-white/[0.04]">
                        {callOpener}
                    </p>
                </div>
            )}

            {/* Follow-up Question */}
            {followUpQuestion && (
                <div className="glass-ultra rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-cyan-400" />
                            Follow-up Question
                        </h3>
                        <button
                            onClick={() => copyBlock(followUpQuestion, "follow-up")}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                        >
                            <Copy className="w-3 h-3" /> Copy
                        </button>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed bg-black/20 rounded-lg p-3 border border-white/[0.04]">
                        {followUpQuestion}
                    </p>
                </div>
            )}

            {/* Objection Handlers */}
            {relevantObjections.length > 0 && (
                <div className="glass-ultra rounded-xl p-5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        Objection Handlers
                    </h3>
                    <div className="space-y-2">
                        {relevantObjections.map(([key, obj]) => (
                            <div key={key} className="glass rounded-lg p-3 border border-white/[0.04]">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70">
                                        {obj.trigger}
                                    </span>
                                    <button
                                        onClick={() => copyBlock(obj.handler, obj.trigger.toLowerCase())}
                                        className="text-[9px] text-muted-foreground hover:text-white transition-colors"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </button>
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed italic">
                                    &ldquo;{obj.handler}&rdquo;
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Next Step */}
            <div className="glass-ultra rounded-xl p-5 border border-emerald-500/10">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-semibold flex items-center gap-1.5">
                        <ArrowRight className="w-3 h-3" /> Next Step
                    </h3>
                    <button
                        onClick={() => copyBlock(NEXT_STEP, "next step")}
                        className="text-[9px] text-muted-foreground hover:text-emerald-400 transition-colors"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                </div>
                <p className="text-xs text-emerald-300/80 leading-relaxed italic">
                    &ldquo;{NEXT_STEP}&rdquo;
                </p>
            </div>
        </div>
    );
}

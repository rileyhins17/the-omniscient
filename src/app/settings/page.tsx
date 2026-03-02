"use client";
import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Zap, Monitor, Eye } from "lucide-react"
import { usePerformance } from "@/lib/ui/performance"

interface EngineConfig {
    openAiKey: string;
    geminiKey: string;
    axiomUrl: string;
    defaultRegion: string;
    radiusOverride: number;
    requireWebsite: boolean;
}

const DEFAULT_CONFIG: EngineConfig = {
    openAiKey: "",
    geminiKey: "",
    axiomUrl: "",
    defaultRegion: "United States",
    radiusOverride: 25,
    requireWebsite: true
}

export default function SettingsPage() {
    const { reducedMotion, toggle } = usePerformance();
    const [config, setConfig] = useState<EngineConfig>(DEFAULT_CONFIG);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("omniscient:engine_config");
            if (raw) {
                setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) });
            }
        } catch { }
        setIsLoaded(true);
    }, []);

    const updateConfig = (key: keyof EngineConfig, value: any) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        localStorage.setItem("omniscient:engine_config", JSON.stringify(newConfig));
    };

    if (!isLoaded) return null;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="animate-slide-up">
                <h1 className="text-4xl font-extrabold tracking-tight">
                    <span className="gradient-text">Settings</span>
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Configure your operator console preferences.
                </p>
            </div>

            {/* Performance & Display */}
            <Card className="glass-strong rounded-xl glow-emerald animate-slide-up" style={{ animationDelay: "100ms" }}>
                <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-emerald-400" />
                        Display & Performance
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Control visual effects and animation intensity.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Performance Mode Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl glass group hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center">
                                <Zap className={`w-4 h-4 ${reducedMotion ? "text-amber-400" : "text-emerald-400"}`} />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-foreground">Performance Mode</div>
                                <div className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                                    Disable particles, aurora, holo shimmer, and reduce animation durations.
                                    <br />Recommended for lower-end hardware or extended sessions.
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={toggle}
                            className={`relative w-11 h-6 rounded-full transition-all duration-300 ${reducedMotion
                                ? "bg-amber-400/30 border border-amber-400/40"
                                : "bg-white/[0.08] border border-white/[0.06]"
                                }`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 ${reducedMotion
                                ? "left-[22px] bg-amber-400 shadow-lg shadow-amber-400/30"
                                : "left-0.5 bg-zinc-400"
                                }`} />
                        </button>
                    </div>

                    {/* Visual Effects Info */}
                    <div className="flex items-center justify-between p-4 rounded-xl glass">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center">
                                <Eye className="w-4 h-4 text-cyan-400" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-foreground">Visual Effects</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {reducedMotion
                                        ? "Reduced — particles off, animations shortened, shimmer disabled"
                                        : "Full — aurora background, particle field, holo shimmer, cascade animations"
                                    }
                                </div>
                            </div>
                        </div>
                        <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-md ${reducedMotion
                            ? "text-amber-400 bg-amber-400/10"
                            : "text-emerald-400 bg-emerald-400/10"
                            }`}>
                            {reducedMotion ? "Reduced" : "Full FX"}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Engine Config Section */}
            <Card className="glass-strong rounded-xl glow-cyan animate-slide-up" style={{ animationDelay: "200ms" }}>
                <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Settings className="w-5 h-5 text-cyan-400" />
                        Engine Configuration
                    </CardTitle>
                    <CardDescription className="text-xs">
                        API keys, default search parameters, and export targets for v4.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* API Keys */}
                    <div className="space-y-3 p-4 rounded-xl glass border border-white/[0.04]">
                        <div className="text-sm font-semibold text-white/90">Authentication</div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-muted-foreground/60 block mb-1.5">OpenAI Key (GPT-4o)</label>
                                <input type="password" placeholder="sk-proj-..." value={config.openAiKey} onChange={(e) => updateConfig("openAiKey", e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/20" />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-muted-foreground/60 block mb-1.5">Gemini Key (Tier 1)</label>
                                <input type="password" placeholder="AIza..." value={config.geminiKey} onChange={(e) => updateConfig("geminiKey", e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/20" />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-muted-foreground/60 block mb-1.5">Axiom Dataset URL</label>
                                <input type="text" placeholder="https://cloud.axiom.co/api/v1/datasets/..." value={config.axiomUrl} onChange={(e) => updateConfig("axiomUrl", e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/20" />
                            </div>
                        </div>
                    </div>

                    {/* Extraction Settings */}
                    <div className="space-y-3 p-4 rounded-xl glass border border-white/[0.04]">
                        <div className="text-sm font-semibold text-white/90">Extraction Defaults</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-muted-foreground/60 block mb-1.5">Default Region</label>
                                <input type="text" value={config.defaultRegion} onChange={(e) => updateConfig("defaultRegion", e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:border-emerald-500/50 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-muted-foreground/60 block mb-1.5">Radius Override (Miles)</label>
                                <input type="number" value={config.radiusOverride} onChange={(e) => updateConfig("radiusOverride", parseInt(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:border-emerald-500/50 outline-none transition-all" />
                            </div>
                        </div>
                        <div className="pt-2">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="require-website" checked={config.requireWebsite} onChange={(e) => updateConfig("requireWebsite", e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/20" />
                                <label htmlFor="require-website" className="text-xs text-muted-foreground">Skip extraction if business has no identifiable website</label>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

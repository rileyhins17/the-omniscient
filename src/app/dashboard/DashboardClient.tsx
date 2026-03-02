"use client"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Database, Mail, Globe, Star, TrendingUp, Zap, Activity, BarChart3,
    MapPin, Target, ArrowUpRight, Users, Phone, Share2, Shield
} from "lucide-react"

interface Analytics {
    total: number
    withEmail: number
    withPhone: number
    missingWebsite: number
    activeWebsite: number
    withSocial: number
    withContact: number
    avgRating: number
    avgScore: number
    emailRate: number
    scoreDistribution: { elite: number; high: number; medium: number; low: number }
    nicheBreakdown: { name: string; count: number }[]
    cityDistribution: { name: string; count: number }[]
    leadsOverTime: { date: string; count: number }[]
    gradeDistribution: { grade: string; count: number }[]
    topLeads: { id: number; businessName: string; niche: string; city: string; leadScore: number | null; websiteStatus: string | null; email: boolean }[]
    recentActivity: { id: number; businessName: string; niche: string; city: string; leadScore: number | null; websiteStatus: string | null; email: boolean; createdAt: string }[]
    funnel: { raw: number; enriched: number; scored: number; contactable: number }
}

function AnimatedCounter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
    const [display, setDisplay] = useState(0)
    const ref = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        if (value === 0) { setDisplay(0); return }
        const duration = 1200
        const steps = 40
        const increment = value / steps
        let current = 0
        const timer = setInterval(() => {
            current += increment
            if (current >= value) {
                setDisplay(value)
                clearInterval(timer)
            } else {
                setDisplay(Math.floor(current))
            }
        }, duration / steps)
        return () => clearInterval(timer)
    }, [value])

    return <span ref={ref} className="animate-counter-up font-mono">{prefix}{display.toLocaleString()}{suffix}</span>
}

function ScoreTier({ score }: { score: number }) {
    const tier = score >= 80 ? "S" : score >= 60 ? "A" : score >= 40 ? "B" : "C"
    return (
        <span className="score-badge text-[10px] font-bold px-1.5 py-0.5 rounded border" data-tier={tier}>
            {tier}
        </span>
    )
}

const NICHE_COLORS = [
    "from-emerald-500 to-emerald-600",
    "from-cyan-500 to-cyan-600",
    "from-purple-500 to-purple-600",
    "from-amber-500 to-amber-600",
    "from-rose-500 to-rose-600",
    "from-blue-500 to-blue-600",
    "from-lime-500 to-lime-600",
    "from-orange-500 to-orange-600",
]

export default function DashboardClient() {
    const [data, setData] = useState<Analytics | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/api/leads/analytics")
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="animate-slide-up">
                    <h1 className="text-4xl font-extrabold tracking-tight">
                        <span className="gradient-text">Command Center</span>
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">Loading intelligence...</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="glass-strong rounded-xl p-5 h-32 animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    if (!data) return null

    const maxNiche = Math.max(...data.nicheBreakdown.map(n => n.count), 1)
    const maxCity = Math.max(...data.cityDistribution.map(c => c.count), 1)
    const maxTimeline = Math.max(...data.leadsOverTime.map(t => t.count), 1)

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Hero Header */}
            <div className="animate-slide-up">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight">
                            <span className="gradient-text">Command Center</span>
                        </h1>
                        <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                            Real-time intelligence overview of your entire lead pipeline.
                        </p>
                    </div>
                    <div className="hidden lg:flex items-center gap-3">
                        <div className="glass rounded-full px-3 py-1.5 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-glow" />
                            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Engine Idle</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Hero Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 cascade">
                {/* Total Leads */}
                <div className="glass-ultra rounded-xl p-5 holo-card stat-card glow-emerald animate-slide-up">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Leads</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                            <Database className="w-4 h-4 text-emerald-400" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-emerald-400">
                        <AnimatedCounter value={data.total} />
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                        <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] text-emerald-500/80">targets acquired</span>
                    </div>
                </div>

                {/* With Email */}
                <div className="glass-ultra rounded-xl p-5 holo-card stat-card glow-cyan animate-slide-up">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">With Email</span>
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                            <Mail className="w-4 h-4 text-cyan-400" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-cyan-400">
                        <AnimatedCounter value={data.withEmail} />
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                        <TrendingUp className="w-3 h-3 text-cyan-500" />
                        <span className="text-[10px] text-cyan-500/80">{data.emailRate}% contact rate</span>
                    </div>
                </div>

                {/* Avg Score */}
                <div className="glass-ultra rounded-xl p-5 holo-card stat-card glow-purple animate-slide-up">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Score</span>
                        <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-purple-400" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-purple-400">
                        <AnimatedCounter value={data.avgScore} suffix="/100" />
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                        <Activity className="w-3 h-3 text-purple-500" />
                        <span className="text-[10px] text-purple-500/80">lead quality index</span>
                    </div>
                </div>

                {/* No Website */}
                <div className="glass-ultra rounded-xl p-5 holo-card stat-card glow-red animate-slide-up">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">No Website</span>
                        <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                            <Globe className="w-4 h-4 text-red-400" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-red-400">
                        <AnimatedCounter value={data.missingWebsite} />
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                        <Target className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] text-red-500/80">prime targets</span>
                    </div>
                </div>
            </div>

            {/* Secondary Stats Row */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 cascade">
                {[
                    { label: "With Phone", value: data.withPhone, icon: Phone, color: "text-emerald-400" },
                    { label: "With Social", value: data.withSocial, icon: Share2, color: "text-blue-400" },
                    { label: "Has Contact", value: data.withContact, icon: Users, color: "text-amber-400" },
                    { label: "Active Site", value: data.activeWebsite, icon: Globe, color: "text-cyan-400" },
                    { label: "Avg Rating", value: data.avgRating, icon: Star, color: "text-yellow-400" },
                    { label: "Email Rate", value: data.emailRate, icon: Mail, color: "text-purple-400" },
                ].map((stat, i) => (
                    <div key={i} className="glass rounded-lg p-3 text-center animate-slide-up">
                        <stat.icon className={`w-3.5 h-3.5 mx-auto mb-1.5 ${stat.color}`} />
                        <div className={`text-lg font-bold font-mono ${stat.color}`}>
                            {stat.label === "Avg Rating" ? stat.value.toFixed(1) :
                                stat.label === "Email Rate" ? `${stat.value}%` :
                                    stat.value.toLocaleString()}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Lead Funnel */}
            <Card className="glass-ultra rounded-xl overflow-hidden holo-card animate-slide-up">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                        Lead Pipeline Funnel
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[
                            { label: "Raw Leads", value: data.funnel.raw, color: "from-zinc-500 to-zinc-600", pct: 100 },
                            { label: "AI Enriched", value: data.funnel.enriched, color: "from-purple-500 to-purple-600", pct: data.funnel.raw > 0 ? (data.funnel.enriched / data.funnel.raw) * 100 : 0 },
                            { label: "Scored", value: data.funnel.scored, color: "from-cyan-500 to-cyan-600", pct: data.funnel.raw > 0 ? (data.funnel.scored / data.funnel.raw) * 100 : 0 },
                            { label: "Contactable", value: data.funnel.contactable, color: "from-emerald-500 to-emerald-600", pct: data.funnel.raw > 0 ? (data.funnel.contactable / data.funnel.raw) * 100 : 0 },
                        ].map((stage, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-24 text-[10px] uppercase tracking-wider text-muted-foreground text-right shrink-0">{stage.label}</div>
                                <div className="flex-1 h-7 bg-white/[0.03] rounded-md overflow-hidden relative">
                                    <div
                                        className={`h-full bg-gradient-to-r ${stage.color} rounded-md transition-all duration-1000 ease-out funnel-segment`}
                                        style={{ width: `${Math.max(stage.pct, 2)}%`, transitionDelay: `${i * 200}ms` }}
                                    />
                                    <div className="absolute inset-0 flex items-center px-3">
                                        <span className="text-[11px] font-bold font-mono text-white/90">{stage.value.toLocaleString()}</span>
                                        <span className="text-[9px] text-white/40 ml-1.5">{stage.pct.toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Niche Breakdown */}
                <Card className="glass-ultra rounded-xl overflow-hidden holo-card animate-slide-up">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Target className="w-4 h-4 text-emerald-400" />
                            Niche Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.nicheBreakdown.length === 0 ? (
                            <div className="text-center py-8 text-zinc-600 text-sm">No data yet. Run an extraction.</div>
                        ) : (
                            <div className="space-y-2.5">
                                {data.nicheBreakdown.slice(0, 8).map((niche, i) => (
                                    <div key={niche.name} className="flex items-center gap-3">
                                        <div className="w-28 text-xs text-white/80 truncate font-medium shrink-0">{niche.name}</div>
                                        <div className="flex-1 h-5 bg-white/[0.03] rounded-md overflow-hidden">
                                            <div
                                                className={`h-full bg-gradient-to-r ${NICHE_COLORS[i % NICHE_COLORS.length]} rounded-md transition-all duration-700`}
                                                style={{ width: `${(niche.count / maxNiche) * 100}%`, transitionDelay: `${i * 100}ms` }}
                                            />
                                        </div>
                                        <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right">{niche.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* City Distribution */}
                <Card className="glass-ultra rounded-xl overflow-hidden holo-card animate-slide-up">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-cyan-400" />
                            City Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.cityDistribution.length === 0 ? (
                            <div className="text-center py-8 text-zinc-600 text-sm">No data yet.</div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2.5">
                                {data.cityDistribution.slice(0, 8).map((city, i) => {
                                    const intensity = Math.max(0.15, city.count / maxCity)
                                    return (
                                        <div
                                            key={city.name}
                                            className="glass rounded-lg p-3 text-center animate-scale-in transition-all duration-300 hover:scale-105 cursor-default"
                                            style={{
                                                animationDelay: `${i * 80}ms`,
                                                boxShadow: `0 0 ${20 * intensity}px rgba(6, 182, 212, ${intensity * 0.3})`
                                            }}
                                        >
                                            <MapPin className="w-3.5 h-3.5 mx-auto mb-1 text-cyan-400" style={{ opacity: 0.4 + intensity * 0.6 }} />
                                            <div className="text-sm font-bold text-white/90">{city.name}</div>
                                            <div className="text-lg font-bold font-mono text-cyan-400">{city.count}</div>
                                            <div className="text-[9px] text-muted-foreground">leads</div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Timeline + Score Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lead Timeline (30 days) */}
                <Card className="glass-ultra rounded-xl overflow-hidden holo-card animate-slide-up lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            Lead Acquisition Timeline
                            <Badge variant="outline" className="text-[9px] border-white/10 text-muted-foreground ml-auto">30 days</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-[3px] h-32">
                            {data.leadsOverTime.map((day, i) => {
                                const height = maxTimeline > 0 ? (day.count / maxTimeline) * 100 : 0
                                return (
                                    <div key={day.date} className="flex-1 flex flex-col items-center justify-end group relative">
                                        <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-emerald-400 whitespace-nowrap z-10 bg-black/80 px-1.5 py-0.5 rounded">
                                            {day.count} • {day.date.slice(5)}
                                        </div>
                                        <div
                                            className="w-full rounded-t-sm bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500 group-hover:from-emerald-500 group-hover:to-emerald-300 min-h-[2px]"
                                            style={{
                                                height: `${Math.max(height, 2)}%`,
                                                transitionDelay: `${i * 20}ms`,
                                                opacity: day.count > 0 ? 1 : 0.15
                                            }}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex justify-between mt-2">
                            <span className="text-[9px] text-muted-foreground font-mono">{data.leadsOverTime[0]?.date.slice(5)}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">{data.leadsOverTime[data.leadsOverTime.length - 1]?.date.slice(5)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Score Distribution */}
                <Card className="glass-ultra rounded-xl overflow-hidden holo-card animate-slide-up">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Shield className="w-4 h-4 text-purple-400" />
                            Score Tiers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                { tier: "S", label: "Elite (80+)", count: data.scoreDistribution.elite, color: "bg-emerald-500", textColor: "text-emerald-400" },
                                { tier: "A", label: "High (60-79)", count: data.scoreDistribution.high, color: "bg-cyan-500", textColor: "text-cyan-400" },
                                { tier: "B", label: "Medium (40-59)", count: data.scoreDistribution.medium, color: "bg-amber-500", textColor: "text-amber-400" },
                                { tier: "C", label: "Low (<40)", count: data.scoreDistribution.low, color: "bg-red-500", textColor: "text-red-400" },
                            ].map((s) => {
                                const totalScored = data.scoreDistribution.elite + data.scoreDistribution.high + data.scoreDistribution.medium + data.scoreDistribution.low
                                const pct = totalScored > 0 ? (s.count / totalScored) * 100 : 0
                                return (
                                    <div key={s.tier} className="flex items-center gap-2.5">
                                        <span className="score-badge text-[10px] font-bold w-6 text-center py-0.5 rounded border" data-tier={s.tier}>{s.tier}</span>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-[10px] mb-0.5">
                                                <span className="text-muted-foreground">{s.label}</span>
                                                <span className={`font-mono ${s.textColor}`}>{s.count}</span>
                                            </div>
                                            <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                                                <div className={`h-full ${s.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity + Top Leads */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <Card className="glass-ultra rounded-xl overflow-hidden animate-slide-up">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-400" />
                                Recent Activity
                            </CardTitle>
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-glow" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {data.recentActivity.length === 0 ? (
                            <div className="text-center py-8 text-zinc-600 text-sm">No recent activity.</div>
                        ) : (
                            <div className="space-y-1">
                                {data.recentActivity.map((lead, i) => (
                                    <div
                                        key={lead.id}
                                        className="activity-item flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                                        style={{ animationDelay: `${i * 60}ms` }}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${lead.websiteStatus === "MISSING" ? "bg-red-400" : "bg-emerald-400"}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-white/90 truncate">{lead.businessName}</div>
                                            <div className="text-[9px] text-muted-foreground">{lead.niche} • {lead.city}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {lead.email && <Mail className="w-3 h-3 text-cyan-400" />}
                                            {lead.leadScore !== null && <ScoreTier score={lead.leadScore} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top Leads */}
                <Card className="glass-ultra rounded-xl overflow-hidden animate-slide-up">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Star className="w-4 h-4 text-emerald-400" />
                            Top Scored Leads
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.topLeads.length === 0 ? (
                            <div className="text-center py-8 text-zinc-600 text-sm">No scored leads yet. Run an extraction.</div>
                        ) : (
                            <div className="space-y-1">
                                {data.topLeads.map((lead, i) => (
                                    <div
                                        key={lead.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors animate-slide-up"
                                        style={{ animationDelay: `${i * 60}ms` }}
                                    >
                                        <span className="text-[10px] font-mono text-muted-foreground w-5 text-right">#{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-white/90 truncate">{lead.businessName}</div>
                                            <div className="text-[9px] text-muted-foreground">{lead.niche} • {lead.city}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {lead.websiteStatus === "MISSING" && (
                                                <Badge variant="outline" className="text-[8px] border-red-900 text-red-400 px-1 py-0.5">NO SITE</Badge>
                                            )}
                                            {lead.email && <Mail className="w-3 h-3 text-cyan-400" />}
                                            {lead.leadScore !== null && (
                                                <span className="text-xs font-bold font-mono text-emerald-400">{lead.leadScore}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

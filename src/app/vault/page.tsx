import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import VaultDataTable from "@/components/VaultDataTable"
import { Database, Globe, Mail, Star } from "lucide-react"

export default async function TheVaultPage() {
    const leads = await prisma.lead.findMany({
        orderBy: { createdAt: "desc" }
    })

    const totalLeads = leads.length
    const missingWebsite = leads.filter(l => l.websiteStatus === "MISSING").length
    const withEmail = leads.filter(l => l.email && l.email.length > 0).length
    const avgRating = totalLeads > 0
        ? parseFloat((leads.reduce((sum, l) => sum + (l.rating || 0), 0) / totalLeads).toFixed(1))
        : 0

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="animate-slide-up">
                <h1 className="text-4xl font-extrabold tracking-tight">
                    <span className="gradient-text">The Vault</span>
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Your secured repository of AI-enriched, qualified business intelligence.
                </p>
            </div>

            {/* Stats Cards — using design system StatCard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
                <StatCard
                    label="Total Leads"
                    value={totalLeads}
                    subtitle="targets acquired"
                    icon={<Database />}
                    iconColor="text-emerald-400"
                    glowClass="glow-emerald"
                />
                <StatCard
                    label="No Website"
                    value={missingWebsite}
                    subtitle="prime targets"
                    icon={<Globe />}
                    iconColor="text-red-400"
                    glowClass="glow-red"
                />
                <StatCard
                    label="With Email"
                    value={withEmail}
                    subtitle="contactable leads"
                    icon={<Mail />}
                    iconColor="text-cyan-400"
                    glowClass="glow-cyan"
                />
                <StatCard
                    label="Avg Rating"
                    value={avgRating}
                    subtitle="stars average"
                    icon={<Star />}
                    iconColor="text-amber-400"
                    glowClass="glow-amber"
                />
            </div>

            {/* Data Table */}
            <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
                <Card className="glass-strong rounded-xl overflow-hidden glow-emerald">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                                    <Database className="w-5 h-5 text-emerald-400" />
                                    Lead Intelligence Database
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    Filter, sort, and export your enriched targets.
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-emerald-400 border-emerald-900 bg-emerald-950/30 px-3 py-1 font-mono text-xs">
                                {leads.length} Records
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <VaultDataTable initialLeads={JSON.parse(JSON.stringify(leads))} />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

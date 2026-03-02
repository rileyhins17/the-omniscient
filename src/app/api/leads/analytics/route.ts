import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const leads = await prisma.lead.findMany({
            where: { isArchived: false },
            orderBy: { createdAt: "desc" },
        });

        const total = leads.length;
        const withEmail = leads.filter(l => l.email && l.email.length > 0).length;
        const withPhone = leads.filter(l => l.phone && l.phone.length > 0).length;
        const missingWebsite = leads.filter(l => l.websiteStatus === "MISSING").length;
        const activeWebsite = leads.filter(l => l.websiteStatus === "ACTIVE").length;
        const withSocial = leads.filter(l => l.socialLink && l.socialLink.length > 0).length;
        const withContact = leads.filter(l => l.contactName && l.contactName.length > 0).length;

        // Average rating
        const rated = leads.filter(l => l.rating && l.rating > 0);
        const avgRating = rated.length > 0
            ? parseFloat((rated.reduce((s, l) => s + (l.rating || 0), 0) / rated.length).toFixed(1))
            : 0;

        // ═══ AXIOM METRICS ═══
        const scored = leads.filter(l => l.axiomScore !== null && l.axiomScore !== undefined);
        const avgScore = scored.length > 0
            ? Math.round(scored.reduce((s, l) => s + (l.axiomScore || 0), 0) / scored.length)
            : 0;

        // Tier distribution
        const tierCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
        leads.forEach(l => {
            if (l.axiomTier && tierCounts[l.axiomTier] !== undefined) {
                tierCounts[l.axiomTier]++;
            }
        });

        // Tier counts by niche
        const tierByNiche: Record<string, Record<string, number>> = {};
        leads.forEach(l => {
            const n = l.niche || "Unknown";
            if (!tierByNiche[n]) tierByNiche[n] = { S: 0, A: 0, B: 0, C: 0, D: 0 };
            if (l.axiomTier) tierByNiche[n][l.axiomTier]++;
        });

        // Tier counts by city
        const tierByCity: Record<string, Record<string, number>> = {};
        leads.forEach(l => {
            const c = l.city || "Unknown";
            if (!tierByCity[c]) tierByCity[c] = { S: 0, A: 0, B: 0, C: 0, D: 0 };
            if (l.axiomTier) tierByCity[c][l.axiomTier]++;
        });

        // Average axiomScore by niche
        const scoreByNiche: Record<string, { total: number; count: number }> = {};
        leads.forEach(l => {
            const n = l.niche || "Unknown";
            if (!scoreByNiche[n]) scoreByNiche[n] = { total: 0, count: 0 };
            if (l.axiomScore !== null) {
                scoreByNiche[n].total += l.axiomScore || 0;
                scoreByNiche[n].count++;
            }
        });
        const avgScoreByNiche = Object.entries(scoreByNiche).map(([name, { total, count }]) => ({
            name, avgScore: count > 0 ? Math.round(total / count) : 0, count,
        })).sort((a, b) => b.avgScore - a.avgScore);

        // Average axiomScore by city
        const scoreByCity: Record<string, { total: number; count: number }> = {};
        leads.forEach(l => {
            const c = l.city || "Unknown";
            if (!scoreByCity[c]) scoreByCity[c] = { total: 0, count: 0 };
            if (l.axiomScore !== null) {
                scoreByCity[c].total += l.axiomScore || 0;
                scoreByCity[c].count++;
            }
        });
        const avgScoreByCity = Object.entries(scoreByCity).map(([name, { total, count }]) => ({
            name, avgScore: count > 0 ? Math.round(total / count) : 0, count,
        })).sort((a, b) => b.avgScore - a.avgScore);

        // Top pain signals frequency
        const painFreq: Record<string, number> = {};
        leads.forEach(l => {
            try {
                const pains = JSON.parse(l.painSignals || "[]");
                for (const p of pains) {
                    const key = p.type || "UNKNOWN";
                    painFreq[key] = (painFreq[key] || 0) + 1;
                }
            } catch { }
        });
        const topPainSignals = Object.entries(painFreq)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);

        // Callable leads: tier S/A/B AND phoneConfidence>0.6 AND (emailConfidence>0.4 OR contactPath exists)
        const callableLeads = leads.filter(l => {
            const goodTier = ["S", "A", "B"].includes(l.axiomTier || "");
            const goodPhone = (l.phoneConfidence || 0) > 0.6;
            const goodContact = (l.emailConfidence || 0) > 0.4 || (l.socialLink && l.socialLink.length > 0);
            return goodTier && goodPhone && goodContact;
        }).length;

        // Niche breakdown
        const nicheMap: Record<string, number> = {};
        leads.forEach(l => { nicheMap[l.niche || "Unknown"] = (nicheMap[l.niche || "Unknown"] || 0) + 1; });
        const nicheBreakdown = Object.entries(nicheMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // City distribution
        const cityMap: Record<string, number> = {};
        leads.forEach(l => { cityMap[l.city || "Unknown"] = (cityMap[l.city || "Unknown"] || 0) + 1; });
        const cityDistribution = Object.entries(cityMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Leads over time (last 30 days)
        const timeMap: Record<string, number> = {};
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            timeMap[d.toISOString().split("T")[0]] = 0;
        }
        leads.forEach(l => {
            const key = new Date(l.createdAt).toISOString().split("T")[0];
            if (key in timeMap) timeMap[key]++;
        });
        const leadsOverTime = Object.entries(timeMap).map(([date, count]) => ({ date, count }));

        // Score distribution (Axiom tiers)
        const scoreDistribution = {
            elite: tierCounts.S,
            high: tierCounts.A,
            medium: tierCounts.B,
            low: tierCounts.C + tierCounts.D,
        };

        // Grade distribution
        const gradeMap: Record<string, number> = {};
        leads.forEach(l => { if (l.websiteGrade) gradeMap[l.websiteGrade] = (gradeMap[l.websiteGrade] || 0) + 1; });
        const gradeDistribution = Object.entries(gradeMap)
            .map(([grade, count]) => ({ grade, count }))
            .sort((a, b) => a.grade.localeCompare(b.grade));

        // Top scored leads (by axiomScore)
        const topLeads = [...leads]
            .filter(l => l.axiomScore !== null)
            .sort((a, b) => (b.axiomScore || 0) - (a.axiomScore || 0))
            .slice(0, 8)
            .map(l => ({
                id: l.id,
                businessName: l.businessName,
                niche: l.niche,
                city: l.city,
                leadScore: l.axiomScore,
                axiomScore: l.axiomScore,
                axiomTier: l.axiomTier,
                websiteStatus: l.websiteStatus,
                email: l.email ? true : false,
                callOpener: l.callOpener,
            }));

        // Recent activity
        const recentActivity = leads.slice(0, 10).map(l => ({
            id: l.id,
            businessName: l.businessName,
            niche: l.niche,
            city: l.city,
            leadScore: l.axiomScore,
            axiomScore: l.axiomScore,
            axiomTier: l.axiomTier,
            websiteStatus: l.websiteStatus,
            email: l.email ? true : false,
            createdAt: l.createdAt,
        }));

        // Email rate
        const emailRate = total > 0 ? Math.round((withEmail / total) * 100) : 0;

        // Funnel
        const funnel = {
            raw: total,
            enriched: leads.filter(l => l.tacticalNote && l.tacticalNote !== "No intelligence generated.").length,
            scored: scored.length,
            contactable: leads.filter(l => (l.email && l.email.length > 0) || (l.phone && l.phone.length > 0)).length,
        };

        // Disqualified count (all, including archived)
        const totalArchived = await prisma.lead.count({ where: { isArchived: true } });

        return NextResponse.json({
            total, withEmail, withPhone, missingWebsite, activeWebsite,
            withSocial, withContact, avgRating, avgScore, emailRate,
            scoreDistribution, nicheBreakdown, cityDistribution,
            leadsOverTime, gradeDistribution, topLeads, recentActivity, funnel,
            // ═══ NEW AXIOM METRICS ═══
            tierCounts,
            tierByNiche,
            tierByCity,
            avgScoreByNiche,
            avgScoreByCity,
            topPainSignals,
            callableLeads,
            totalArchived,
        });
    } catch (error: any) {
        console.error("Analytics API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

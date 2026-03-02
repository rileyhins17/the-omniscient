import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const total = await prisma.lead.count({ where: { isArchived: false } });

        // Today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayLeads = await prisma.lead.count({
            where: { isArchived: false, createdAt: { gte: today } },
        });

        const allTodayLeads = await prisma.lead.findMany({
            where: { createdAt: { gte: today } },
            select: {
                email: true,
                axiomTier: true,
                isArchived: true,
                phoneConfidence: true,
                emailConfidence: true,
                socialLink: true,
            },
        });

        const todayEmails = allTodayLeads.filter(l => l.email && l.email.length > 0 && !l.isArchived).length;

        // Callable: S/A/B + phoneConfidence>0.6 + (emailConfidence>0.4 OR socialLink)
        const todayCallable = allTodayLeads.filter(l => {
            const goodTier = ["S", "A", "B"].includes(l.axiomTier || "");
            const goodPhone = (l.phoneConfidence || 0) > 0.6;
            const goodContact = (l.emailConfidence || 0) > 0.4 || (l.socialLink && l.socialLink.length > 0);
            return goodTier && goodPhone && goodContact && !l.isArchived;
        }).length;

        const todayTierSA = allTodayLeads.filter(l =>
            ["S", "A"].includes(l.axiomTier || "") && !l.isArchived
        ).length;

        const todayDisqualified = allTodayLeads.filter(l => l.isArchived).length;

        return NextResponse.json({
            total,
            todayLeads,
            todayEmails,
            todayCallable,
            todayTierSA,
            todayDisqualified,
        });
    } catch (error: any) {
        return NextResponse.json({
            total: 0, todayLeads: 0, todayEmails: 0,
            todayCallable: 0, todayTierSA: 0, todayDisqualified: 0,
        });
    }
}

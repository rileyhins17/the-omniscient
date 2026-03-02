/**
 * Backfill API — Scores existing leads with Axiom engine
 * 
 * POST /api/leads/backfill
 * Recalculates axiomScore, tier, painSignals, personalization,
 * contact validation, dedup keys, and disqualifiers for all existing leads.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAxiomScoreFromDbLead } from "@/lib/axiom-scoring";
import { validateContact } from "@/lib/contact-validation";
import { generateDedupeKey } from "@/lib/dedupe";
import { generatePersonalization } from "@/lib/lead-personalization";

export async function POST() {
    try {
        const leads = await prisma.lead.findMany({
            orderBy: { createdAt: "asc" },
        });

        let processed = 0;
        let disqualified = 0;
        let archived = 0;
        const tierCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
        const seenDedupeKeys = new Set<string>();
        let dupesFound = 0;

        for (const lead of leads) {
            // Compute Axiom score from DB data
            const scoreResult = computeAxiomScoreFromDbLead({
                niche: lead.niche,
                category: lead.category,
                city: lead.city,
                rating: lead.rating,
                reviewCount: lead.reviewCount,
                websiteStatus: lead.websiteStatus,
                email: lead.email,
                phone: lead.phone,
                socialLink: lead.socialLink,
                contactName: lead.contactName,
                tacticalNote: lead.tacticalNote,
            });

            // Contact validation
            const contactVal = validateContact(lead.email, lead.phone);

            // Dedupe key
            const dedupe = generateDedupeKey(
                lead.businessName, lead.city, lead.phone, null, lead.address
            );

            // Check for duplicates within existing data
            let isDupe = false;
            if (seenDedupeKeys.has(dedupe.key)) {
                isDupe = true;
                dupesFound++;
            }
            seenDedupeKeys.add(dedupe.key);

            // Personalization
            const personalization = generatePersonalization({
                businessName: lead.businessName,
                niche: lead.niche,
                city: lead.city,
                websiteStatus: lead.websiteStatus || "MISSING",
                painSignals: scoreResult.painSignals,
                assessment: null,
                contactName: lead.contactName || null,
            });

            // Backfill does NOT auto-archive based on score — data is too limited.
            // Only archive true duplicates.
            const shouldArchive = isDupe;
            if (shouldArchive) archived++;

            tierCounts[scoreResult.tier] = (tierCounts[scoreResult.tier] || 0) + 1;

            // Update lead
            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    axiomScore: scoreResult.axiomScore,
                    axiomTier: scoreResult.tier,
                    scoreBreakdown: JSON.stringify(scoreResult.breakdown),
                    painSignals: JSON.stringify(scoreResult.painSignals),
                    callOpener: personalization.callOpener,
                    followUpQuestion: personalization.followUpQuestion,
                    dedupeKey: dedupe.key,
                    dedupeMatchedBy: dedupe.matchedBy,
                    emailType: contactVal.emailType,
                    emailConfidence: contactVal.emailConfidence,
                    phoneConfidence: contactVal.phoneConfidence,
                    isArchived: shouldArchive,
                    leadScore: scoreResult.axiomScore, // Sync legacy field
                    lastUpdated: new Date(),
                },
            });

            processed++;
        }

        return NextResponse.json({
            success: true,
            processed,
            disqualified,
            archived,
            dupesFound,
            tierDistribution: tierCounts,
            message: `Backfilled ${processed} leads. ${disqualified} disqualified, ${dupesFound} dupes found, ${archived} archived.`,
        });
    } catch (error: any) {
        console.error("Backfill error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Lead Personalization Module
 * 
 * Generates evidence-backed callOpener and followUpQuestion
 * using painSignals + niche context.
 */

import type { PainSignal, WebsiteAssessment } from "./axiom-scoring";

export interface PersonalizationResult {
    callOpener: string;
    followUpQuestion: string;
}

/**
 * Generate a sales-ready call opener and follow-up question.
 * Uses the most severe pain signals as evidence.
 */
export function generatePersonalization(input: {
    businessName: string;
    niche: string;
    city: string;
    websiteStatus: string;
    painSignals: PainSignal[];
    assessment: WebsiteAssessment | null;
    contactName: string | null;
}): PersonalizationResult {
    const topPains = [...input.painSignals]
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 3);

    const name = input.contactName ? input.contactName.split(" ")[0] : null;
    const greeting = name ? `Hi ${name}, ` : "";

    // ═══ NO WEBSITE ═══
    if (input.websiteStatus === "MISSING") {
        const hasReviews = topPains.some(p => p.evidence.includes("reviews") || p.evidence.includes("review"));

        if (hasReviews) {
            return {
                callOpener: `${greeting}Noticed ${input.businessName} has solid reviews on Google but no website showing up — in ${input.niche.toLowerCase()}, that usually means a lot of leads are going to competitors who do. We typically fix that in about two weeks.`,
                followUpQuestion: `Are you mainly looking to get more calls from people searching online, or is it more about having a professional presence when someone Googles you?`,
            };
        }

        return {
            callOpener: `${greeting}Came across ${input.businessName} on Google Maps — strong listing but no website. Most of your competitors in ${input.city} have one, so there's an opportunity to capture the leads they're missing.`,
            followUpQuestion: `Have you been thinking about getting a site built, or has it just not been a priority yet?`,
        };
    }

    // ═══ HAS WEBSITE WITH PROBLEMS ═══
    if (topPains.length === 0) {
        return {
            callOpener: `${greeting}Took a look at ${input.businessName}'s website — there may be a few quick wins that could help you get more calls from it.`,
            followUpQuestion: `Are you happy with the volume of leads coming through your site right now, or do you feel like it could be doing more?`,
        };
    }

    // Build evidence string from top pain signals
    const painPhrases: string[] = [];
    for (const pain of topPains) {
        switch (pain.type) {
            case "SPEED":
                painPhrases.push("loads slow on mobile");
                break;
            case "CONVERSION":
                if (pain.evidence.toLowerCase().includes("no booking") || pain.evidence.toLowerCase().includes("no form")) {
                    painPhrases.push("no quick way for visitors to book or request a quote");
                } else if (pain.evidence.toLowerCase().includes("no cta")) {
                    painPhrases.push("no clear call-to-action to drive inquiries");
                } else {
                    painPhrases.push("weak conversion path for turning visitors into calls");
                }
                break;
            case "TRUST":
                if (pain.evidence.toLowerCase().includes("ssl") || pain.evidence.toLowerCase().includes("https")) {
                    painPhrases.push("shows security warnings");
                } else if (pain.evidence.toLowerCase().includes("outdated")) {
                    painPhrases.push("looks like it hasn't been updated in a while");
                } else {
                    painPhrases.push("has some trust signals that could be stronger");
                }
                break;
            case "SEO":
                painPhrases.push("isn't showing up well in local search");
                break;
            case "DESIGN":
                painPhrases.push("design could use a modern refresh");
                break;
            default:
                painPhrases.push("has room for improvement");
        }
    }

    // Deduplicate
    const uniquePhrases = [...new Set(painPhrases)].slice(0, 2);
    const evidenceStr = uniquePhrases.join(" and ");

    const callOpener = `${greeting}Looked at ${input.businessName}'s site — it ${evidenceStr}. We usually fix those together so you actually see more calls coming in within the first month.`;

    // Follow-up based on primary pain type
    const primaryType = topPains[0]?.type;
    let followUpQuestion: string;
    switch (primaryType) {
        case "SPEED":
            followUpQuestion = "Have you noticed if customers mention the site being slow, or are you more focused on getting new leads?";
            break;
        case "CONVERSION":
            followUpQuestion = "Are you mainly trying to increase booked jobs this season, or is it more about improving how people find you online?";
            break;
        case "TRUST":
            followUpQuestion = "Has anyone mentioned that your site looks outdated, or is growing your customer base the bigger priority?";
            break;
        case "SEO":
            followUpQuestion = "Are your competitors showing up above you when people search for your services locally?";
            break;
        default:
            followUpQuestion = "What would make the biggest difference for your business right now — more calls, or a better first impression online?";
    }

    return { callOpener, followUpQuestion };
}

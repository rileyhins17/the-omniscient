import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { createObjectCsvWriter } from "csv-writer";
import fs from "fs";

import {
    computeAxiomScore,
    type PainSignal,
    type WebsiteAssessment,
} from "@/lib/axiom-scoring";
import { validateContact } from "@/lib/contact-validation";
import { generateDedupeKey } from "@/lib/dedupe";
import { checkDisqualifiers } from "@/lib/disqualifiers";
import { generatePersonalization } from "@/lib/lead-personalization";
import {
    formatEmailCandidatesForPrompt,
    resolvePublicBusinessEmail,
    type EmailDiscoveryPage,
} from "@/lib/public-email-intelligence";
import {
    collectSearchDiscoveryPage,
    collectWebsiteDiscoveryPages,
    pickBestSocialLink,
} from "@/lib/public-web-discovery";

type Target = {
    businessName: string;
    website: string;
    rating: number;
    reviewCount: number;
    phone: string;
    category: string;
    address: string;
};

function sanitizeAiJsonResponse(text: string): string {
    return text.trim().replace(/```json/g, "").replace(/```/g, "").trim();
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const niche = searchParams.get("niche");
    const city = searchParams.get("city");
    const radius = searchParams.get("radius") || "10";
    const maxDepth = parseInt(searchParams.get("maxDepth") || "5", 10);

    let browser: import("playwright").Browser | null = null;

    const stream = new ReadableStream({
        async start(controller) {
            let streamClosed = false;
            const sendEvent = (data: unknown) => {
                if (streamClosed) return false;
                try {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
                    return true;
                } catch {
                    streamClosed = true;
                    return false;
                }
            };

            req.signal.addEventListener("abort", () => {
                streamClosed = true;
                if (browser) {
                    void browser.close().catch(() => undefined);
                }
            });

            try {
                if (!niche || !city) {
                    throw new Error("Missing niche or city text");
                }

                const source = `${niche}|${city}|${new Date().toISOString().split("T")[0]}`;
                const csvPath = `C:\\Users\\riley\\.gemini\\antigravity\\scratch\\axiom_call_sheet.csv`;
                const csvHeaders = [
                    { id: "Business_Name", title: "Business_Name" },
                    { id: "City", title: "City" },
                    { id: "Niche", title: "Niche" },
                    { id: "Phone", title: "Phone" },
                    { id: "Best_Email", title: "Best_Email" },
                    { id: "Axiom_Score", title: "Axiom_Score" },
                    { id: "Tier", title: "Tier" },
                    { id: "Call_Opener", title: "Call_Opener" },
                    { id: "Pain_Signals", title: "Pain_Signals" },
                    { id: "Website", title: "Website" },
                    { id: "Website_Grade", title: "Website_Grade" },
                    { id: "Score_Breakdown", title: "Score_Breakdown" },
                    { id: "Last_Updated", title: "Last_Updated" },
                    { id: "Source", title: "Source" },
                ];

                const fileExists = fs.existsSync(csvPath);
                const csvWriter = createObjectCsvWriter({
                    path: csvPath,
                    header: csvHeaders,
                    append: fileExists,
                });
                const jsonlPath = `C:\\Users\\riley\\.gemini\\antigravity\\scratch\\axiom_call_sheet.jsonl`;

                browser = await chromium.launch({ headless: true });
                const context = await browser.newContext({ locale: "en-CA" });
                const page = await context.newPage();

                sendEvent({ message: `[ENGINE] AXIOM ENGINE V4 initialized for ${niche} in ${city} (R:${radius}km, D:${maxDepth})` });
                sendEvent({ message: "[ENGINE] Intelligence modules online: scoring, dedupe, contact validation, public email resolver" });

                const query = `${niche} in ${city}, Ontario`;
                await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`);

                try {
                    await page.waitForSelector("div[role='feed']", { timeout: 15000 });
                } catch {
                    throw new Error("Maps results timed out. No targets found.");
                }

                sendEvent({ message: "[MAPS] Infinite scroll extraction started" });

                let lastHeight = 0;
                let scrollAttempts = 0;
                while (scrollAttempts < maxDepth) {
                    const newHeight = await page.evaluate(() => {
                        const feed = document.querySelector('div[role="feed"]');
                        if (feed) {
                            feed.scrollBy(0, 5000);
                            return feed.scrollHeight;
                        }
                        return 0;
                    });

                    if (newHeight === lastHeight) break;
                    lastHeight = newHeight;
                    scrollAttempts++;
                    await page.waitForTimeout(1500);
                    sendEvent({ message: `[MAPS] Depth ${scrollAttempts}/${maxDepth}` });
                }

                const placeLinks = await page.locator("a.hfpxzc").evaluateAll((anchors) =>
                    anchors
                        .map((anchor) => ({
                            name: anchor.getAttribute("aria-label") || "",
                            url: (anchor as HTMLAnchorElement).href || anchor.getAttribute("href") || "",
                        }))
                        .filter((place) => place.name && place.url && !place.url.includes("/search/"))
                );

                sendEvent({ message: `[MAPS] Found ${placeLinks.length} listings. Extracting details...` });

                const targets: Target[] = [];
                const chunkSize = 5;

                for (let i = 0; i < placeLinks.length; i += chunkSize) {
                    const chunk = placeLinks.slice(i, i + chunkSize);
                    sendEvent({ message: `[MAPS] Detail batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(placeLinks.length / chunkSize)}` });

                    const chunkResults = await Promise.all(chunk.map(async (place) => {
                        const detailPage = await context.newPage();
                        try {
                            await detailPage.goto(place.url, { waitUntil: "domcontentloaded", timeout: 15000 });
                            await detailPage.waitForSelector("h1", { timeout: 10000 });

                            const detailData = await detailPage.evaluate(() => {
                                const title = document.querySelector("h1")?.innerText || "";
                                const webButton = document.querySelector('a[data-item-id="authority"]');
                                const website = (webButton as HTMLAnchorElement | null)?.href || webButton?.getAttribute("href") || "";
                                const phoneButton = document.querySelector('button[data-item-id*="phone:tel:"]');
                                let phone = "";
                                if (phoneButton) {
                                    phone = phoneButton.getAttribute("data-item-id")?.replace("phone:tel:", "") || "";
                                } else {
                                    const fallbackButtons = Array.from(document.querySelectorAll('button[data-tooltip="Copy phone number"]'));
                                    if (fallbackButtons.length > 0) phone = (fallbackButtons[0] as HTMLElement).innerText;
                                }

                                const addressButton = document.querySelector('button[data-item-id="address"]');
                                const address = addressButton?.getAttribute("aria-label")?.replace("Address: ", "") || "";
                                const categoryButton = document.querySelector('button[jsaction="pane.rating.category"]');
                                const category = (categoryButton as HTMLElement | null)?.innerText || "";
                                const ratingDiv = document.querySelector('div[jsaction="pane.rating.moreReviews"]');
                                const ratingText = ratingDiv?.getAttribute("aria-label") || "";

                                return { title, website, phone, address, category, ratingText };
                            });
                            return detailData;
                        } catch {
                            return null;
                        } finally {
                            await detailPage.close();
                        }
                    }));

                    for (const res of chunkResults) {
                        if (!res || !res.title) continue;

                        let rating = 0;
                        let reviewCount = 0;
                        if (res.ratingText) {
                            const match = res.ratingText.match(/([\d.]+)\s*stars?\s*([\d,]+)/i);
                            if (match) {
                                rating = parseFloat(match[1]);
                                reviewCount = parseInt(match[2].replace(/,/g, ""), 10);
                            }
                        }

                        targets.push({
                            businessName: res.title,
                            website: res.website,
                            rating,
                            reviewCount,
                            phone: res.phone,
                            category: res.category,
                            address: res.address,
                        });
                    }
                }

                sendEvent({ message: `[ENGINE] ${targets.length} targets parsed. Starting enrichment...`, progress: 0, total: targets.length });

                const existingLeads = await prisma.lead.findMany({
                    select: { dedupeKey: true, businessName: true, city: true, phone: true },
                });

                const existingDedupeKeys = new Set<string>();
                for (const lead of existingLeads) {
                    if (lead.dedupeKey) {
                        existingDedupeKeys.add(lead.dedupeKey);
                    } else {
                        const fallback = generateDedupeKey(lead.businessName, lead.city || "", lead.phone);
                        existingDedupeKeys.add(fallback.key);
                    }
                }

                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.5-pro",
                    safetySettings: [
                        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    ],
                });

                let savedCount = 0;
                let emailCount = 0;
                let dupCount = 0;
                let disqualifiedCount = 0;
                const tierCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };

                for (let idx = 0; idx < targets.length; idx++) {
                    const target = targets[idx];
                    if (streamClosed) break;
                    const dedupe = generateDedupeKey(
                        target.businessName,
                        city,
                        target.phone,
                        target.website,
                        target.address,
                    );

                    if (existingDedupeKeys.has(dedupe.key)) {
                        dupCount++;
                        sendEvent({
                            message: `[DEDUPE] ${target.businessName} skipped (${dedupe.matchedBy})`,
                            progress: idx + 1,
                            total: targets.length,
                            stats: { leadsFound: savedCount, withEmail: emailCount },
                        });
                        continue;
                    }
                    existingDedupeKeys.add(dedupe.key);

                    sendEvent({
                        message: `[ENRICH] ${idx + 1}/${targets.length} ${target.businessName}`,
                        progress: idx,
                        total: targets.length,
                        stats: { leadsFound: savedCount, withEmail: emailCount },
                    });

                    let rawFootprint = "";
                    let email = "";
                    let ownerName = "";
                    let socialLink = "";
                    let websiteStatus = "MISSING";
                    let discoveryPages: EmailDiscoveryPage[] = [];

                    try {
                        if (target.website) {
                            websiteStatus = "ACTIVE";
                            sendEvent({ message: `[WEB] Deep scan ${target.website.substring(0, 70)}` });
                            const discovery = await collectWebsiteDiscoveryPages(context, target.website, sendEvent);
                            rawFootprint = discovery.rawFootprint;
                            discoveryPages = discovery.pages;
                            socialLink = pickBestSocialLink(discovery.pages);
                        } else {
                            sendEvent({ message: "[WEB] No website. Searching public footprint..." });
                            const searchQuery = `"${target.businessName}" ${city} email OR owner OR founder OR facebook OR linkedin`;
                            const discovery = await collectSearchDiscoveryPage(context, searchQuery);
                            rawFootprint = discovery.rawFootprint;
                            discoveryPages = discovery.pages;
                            socialLink = pickBestSocialLink(discovery.pages);
                        }
                    } catch {
                        // Ignore enrichment timeouts and continue with what we have.
                    }

                    let emailResolution = resolvePublicBusinessEmail({
                        businessName: target.businessName,
                        businessWebsite: target.website,
                        pages: discoveryPages,
                    });
                    email = emailResolution.email;

                    if (emailResolution.email) {
                        sendEvent({
                            message: `[EMAIL] Resolver candidate ${emailResolution.email} (${emailResolution.emailType}/${emailResolution.confidence.toFixed(2)})`,
                        });
                    } else {
                        sendEvent({ message: "[EMAIL] Resolver found no vetted public email" });
                    }

                    let assessment: WebsiteAssessment | null = null;
                    let painSignals: PainSignal[] = [];
                    let tacticalNote = "No intelligence generated.";
                    let hasContactForm = false;
                    let hasSocialMessaging = /facebook|instagram|messenger/i.test(socialLink);

                    if (process.env.GEMINI_API_KEY) {
                        try {
                            const vettedEmailCandidates = formatEmailCandidatesForPrompt(emailResolution.candidates);
                            const prompt = websiteStatus === "ACTIVE"
                                ? `You are an elite B2B web analyst evaluating a local business website for a web design agency.
Business: ${target.businessName} | Location: ${city} | Niche: ${niche} | Category: ${target.category}
Website: ${target.website}
Rating: ${target.rating}/5 (${target.reviewCount} reviews)

WEBSITE CONTENT & LINKS:
${rawFootprint.substring(0, 15000)}

VETTED PUBLIC EMAIL CANDIDATES:
${vettedEmailCandidates}

EMAIL RULES:
- You may only return an email that appears exactly in the vetted public email candidates list above.
- If no candidate is clearly usable for outreach, return "".
- Prefer public owner, founder, director, or person-named inboxes over generic inboxes.
- Never invent, normalize, or guess an email.

Return a JSON object (no markdown, no code fences):
{
  "email": "Exact email from the vetted candidate list or empty string",
  "ownerName": "Owner/founder/contact person or empty string",
  "socialLink": "Best social media link (FB, IG, LinkedIn) or empty string",
  "websiteAssessment": {
    "speedRisk": 0-5,
    "conversionRisk": 0-5,
    "trustRisk": 0-5,
    "seoRisk": 0-5,
    "overallGrade": "A through F",
    "topFixes": ["Fix 1", "Fix 2", "Fix 3"]
  },
  "painSignals": [
    {"type": "CONVERSION|SPEED|TRUST|SEO|DESIGN|FUNCTIONALITY", "severity": 1-5, "evidence": "Specific evidence from the site", "source": "site_scan"}
  ],
  "hasContactForm": true/false,
  "hasSocialMessaging": true/false,
  "tacticalNote": "1-2 sentence critical evaluation"
}`
                                : `You are an elite B2B web analyst evaluating a local business with no website.
Business: ${target.businessName} | Location: ${city} | Niche: ${niche} | Category: ${target.category}
Rating: ${target.rating}/5 (${target.reviewCount} reviews)

RAW SEARCH FOOTPRINT:
${rawFootprint.substring(0, 15000)}

VETTED PUBLIC EMAIL CANDIDATES:
${vettedEmailCandidates}

EMAIL RULES:
- You may only return an email that appears exactly in the vetted public email candidates list above.
- If no candidate is clearly usable for outreach, return "".
- Prefer public owner, founder, director, or person-named inboxes over generic inboxes.
- Never invent, normalize, or guess an email.

Return a JSON object (no markdown, no code fences):
{
  "email": "Exact email from the vetted candidate list or empty string",
  "ownerName": "Owner/founder/director or empty string",
  "socialLink": "Best social media link (Facebook, Instagram, LinkedIn) or empty string",
  "websiteAssessment": null,
  "painSignals": [
    {"type": "NO_WEBSITE", "severity": 4, "evidence": "Specific evidence about their lack of web presence vs competitors", "source": "heuristic"},
    {"type": "CONVERSION", "severity": 3, "evidence": "How they are losing leads without a website", "source": "heuristic"}
  ],
  "hasContactForm": false,
  "hasSocialMessaging": true/false,
  "tacticalNote": "1 sentence about their strongest online platform or lack thereof"
}`;

                            const result = await model.generateContent(prompt);
                            const textResponse = sanitizeAiJsonResponse(result.response.text());
                            const aiData = JSON.parse(textResponse) as {
                                email?: string;
                                ownerName?: string;
                                socialLink?: string;
                                websiteAssessment?: {
                                    speedRisk?: number;
                                    conversionRisk?: number;
                                    trustRisk?: number;
                                    seoRisk?: number;
                                    overallGrade?: string;
                                    topFixes?: string[];
                                } | null;
                                painSignals?: Array<{ type?: string; severity?: number; evidence?: string; source?: string }>;
                                hasContactForm?: boolean;
                                hasSocialMessaging?: boolean;
                                tacticalNote?: string;
                            };

                            ownerName = aiData.ownerName || ownerName;
                            socialLink = aiData.socialLink || socialLink;
                            tacticalNote = aiData.tacticalNote || tacticalNote;
                            hasContactForm = aiData.hasContactForm === true;
                            hasSocialMessaging = aiData.hasSocialMessaging === true || hasSocialMessaging;

                            if (aiData.websiteAssessment) {
                                assessment = {
                                    speedRisk: Math.min(aiData.websiteAssessment.speedRisk || 0, 5),
                                    conversionRisk: Math.min(aiData.websiteAssessment.conversionRisk || 0, 5),
                                    trustRisk: Math.min(aiData.websiteAssessment.trustRisk || 0, 5),
                                    seoRisk: Math.min(aiData.websiteAssessment.seoRisk || 0, 5),
                                    overallGrade: aiData.websiteAssessment.overallGrade || "C",
                                    topFixes: (aiData.websiteAssessment.topFixes || []).slice(0, 3),
                                };
                            }

                            if (Array.isArray(aiData.painSignals)) {
                                painSignals = aiData.painSignals
                                    .filter((signal) => signal && signal.type && signal.evidence)
                                    .map((signal) => ({
                                        type: signal.type as PainSignal["type"],
                                        severity: Math.min(Math.max(signal.severity || 1, 1), 5),
                                        evidence: signal.evidence as string,
                                        source: (signal.source as PainSignal["source"]) || "ai_analysis",
                                    }));
                            }

                            emailResolution = resolvePublicBusinessEmail({
                                businessName: target.businessName,
                                businessWebsite: target.website,
                                ownerName,
                                aiPreferredEmail: aiData.email || "",
                                pages: discoveryPages,
                            });
                            email = emailResolution.email || email;
                        } catch (geminiError: unknown) {
                            const message = geminiError instanceof Error ? geminiError.message : "Unknown AI error";
                            tacticalNote = `AI Error: ${message}`;
                        }
                    }

                    if (websiteStatus === "MISSING" && !painSignals.some((signal) => signal.type === "NO_WEBSITE")) {
                        painSignals.unshift({
                            type: "NO_WEBSITE",
                            severity: 4,
                            evidence: `${target.businessName} has no website and is relying on directory or social presence only`,
                            source: "heuristic",
                        });
                    }

                    if (websiteStatus === "MISSING" && painSignals.length === 1 && target.reviewCount >= 5) {
                        painSignals.push({
                            type: "CONVERSION",
                            severity: 3,
                            evidence: `Active business with ${target.reviewCount} reviews but no web presence is likely losing leads to competitors`,
                            source: "heuristic",
                        });
                    }

                    const contactValidation = validateContact(email, target.phone, {
                        ownerName,
                        businessWebsite: target.website,
                    });
                    sendEvent({
                        message: `[EMAIL] Final ${email || "none"} | type=${contactValidation.emailType} | confidence=${contactValidation.emailConfidence.toFixed(2)}`,
                    });

                    const scoreResult = computeAxiomScore({
                        niche,
                        category: target.category,
                        city,
                        rating: target.rating,
                        reviewCount: target.reviewCount,
                        websiteStatus,
                        websiteContent: rawFootprint.substring(0, 5000),
                        assessment,
                        painSignals,
                        contact: contactValidation,
                        hasContactForm,
                        hasSocialMessaging,
                        reviewContent: rawFootprint.substring(0, 2000),
                    });

                    const disqualifyResult = checkDisqualifiers({
                        businessName: target.businessName,
                        niche,
                        category: target.category,
                        city,
                        rating: target.rating,
                        reviewCount: target.reviewCount,
                        websiteStatus,
                        websiteContent: rawFootprint.substring(0, 5000),
                        assessment,
                        painSignals,
                        axiomScore: scoreResult.axiomScore,
                        tier: scoreResult.tier,
                    });

                    const personalization = generatePersonalization({
                        businessName: target.businessName,
                        niche,
                        city,
                        websiteStatus,
                        painSignals,
                        assessment,
                        contactName: ownerName || null,
                    });

                    const isArchived = disqualifyResult.disqualified;
                    if (isArchived) disqualifiedCount++;

                    await prisma.lead.create({
                        data: {
                            businessName: target.businessName,
                            niche,
                            city,
                            phone: target.phone,
                            rating: target.rating,
                            reviewCount: target.reviewCount,
                            websiteStatus,
                            category: target.category,
                            address: target.address,
                            email,
                            socialLink,
                            contactName: ownerName || null,
                            tacticalNote,
                            leadScore: scoreResult.axiomScore,
                            websiteGrade: assessment?.overallGrade || null,
                            axiomScore: scoreResult.axiomScore,
                            axiomTier: scoreResult.tier,
                            scoreBreakdown: JSON.stringify(scoreResult.breakdown),
                            painSignals: JSON.stringify(painSignals),
                            callOpener: personalization.callOpener,
                            followUpQuestion: personalization.followUpQuestion,
                            axiomWebsiteAssessment: assessment ? JSON.stringify(assessment) : null,
                            dedupeKey: dedupe.key,
                            dedupeMatchedBy: dedupe.matchedBy,
                            emailType: contactValidation.emailType,
                            emailConfidence: contactValidation.emailConfidence,
                            phoneConfidence: contactValidation.phoneConfidence,
                            disqualifiers: disqualifyResult.reasons.length > 0 ? JSON.stringify(disqualifyResult.reasons) : null,
                            disqualifyReason: disqualifyResult.primaryReason,
                            source,
                            isArchived,
                            lastUpdated: new Date(),
                        },
                    });

                    if (!isArchived) {
                        const painSummary = painSignals.slice(0, 3).map((signal) => signal.evidence).join(" | ");
                        const breakdownStr = `BV:${scoreResult.breakdown.businessValue} P:${scoreResult.breakdown.painOpportunity} R:${scoreResult.breakdown.reachability} L:${scoreResult.breakdown.localFit}`;

                        await csvWriter.writeRecords([{
                            Business_Name: target.businessName,
                            City: city,
                            Niche: niche,
                            Phone: target.phone,
                            Best_Email: email,
                            Axiom_Score: scoreResult.axiomScore,
                            Tier: scoreResult.tier,
                            Call_Opener: personalization.callOpener,
                            Pain_Signals: painSummary,
                            Website: target.website || "NONE",
                            Website_Grade: assessment?.overallGrade || "N/A",
                            Score_Breakdown: breakdownStr,
                            Last_Updated: new Date().toISOString().split("T")[0],
                            Source: source,
                        }]);

                        const jsonlRecord = {
                            businessName: target.businessName,
                            city,
                            niche,
                            phone: target.phone,
                            bestEmail: email,
                            axiomScore: scoreResult.axiomScore,
                            tier: scoreResult.tier,
                            callOpener: personalization.callOpener,
                            followUpQuestion: personalization.followUpQuestion,
                            painSignals,
                            scoreBreakdown: scoreResult.breakdown,
                            website: target.website || null,
                            websiteGrade: assessment?.overallGrade || null,
                            assessment,
                            contactValidation,
                            emailResolution: {
                                email: emailResolution.email,
                                confidence: emailResolution.confidence,
                                reason: emailResolution.reason,
                                candidateCount: emailResolution.candidates.length,
                            },
                            lastUpdated: new Date().toISOString(),
                            source,
                        };
                        fs.appendFileSync(jsonlPath, JSON.stringify(jsonlRecord) + "\n");
                    }

                    savedCount++;
                    if (email) emailCount++;
                    tierCounts[scoreResult.tier] = (tierCounts[scoreResult.tier] || 0) + 1;

                    const grade = assessment ? ` | Grade: ${assessment.overallGrade}` : "";
                    const disqualifiedLabel = isArchived ? " | DISQUALIFIED" : "";
                    sendEvent({
                        message: `[SCORE] ${scoreResult.axiomScore}/100 [${scoreResult.tier}]${grade}${disqualifiedLabel} - ${target.businessName}`,
                        progress: idx + 1,
                        total: targets.length,
                        stats: { leadsFound: savedCount, withEmail: emailCount },
                    });
                }

                const qualified = savedCount - disqualifiedCount;
                sendEvent({ message: "[DONE] AXIOM extraction complete" });
                sendEvent({ message: `[DONE] ${savedCount} processed | ${dupCount} deduped | ${disqualifiedCount} disqualified | ${qualified} qualified` });
                sendEvent({ message: `[DONE] Tiers S:${tierCounts.S || 0} A:${tierCounts.A || 0} B:${tierCounts.B || 0} C:${tierCounts.C || 0} D:${tierCounts.D || 0}` });
                sendEvent({ message: `[DONE] Call sheet written to ${csvPath}` });
                sendEvent({ _done: true, stats: { leadsFound: savedCount, withEmail: emailCount, avgScore: 0 } });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unknown scrape error";
                console.error("[SCRAPE_ERROR]", error);
                sendEvent({ error: message });
            } finally {
                if (browser) await browser.close();
                if (!streamClosed) {
                    controller.close();
                }
            }
        },
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}

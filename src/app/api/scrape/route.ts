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

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const niche = searchParams.get("niche");
    const city = searchParams.get("city");
    const radius = searchParams.get("radius") || "10";
    const maxDepth = parseInt(searchParams.get("maxDepth") || "5", 10);

    let browser: import("playwright").Browser | null = null;

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
            };

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

                // Also write JSONL
                const jsonlPath = `C:\\Users\\riley\\.gemini\\antigravity\\scratch\\axiom_call_sheet.jsonl`;

                browser = await chromium.launch({ headless: true });
                const context = await browser.newContext({ locale: "en-CA" });
                const page = await context.newPage();

                sendEvent({ message: `[🚀] AXIOM ENGINE V4 Initialized: ${niche} in ${city} (R:${radius}km, D:${maxDepth})` });
                sendEvent({ message: `[⚡] Intelligence: Sales-Probability Scoring + Multi-Signal Dedup + Pain Detection + Contact Validation + Auto-Disqualify` });

                // ═══ PHASE 1: GOOGLE MAPS EXTRACTION ═══
                const query = `${niche} in ${city}, Ontario`;
                await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`);

                try {
                    await page.waitForSelector("div[role='feed']", { timeout: 15000 });
                } catch (e) {
                    throw new Error("Maps results timed out. No targets found.");
                }

                sendEvent({ message: `[🌐] Infinite scroll bypass injected...` });

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
                    sendEvent({ message: `[⬇️] Depth ${scrollAttempts}/${maxDepth}...` });
                }

                const placeLinks = await page.locator("a.hfpxzc").evaluateAll(anchors =>
                    anchors.map(a => ({
                        name: a.getAttribute("aria-label") || "",
                        url: a.getAttribute("href") || ""
                    })).filter(p => p.name && p.url && !p.url.includes("/search/"))
                );

                sendEvent({ message: `[🔍] Found ${placeLinks.length} listings. Extracting details...` });

                // ═══ PHASE 2: EXTRACT DETAILS FROM PLACE URLs ═══
                const targets: any[] = [];
                const CHUNK_SIZE = 5;

                for (let i = 0; i < placeLinks.length; i += CHUNK_SIZE) {
                    const chunk = placeLinks.slice(i, i + CHUNK_SIZE);
                    sendEvent({ message: `[⬇️] Extracting details for batch ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(placeLinks.length / CHUNK_SIZE)}...` });

                    const chunkResults = await Promise.all(chunk.map(async (place) => {
                        const p = await context.newPage();
                        try {
                            await p.goto(place.url, { waitUntil: "domcontentloaded", timeout: 15000 });
                            await p.waitForSelector('h1', { timeout: 10000 });

                            const data = await p.evaluate(() => {
                                const title = document.querySelector("h1")?.innerText || "";

                                const webBtn = document.querySelector('a[data-item-id="authority"]');
                                const website = webBtn ? webBtn.getAttribute("href") : "";

                                const phoneBtn = document.querySelector('button[data-item-id*="phone:tel:"]');
                                let phone = "";
                                if (phoneBtn) {
                                    phone = phoneBtn.getAttribute("data-item-id")?.replace("phone:tel:", "") || "";
                                } else {
                                    const allBtns = Array.from(document.querySelectorAll('button[data-tooltip="Copy phone number"]'));
                                    if (allBtns.length > 0) phone = (allBtns[0] as HTMLElement).innerText;
                                }

                                const addBtn = document.querySelector('button[data-item-id="address"]');
                                const address = addBtn ? addBtn.getAttribute("aria-label")?.replace("Address: ", "") || "" : "";

                                const catBtn = document.querySelector('button[jsaction="pane.rating.category"]');
                                const category = catBtn ? (catBtn as HTMLElement).innerText : "";

                                const ratingDiv = document.querySelector('div[jsaction="pane.rating.moreReviews"]');
                                const ratingText = ratingDiv ? ratingDiv.getAttribute("aria-label") || "" : ""; // e.g. "4.9 stars 45 Reviews"

                                return { title, website, phone, address, category, ratingText };
                            });

                            await p.close();
                            return data;
                        } catch (e) {
                            await p.close();
                            return null;
                        }
                    }));

                    for (const res of chunkResults) {
                        if (res && res.title) {
                            let rating = 0;
                            let reviewCount = 0;
                            if (res.ratingText) {
                                const rMatch = res.ratingText.match(/([\d.]+)\s*stars?\s*([\d,]+)/i);
                                if (rMatch) {
                                    rating = parseFloat(rMatch[1]);
                                    reviewCount = parseInt(rMatch[2].replace(/,/g, ""), 10);
                                }
                            }
                            targets.push({
                                businessName: res.title,
                                website: res.website,
                                rating,
                                reviewCount,
                                phone: res.phone,
                                category: res.category,
                                address: res.address
                            });
                        }
                    }
                }

                sendEvent({ message: `[🎯] ${targets.length} targets parsed. Starting Axiom intelligence pipeline...`, progress: 0, total: targets.length });

                // ═══ PHASE 3: LOAD EXISTING DEDUPE KEYS ═══
                const existingLeads = await prisma.lead.findMany({
                    select: { dedupeKey: true, businessName: true, city: true, phone: true },
                });
                const existingDedupeKeys = new Set<string>();
                for (const el of existingLeads) {
                    if (el.dedupeKey) {
                        existingDedupeKeys.add(el.dedupeKey);
                    } else {
                        // Fallback for leads without dedupeKey (pre-v4)
                        const fallback = generateDedupeKey(el.businessName, el.city || "", el.phone);
                        existingDedupeKeys.add(fallback.key);
                    }
                }

                sendEvent({ message: `[🔑] Loaded ${existingDedupeKeys.size} existing dedupe keys` });

                // ═══ PHASE 4: AI + ENRICHMENT ═══
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

                    // ═══ MULTI-SIGNAL DEDUP ═══
                    const dedupe = generateDedupeKey(
                        target.businessName, city!, target.phone, target.website, target.address
                    );

                    if (existingDedupeKeys.has(dedupe.key)) {
                        dupCount++;
                        sendEvent({
                            message: `[♻️] DEDUP (${dedupe.matchedBy}): ${target.businessName} — key:${dedupe.key.substring(0, 30)}...`,
                            progress: idx + 1,
                            total: targets.length,
                            stats: { leadsFound: savedCount, withEmail: emailCount },
                        });
                        continue;
                    }
                    existingDedupeKeys.add(dedupe.key);

                    sendEvent({ message: `[⚙️] Enriching [${idx + 1}/${targets.length}]: ${target.businessName}...`, progress: idx, total: targets.length, stats: { leadsFound: savedCount, withEmail: emailCount } });

                    const searchPage = await context.newPage();
                    let rawFootprint = "";
                    let email = "";
                    let ownerName = "";
                    let socialLink = "";
                    let websiteStatus = "MISSING";

                    try {
                        if (target.website) {
                            websiteStatus = "ACTIVE";
                            sendEvent({ message: `[🌐] Deep scan: ${target.website.substring(0, 50)}...` });
                            await searchPage.goto(target.website, { waitUntil: "domcontentloaded", timeout: 15000 });
                            rawFootprint = await searchPage.locator("body").innerText();
                            const allLinks = await searchPage.locator("a").evaluateAll(a => a.map(n => n.getAttribute("href")).filter(h => h && h.startsWith("http")));
                            rawFootprint += "\n\nDISCOVERED LINKS:\n" + allLinks.join("\n");
                        } else {
                            sendEvent({ message: `[🔍] No website. Searching digital footprint...` });
                            const sQuery = `"${target.businessName}" ${city} email OR owner OR facebook OR linkedin`;
                            await searchPage.goto(`https://www.google.com/search?q=${encodeURIComponent(sQuery)}`, { waitUntil: "domcontentloaded" });
                            await searchPage.waitForSelector("#search", { timeout: 10000 });
                            rawFootprint = await searchPage.locator("#search").innerText();
                            const allLinks = await searchPage.locator("#search a").evaluateAll(a => a.map(n => n.getAttribute("href")).filter(h => h && h.startsWith("http")));
                            rawFootprint += "\n\nDISCOVERED LINKS:\n" + allLinks.join("\n");
                        }
                    } catch (err) {
                        // Ignore timeout
                    } finally {
                        await searchPage.close();
                    }

                    // ═══ AI ANALYSIS — AXIOM READINESS ═══
                    let assessment: WebsiteAssessment | null = null;
                    let painSignals: PainSignal[] = [];
                    let tacticalNote = "No intelligence generated.";

                    if (process.env.GEMINI_API_KEY) {
                        try {
                            const prompt = websiteStatus === "ACTIVE"
                                ? `You are an elite B2B web analyst evaluating a local business website for a web design agency.
Business: ${target.businessName} | Location: ${city} | Niche: ${niche} | Category: ${target.category}
Website: ${target.website}
Rating: ${target.rating}/5 (${target.reviewCount} reviews)

WEBSITE CONTENT & LINKS:
${rawFootprint.substring(0, 15000)}

Evaluate this website and return a JSON object (no markdown, no \`\`\`json wrappers):
{
  "email": "Valid contact email or empty string",
  "ownerName": "Owner/founder/contact person or empty string",
  "socialLink": "Best social media link (FB, IG, LinkedIn) or empty string",
  "websiteAssessment": {
    "speedRisk": 0-5 (0=fast, 5=very slow. Check for heavy images, no lazy loading, large unoptimized assets, slow server response indicators),
    "conversionRisk": 0-5 (0=strong funnel, 5=no conversion path. Check for: CTA buttons, booking/quote forms, click-to-call, lead capture, appointment scheduling),
    "trustRisk": 0-5 (0=trustworthy, 5=major issues. Check for: SSL, outdated copyright year, broken links, missing analytics, malware/spam signals, mixed content),
    "seoRisk": 0-5 (0=well optimized, 5=poor. Check for: missing schema, no meta descriptions, thin content, no local business markup, poor mobile responsiveness),
    "overallGrade": "A through F based on total risk score",
    "topFixes": ["Fix 1", "Fix 2", "Fix 3"] (3 specific actionable fixes Axiom could sell)
  },
  "painSignals": [
    {"type": "CONVERSION|SPEED|TRUST|SEO|DESIGN|FUNCTIONALITY", "severity": 1-5, "evidence": "Specific evidence from the site", "source": "site_scan"}
  ] (2-6 pain signals, each with concrete evidence from the actual site content),
  "hasContactForm": true/false,
  "hasSocialMessaging": true/false,
  "tacticalNote": "1-2 sentence critical evaluation"
}`
                                : `You are an elite B2B web analyst evaluating a local business with NO website.
Business: ${target.businessName} | Location: ${city} | Niche: ${niche} | Category: ${target.category}
Rating: ${target.rating}/5 (${target.reviewCount} reviews)

RAW SEARCH FOOTPRINT:
${rawFootprint.substring(0, 15000)}

Return a JSON object (no markdown, no \`\`\`json wrappers):
{
  "email": "Valid contact email or empty string. Ignore sentry.io or google links.",
  "ownerName": "Owner/founder/director or empty string",
  "socialLink": "Best social media link (Facebook, Instagram, LinkedIn) or empty string",
  "websiteAssessment": null,
  "painSignals": [
    {"type": "NO_WEBSITE", "severity": 4, "evidence": "Specific evidence about their lack of web presence vs competitors", "source": "heuristic"},
    {"type": "CONVERSION", "severity": 3, "evidence": "How they are losing leads without a website", "source": "heuristic"}
  ] (2-4 pain signals based on available data),
  "hasContactForm": false,
  "hasSocialMessaging": true/false (based on Facebook/messenger presence),
  "tacticalNote": "1-sentence note about their strongest online platform or lack thereof"
}`;

                            const result = await model.generateContent(prompt);
                            const textResp = result.response.text().trim().replace(/```json/g, "").replace(/```/g, "").trim();

                            try {
                                const aiData = JSON.parse(textResp);
                                email = aiData.email || email;
                                ownerName = aiData.ownerName || ownerName;
                                socialLink = aiData.socialLink || socialLink;
                                tacticalNote = aiData.tacticalNote || "Intelligence parsed but analysis empty.";

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
                                        .filter((s: any) => s && s.type && s.evidence)
                                        .map((s: any) => ({
                                            type: s.type,
                                            severity: Math.min(Math.max(s.severity || 1, 1), 5),
                                            evidence: s.evidence,
                                            source: s.source || "ai_analysis",
                                        }));
                                }

                                // Add no-website pain if missing
                                if (websiteStatus === "MISSING" && !painSignals.some(p => p.type === "NO_WEBSITE")) {
                                    painSignals.unshift({
                                        type: "NO_WEBSITE",
                                        severity: 4,
                                        evidence: `${target.businessName} has no website — relying solely on Google listing and word-of-mouth`,
                                        source: "heuristic",
                                    });
                                }

                                var hasContactForm = aiData.hasContactForm === true;
                                var hasSocialMessaging = aiData.hasSocialMessaging === true;
                            } catch (parseErr) {
                                console.error("JSON parse failed:", textResp);
                                tacticalNote = `AI parsing error: ${textResp.substring(0, 50)}`;
                                var hasContactForm = false;
                                var hasSocialMessaging = false;
                            }
                        } catch (geminiErr: any) {
                            tacticalNote = `AI Error: ${geminiErr.message}`;
                            var hasContactForm = false;
                            var hasSocialMessaging = false;
                        }
                    } else {
                        var hasContactForm = false;
                        var hasSocialMessaging = false;
                    }

                    // Add base pain signal for no-website if none generated
                    if (websiteStatus === "MISSING" && painSignals.length === 0) {
                        painSignals.push({
                            type: "NO_WEBSITE",
                            severity: 4,
                            evidence: `${target.businessName} has no website but is listed on Google Maps with ${target.reviewCount} reviews`,
                            source: "maps_data",
                        });
                        if (target.reviewCount >= 5) {
                            painSignals.push({
                                type: "CONVERSION",
                                severity: 3,
                                evidence: `Active business with reviews but no web presence — losing leads to competitors`,
                                source: "heuristic",
                            });
                        }
                    }

                    // ═══ CONTACT VALIDATION ═══
                    const contactValidation = validateContact(email, target.phone);
                    sendEvent({ message: `[📧] Contact: email=${contactValidation.emailType}(${contactValidation.emailConfidence.toFixed(2)}) phone=${contactValidation.phoneConfidence.toFixed(2)}` });

                    // ═══ AXIOM SCORING ═══
                    const scoreResult = computeAxiomScore({
                        niche: niche!,
                        category: target.category,
                        city: city!,
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

                    // ═══ DISQUALIFIER CHECK ═══
                    const disqualifyResult = checkDisqualifiers({
                        businessName: target.businessName,
                        niche: niche!,
                        category: target.category,
                        city: city!,
                        rating: target.rating,
                        reviewCount: target.reviewCount,
                        websiteStatus,
                        websiteContent: rawFootprint.substring(0, 5000),
                        assessment,
                        painSignals,
                        axiomScore: scoreResult.axiomScore,
                        tier: scoreResult.tier,
                    });

                    // ═══ PERSONALIZATION ═══
                    const personalization = generatePersonalization({
                        businessName: target.businessName,
                        niche: niche!,
                        city: city!,
                        websiteStatus,
                        painSignals,
                        assessment,
                        contactName: ownerName || null,
                    });

                    // ═══ LEGACY SCORE (backwards compat) ═══
                    const legacyScore = scoreResult.axiomScore; // Map axiomScore to leadScore

                    // ═══ PERSIST ═══
                    const isArchived = disqualifyResult.disqualified;
                    if (isArchived) disqualifiedCount++;

                    const savedLead = await prisma.lead.create({
                        data: {
                            businessName: target.businessName,
                            niche: niche!,
                            city: city!,
                            phone: target.phone,
                            rating: target.rating,
                            reviewCount: target.reviewCount,
                            websiteStatus,
                            category: target.category,
                            address: target.address,
                            email,
                            socialLink,
                            contactName: ownerName,
                            tacticalNote,

                            // Legacy
                            leadScore: legacyScore,
                            websiteGrade: assessment?.overallGrade || null,

                            // Axiom v4
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

                    // Write CSV (call sheet format)
                    if (!isArchived) {
                        const painSummary = painSignals.slice(0, 3).map(p => p.evidence).join(" | ");
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

                        // JSONL
                        const jsonlRecord = {
                            businessName: target.businessName, city: city, niche: niche,
                            phone: target.phone, bestEmail: email,
                            axiomScore: scoreResult.axiomScore, tier: scoreResult.tier,
                            callOpener: personalization.callOpener,
                            followUpQuestion: personalization.followUpQuestion,
                            painSignals, scoreBreakdown: scoreResult.breakdown,
                            website: target.website || null,
                            websiteGrade: assessment?.overallGrade || null,
                            assessment, contactValidation,
                            lastUpdated: new Date().toISOString(), source,
                        };
                        fs.appendFileSync(jsonlPath, JSON.stringify(jsonlRecord) + "\n");
                    }

                    savedCount++;
                    if (email) emailCount++;
                    tierCounts[scoreResult.tier] = (tierCounts[scoreResult.tier] || 0) + 1;

                    const gradeStr = assessment ? ` | Grade: ${assessment.overallGrade}` : "";
                    const dqStr = isArchived ? " | ❌ DISQUALIFIED" : "";
                    const painCount = painSignals.length;
                    sendEvent({
                        message: `[🛡️] Axiom: ${scoreResult.axiomScore}/100 [${scoreResult.tier}] (BV:${scoreResult.breakdown.businessValue} P:${scoreResult.breakdown.painOpportunity} R:${scoreResult.breakdown.reachability} L:${scoreResult.breakdown.localFit})${gradeStr} | ${painCount} pains${dqStr} — ${target.businessName}`,
                        progress: idx + 1,
                        total: targets.length,
                        stats: { leadsFound: savedCount, withEmail: emailCount },
                    });
                }

                // ═══ SUMMARY ═══
                const qualified = savedCount - disqualifiedCount;
                sendEvent({ message: `\n[✅] ═══ AXIOM EXTRACTION COMPLETE ═══` });
                sendEvent({ message: `[✅] ${savedCount} processed | ${dupCount} deduped | ${disqualifiedCount} disqualified | ${qualified} qualified` });
                sendEvent({ message: `[📊] Tiers: S:${tierCounts.S || 0} A:${tierCounts.A || 0} B:${tierCounts.B || 0} C:${tierCounts.C || 0} D:${tierCounts.D || 0}` });
                sendEvent({ message: `[💾] Call Sheet: ${csvPath}` });
                sendEvent({ _done: true, stats: { leadsFound: savedCount, withEmail: emailCount, avgScore: 0 } });

            } catch (error: any) {
                console.error("[!] Axiom Engine Error:", error);
                sendEvent({ error: error.message });
            } finally {
                if (browser) await browser.close();
                controller.close();
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

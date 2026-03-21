import { NextResponse } from "next/server";

import { isValidJobId, normalizeAgentName, validateAgentLeadPayload } from "@/lib/agent-protocol";
import { appendScrapeJobEvent } from "@/lib/scrape-jobs";
import { requireAgentAuth } from "@/lib/agent-auth";
import { extractDomain } from "@/lib/dedupe";
import { getPrisma } from "@/lib/prisma";
import { getScrapeJob } from "@/lib/scrape-jobs";

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") {
    return value === null || value === undefined ? null : String(value).trim() || null;
  }

  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

function cleanJsonText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return cleanText(value);
  }

  if (Array.isArray(value) || typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  return cleanText(String(value));
}

function normalizeLeadPayload(lead: Record<string, unknown>) {
  const category = cleanText(lead.category) ?? cleanText(lead.niche) ?? null;
  const rawWebsiteUrl = cleanText(lead.websiteUrl);
  const websiteUrl =
    rawWebsiteUrl &&
    rawWebsiteUrl.length <= 2048 &&
    !/google\.[^/]*\/maps|maps\.google\./i.test(rawWebsiteUrl)
      ? rawWebsiteUrl
      : null;
  const websiteDomain =
    cleanText(lead.websiteDomain) ||
    (websiteUrl ? extractDomain(websiteUrl) : null);

  return {
    ...lead,
    address: cleanText(lead.address),
    category,
    contactName: cleanText(lead.contactName),
    callOpener: cleanText(lead.callOpener),
    disqualifiers: cleanText(lead.disqualifiers),
    disqualifyReason: cleanText(lead.disqualifyReason),
    email: cleanText(lead.email) || "",
    emailFlags: cleanJsonText(lead.emailFlags),
    followUpQuestion: cleanText(lead.followUpQuestion),
    painSignals: cleanJsonText(lead.painSignals) || "[]",
    phone: cleanText(lead.phone) || "",
    phoneFlags: cleanJsonText(lead.phoneFlags),
    scoreBreakdown: cleanJsonText(lead.scoreBreakdown) || "{}",
    socialLink: cleanText(lead.socialLink),
    source: cleanText(lead.source),
    tacticalNote: cleanText(lead.tacticalNote) || "",
    websiteDomain: websiteDomain && websiteDomain.length <= 255 ? websiteDomain : null,
    websiteUrl,
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authResult = await requireAgentAuth(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const { id: jobId } = await context.params;
  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const currentJob = await getScrapeJob(jobId);
  if (!currentJob) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (currentJob.claimedBy !== authResult.agentName) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (currentJob.status === "completed" || currentJob.status === "failed" || currentJob.status === "canceled") {
    return NextResponse.json({ error: "Job already finished" }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const bodyAgentName = body.agentName ? normalizeAgentName(body.agentName) : null;
  if (body.agentName && !bodyAgentName) {
    return NextResponse.json({ error: "Invalid agent name" }, { status: 400 });
  }

  if (bodyAgentName && bodyAgentName !== authResult.agentName) {
    return NextResponse.json({ error: "Agent identity mismatch" }, { status: 400 });
  }

  const lead = body.lead;
  if (!lead || typeof lead !== "object" || Array.isArray(lead)) {
    return NextResponse.json({ error: "Invalid lead payload" }, { status: 400 });
  }

  const normalizedLead = normalizeLeadPayload(lead as Record<string, unknown>);

  const validation = validateAgentLeadPayload(normalizedLead);

  if (!validation.success) {
    console.warn(`[agent.results] Lead validation failed for job ${jobId}: ${validation.error}`);
    await appendScrapeJobEvent(jobId, "error", {
      jobId,
      jobStatus: currentJob.status,
      message: `[LEAD] Validation failed: ${validation.error}`,
    });
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const prisma = getPrisma();
  const createdLead = await prisma.lead.create({
    data: {
      ...validation.lead,
      isArchived: validation.lead.isArchived ? true : false,
    },
  });

  await appendScrapeJobEvent(jobId, "result", {
    jobId,
    jobStatus: "running",
    leadId: createdLead.id,
    businessName: createdLead.businessName,
    city: createdLead.city,
    message: `[LEAD] Saved ${createdLead.businessName} — ${createdLead.city}`,
  });

  return NextResponse.json({ ok: true, leadId: createdLead.id });
}

import { NextResponse } from "next/server";

import {
  isValidAgentEventType,
  isValidJobId,
  normalizeAgentName,
  validateAgentProgressPayload,
  validateAgentStatusPayload,
} from "@/lib/agent-protocol";
import { appendScrapeJobEvent, getScrapeJob } from "@/lib/scrape-jobs";
import { requireAgentAuth } from "@/lib/agent-auth";

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
  const eventType = String(body.eventType || "log");
  if (!isValidAgentEventType(eventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const bodyAgentName = body.agentName ? normalizeAgentName(body.agentName) : null;
  if (body.agentName && !bodyAgentName) {
    return NextResponse.json({ error: "Invalid agent name" }, { status: 400 });
  }

  if (bodyAgentName && bodyAgentName !== authResult.agentName) {
    return NextResponse.json({ error: "Agent identity mismatch" }, { status: 400 });
  }

  const payload = (body.payload && typeof body.payload === "object" ? body.payload : body) as Record<string, unknown>;
  const eventPayload = {
    ...payload,
    jobId,
  };

  if (eventType === "status") {
    const validation = validateAgentStatusPayload(eventPayload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  if (eventType === "progress") {
    const validation = validateAgentProgressPayload(eventPayload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  await appendScrapeJobEvent(jobId, eventType, eventPayload);
  return NextResponse.json({ ok: true });
}

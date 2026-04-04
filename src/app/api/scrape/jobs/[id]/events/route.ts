import { NextResponse } from "next/server";

import { getScrapeJob, getScrapeJobEventsAfter } from "@/lib/scrape-jobs";
import { requireAdminApiSession } from "@/lib/session";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdminApiSession(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const { id: jobId } = await context.params;
  const job = await getScrapeJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const afterParam = Number.parseInt(url.searchParams.get("after") || "0", 10);
  const after = Number.isFinite(afterParam) && afterParam > 0 ? afterParam : 0;

  const events = await getScrapeJobEventsAfter(jobId, after);

  return NextResponse.json(
    {
      events: events.map((event) => ({
        createdAt: event.createdAt.toISOString(),
        eventId: event.id,
        eventType: event.eventType,
        payload: {
          ...event.payload,
          eventId: event.id,
          jobId,
        },
      })),
      job: {
        city: job.city,
        errorMessage: job.errorMessage,
        finishedAt: job.finishedAt?.toISOString() ?? null,
        heartbeatAt: job.heartbeatAt?.toISOString() ?? null,
        id: job.id,
        maxDepth: job.maxDepth,
        niche: job.niche,
        radius: job.radius,
        stats: job.stats,
        status: job.status,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

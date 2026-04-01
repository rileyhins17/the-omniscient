import { NextResponse } from "next/server";

import { queueLeadsForAutomation } from "@/lib/outreach-automation";
import { requireAdminApiSession } from "@/lib/session";

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const body = (await request.json()) as { leadIds?: number[] };
    if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
      return NextResponse.json({ error: "leadIds array is required" }, { status: 400 });
    }

    const result = await queueLeadsForAutomation({
      leadIds: body.leadIds,
      queuedByUserId: authResult.session.user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Automation queue error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to queue leads for automation" },
      { status: 500 },
    );
  }
}

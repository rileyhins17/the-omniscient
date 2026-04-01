import { NextResponse } from "next/server";

import { listAutomationOverview } from "@/lib/outreach-automation";
import { requireAdminApiSession } from "@/lib/session";

export async function GET(request: Request) {
  const authResult = await requireAdminApiSession(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const overview = await listAutomationOverview();
    return NextResponse.json(overview);
  } catch (error: any) {
    console.error("Automation overview error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch automation overview" },
      { status: 500 },
    );
  }
}

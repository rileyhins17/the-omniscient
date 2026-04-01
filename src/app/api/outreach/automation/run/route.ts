import { NextResponse } from "next/server";

import { runAutomationScheduler } from "@/lib/outreach-automation";
import { requireAdminApiSession } from "@/lib/session";

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const result = await runAutomationScheduler();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Automation run error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run automation scheduler" },
      { status: 500 },
    );
  }
}

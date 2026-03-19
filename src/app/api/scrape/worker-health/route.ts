import { NextResponse } from "next/server";

import { getWorkerHealth } from "@/lib/scrape-jobs";
import { requireAdminApiSession } from "@/lib/session";

export async function GET(request: Request) {
  const authResult = await requireAdminApiSession(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const health = await getWorkerHealth();

  return NextResponse.json(
    {
      health,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

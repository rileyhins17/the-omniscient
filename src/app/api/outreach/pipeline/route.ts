import { NextResponse } from "next/server";

import { getActiveAutomationLeadIds } from "@/lib/outreach-automation";
import { getPrisma } from "@/lib/prisma";
import { getOutreachPipelineLeadWhere } from "@/lib/outreach";
import { requireApiSession } from "@/lib/session";

export async function GET(request: Request) {
  const authResult = await requireApiSession(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const prisma = getPrisma();
    const automationLeadIds = new Set(await getActiveAutomationLeadIds());
    const leads = await prisma.lead.findMany({
      where: getOutreachPipelineLeadWhere(),
      orderBy: {
        axiomScore: "desc",
      },
      select: {
        id: true,
        businessName: true,
        city: true,
        niche: true,
        contactName: true,
        phone: true,
        email: true,
        axiomScore: true,
        axiomTier: true,
        outreachStatus: true,
        outreachChannel: true,
        firstContactedAt: true,
        lastContactedAt: true,
        nextFollowUpDue: true,
        outreachNotes: true,
      },
    });

    return NextResponse.json({
      leads: leads.filter((lead) => !automationLeadIds.has(lead.id)),
    });
  } catch (error: any) {
    console.error("Pipeline leads fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch pipeline leads" },
      { status: 500 },
    );
  }
}

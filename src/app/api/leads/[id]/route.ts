import { NextRequest, NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireApiSession(request);
    if ("response" in authResult) {
      return authResult.response;
    }

    const { id } = await params;
    const leadId = parseInt(id, 10);

    if (Number.isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const prisma = getPrisma();
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Failed to fetch lead:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireApiSession(request);
    if ("response" in authResult) {
      return authResult.response;
    }

    const { id } = await params;
    const leadId = parseInt(id, 10);

    if (Number.isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const body = (await request.json()) as {
      isArchived?: boolean;
    };

    if (typeof body.isArchived !== "boolean") {
      return NextResponse.json({ error: "isArchived boolean is required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        isArchived: body.isArchived,
        lastUpdated: new Date(),
      },
    });

    return NextResponse.json(updatedLead);
  } catch (error) {
    console.error("Failed to update lead:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

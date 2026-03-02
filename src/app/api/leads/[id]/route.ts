import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/leads/[id] — Fetch a single lead by ID for the dossier page.
 * Read-only, no engine logic touched.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const leadId = parseInt(id, 10);

        if (isNaN(leadId)) {
            return NextResponse.json(
                { error: "Invalid lead ID" },
                { status: 400 }
            );
        }

        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
        });

        if (!lead) {
            return NextResponse.json(
                { error: "Lead not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(lead);
    } catch (error) {
        console.error("Failed to fetch lead:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

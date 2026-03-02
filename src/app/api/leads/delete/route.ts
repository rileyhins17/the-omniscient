import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();

        if (!id || typeof id !== "number") {
            return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
        }

        await prisma.lead.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
    }
}

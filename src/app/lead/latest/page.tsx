import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/**
 * /lead/latest — Redirects to the most recently created lead's dossier.
 */
export default async function LatestLeadPage() {
    const lead = await prisma.lead.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true },
    });

    if (lead) {
        redirect(`/lead/${lead.id}`);
    }

    redirect("/vault");
}

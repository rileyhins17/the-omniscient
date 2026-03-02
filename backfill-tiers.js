const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function computeTier(axiomScore, painSignals) {
    const highSeverityPains = painSignals.filter(s => s.severity >= 2).length;

    // Must have at least one pain signal to be S-tier
    if (axiomScore >= 80 && highSeverityPains >= 1) return "S";
    if (axiomScore >= 80) return "A"; // Demoted for lack of pain

    if (axiomScore >= 60) return "A";
    if (axiomScore >= 40) return "B";
    if (axiomScore >= 20) return "C";
    return "D";
}

async function main() {
    const leads = await p.lead.findMany({
        where: { axiomScore: { not: null } },
        select: { id: true, axiomScore: true, painSignals: true }
    });

    console.log(`Rescoring ${leads.length} leads...`);

    let updated = 0;
    for (const lead of leads) {
        if (!lead.axiomScore) continue;

        let pains = [];
        if (lead.painSignals) {
            try {
                pains = JSON.parse(lead.painSignals);
            } catch { }
        }

        const exactTier = computeTier(lead.axiomScore, pains);

        await p.lead.update({
            where: { id: lead.id },
            data: { axiomTier: exactTier }
        });
        updated++;
    }

    console.log(`Updated ${updated} leads to new accurate tiers.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await p.$disconnect());

// ts-node script
import { PrismaClient } from '@prisma/client';
import { computeTier, PainSignal } from './src/lib/axiom-scoring';

const p = new PrismaClient();

async function main() {
    const leads = await p.lead.findMany({
        where: { axiomScore: { not: null } },
        select: { id: true, axiomScore: true, painSignals: true }
    });

    console.log(`Rescoring ${leads.length} leads...`);

    let updated = 0;
    for (const lead of leads) {
        if (!lead.axiomScore) continue;

        let pains: PainSignal[] = [];
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

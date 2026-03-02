const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    const total = await p.lead.count();
    const withAxiomTier = await p.lead.count({ where: { axiomTier: { not: null } } });
    const withAxiomScore = await p.lead.count({ where: { axiomScore: { not: null } } });
    const withLeadScore = await p.lead.count({ where: { leadScore: { not: null } } });

    const tiers = await p.lead.groupBy({ by: ['axiomTier'], _count: true });

    const scoreSample = await p.lead.findMany({
        take: 10,
        select: { id: true, axiomScore: true, axiomTier: true, leadScore: true },
        orderBy: { axiomScore: 'desc' },
        where: { axiomScore: { not: null } },
    });

    const leadScoreSample = await p.lead.findMany({
        take: 10,
        select: { id: true, axiomScore: true, axiomTier: true, leadScore: true },
        orderBy: { leadScore: 'desc' },
        where: { leadScore: { not: null } },
    });

    console.log(JSON.stringify({
        total, withAxiomTier, withAxiomScore, withLeadScore,
        tiers,
        scoreSample,
        leadScoreSample,
    }, null, 2));

    await p.$disconnect();
})();

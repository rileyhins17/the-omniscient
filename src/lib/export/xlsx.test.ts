import { test } from 'node:test';
import assert from 'node:assert';
import { generateXlsx } from './xlsx';
import { Lead } from '@prisma/client';

test("XLSX Exporter Tests", async (t) => {
    const fixtureLeads = [
        {
            id: 1,
            businessName: "Test Co",
            phone: "519-555-1234",
            email: "test@example.com",
            socialLink: "example.com",
            createdAt: new Date(),
            lastUpdated: new Date()
        } as Lead
    ];

    await t.test("generates valid xlsx buffer with basic requirements", async () => {
        const buffer = await generateXlsx(fixtureLeads, "call_sheet", { tier: ["S", "A"] });
        assert.ok(buffer);
        assert.ok(buffer.length > 100);

        // Check magic bytes for zip (xlsx is a zip) - PK\x03\x04
        assert.equal(buffer[0], 0x50);
        assert.equal(buffer[1], 0x4B);
        assert.equal(buffer[2], 0x03);
        assert.equal(buffer[3], 0x04);
    });
});

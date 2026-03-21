import { strict as assert } from "node:assert";
import test from "node:test";

import { checkDisqualifiers } from "./disqualifiers";

test("checkDisqualifiers keeps strong local service leads qualified", () => {
  const result = checkDisqualifiers({
    businessName: "Breathe Medical Spa",
    niche: "Med-Spas",
    category: "Medical spa",
    city: "Guelph",
    rating: 4.7,
    reviewCount: 152,
    websiteStatus: "ACTIVE",
    websiteContent: "Locally owned and independently operated medical spa serving Guelph.",
    assessment: {
      speedRisk: 2,
      conversionRisk: 2,
      trustRisk: 1,
      seoRisk: 1,
      overallGrade: "C",
      topFixes: [],
    },
    painSignals: [],
    axiomScore: 73,
    tier: "A",
  });

  assert.equal(result.disqualified, false);
  assert.equal(result.reasons.length, 0);
  assert.equal(result.primaryReason, null);
});

test("checkDisqualifiers still blocks low ROI businesses", () => {
  const result = checkDisqualifiers({
    businessName: "Summer Lemonade Stand",
    niche: "Lemonade",
    category: "Food stand",
    city: "Guelph",
    rating: 4.9,
    reviewCount: 20,
    websiteStatus: "MISSING",
    websiteContent: "",
    assessment: null,
    painSignals: [],
    axiomScore: 12,
    tier: "D",
  });

  assert.equal(result.disqualified, true);
  assert.ok(result.reasons.some((reason) => reason.includes("Industry low ROI")));
  assert.ok(result.primaryReason);
});


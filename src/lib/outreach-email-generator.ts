/**
 * Outreach Email Generator
 *
 * Uses DeepSeek to generate personalized outreach email copy based on
 * enrichment data. Cold emails are validated against tone/style rules
 * before HTML is rendered for delivery.
 */

import type { PainSignal, WebsiteAssessment } from "@/lib/axiom-scoring";
import { chatCompletionJson } from "@/lib/deepseek";
import {
  buildHtmlEmail,
  buildPlainTextEmail,
  buildRetryInstructions,
  chooseColdEmailPlan,
  type ColdEmailCtaType,
  type ColdEmailDraft,
  type ColdEmailPlan,
  validateColdEmailDraft,
} from "@/lib/outreach-email-style";
import type { EnrichmentResult } from "@/lib/outreach-enrichment";
import type { LeadRecord } from "@/lib/prisma";

export type GeneratedEmail = {
  subject: string;
  bodyHtml: string;
  bodyPlain: string;
  personalization_reason?: string;
  observed_issue?: string;
  CTA_type?: ColdEmailCtaType | "follow_up";
  confidence_score?: number;
};

export type OutreachSequenceStepType = "INITIAL" | "FOLLOW_UP_1" | "FOLLOW_UP_2";

type FollowUpSourceEmail = {
  subject: string;
  bodyPlain: string;
  sentAt: string | Date;
};

type RawGeneratedColdEmail = {
  subject: string;
  body: string;
  personalization_reason: string;
  observed_issue: string;
  CTA_type: ColdEmailCtaType;
  confidence_score: number;
};

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function firstName(senderName: string) {
  return senderName.trim().split(/\s+/)[0] || senderName.trim() || "Riley";
}

function buildPainSignalContext(lead: LeadRecord) {
  const painSignals = parseJson<PainSignal[]>(lead.painSignals);
  if (!Array.isArray(painSignals) || painSignals.length === 0) {
    return "PAIN SIGNALS: none recorded";
  }

  const lines = painSignals
    .slice(0, 4)
    .map(
      (signal) =>
        `- ${signal.type} (severity ${signal.severity}, ${signal.source}): ${signal.evidence || "No evidence provided"}`,
    );

  return ["PAIN SIGNALS:", ...lines].join("\n");
}

function buildWebsiteAssessmentContext(lead: LeadRecord) {
  const assessment = parseJson<WebsiteAssessment>(lead.axiomWebsiteAssessment);
  if (!assessment) {
    return "WEBSITE ASSESSMENT: none recorded";
  }

  return [
    "WEBSITE ASSESSMENT:",
    `- Overall grade: ${assessment.overallGrade || "unknown"}`,
    `- Speed risk: ${assessment.speedRisk}/10`,
    `- Conversion risk: ${assessment.conversionRisk}/10`,
    `- Trust risk: ${assessment.trustRisk}/10`,
    `- SEO risk: ${assessment.seoRisk}/10`,
    `- Top fixes: ${(assessment.topFixes || []).slice(0, 3).join("; ") || "none recorded"}`,
  ].join("\n");
}

function buildGenerationContext(
  lead: LeadRecord,
  enrichment: EnrichmentResult,
  senderName: string,
  plan: ColdEmailPlan,
): string {
  const lines: string[] = [];

  lines.push(`SENDER: ${senderName} from Axiom Infrastructure`);
  lines.push(`SENDER FIRST NAME: ${firstName(senderName)}`);
  lines.push(`BUSINESS: ${lead.businessName}`);
  lines.push(`CITY: ${lead.city}`);
  lines.push(`NICHE: ${lead.niche}`);
  if (lead.category) lines.push(`CATEGORY: ${lead.category}`);
  if (lead.contactName) lines.push(`CONTACT NAME: ${lead.contactName}`);
  if (lead.email) lines.push(`EMAIL: ${lead.email}`);
  if (lead.emailType) lines.push(`EMAIL TYPE: ${lead.emailType}`);
  if (lead.emailConfidence != null) lines.push(`EMAIL CONFIDENCE: ${lead.emailConfidence}`);
  lines.push(`WEBSITE STATUS: ${lead.websiteStatus || "UNKNOWN"}`);
  if (lead.websiteUrl) lines.push(`WEBSITE URL: ${lead.websiteUrl}`);
  if (lead.websiteGrade) lines.push(`WEBSITE GRADE: ${lead.websiteGrade}`);
  if (lead.rating != null) lines.push(`GOOGLE RATING: ${lead.rating}`);
  if (lead.reviewCount != null) lines.push(`REVIEW COUNT: ${lead.reviewCount}`);
  if (lead.axiomScore != null) lines.push(`AXIOM SCORE: ${lead.axiomScore}`);
  if (lead.axiomTier) lines.push(`AXIOM TIER: ${lead.axiomTier}`);
  if (lead.tacticalNote) lines.push(`TACTICAL NOTE: ${lead.tacticalNote}`);
  lines.push("");
  lines.push(buildWebsiteAssessmentContext(lead));
  lines.push("");
  lines.push(buildPainSignalContext(lead));
  lines.push("");
  lines.push("ENRICHMENT INTELLIGENCE:");
  lines.push(`- Value proposition: ${enrichment.valueProposition}`);
  lines.push(`- Pitch angle: ${enrichment.pitchAngle}`);
  lines.push(`- Key pain point: ${enrichment.keyPainPoint}`);
  lines.push(`- Personalized hook: ${enrichment.personalizedHook}`);
  lines.push(`- Recommended CTA: ${enrichment.recommendedCTA}`);
  lines.push(`- Tone: ${enrichment.emailTone}`);
  lines.push(`- Summary: ${enrichment.enrichmentSummary}`);
  lines.push("");
  lines.push("SELECTED EMAIL STRATEGY:");
  lines.push(`- Strategy: ${plan.strategy}`);
  lines.push(`- CTA type: ${plan.CTA_type}`);
  lines.push(`- Confidence score: ${plan.confidence_score}`);
  lines.push(`- Personalization reason: ${plan.personalization_reason}`);
  lines.push(`- Concrete anchor to reference: ${plan.concreteAnchor}`);
  lines.push(`- Observed issue: ${plan.observed_issue}`);
  lines.push(`- Evidence: ${plan.issueEvidence}`);
  lines.push(`- Preferred observation framing: ${plan.observationHint}`);
  lines.push(`- Preferred soft consequence: ${plan.consequenceHint}`);
  lines.push(`- Preferred CTA: ${plan.ctaHint}`);
  lines.push(`- Use softened language: ${plan.softened ? "yes" : "no"}`);

  return lines.join("\n");
}

function buildFollowUpContext(
  lead: LeadRecord,
  enrichment: EnrichmentResult,
  senderName: string,
  previousEmail: FollowUpSourceEmail,
  stepType: OutreachSequenceStepType = "FOLLOW_UP_1",
): string {
  const lines: string[] = [];

  lines.push(`SENDER: ${senderName} from Axiom Infrastructure`);
  lines.push(`RECIPIENT BUSINESS: ${lead.businessName}`);
  if (lead.contactName) lines.push(`RECIPIENT CONTACT NAME: ${lead.contactName}`);
  lines.push(`RECIPIENT EMAIL: ${lead.email}`);
  lines.push(`RECIPIENT CITY: ${lead.city}`);
  lines.push(`RECIPIENT NICHE: ${lead.niche}`);
  lines.push(`WEBSITE STATUS: ${lead.websiteStatus || "UNKNOWN"}`);
  lines.push(`PREVIOUS EMAIL SUBJECT: ${previousEmail.subject}`);
  lines.push(`PREVIOUS EMAIL SENT AT: ${new Date(previousEmail.sentAt).toISOString()}`);
  lines.push(`PREVIOUS EMAIL BODY: ${previousEmail.bodyPlain}`);
  lines.push(`FOLLOW-UP STEP: ${stepType}`);
  lines.push(``);
  lines.push(`=== ENRICHMENT INTELLIGENCE ===`);
  lines.push(`VALUE PROPOSITION: ${enrichment.valueProposition}`);
  lines.push(`PITCH ANGLE: ${enrichment.pitchAngle}`);
  lines.push(`KEY PAIN POINT: ${enrichment.keyPainPoint}`);
  lines.push(`COMPETITIVE EDGE: ${enrichment.competitiveEdge}`);
  lines.push(`PERSONALIZED HOOK: ${enrichment.personalizedHook}`);
  lines.push(`RECOMMENDED CTA: ${enrichment.recommendedCTA}`);
  lines.push(`EMAIL TONE: ${enrichment.emailTone}`);

  return lines.join("\n");
}

const COLD_EMAIL_SYSTEM_PROMPT = `You write short local-business cold emails for Axiom Infrastructure.

The emails must sound human, calm, sharp, and specific. They should read like a real person looked at the business, not like agency outreach or AI copy.

Core rules:
1. Write between 70 and 130 words.
2. Use plain English only.
3. Use short paragraphs.
4. Open with a real business-specific observation or a light curiosity-based opener.
5. Include one specific observed issue only if the evidence supports it.
6. If the evidence is weaker, soften the wording with phrases like "may be", "might be", "feels like", or "doesn't fully reflect".
7. Include one soft consequence, not a dramatic claim.
8. End with a low-friction CTA unless the strategy explicitly allows a soft call CTA.
9. Sign off with the sender's first name only.
10. Do not use em dashes.
11. Do not use exclamation marks.
12. Do not open with "I hope you're well."
13. Do not use generic agency language or hype.
14. Do not hallucinate observations that are not supported by the context.
15. Use at least one concrete anchor from the context, such as the website domain, city, review count, or a clearly supported issue.
16. Keep compliments minimal. At most one light compliment, and only if it is tied to a concrete fact.
17. If you cannot support a strong observation, stay curious and permission-based instead of forcing a critique.

Never use phrases like:
- stellar reputation
- glowing reviews
- award-winning brand
- we specialize in
- high-converting platforms
- improve booking conversions
- modernize your website
- boost revenue
- schedule a quick 10-minute call
- first impression
- online visibility
- digital transformation
- stand out online
- unlock growth

Return JSON only:
{
  "subject": "Short natural subject line",
  "body": "Plain text email body only",
  "personalization_reason": "Why this email is personalized to the lead",
  "observed_issue": "Single issue referenced in the email",
  "CTA_type": "observation_offer | permission_offer | soft_call",
  "confidence_score": 0
}`;

const FOLLOW_UP_SYSTEM_PROMPT = `You are writing a concise follow-up email on behalf of Axiom Infrastructure, a web design and development agency in Ontario, Canada.

STRICT RULES:
1. This is a follow-up to a previous cold email. Acknowledge the prior note briefly without sounding robotic.
2. Keep the email under 90 words.
3. Maintain the same personalized context from the original outreach and add one fresh, relevant angle.
4. FOLLOW_UP_1 should feel like a soft nudge with a new angle.
5. FOLLOW_UP_2 should feel like a concise final check-in and can politely close the loop.
6. The tone should be helpful, confident, and low-pressure.
7. Keep the CTA simple and easy to reply to.
8. Do NOT repeat the original email verbatim.
9. Prefer a natural reply-style subject. "Re:" is allowed when it fits.
10. Do NOT use placeholders.
11. The plain text version should be a clean version without any HTML.
12. The HTML version should use simple inline styles and remain lightweight.

Respond with a JSON object:
{
  "subject": "Follow-up email subject line",
  "bodyHtml": "Full HTML email body (complete, ready to send)",
  "bodyPlain": "Plain text version of the same email"
}`;

function sanitizeSubject(subject: string, businessName: string) {
  const trimmed = subject
    .replace(/[!]/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (trimmed.length > 0) {
    return trimmed.slice(0, 78);
  }

  return `Quick thought on ${businessName}`;
}

function normalizeColdEmailDraft(
  draft: RawGeneratedColdEmail,
  plan: ColdEmailPlan,
  businessName: string,
): ColdEmailDraft {
  return {
    subject: sanitizeSubject(draft.subject || "", businessName),
    body: (draft.body || "").replace(/\r/g, "").trim(),
    personalization_reason: (draft.personalization_reason || plan.personalization_reason).trim(),
    observed_issue: (draft.observed_issue || plan.observed_issue).trim(),
    CTA_type: plan.CTA_type,
    confidence_score: Math.max(0, Math.min(100, Math.round(Number(draft.confidence_score || plan.confidence_score)))),
  };
}

async function generateColdEmailAttempt(
  context: string,
  plan: ColdEmailPlan,
  retryInstructions?: string,
): Promise<RawGeneratedColdEmail> {
  const userPrompt = [
    "Generate one cold email using the selected strategy and context below.",
    "The email must feel human, specific, low-friction, and reply-worthy.",
    "",
    context,
    "",
    "Additional rules:",
    `- Keep CTA type as ${plan.CTA_type}.`,
    `- Strategy is ${plan.strategy}.`,
    `- Use this concrete anchor somewhere naturally: ${plan.concreteAnchor}.`,
    `- Observed issue to anchor around: ${plan.observed_issue}.`,
    `- If evidence is limited, stay curiosity-based and ask permission to send ideas.`,
    "- Do not over-compliment the business.",
    retryInstructions ? `\n${retryInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return chatCompletionJson<RawGeneratedColdEmail>({
    systemPrompt: COLD_EMAIL_SYSTEM_PROMPT,
    userPrompt,
    temperature: retryInstructions ? 0.35 : 0.55,
    maxTokens: 1100,
  });
}

function finalizeColdEmail(
  draft: ColdEmailDraft,
  senderName: string,
): GeneratedEmail {
  const bodyPlain = buildPlainTextEmail(draft.body, firstName(senderName));
  const bodyHtml = buildHtmlEmail(bodyPlain);

  return {
    subject: draft.subject,
    bodyPlain,
    bodyHtml,
    personalization_reason: draft.personalization_reason,
    observed_issue: draft.observed_issue,
    CTA_type: draft.CTA_type,
    confidence_score: draft.confidence_score,
  };
}

/**
 * Generate a personalized email for a single lead.
 */
export async function generateEmail(
  lead: LeadRecord,
  enrichment: EnrichmentResult,
  senderName: string,
): Promise<GeneratedEmail> {
  const plan = chooseColdEmailPlan(lead, enrichment);
  const context = buildGenerationContext(lead, enrichment, senderName, plan);

  const firstDraft = normalizeColdEmailDraft(
    await generateColdEmailAttempt(context, plan),
    plan,
    lead.businessName,
  );
  const firstValidation = validateColdEmailDraft(firstDraft, lead, plan);
  if (firstValidation.valid) {
    return finalizeColdEmail(firstDraft, senderName);
  }

  const retryDraft = normalizeColdEmailDraft(
    await generateColdEmailAttempt(context, plan, buildRetryInstructions(firstValidation, plan)),
    plan,
    lead.businessName,
  );
  const retryValidation = validateColdEmailDraft(retryDraft, lead, plan);
  const finalDraft =
    retryValidation.valid || retryValidation.score >= firstValidation.score
      ? retryDraft
      : firstDraft;
  return finalizeColdEmail(finalDraft, senderName);
}

export async function generateFollowUpEmail(
  lead: LeadRecord,
  enrichment: EnrichmentResult,
  senderName: string,
  previousEmail: FollowUpSourceEmail,
  stepType: OutreachSequenceStepType = "FOLLOW_UP_1",
): Promise<GeneratedEmail> {
  const context = buildFollowUpContext(lead, enrichment, senderName, previousEmail, stepType);

  return chatCompletionJson<GeneratedEmail>({
    systemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
    userPrompt: `Generate a personalized follow-up email using this context:\n\n${context}`,
    temperature: 0.65,
    maxTokens: 1024,
  });
}

export async function generateSequenceStepEmail(
  lead: LeadRecord,
  enrichment: EnrichmentResult,
  senderName: string,
  stepType: OutreachSequenceStepType,
  previousEmail?: FollowUpSourceEmail,
): Promise<GeneratedEmail> {
  if (stepType === "INITIAL") {
    return generateEmail(lead, enrichment, senderName);
  }

  if (!previousEmail) {
    throw new Error(`Previous email context is required for ${stepType}`);
  }

  return generateFollowUpEmail(lead, enrichment, senderName, previousEmail, stepType);
}

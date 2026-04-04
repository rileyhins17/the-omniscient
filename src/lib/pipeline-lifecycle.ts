import { hasValidPipelineEmail, isLeadOutreachEligible } from "@/lib/lead-qualification";
import { isContactedOutreachStatus, READY_FOR_FIRST_TOUCH_STATUS } from "@/lib/outreach";

type PipelineLeadLike = {
  axiomScore?: number | null | undefined;
  email: string | null | undefined;
  emailConfidence?: number | null | undefined;
  emailFlags?: string | null | string[] | undefined;
  emailType?: string | null | undefined;
  enrichedAt?: string | Date | null | undefined;
  enrichmentData?: string | null | undefined;
  isArchived?: boolean | null | undefined;
  outreachStatus?: string | null | undefined;
  source?: string | null | undefined;
  websiteStatus?: string | null | undefined;
};

export type PipelineReadinessState = "NOT_READY" | "ALMOST_READY" | "READY";

export function isReadyForFirstTouchStatus(status: string | null | undefined) {
  return status === READY_FOR_FIRST_TOUCH_STATUS;
}

export function isIntakeLead(lead: PipelineLeadLike) {
  if (lead.isArchived) return false;
  if (isContactedOutreachStatus(lead.outreachStatus)) return false;
  if (isReadyForFirstTouchStatus(lead.outreachStatus)) return false;
  return Boolean(lead.source) && !lead.enrichedAt;
}

export function isQualificationLead(lead: PipelineLeadLike) {
  if (lead.isArchived) return false;
  if (isContactedOutreachStatus(lead.outreachStatus)) return false;
  if (isReadyForFirstTouchStatus(lead.outreachStatus)) return false;
  return Boolean(lead.enrichedAt || lead.enrichmentData);
}

export function getReadinessChecklist(lead: PipelineLeadLike) {
  const websiteAssessed = Boolean(lead.websiteStatus);
  const validContactFound = hasValidPipelineEmail(lead);
  const scoreComputed =
    typeof lead.axiomScore === "number" && Number.isFinite(lead.axiomScore);
  const enrichmentCaptured = Boolean(lead.enrichmentData || lead.enrichedAt);
  const outreachEligibilityDetermined = enrichmentCaptured && scoreComputed;
  const fitConfirmed = isLeadOutreachEligible({
    ...lead,
    axiomScore: lead.axiomScore ?? null,
  });

  return [
    { id: "website", label: "Website assessed", complete: websiteAssessed },
    { id: "contact", label: "Valid contact found", complete: validContactFound },
    { id: "fit", label: "Fit confirmed", complete: fitConfirmed },
    { id: "score", label: "Qualification score computed", complete: scoreComputed },
    {
      id: "eligibility",
      label: "Outreach eligibility determined",
      complete: outreachEligibilityDetermined,
    },
  ];
}

export function getReadinessState(lead: PipelineLeadLike): PipelineReadinessState {
  const checklist = getReadinessChecklist(lead);
  const completed = checklist.filter((item) => item.complete).length;

  if (
    completed === checklist.length &&
    isLeadOutreachEligible({
      ...lead,
      axiomScore: lead.axiomScore ?? null,
    })
  ) {
    return "READY";
  }

  if (completed >= 2) {
    return "ALMOST_READY";
  }

  return "NOT_READY";
}

export function getReadinessLabel(state: PipelineReadinessState) {
  switch (state) {
    case "READY":
      return "Ready for Qualification";
    case "ALMOST_READY":
      return "Almost Ready";
    default:
      return "Not Ready";
  }
}

export function getReadinessTone(state: PipelineReadinessState) {
  switch (state) {
    case "READY":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "ALMOST_READY":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    default:
      return "border-white/10 bg-white/[0.04] text-zinc-300";
  }
}

export function getMissingDataSummary(lead: PipelineLeadLike) {
  const missing: string[] = [];

  if (!lead.enrichedAt && !lead.enrichmentData) {
    missing.push("Enrichment not started");
  }
  if (!lead.websiteStatus) {
    missing.push("Website not assessed");
  }
  if (!hasValidPipelineEmail(lead)) {
    missing.push("No valid email");
  }
  if (!(typeof lead.axiomScore === "number" && Number.isFinite(lead.axiomScore))) {
    missing.push("Qualification score missing");
  }
  if (
    lead.enrichmentData &&
    !isLeadOutreachEligible({
      ...lead,
      axiomScore: lead.axiomScore ?? null,
    })
  ) {
    missing.push("Not yet ready for first touch");
  }

  return missing;
}

export function getLifecycleOwnerHref(input: {
  hasActiveSequence?: boolean;
  hasSentAnyStep?: boolean;
  outreachStatus?: string | null | undefined;
  isArchived?: boolean | null | undefined;
}) {
  if (input.isArchived) return "/vault";
  if (input.hasActiveSequence && input.hasSentAnyStep) return "/automation";
  if (input.hasActiveSequence && !input.hasSentAnyStep) return "/outreach?stage=initial";
  if (isReadyForFirstTouchStatus(input.outreachStatus)) return "/outreach?stage=initial";
  if (isContactedOutreachStatus(input.outreachStatus)) return "/automation";
  return "/outreach?stage=enrichment";
}

export function getLifecycleStageLabel(input: {
  enrichedAt?: string | Date | null | undefined;
  enrichmentData?: string | null | undefined;
  hasActiveSequence?: boolean;
  hasSentAnyStep?: boolean;
  isArchived?: boolean | null | undefined;
  outreachStatus?: string | null | undefined;
  source?: string | null | undefined;
}) {
  if (input.isArchived) return "Closed";
  if (input.hasActiveSequence && input.hasSentAnyStep) return "Follow-Up";
  if (input.hasActiveSequence && !input.hasSentAnyStep) return "Initial Outreach";
  if (isReadyForFirstTouchStatus(input.outreachStatus)) return "Initial Outreach";
  if (isContactedOutreachStatus(input.outreachStatus)) return "Follow-Up";
  if (input.enrichedAt || input.enrichmentData) return "Qualification";
  if (input.source) return "Intake";
  return "Enrichment";
}

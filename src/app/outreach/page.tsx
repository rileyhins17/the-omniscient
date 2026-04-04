import { Bot, Brain, Clock3, MailCheck, Send } from "lucide-react";

import { OutreachHub } from "@/components/outreach/outreach-hub";
import { ToastProvider } from "@/components/ui/toast-provider";
import { StatCard } from "@/components/ui/stat-card";
import { hasValidPipelineEmail, isLeadOutreachEligible } from "@/lib/lead-qualification";
import { getActiveAutomationLeadIds, listAutomationOverview } from "@/lib/outreach-automation";
import { getPrisma } from "@/lib/prisma";
import {
  getContactedOutreachLeadWhere,
  getOutreachPipelineLeadWhere,
  OUTREACH_AUTO_INCLUDE_MIN_SCORE,
} from "@/lib/outreach";
import { requireSession } from "@/lib/session";
import { formatAppDateTime } from "@/lib/time";

function emptyAutomationOverview() {
  return {
    settings: {
      enabled: true,
      globalPaused: false,
      sendWindowStartHour: 9,
      sendWindowStartMinute: 0,
      sendWindowEndHour: 16,
      sendWindowEndMinute: 30,
      initialDelayMinMinutes: 10,
      initialDelayMaxMinutes: 45,
      followUp1BusinessDays: 2,
      followUp2BusinessDays: 4,
      schedulerClaimBatch: 4,
      replySyncStaleMinutes: 15,
    },
    ready: [],
    mailboxes: [],
    sequences: [],
    queued: [],
    active: [],
    finished: [],
    recentSent: [],
    engine: {
      mode: "ACTIVE",
      nextSendAt: null,
      scheduledToday: 0,
      blockedCount: 0,
      replyStoppedCount: 0,
      readyCount: 0,
      queuedCount: 0,
      waitingCount: 0,
      sendingCount: 0,
    },
    recentRuns: [],
    stats: {
      ready: 0,
      queued: 0,
      sending: 0,
      waiting: 0,
      blocked: 0,
      active: 0,
      paused: 0,
      stopped: 0,
      completed: 0,
      replied: 0,
      scheduledToday: 0,
    },
  };
}

function formatRunTime(value: Date | string | null | undefined) {
  return formatAppDateTime(
    value,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
    "No runs recorded yet",
  );
}

export default async function OutreachPage() {
  await requireSession();

  const prisma = getPrisma();
  const automationLeadIds = new Set(await getActiveAutomationLeadIds().catch(() => []));
  const automationOverview = await listAutomationOverview().catch(() => emptyAutomationOverview());

  const allPipelineLeads = await prisma.lead.findMany({
    where: getOutreachPipelineLeadWhere(),
    orderBy: {
      axiomScore: "desc",
    },
    select: {
      id: true,
      businessName: true,
      city: true,
      niche: true,
      contactName: true,
      phone: true,
      email: true,
      emailConfidence: true,
      emailFlags: true,
      emailType: true,
      axiomScore: true,
      axiomTier: true,
      outreachStatus: true,
      outreachChannel: true,
      firstContactedAt: true,
      lastContactedAt: true,
      nextFollowUpDue: true,
      outreachNotes: true,
    },
  }).catch(() => []);
  const pipelineLeads = allPipelineLeads.filter(
    (lead) => !automationLeadIds.has(lead.id) && isLeadOutreachEligible(lead),
  );

  const contactedLeads = await prisma.lead.findMany({
    where: getContactedOutreachLeadWhere(),
    orderBy: {
      lastContactedAt: "desc",
    },
    select: {
      id: true,
      outreachStatus: true,
      nextFollowUpDue: true,
    },
  }).catch(() => []);

  const enrichedLeads = await prisma.lead.findMany({
    where: {
      enrichedAt: { not: null },
    },
    orderBy: {
      enrichedAt: "desc",
    },
    select: {
      id: true,
      businessName: true,
      city: true,
      niche: true,
      email: true,
      emailConfidence: true,
      emailFlags: true,
      emailType: true,
      contactName: true,
      axiomScore: true,
      axiomTier: true,
      websiteStatus: true,
      enrichedAt: true,
      enrichmentData: true,
      outreachStatus: true,
    },
  }).catch(() => []);

  let emailsSentToday = 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    emailsSentToday = await prisma.outreachEmail.count({
      where: {
        sentAt: { gte: today },
        status: "sent",
      },
    });
  } catch {
    // Table may not exist yet.
  }

  const now = Date.now();
  const followUpDue = contactedLeads.filter(
    (lead) => lead.nextFollowUpDue && new Date(lead.nextFollowUpDue).getTime() <= now,
  ).length;
  const validEmailLeads = enrichedLeads.filter((lead) => hasValidPipelineEmail(lead)).length;
  const openConversations = contactedLeads.filter(
    (lead) =>
      lead.outreachStatus === "OUTREACHED" ||
      lead.outreachStatus === "FOLLOW_UP_DUE" ||
      lead.outreachStatus === "REPLIED",
  ).length;
  const liveAutomationCount =
    automationOverview.stats.queued + automationOverview.stats.active + automationOverview.stats.paused;
  const lastRun = automationOverview.recentRuns[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-6 py-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-[11px] uppercase tracking-[0.32em] text-emerald-400/80">
              Axiom Pipeline Engine
            </p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Outreach
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Review leads, enrich them, send manually when needed, and hand qualified work off to the dedicated Automation engine.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[420px]">
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
              <div className="text-[11px] text-zinc-500">Last scheduler run</div>
              <div className="mt-1 text-sm font-medium text-white">
                {lastRun ? lastRun.status : "Idle"}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{formatRunTime(lastRun?.startedAt)}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
              <div className="text-[11px] text-zinc-500">Follow-up due</div>
              <div className="mt-1 text-sm font-medium text-white">{followUpDue}</div>
              <div className="mt-1 text-xs text-zinc-500">manual conversations waiting</div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
              <div className="text-[11px] text-zinc-500">Automation ready rule</div>
              <div className="mt-1 text-sm font-medium text-white">
                Score above {OUTREACH_AUTO_INCLUDE_MIN_SCORE}
              </div>
              <div className="mt-1 text-xs text-zinc-500">plus a vetted pipeline-usable email</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pipeline"
          value={pipelineLeads.length}
          subtitle={`manual candidates above ${OUTREACH_AUTO_INCLUDE_MIN_SCORE}`}
          icon={<MailCheck />}
          iconColor="text-cyan-400"
        />
        <StatCard
          label="Enriched"
          value={enrichedLeads.length}
          subtitle={`${validEmailLeads} with vetted email`}
          icon={<Brain />}
          iconColor="text-purple-400"
        />
        <StatCard
          label="Automation Live"
          value={liveAutomationCount}
          subtitle={`${automationOverview.stats.ready} ready to queue`}
          icon={<Bot />}
          iconColor="text-blue-400"
        />
        <StatCard
          label="Sent Today"
          value={emailsSentToday}
          subtitle={`${openConversations} conversations still active`}
          icon={<Send />}
          iconColor="text-emerald-400"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Clock3 className="h-4 w-4 text-amber-400" />
            What needs attention now
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Manual follow-ups and newly enriched leads are handled here. Automation blockers and scheduled sends now live in the dedicated Automation page.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
          <div className="text-sm font-medium text-white">How automation behaves</div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Automatic sending now lives in the dedicated Automation page. Outreach stays focused on enrichment, manual sends, and the email log.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
          <div className="text-sm font-medium text-white">What the tabs mean</div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Pipeline is manual unsent work, Enriched is ready for review, Automation shows queued
            and running sequences, and Email Log tracks delivered outreach.
          </p>
        </div>
      </section>

      <ToastProvider>
        <OutreachHub
          initialPipelineLeads={JSON.parse(JSON.stringify(pipelineLeads))}
          initialEnrichedLeads={JSON.parse(JSON.stringify(enrichedLeads))}
          initialAutomationOverview={JSON.parse(JSON.stringify(automationOverview))}
        />
      </ToastProvider>
    </div>
  );
}

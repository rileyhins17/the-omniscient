import Link from "next/link";
import { ArrowRight, Mail, MessageSquareText, Radar, Sparkles, Target } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { hasValidPipelineEmail, isLeadOutreachEligible } from "@/lib/lead-qualification";
import { OUTREACH_AUTO_INCLUDE_MIN_SCORE } from "@/lib/outreach";
import { listAutomationOverview } from "@/lib/outreach-automation";
import { getPrisma } from "@/lib/prisma";
import { listScrapeJobs } from "@/lib/scrape-jobs";
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
    mailboxes: [],
    ready: [],
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
    "No runs yet",
  );
}

export default async function DashboardPage() {
  await requireSession();

  const prisma = getPrisma();
  const automationOverview = await listAutomationOverview().catch(() => emptyAutomationOverview());
  const scrapeJobs = await listScrapeJobs(12).catch(() => []);
  const leads = await prisma.lead.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      email: true,
      phone: true,
      nextFollowUpDue: true,
      outreachStatus: true,
      businessName: true,
      city: true,
      axiomScore: true,
      emailConfidence: true,
      emailFlags: true,
      emailType: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  const totalLeads = leads.length;
  const validEmailLeads = leads.filter((lead) => hasValidPipelineEmail(lead)).length;
  const outreachReadyLeads = leads.filter(
    (lead) => isLeadOutreachEligible(lead) && (!lead.outreachStatus || lead.outreachStatus === "NOT_CONTACTED"),
  ).length;
  const followUpDue = leads.filter(
    (lead) =>
      lead.nextFollowUpDue &&
      new Date(lead.nextFollowUpDue).getTime() <= now &&
      lead.outreachStatus !== "CLOSED" &&
      lead.outreachStatus !== "NOT_INTERESTED",
  ).length;

  const recentHighPriority = leads
    .filter((lead) => isLeadOutreachEligible(lead))
    .slice(0, 5);

  const leadGeneratorActiveJob =
    scrapeJobs.find((job) => job.status === "running" || job.status === "claimed") ?? null;
  const leadGeneratorQueuedTargets = scrapeJobs.filter(
    (job) => job.status === "pending" || job.status === "claimed" || job.status === "running",
  ).length;
  const leadGeneratorState = leadGeneratorActiveJob
    ? leadGeneratorActiveJob.status === "running"
      ? "Running"
      : "Queued"
    : leadGeneratorQueuedTargets > 0
      ? "Queued"
      : "Idle";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const emailsSentToday = await prisma.outreachEmail.count({
    where: {
      status: "sent",
      sentAt: { gte: today },
    },
  });

  const nextActions = [
    leadGeneratorActiveJob
      ? `${leadGeneratorActiveJob.niche} in ${leadGeneratorActiveJob.city} is live in Lead Generator`
      : "Lead Generator is ready for the next target",
    `${automationOverview.stats.ready} lead${automationOverview.stats.ready === 1 ? "" : "s"} ready for automation`,
    `${automationOverview.stats.scheduledToday} automation touch${automationOverview.stats.scheduledToday === 1 ? "" : "es"} scheduled today`,
    `${followUpDue} follow-up item${followUpDue === 1 ? "" : "s"} due`,
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="rounded-[32px] border border-white/[0.06] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-6 py-12 shadow-[0_20px_80px_rgba(0,0,0,0.35)] md:px-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <BrandMark
            className="w-full max-w-[420px] border-white/[0.08] bg-black/20 px-8 py-6 shadow-none"
            imageClassName="h-16"
          />
          <div className="mt-8 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.34em] text-emerald-400/80">
              Axiom Pipeline Engine
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Clean operations control for lead intake, outreach, and automation.
            </h1>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="h-10 rounded-full bg-white px-5 text-sm text-black hover:bg-zinc-200">
              <Link href="/hunt">
                Open Lead Generator
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-10 rounded-full border border-white/10 px-5 text-sm text-white hover:bg-white/[0.04]">
              <Link href="/automation">
                Open Automation
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Total Leads"
          value={totalLeads}
          subtitle="active records"
          icon={<Radar />}
          iconColor="text-emerald-400"
          className="bg-white/[0.02]"
        />
        <StatCard
          label="Lead Generator"
          value={leadGeneratorState}
          subtitle={
            leadGeneratorActiveJob
              ? `${leadGeneratorActiveJob.niche} in ${leadGeneratorActiveJob.city}`
              : "current generation state"
          }
          icon={<Target />}
          iconColor="text-cyan-400"
          className="bg-white/[0.02]"
        />
        <StatCard
          label="Valid Email"
          value={validEmailLeads}
          subtitle="pipeline-usable inboxes"
          icon={<Mail />}
          iconColor="text-blue-400"
          className="bg-white/[0.02]"
        />
        <StatCard
          label="Outreach Ready"
          value={outreachReadyLeads}
          subtitle={`score > ${OUTREACH_AUTO_INCLUDE_MIN_SCORE} with vetted email`}
          icon={<Sparkles />}
          iconColor="text-purple-400"
          className="bg-white/[0.02]"
        />
        <StatCard
          label="Follow-Up Due"
          value={followUpDue}
          subtitle="needs a decision"
          icon={<MessageSquareText />}
          iconColor="text-amber-400"
          className="bg-white/[0.02]"
        />
        <StatCard
          label="Sent Today"
          value={emailsSentToday}
          subtitle="delivered emails"
          icon={<Mail />}
          iconColor="text-emerald-400"
          className="bg-white/[0.02]"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Automation Status</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Automation summary</h2>
            </div>
            <Button asChild variant="ghost" className="rounded-full border border-white/10 px-4 text-sm text-white hover:bg-white/[0.04]">
              <Link href="/automation">Open Automation</Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
              <div className="text-[11px] text-zinc-500">Lead Generator</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {leadGeneratorState}
              </div>
              <div className="mt-1 text-sm text-zinc-400">
                {leadGeneratorActiveJob
                  ? `${leadGeneratorActiveJob.niche} in ${leadGeneratorActiveJob.city}`
                  : "Ready for the next launch"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
              <div className="text-[11px] text-zinc-500">Ready to queue</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {automationOverview.stats.ready}
              </div>
              <div className="mt-1 text-sm text-zinc-400">
                automation-ready and unsent
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
              <div className="text-[11px] text-zinc-500">Next automated send</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {automationOverview.engine.nextSendAt ? formatRunTime(automationOverview.engine.nextSendAt) : "No send queued"}
              </div>
              <div className="mt-1 text-sm text-zinc-400">
                {automationOverview.engine.mode === "ACTIVE" ? "Engine active" : automationOverview.engine.mode}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-5">
            <div className="text-sm font-semibold text-white">Next actions</div>
            <div className="mt-4 space-y-3">
              {nextActions.map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-zinc-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{item}</span>
                </div>
              ))}
              {!automationOverview.engine.nextSendAt && (
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span>No automated sends are scheduled yet.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Needs Attention</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
                <div className="text-sm font-semibold text-white">Follow-ups due</div>
                <div className="mt-1 text-3xl font-semibold text-amber-300">{followUpDue}</div>
                <div className="mt-2 text-sm text-zinc-400">Manual follow-up work waiting in outreach.</div>
              </div>
              <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-4">
              <div className="text-sm font-semibold text-white">Queued automation</div>
                <div className="mt-1 text-3xl font-semibold text-blue-300">{automationOverview.stats.scheduledToday}</div>
                <div className="mt-2 text-sm text-zinc-400">Automated touches scheduled during today's window.</div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">High Priority Leads</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Recent outreach-ready opportunities</h2>
              </div>
              <Button asChild variant="ghost" className="rounded-full border border-white/10 px-4 text-sm text-white hover:bg-white/[0.04]">
                <Link href="/vault">Open Vault</Link>
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {recentHighPriority.length > 0 ? recentHighPriority.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-2xl border border-white/[0.05] bg-black/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{lead.businessName}</div>
                    <div className="truncate text-xs text-zinc-500">{lead.city || "Unknown city"}</div>
                  </div>
                  <div className="font-mono text-lg text-emerald-400">{lead.axiomScore ?? "—"}</div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">
                  No high-priority leads yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Brain, Inbox, MessageSquareText, Sparkles } from "lucide-react";

import { EmailComposer } from "@/components/outreach/email-composer";
import { EmailLogTable } from "@/components/outreach/email-log-table";
import { EnrichmentPanel } from "@/components/outreach/enrichment-panel";
import { GmailConnectCard } from "@/components/outreach/gmail-connect-card";
import { OutreachClient } from "@/components/outreach/outreach-client";
import type { OutreachEditableLead } from "@/components/outreach/outreach-editor-sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

type Tab = "pipeline" | "enriched" | "log";

const TAB_CONFIG: Array<{
  id: Tab;
  label: string;
  description: string;
  icon: typeof MessageSquareText;
}> = [
  {
    id: "pipeline",
    label: "Pipeline",
    description: "Manual outreach candidates that have not been sent yet.",
    icon: MessageSquareText,
  },
  {
    id: "enriched",
    label: "Enriched",
    description: "Reviewed leads ready for manual send or automation queueing.",
    icon: Brain,
  },
  {
    id: "log",
    label: "Email Log",
    description: "Sent history and one-click follow-up actions.",
    icon: Inbox,
  },
];

type EnrichedLead = {
  id: number;
  businessName: string;
  city: string;
  niche: string;
  email: string | null;
  contactName: string | null;
  axiomScore: number | null;
  axiomTier: string | null;
  websiteStatus: string | null;
  enrichedAt: string | null;
  enrichmentData: string | null;
  outreachStatus: string | null;
};

type AutomationOverview = {
  settings: {
    enabled: boolean;
    globalPaused: boolean;
    sendWindowStartHour: number;
    sendWindowStartMinute: number;
    sendWindowEndHour: number;
    sendWindowEndMinute: number;
    initialDelayMinMinutes: number;
    initialDelayMaxMinutes: number;
    followUp1BusinessDays: number;
    followUp2BusinessDays: number;
    schedulerClaimBatch: number;
    replySyncStaleMinutes: number;
  };
  ready: Array<{
    id: number;
    businessName: string;
    city: string;
    niche: string;
    email: string | null;
  }>;
  mailboxes: Array<{
    id: string;
    userId: string;
    gmailAddress: string;
    label: string | null;
    status: string;
    timezone: string;
    dailyLimit: number;
    hourlyLimit: number;
    minDelaySeconds: number;
    maxDelaySeconds: number;
    warmupLevel: number;
    sentToday: number;
    sentThisHour: number;
  }>;
  queued: Array<{
    id: string;
    leadId: number;
    status: string;
    currentStep: string;
    nextScheduledAt: string | null;
    lastSentAt: string | null;
    stopReason: string | null;
    lead?: EnrichedLead | null;
    mailbox?: {
      id: string;
      gmailAddress: string;
      label: string | null;
      status: string;
      timezone: string;
      dailyLimit: number;
      hourlyLimit: number;
      minDelaySeconds: number;
      maxDelaySeconds: number;
      warmupLevel: number;
      sentToday: number;
      sentThisHour: number;
    } | null;
    nextStep?: { stepType: string; scheduledFor: string } | null;
  }>;
  active: Array<any>;
  finished: Array<any>;
  recentRuns: Array<any>;
  stats: {
    ready: number;
    queued: number;
    sending: number;
    waiting: number;
    blocked: number;
    active: number;
    paused: number;
    stopped: number;
    completed: number;
    replied: number;
    scheduledToday: number;
  };
};

type OutreachHubProps = {
  initialPipelineLeads: OutreachEditableLead[];
  initialEnrichedLeads: EnrichedLead[];
  initialAutomationOverview: AutomationOverview;
};

export function OutreachHub({
  initialPipelineLeads,
  initialEnrichedLeads,
  initialAutomationOverview,
}: OutreachHubProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("pipeline");
  const [pipelineLeads, setPipelineLeads] = useState<OutreachEditableLead[]>(initialPipelineLeads);
  const [enrichedLeads, setEnrichedLeads] = useState<EnrichedLead[]>(initialEnrichedLeads);
  const [automationOverview, setAutomationOverview] = useState(initialAutomationOverview);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [sendingLeadIds, setSendingLeadIds] = useState<number[] | null>(null);

  useEffect(() => {
    fetch("/api/outreach/gmail/status")
      .then((res) => res.json())
      .then((data) => setGmailConnected(data.connected === true))
      .catch(() => {});
  }, []);

  const refreshEnrichedLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/outreach/enriched-leads");
      if (res.ok) {
        const data = await res.json();
        setEnrichedLeads(data.leads || []);
      }
    } catch {
      // Leave stale UI in place if refresh fails.
    }
  }, []);

  const refreshAutomationOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/outreach/automation/overview");
      if (res.ok) {
        const data = await res.json();
        setAutomationOverview(data);
      }
    } catch {
      // Leave stale UI in place if refresh fails.
    }
  }, []);

  const refreshPipelineLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/outreach/pipeline");
      if (res.ok) {
        const data = await res.json();
        setPipelineLeads(data.leads || []);
      }
    } catch {
      // Leave stale UI in place if refresh fails.
    }
  }, []);

  const handleEnrichFromPipeline = useCallback(
    async (leadIds: number[]) => {
      try {
        const res = await fetch("/api/outreach/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Enrichment failed");
        }

        const data = await res.json();
        toast(`Enriched ${data.enriched} lead${data.enriched !== 1 ? "s" : ""} with AI`, {
          type: "success",
          icon: "note",
        });

        await refreshEnrichedLeads();
        setActiveTab("enriched");
      } catch (error) {
        toast(error instanceof Error ? error.message : "Enrichment failed", {
          type: "error",
          icon: "note",
        });
      }
    },
    [refreshEnrichedLeads, toast],
  );

  const handleSendRequested = useCallback((leadIds: number[]) => {
    setSendingLeadIds(leadIds);
  }, []);

  const handleSendComplete = useCallback(
    (sentLeadIds: number[]) => {
      setSendingLeadIds(null);
      if (sentLeadIds.length > 0) {
        setPipelineLeads((prev) => prev.filter((lead) => !sentLeadIds.includes(lead.id)));
      }
      void refreshEnrichedLeads();
      void refreshPipelineLeads();
      void refreshAutomationOverview();
    },
    [refreshAutomationOverview, refreshEnrichedLeads, refreshPipelineLeads],
  );

  const handleQueueRequested = useCallback(
    async (leadIds: number[]) => {
      try {
        const res = await fetch("/api/outreach/automation/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to queue leads for automation");
        }

        const queued = data?.queued?.length || 0;
        const skipped = data?.skipped?.length || 0;
        toast(
          queued > 0
            ? `Queued ${queued} lead${queued !== 1 ? "s" : ""}${skipped > 0 ? `, skipped ${skipped}` : ""}`
            : `No leads were queued${skipped > 0 ? `, skipped ${skipped}` : ""}`,
          { type: queued > 0 ? "success" : "error", icon: "note" },
        );

        await refreshAutomationOverview();
        await refreshPipelineLeads();
      } catch (error) {
        toast(error instanceof Error ? error.message : "Failed to queue leads", {
          type: "error",
          icon: "note",
        });
      }
    },
    [refreshAutomationOverview, refreshPipelineLeads, toast],
  );

  const queuedLeadIds = useMemo(
    () => [
      ...automationOverview.queued.map((sequence) => sequence.leadId),
      ...automationOverview.active.map((sequence: { leadId: number }) => sequence.leadId),
    ],
    [automationOverview.active, automationOverview.queued],
  );

  const tabCounts: Record<Tab, number | null> = {
    pipeline: pipelineLeads.length,
    enriched: enrichedLeads.length,
    log: null,
  };
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab) || TAB_CONFIG[0];

  return (
    <div className="space-y-5">
      <GmailConnectCard />

      <div className="rounded-[24px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-blue-400" />
              Automation is now its own workspace
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Use Outreach for enrichment, manual sends, and the email log. Use Automation for automatic sending, scheduler status, mailbox load, and blocked sequences.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                {automationOverview.stats.ready} ready to queue
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                {automationOverview.stats.scheduledToday} scheduled today
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                {automationOverview.stats.blocked} blocked
              </span>
            </div>
          </div>

          <Button asChild className="rounded-full bg-white px-4 text-sm text-black hover:bg-zinc-200">
            <Link href="/automation">
              Open Automation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-2">
        <div className="grid gap-2 md:grid-cols-3">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl px-4 py-3 text-left transition-all ${
                  isActive
                    ? "border border-white/10 bg-black/35 shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
                    : "border border-transparent bg-transparent hover:border-white/[0.06] hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Icon
                      className={`h-4 w-4 ${
                        tab.id === "pipeline"
                          ? "text-cyan-400"
                          : tab.id === "enriched"
                            ? "text-purple-400"
                            : "text-emerald-400"
                      }`}
                    />
                    {tab.label}
                  </div>
                  {typeof count === "number" && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400">
                      {count}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{tab.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/[0.06] bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="mb-5 flex flex-col gap-3 border-b border-white/[0.06] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{activeTabConfig.label}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
              {activeTabConfig.description}
            </p>
          </div>
          {typeof tabCounts[activeTab] === "number" && (
            <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">
              {tabCounts[activeTab]} item{tabCounts[activeTab] === 1 ? "" : "s"}
            </div>
          )}
        </div>

        {activeTab === "pipeline" && (
          <OutreachClient
            initialLeads={pipelineLeads}
            enableSelection
            onEnrichRequested={handleEnrichFromPipeline}
          />
        )}

        {activeTab === "enriched" && (
          <EnrichmentPanel
            leads={enrichedLeads}
            gmailConnected={gmailConnected}
            onSendRequested={handleSendRequested}
            onQueueRequested={handleQueueRequested}
            onLeadsUpdated={refreshEnrichedLeads}
            queuedLeadIds={queuedLeadIds}
          />
        )}

        {activeTab === "log" && <EmailLogTable />}
      </div>

      {sendingLeadIds && (
        <EmailComposer
          leadIds={sendingLeadIds}
          onClose={() => setSendingLeadIds(null)}
          onComplete={handleSendComplete}
        />
      )}
    </div>
  );
}

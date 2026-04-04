"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Brain, Inbox, MailCheck, ShieldCheck, Sparkles } from "lucide-react";

import { EmailComposer } from "@/components/outreach/email-composer";
import { EmailLogTable } from "@/components/outreach/email-log-table";
import { GmailConnectCard } from "@/components/outreach/gmail-connect-card";
import {
  EnrichmentWorkspace,
  InitialOutreachPanel,
  QualificationPanel,
  type PreSendLead,
  type PreSendSequence,
} from "@/components/outreach/pre-send-stage-panels";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

type Tab = "enrichment" | "qualification" | "initial" | "log";

const TAB_CONFIG: Array<{
  id: Tab;
  label: string;
  description: string;
  icon: typeof Brain;
}> = [
  {
    id: "enrichment",
    label: "Enrichment",
    description: "Prepare intake leads and surface what is still missing before qualification.",
    icon: Brain,
  },
  {
    id: "qualification",
    label: "Qualification",
    description: "Make the pre-send approval explicit before anything enters first-touch.",
    icon: ShieldCheck,
  },
  {
    id: "initial",
    label: "Initial Outreach",
    description: "Own only unsent first-touch work. No follow-up lifecycle appears here.",
    icon: MailCheck,
  },
  {
    id: "log",
    label: "Email Log",
    description: "Reference sent history and thread activity without changing stage ownership.",
    icon: Inbox,
  },
];

type AutomationOverview = {
  ready: Array<PreSendLead>;
  sequences: Array<PreSendSequence>;
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
  initialEnrichmentLeads: PreSendLead[];
  initialQualificationLeads: PreSendLead[];
  initialReadyLeads: PreSendLead[];
  initialAutomationOverview: AutomationOverview;
  initialTab?: Tab;
};

export function OutreachHub({
  initialEnrichmentLeads,
  initialQualificationLeads,
  initialReadyLeads,
  initialAutomationOverview,
  initialTab = "enrichment",
}: OutreachHubProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [enrichmentLeads, setEnrichmentLeads] = useState<PreSendLead[]>(initialEnrichmentLeads);
  const [qualificationLeads, setQualificationLeads] = useState<PreSendLead[]>(initialQualificationLeads);
  const [readyLeads, setReadyLeads] = useState<PreSendLead[]>(initialReadyLeads);
  const [automationOverview, setAutomationOverview] = useState(initialAutomationOverview);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [sendingLeadIds, setSendingLeadIds] = useState<number[] | null>(null);

  useEffect(() => {
    fetch("/api/outreach/gmail/status")
      .then((res) => res.json())
      .then((data) => setGmailConnected(data.connected === true))
      .catch(() => {});
  }, []);

  const refreshEnrichmentStage = useCallback(async () => {
    try {
      const [enrichmentRes, qualificationRes, initialRes, automationRes] = await Promise.all([
        fetch("/api/outreach/enrichment-stage"),
        fetch("/api/outreach/qualification-stage"),
        fetch("/api/outreach/pipeline"),
        fetch("/api/outreach/automation/overview"),
      ]);

      if (enrichmentRes.ok) {
        const data = await enrichmentRes.json();
        setEnrichmentLeads(data.leads || []);
      }
      if (qualificationRes.ok) {
        const data = await qualificationRes.json();
        setQualificationLeads(data.leads || []);
      }
      if (initialRes.ok) {
        const data = await initialRes.json();
        setReadyLeads(data.leads || []);
      }
      if (automationRes.ok) {
        const data = await automationRes.json();
        setAutomationOverview(data);
      }
    } catch {
      // Keep current state if refresh fails.
    }
  }, []);

  const handleEnrichRequested = useCallback(
    async (leadIds: number[]) => {
      try {
        const res = await fetch("/api/outreach/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Enrichment failed");
        }

        toast(`Enriched ${data?.enriched || leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`, {
          type: "success",
          icon: "note",
        });
        await refreshEnrichmentStage();
      } catch (error) {
        toast(error instanceof Error ? error.message : "Enrichment failed", {
          type: "error",
          icon: "note",
        });
      }
    },
    [refreshEnrichmentStage, toast],
  );

  const handleSendRequested = useCallback((leadIds: number[]) => {
    setSendingLeadIds(leadIds);
  }, []);

  const handleSendComplete = useCallback(
    async () => {
      setSendingLeadIds(null);
      toast("First touch sent. This lead is now managed in Follow-Up.", {
        type: "success",
        icon: "note",
      });
      await refreshEnrichmentStage();
    },
    [refreshEnrichmentStage, toast],
  );

  const handleQueueRequested = useCallback(
    async (leadIds: number[]) => {
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
          ? `Queued ${queued} first-touch lead${queued === 1 ? "" : "s"}${skipped > 0 ? `, skipped ${skipped}` : ""}`
          : `No leads were queued${skipped > 0 ? `, skipped ${skipped}` : ""}`,
        { type: queued > 0 ? "success" : "error", icon: "note" },
      );
      await refreshEnrichmentStage();
    },
    [refreshEnrichmentStage, toast],
  );

  const preSendSequences = useMemo(
    () => automationOverview.sequences.filter((sequence) => !sequence.hasSentAnyStep),
    [automationOverview.sequences],
  );

  const tabCounts: Record<Tab, number | null> = {
    enrichment: enrichmentLeads.length,
    qualification: qualificationLeads.length,
    initial: readyLeads.length + preSendSequences.length,
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
              Outreach now owns the full pre-send pipeline
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Move leads from enrichment into qualification, approve only the right records for first-touch, then let Follow-Up automation take over after the first send lands.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                {enrichmentLeads.length} in enrichment
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                {qualificationLeads.length} in qualification
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                {automationOverview.stats.ready} ready for first touch
              </span>
            </div>
          </div>

          <Button asChild className="rounded-full bg-white px-4 text-sm text-black hover:bg-zinc-200">
            <Link href="/automation">
              Open Follow-Up Console
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-2">
        <div className="grid gap-2 md:grid-cols-4">
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
                        tab.id === "enrichment"
                          ? "text-cyan-400"
                          : tab.id === "qualification"
                            ? "text-purple-400"
                            : tab.id === "initial"
                              ? "text-emerald-400"
                              : "text-zinc-300"
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

        {activeTab === "enrichment" && (
          <EnrichmentWorkspace
            leads={enrichmentLeads}
            onEnrichRequested={handleEnrichRequested}
            onOpenQualification={() => setActiveTab("qualification")}
          />
        )}

        {activeTab === "qualification" && (
          <QualificationPanel
            leads={qualificationLeads}
            onRefresh={refreshEnrichmentStage}
            onReEnrich={handleEnrichRequested}
            onOpenEnrichment={() => setActiveTab("enrichment")}
          />
        )}

        {activeTab === "initial" && (
          <InitialOutreachPanel
            leads={readyLeads}
            sequences={preSendSequences}
            gmailConnected={gmailConnected}
            onSendRequested={handleSendRequested}
            onQueueRequested={handleQueueRequested}
            onRefresh={refreshEnrichmentStage}
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

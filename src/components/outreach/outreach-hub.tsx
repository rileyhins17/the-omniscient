"use client";

import { useCallback, useState } from "react";
import { Bot, Brain, Inbox, MessageSquareText } from "lucide-react";

import { AutomationPanel } from "@/components/outreach/automation-panel";
import { EmailComposer } from "@/components/outreach/email-composer";
import { EmailLogTable } from "@/components/outreach/email-log-table";
import { EnrichmentPanel } from "@/components/outreach/enrichment-panel";
import { GmailConnectCard } from "@/components/outreach/gmail-connect-card";
import { OutreachClient } from "@/components/outreach/outreach-client";
import type { OutreachEditableLead } from "@/components/outreach/outreach-editor-sheet";
import { useToast } from "@/components/ui/toast-provider";

type Tab = "pipeline" | "enriched" | "automation" | "log";

const TAB_CONFIG: Array<{ id: Tab; label: string; icon: typeof MessageSquareText }> = [
  { id: "pipeline", label: "Pipeline", icon: MessageSquareText },
  { id: "enriched", label: "Enriched Leads", icon: Brain },
  { id: "automation", label: "Automation", icon: Bot },
  { id: "log", label: "Email Log", icon: Inbox },
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

type OutreachHubProps = {
  initialPipelineLeads: OutreachEditableLead[];
  initialEnrichedLeads: EnrichedLead[];
  initialAutomationOverview: {
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
      queued: number;
      active: number;
      paused: number;
      stopped: number;
      completed: number;
      replied: number;
    };
  };
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

  // Check Gmail status on mount
  const [gmailChecked, setGmailChecked] = useState(false);
  if (!gmailChecked) {
    setGmailChecked(true);
    fetch("/api/outreach/gmail/status")
      .then((res) => res.json())
      .then((data) => setGmailConnected(data.connected === true))
      .catch(() => {});
  }

  const refreshEnrichedLeads = useCallback(async () => {
    try {
      // Re-fetch enriched leads from the server
      const res = await fetch("/api/outreach/enriched-leads");
      if (res.ok) {
        const data = await res.json();
        setEnrichedLeads(data.leads || []);
      }
    } catch {
      // Silently fail — the page will show stale data
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
      // Silently fail
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
      // Silently fail â€” the page will show stale data
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

        // Switch to enriched tab and refresh
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

  const handleSendComplete = useCallback((sentLeadIds: number[]) => {
    setSendingLeadIds(null);
    if (sentLeadIds.length > 0) {
      setPipelineLeads((prev) => prev.filter((lead) => !sentLeadIds.includes(lead.id)));
    }
    void refreshEnrichedLeads();
    void refreshPipelineLeads();
    void refreshAutomationOverview();
  }, [refreshAutomationOverview, refreshEnrichedLeads, refreshPipelineLeads]);

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

  const queuedLeadIds = [
    ...automationOverview.queued.map((sequence) => sequence.leadId),
    ...automationOverview.active.map((sequence: { leadId: number }) => sequence.leadId),
  ];

  return (
    <div className="space-y-4">
      {/* Gmail Connection */}
      <GmailConnectCard />

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-1">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
              }`}
            >
              <Icon className={`h-4 w-4 ${
                isActive
                  ? tab.id === "pipeline" ? "text-cyan-400" : tab.id === "enriched" ? "text-purple-400" : tab.id === "automation" ? "text-blue-400" : "text-emerald-400"
                  : ""
              }`} />
              {tab.label}
              {tab.id === "enriched" && enrichedLeads.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? "bg-purple-500/20 text-purple-300" : "bg-white/5 text-zinc-600"
                }`}>
                  {enrichedLeads.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
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

        {activeTab === "automation" && (
          <AutomationPanel
            overview={automationOverview}
            onOverviewUpdated={refreshAutomationOverview}
          />
        )}

        {activeTab === "log" && <EmailLogTable />}
      </div>

      {/* Email Composer Dialog */}
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

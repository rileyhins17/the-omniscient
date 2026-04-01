"use client";

import { useMemo, useState } from "react";
import {
  Loader2,
  Mailbox,
  PauseCircle,
  PlayCircle,
  Power,
  RefreshCw,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";

type AutomationLead = {
  id: number;
  businessName: string;
  city: string;
  niche: string;
  email: string | null;
};

type AutomationMailbox = {
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
};

type AutomationSequence = {
  id: string;
  status: string;
  currentStep: string;
  nextScheduledAt: string | null;
  lastSentAt: string | null;
  stopReason: string | null;
  lead?: AutomationLead | null;
  mailbox?: AutomationMailbox | null;
  nextStep?: {
    stepType: string;
    scheduledFor: string;
  } | null;
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
  mailboxes: AutomationMailbox[];
  queued: AutomationSequence[];
  active: AutomationSequence[];
  finished: AutomationSequence[];
  recentRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    sentCount: number;
    failedCount: number;
    claimedCount: number;
  }>;
  stats: {
    queued: number;
    active: number;
    paused: number;
    stopped: number;
    completed: number;
    replied: number;
  };
};

type AutomationPanelProps = {
  overview: AutomationOverview;
  onOverviewUpdated: () => Promise<void>;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AutomationPanel({ overview, onOverviewUpdated }: AutomationPanelProps) {
  const { toast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState(overview.settings);

  const sequenceSections = useMemo(
    () => [
      { title: "Queued", rows: overview.queued },
      { title: "Active", rows: overview.active },
      { title: "Stopped / Completed", rows: overview.finished },
    ],
    [overview],
  );

  const runAction = async (key: string, fn: () => Promise<Response>, successMessage: string) => {
    setBusyKey(key);
    try {
      const res = await fn();
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Automation action failed");
      }
      toast(successMessage, { type: "success", icon: "note" });
      await onOverviewUpdated();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Automation action failed", {
        type: "error",
        icon: "note",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const updateSequence = async (sequenceId: string, action: "pause" | "resume" | "stop" | "remove") => {
    await runAction(
      `${action}:${sequenceId}`,
      () =>
        fetch(`/api/outreach/automation/sequences/${sequenceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }),
      `Sequence ${action}d`,
    );
  };

  const updateMailbox = async (mailboxId: string, status: string) => {
    await runAction(
      `mailbox:${mailboxId}`,
      () =>
        fetch(`/api/outreach/automation/mailboxes/${mailboxId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      `Mailbox set to ${status.toLowerCase()}`,
    );
  };

  const saveSettings = async () => {
    await runAction(
      "settings",
      () =>
        fetch("/api/outreach/automation/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsDraft),
        }),
      "Automation settings updated",
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Automation Control</div>
              <div className="text-xs text-zinc-500">
                Keep the scheduler slow, mailbox-aware, and reply-safe.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void runAction(
                    "sync",
                    () => fetch("/api/outreach/automation/replies/sync", { method: "POST" }),
                    "Reply sync finished",
                  )
                }
                className="gap-1.5 border border-white/10 text-xs text-zinc-300"
              >
                {busyKey === "sync" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Sync Replies
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  void runAction(
                    "run",
                    () => fetch("/api/outreach/automation/run", { method: "POST" }),
                    "Automation scheduler finished",
                  )
                }
                className="gap-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 text-xs font-semibold text-white"
              >
                {busyKey === "run" ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                Run Scheduler Now
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
            {[
              ["Queued", overview.stats.queued],
              ["Active", overview.stats.active],
              ["Paused", overview.stats.paused],
              ["Stopped", overview.stats.stopped],
              ["Completed", overview.stats.completed],
              ["Replied", overview.stats.replied],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
                <div className="mt-1 text-lg font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Global Pause</div>
              <select
                value={settingsDraft.globalPaused ? "paused" : "running"}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({ ...prev, globalPaused: e.target.value === "paused" }))
                }
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                <option value="running">Running</option>
                <option value="paused">Paused</option>
              </select>
            </label>

            <label className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Claim Batch</div>
              <Input
                value={String(settingsDraft.schedulerClaimBatch)}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({ ...prev, schedulerClaimBatch: Number(e.target.value || 0) }))
                }
                className="border-white/10 bg-black/40"
              />
            </label>

            <label className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Initial Delay (min)</div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={String(settingsDraft.initialDelayMinMinutes)}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({ ...prev, initialDelayMinMinutes: Number(e.target.value || 0) }))
                  }
                  className="border-white/10 bg-black/40"
                />
                <Input
                  value={String(settingsDraft.initialDelayMaxMinutes)}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({ ...prev, initialDelayMaxMinutes: Number(e.target.value || 0) }))
                  }
                  className="border-white/10 bg-black/40"
                />
              </div>
            </label>

            <label className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Follow-Ups (days)</div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={String(settingsDraft.followUp1BusinessDays)}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({ ...prev, followUp1BusinessDays: Number(e.target.value || 0) }))
                  }
                  className="border-white/10 bg-black/40"
                />
                <Input
                  value={String(settingsDraft.followUp2BusinessDays)}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({ ...prev, followUp2BusinessDays: Number(e.target.value || 0) }))
                  }
                  className="border-white/10 bg-black/40"
                />
              </div>
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              onClick={() => void saveSettings()}
              className="gap-1.5 bg-white text-black hover:bg-zinc-200"
            >
              {busyKey === "settings" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
              Save Settings
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Mailbox className="h-4 w-4 text-cyan-400" />
            <div className="text-sm font-semibold text-white">Mailbox Pool</div>
          </div>
          <div className="space-y-3">
            {overview.mailboxes.map((mailbox) => (
              <div key={mailbox.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-white">{mailbox.label || mailbox.gmailAddress}</div>
                    <div className="font-mono text-[11px] text-cyan-300">{mailbox.gmailAddress}</div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                    {mailbox.status}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
                  <span>Today: {mailbox.sentToday}/{mailbox.dailyLimit}</span>
                  <span>Hour: {mailbox.sentThisHour}/{mailbox.hourlyLimit}</span>
                  <span>TZ: {mailbox.timezone}</span>
                  <span>Warmup: {mailbox.warmupLevel}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void updateMailbox(mailbox.id, mailbox.status === "PAUSED" ? "ACTIVE" : "PAUSED")}
                    className="h-7 gap-1.5 border border-white/10 px-2 text-[11px] text-zinc-300"
                  >
                    {busyKey === `mailbox:${mailbox.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : mailbox.status === "PAUSED" ? <PlayCircle className="h-3 w-3" /> : <PauseCircle className="h-3 w-3" />}
                    {mailbox.status === "PAUSED" ? "Resume" : "Pause"}
                  </Button>
                </div>
              </div>
            ))}
            {overview.mailboxes.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-zinc-500">
                Connect Gmail mailboxes to activate automation.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sequenceSections.map((section) => (
          <div key={section.title} className="rounded-xl border border-white/[0.06] bg-black/25 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-white">{section.title}</div>
              <div className="text-[11px] text-zinc-500">{section.rows.length} sequences</div>
            </div>
            <div className="space-y-2">
              {section.rows.map((sequence) => (
                <div key={sequence.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{sequence.lead?.businessName || `Lead #${sequence.id}`}</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                          {sequence.status}
                        </span>
                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                          {sequence.currentStep}
                        </span>
                        {sequence.stopReason && (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            {sequence.stopReason}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                        <span>{sequence.lead?.email || "No email"}</span>
                        <span>Mailbox: {sequence.mailbox?.gmailAddress || "Unassigned"}</span>
                        <span>Next: {formatDateTime(sequence.nextScheduledAt || sequence.nextStep?.scheduledFor)}</span>
                        <span>Last sent: {formatDateTime(sequence.lastSentAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sequence.status !== "PAUSED" && sequence.status !== "STOPPED" && sequence.status !== "COMPLETED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void updateSequence(sequence.id, "pause")}
                          className="h-7 gap-1.5 border border-white/10 px-2 text-[11px] text-zinc-300"
                        >
                          {busyKey === `pause:${sequence.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <PauseCircle className="h-3 w-3" />}
                          Pause
                        </Button>
                      )}
                      {sequence.status === "PAUSED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void updateSequence(sequence.id, "resume")}
                          className="h-7 gap-1.5 border border-white/10 px-2 text-[11px] text-zinc-300"
                        >
                          {busyKey === `resume:${sequence.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                          Resume
                        </Button>
                      )}
                      {sequence.status !== "STOPPED" && sequence.status !== "COMPLETED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void updateSequence(sequence.id, "stop")}
                          className="h-7 gap-1.5 border border-red-500/20 px-2 text-[11px] text-red-300 hover:bg-red-500/10"
                        >
                          {busyKey === `stop:${sequence.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                          Stop
                        </Button>
                      )}
                      {sequence.status === "QUEUED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void updateSequence(sequence.id, "remove")}
                          className="h-7 gap-1.5 border border-amber-500/20 px-2 text-[11px] text-amber-300 hover:bg-amber-500/10"
                        >
                          {busyKey === `remove:${sequence.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {section.rows.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-zinc-500">
                  No sequences in this bucket yet.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

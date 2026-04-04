import { create } from "zustand";

import { type QueueItem } from "@/components/hunt/queue-summary";
import { type LogEntry } from "@/components/hunt/terminal-panel";
import { hasValidPipelineEmail } from "@/lib/lead-qualification";
import { type ScrapeJobEventPayload } from "@/lib/scrape-jobs";
import { formatAppTime } from "@/lib/time";

import { applyParseResult, createInitialState, type HuntSessionState } from "./hunt-session-store";
import { parseSSELine } from "./sse-parser";

type BufferedEvent = { message: string; data: ScrapeJobEventPayload };
type RemoteJobEventsResponse = {
  events?: Array<{
    createdAt: string;
    eventId: number;
    eventType: string;
    payload: ScrapeJobEventPayload;
  }>;
  job?: {
    city: string;
    errorMessage: string | null;
    finishedAt: string | null;
    heartbeatAt: string | null;
    id: string;
    maxDepth: number;
    niche: string;
    radius: string;
    stats?: {
      avgScore?: number;
      leadsFound?: number;
      withEmail?: number;
      [key: string]: unknown;
    } | null;
    status: string;
  };
};

const REMEMBERED_REMOTE_JOB_KEY = "axiom.lead-generator.remote-job-id";

export interface LiveScoreSnapshot {
  axiomScore: number;
  businessName: string;
  breakdown: Record<string, unknown>;
  emailGateApplied: boolean;
  fitLabel: string;
  hasValidEmail: boolean;
  outreachEligible: boolean;
  reasonSummary: string[];
  tier: string;
  websiteLabel: string;
  websiteQuality: string;
  websiteStatus: string;
}

interface LaunchTargetInput {
  niche: string;
  city: string;
  radius: string;
  maxDepth: string;
}

interface CancelOptions {
  interrupted?: boolean;
  reason?: string;
}

interface HuntStore {
  queue: QueueItem[];
  session: HuntSessionState;
  loading: boolean;
  currentJobId: string | null;
  currentRemoteJobId: string | null;
  logs: LogEntry[];
  elapsed: number;
  totalStats: { leadsFound: number; withEmail: number };
  latestScore: LiveScoreSnapshot | null;
  scorePulseAt: number | null;
  activeWebsiteUrl: string | null;
  activeLeadLabel: string | null;
  latestEmailValidityHint: boolean | null;
  latestWebsiteLabelHint: string | null;

  isPaused: boolean;
  isCanceled: boolean;
  bufferedEvents: BufferedEvent[];
  eventSource: EventSource | null;
  pollInterval: ReturnType<typeof setInterval> | null;
  timerInterval: ReturnType<typeof setInterval> | null;
  lastRemoteEventId: number;
  logIdCounter: number;
  jobStart: number;

  setQueue: (queue: QueueItem[] | ((prev: QueueItem[]) => QueueItem[])) => void;
  addToQueue: (niche: string, city: string, radius: string, maxDepth: string) => void;
  removeFromQueue: (id: string) => void;
  skipJob: (id: string) => void;
  runQueue: () => Promise<void>;
  launchTarget: (target: LaunchTargetInput) => Promise<void>;
  replaceActiveRun: (target: LaunchTargetInput) => Promise<void>;
  hydrateActiveRun: () => Promise<void>;
  handlePause: () => void;
  handleResume: () => void;
  handleCancel: (options?: CancelOptions) => Promise<void>;
  processSSEMessage: (message: string, data: ScrapeJobEventPayload) => void;
  addLogEntry: (message: string, level?: LogEntry["level"]) => void;
  togglePin: (id: number) => void;
}

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readRememberedRemoteJobId() {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(REMEMBERED_REMOTE_JOB_KEY);
  } catch {
    return null;
  }
}

function rememberRemoteJobId(jobId: string | null) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    if (jobId) {
      window.sessionStorage.setItem(REMEMBERED_REMOTE_JOB_KEY, jobId);
    } else {
      window.sessionStorage.removeItem(REMEMBERED_REMOTE_JOB_KEY);
    }
  } catch {
    // Ignore storage failures and continue with in-memory state only.
  }
}

function createQueueItem(target: LaunchTargetInput): QueueItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    jobId: null,
    city: target.city,
    maxDepth: target.maxDepth,
    niche: target.niche,
    radius: target.radius,
    status: "pending",
  };
}

function mapRemoteStatus(status: string): QueueItem["status"] {
  switch (status) {
    case "claimed":
      return "claimed";
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    default:
      return "pending";
  }
}

function applyRemoteJobUpdate(queue: QueueItem[], data: ScrapeJobEventPayload): QueueItem[] {
  if (!data?.jobId || !data?.jobStatus) {
    return queue;
  }

  const nextStatus = mapRemoteStatus(String(data.jobStatus));
  const nextStats =
    data.stats && typeof data.stats === "object"
      ? {
          avgScore: Number(data.stats.avgScore || 0),
          leadsFound: Number(data.stats.leadsFound || 0),
          withEmail: Number(data.stats.withEmail || 0),
        }
      : undefined;

  return queue.map((item) =>
    item.jobId === data.jobId
      ? {
          ...item,
          status: nextStatus,
          stats: nextStats ? { ...item.stats, ...nextStats } : item.stats,
        }
      : item,
  );
}

function scoreFromPayload(data: ScrapeJobEventPayload): LiveScoreSnapshot | null {
  if (!data.scoreUpdate || typeof data.scoreUpdate !== "object") {
    return null;
  }

  const score = data.scoreUpdate as Record<string, unknown>;
  return {
    axiomScore: Number(score.axiomScore || 0),
    breakdown: (score.breakdown as Record<string, unknown>) || {},
    businessName: String(score.businessName || "Unknown lead"),
    emailGateApplied: Boolean(score.emailGateApplied),
    fitLabel: String(score.fitLabel || "Weak"),
    hasValidEmail: Boolean(score.hasValidEmail),
    outreachEligible: Boolean(score.outreachEligible),
    reasonSummary: Array.isArray(score.reasonSummary)
      ? score.reasonSummary.map((entry) => String(entry))
      : [],
    tier: String(score.tier || "D"),
    websiteLabel: String(score.websiteLabel || "Unknown Website"),
    websiteQuality: String(score.websiteQuality || "WEAK_WEBSITE"),
    websiteStatus: String(score.websiteStatus || "UNKNOWN"),
  };
}

function scoreFromMessage(
  message: string,
  previous: LiveScoreSnapshot | null,
  hints?: {
    hasValidEmail?: boolean | null;
    websiteLabel?: string | null;
  },
): LiveScoreSnapshot | null {
  if (!message.includes("[SCORE]")) {
    return null;
  }

  const scoreMatch = message.match(/\[SCORE\]\s+(\d+)\/100/);
  const tierMatch = message.match(/\[([SABCD])\]/);
  const businessNameMatch = message.match(/-\s(.+)$/);
  if (!scoreMatch || !tierMatch || !businessNameMatch) {
    return null;
  }

  const score = Number(scoreMatch[1]);
  const gradeMatch = message.match(/Grade:\s*([A-F])/i);
  const websiteLabel = message.includes("No Website")
    ? "No Website"
    : gradeMatch
      ? ["A", "B"].includes(gradeMatch[1].toUpperCase())
        ? "Strong Website"
        : "Weak Website"
      : hints?.websiteLabel ?? previous?.websiteLabel ?? "Weak Website";
  const hasValidEmail = message.includes("Pipeline Ready")
    ? true
    : message.includes("Email Gated")
      ? false
      : hints?.hasValidEmail ?? previous?.hasValidEmail ?? false;

  return {
    axiomScore: score,
    breakdown: previous?.breakdown || {},
    businessName: businessNameMatch[1].trim(),
    emailGateApplied: !hasValidEmail && score >= 35,
    fitLabel:
      score >= 70 && hasValidEmail
        ? "Pipeline Ready"
        : score >= 60
          ? "Strong"
          : score >= 35
            ? "Promising"
            : "Weak",
    hasValidEmail,
    outreachEligible: hasValidEmail && score > 35,
    reasonSummary: previous?.reasonSummary || [],
    tier: tierMatch[1],
    websiteLabel,
    websiteQuality:
      websiteLabel === "No Website"
        ? "NO_WEBSITE"
        : websiteLabel === "Strong Website"
          ? "STRONG_WEBSITE"
          : "WEAK_WEBSITE",
    websiteStatus: websiteLabel === "No Website" ? "MISSING" : "ACTIVE",
  };
}

function getLeadHintsFromMessage(message: string) {
  if (message.includes("[ENRICH]")) {
    return {
      hasValidEmail: null as boolean | null,
      reset: true,
      websiteLabel: null as string | null,
    };
  }

  const emailFinalMatch = message.match(
    /\[EMAIL\]\s+Final\s+(.+?)\s+\|\s+type=([a-z_]+)\s+\|\s+confidence=([0-9.]+)/i,
  );
  if (emailFinalMatch) {
    const email = emailFinalMatch[1].trim();
    const emailType = emailFinalMatch[2].trim().toLowerCase();
    const emailConfidence = Number(emailFinalMatch[3]);

    return {
      hasValidEmail:
        email !== "none" &&
        hasValidPipelineEmail({
          email,
          emailConfidence,
          emailType,
        }),
      reset: false,
      websiteLabel: null as string | null,
    };
  }

  if (message.includes("[WEB] No website")) {
    return {
      hasValidEmail: null as boolean | null,
      reset: false,
      websiteLabel: "No Website",
    };
  }

  if (message.includes("[WEB] Deep scan")) {
    return {
      hasValidEmail: null as boolean | null,
      reset: false,
      websiteLabel: "Weak Website",
    };
  }

  return {
    hasValidEmail: null as boolean | null,
    reset: false,
    websiteLabel: null as string | null,
  };
}

function getActiveContextFromMessage(message: string) {
  const enrichMatch = message.match(/\[ENRICH\]\s+\d+\/\d+\s+(.+)$/);
  if (enrichMatch) {
    return {
      activeLeadLabel: enrichMatch[1].trim(),
      activeWebsiteUrl: "",
    };
  }

  const urlMatch = message.match(/https?:\/\/\S+/);
  if (urlMatch && (message.includes("[WEB]") || message.includes("[EMAIL]"))) {
    return {
      activeLeadLabel: null,
      activeWebsiteUrl: urlMatch[0].replace(/[)\]]+$/, ""),
    };
  }

  return {
    activeLeadLabel: null,
    activeWebsiteUrl: null,
  };
}

export const useHuntStore = create<HuntStore>((set, get) => {
  const stopPolling = () => {
    const currentPoll = get().pollInterval;
    if (currentPoll) {
      clearInterval(currentPoll);
      set({ pollInterval: null });
    }
  };

  const stopLiveConnections = () => {
    stopPolling();
    const currentEventSource = get().eventSource;
    if (currentEventSource) {
      currentEventSource.close();
      set({ eventSource: null });
    }
  };

  const applyRemoteEvents = (events: RemoteJobEventsResponse["events"]) => {
    if (!Array.isArray(events) || events.length === 0) {
      return;
    }

    for (const event of events) {
      const payload = (event.payload || {}) as ScrapeJobEventPayload;
      const message = String(payload.message || "");
      if (message) {
        get().processSSEMessage(message, payload);
      } else if (payload.error) {
        get().processSSEMessage(`[!!!] ERROR: ${String(payload.error)}`, payload);
      }

      if (typeof event.eventId === "number" && event.eventId > get().lastRemoteEventId) {
        set((state) => ({
          lastRemoteEventId: Math.max(state.lastRemoteEventId, event.eventId),
        }));
      }
    }
  };

  const syncJobSnapshot = (job: RemoteJobEventsResponse["job"]) => {
    if (!job) {
      return false;
    }

    const stats = job.stats || {};
    if (job.status === "completed") {
      set((state) => ({
        queue: state.queue.map((item) => ({ ...item, status: "completed" })),
        session: { ...state.session, status: "completed", stage: "done" },
        totalStats: {
          leadsFound: Number(stats.leadsFound || state.totalStats.leadsFound || 0),
          withEmail: Number(stats.withEmail || state.totalStats.withEmail || 0),
        },
      }));
      rememberRemoteJobId(null);
      return true;
    }

    if (job.status === "failed") {
      const message = job.errorMessage || "Scrape failed.";
      get().processSSEMessage(`[!!!] ERROR: ${message}`, {
        error: message,
        jobId: job.id,
        jobStatus: "failed",
      });
      set((state) => ({
        session: { ...state.session, status: "interrupted", stage: "idle" },
      }));
      rememberRemoteJobId(null);
      return true;
    }

    if (job.status === "canceled") {
      get().processSSEMessage(job.errorMessage || "[JOB] Canceled", {
        jobId: job.id,
        jobStatus: "canceled",
        message: job.errorMessage || "[JOB] Canceled",
      });
      set((state) => ({
        session: { ...state.session, status: "interrupted", stage: "idle" },
      }));
      rememberRemoteJobId(null);
      return true;
    }

    set((state) => ({
      queue: state.queue.map((item) =>
        item.jobId === job.id
          ? { ...item, status: job.status === "claimed" ? "claimed" : job.status === "running" ? "running" : "pending" }
          : item,
      ),
      totalStats: {
        leadsFound: Number(stats.leadsFound || state.totalStats.leadsFound || 0),
        withEmail: Number(stats.withEmail || state.totalStats.withEmail || 0),
      },
    }));
    return false;
  };

  const pollRemoteEvents = async (jobId: string) => {
    const response = await fetch(`/api/scrape/jobs/${jobId}/events?after=${get().lastRemoteEventId}`, {
      cache: "no-store",
    }).catch(() => null);

    if (!response?.ok) {
      return false;
    }

    const payload = (await response.json().catch(() => null)) as RemoteJobEventsResponse | null;
    if (!payload) {
      return false;
    }

    applyRemoteEvents(payload.events);
    return syncJobSnapshot(payload.job);
  };

  const startRemotePolling = (jobId: string) => {
    stopPolling();

    const pump = async () => {
      const finished = await pollRemoteEvents(jobId).catch(() => false);
      if (finished) {
        stopPolling();
      }
    };

    void pump();
    const poller = setInterval(() => {
      void pump();
    }, 1200);

    set({ pollInterval: poller });
  };

  const runSingleTarget = async (target: LaunchTargetInput) => {
    const job = createQueueItem(target);
    let runFailed = false;

    stopLiveConnections();
    if (get().timerInterval) {
      clearInterval(get().timerInterval!);
    }

    const timer = setInterval(() => {
      set((state) => ({ elapsed: state.elapsed + 1 }));
    }, 1000);

    set((state) => ({
      bufferedEvents: [],
      currentJobId: job.id,
      currentRemoteJobId: null,
      elapsed: 0,
      eventSource: null,
      isCanceled: false,
      isPaused: false,
      jobStart: Date.now(),
      loading: true,
      logs: [],
      activeLeadLabel: null,
      activeWebsiteUrl: null,
      latestEmailValidityHint: null,
      latestWebsiteLabelHint: null,
      lastRemoteEventId: 0,
      latestScore: null,
      queue: [job],
      scorePulseAt: null,
      session: {
        ...createInitialState(),
        currentJob: {
          city: target.city,
          index: 1,
          niche: target.niche,
          startedAt: Date.now(),
          total: 1,
        },
        lastEvent: `Launching ${target.niche} in ${target.city}`,
        stage: "extracting",
        status: "running",
      },
      timerInterval: timer,
      totalStats: { leadsFound: 0, withEmail: 0 },
    }));

    get().addLogEntry(`[JOB] Launching ${target.niche} in ${target.city}`, "system");

    try {
      const createResponse = await fetch("/api/scrape", {
        body: JSON.stringify({
          city: target.city,
          maxDepth: target.maxDepth,
          niche: target.niche,
          radius: target.radius,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const createBody = (await createResponse.json().catch(() => ({}))) as {
        error?: string;
        job?: { id?: string };
      };
      if (!createResponse.ok || !createBody.job?.id) {
        throw new Error(createBody.error || "Failed to create job.");
      }

      const remoteJobId = createBody.job.id;
      rememberRemoteJobId(remoteJobId);
      set((state) => ({
        currentRemoteJobId: remoteJobId,
        queue: state.queue.map((item) =>
          item.id === job.id ? { ...item, jobId: remoteJobId, status: "pending" } : item,
        ),
      }));
      startRemotePolling(remoteJobId);

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let disconnectNotified = false;

        const finish = (result: "resolve" | "reject", error?: unknown) => {
          if (settled) return;
          settled = true;
          stopLiveConnections();
          if (result === "resolve") resolve();
          else reject(error);
        };

        const eventSource = new EventSource(`/api/scrape/jobs/${remoteJobId}/stream`);
        set({ eventSource });

        eventSource.onopen = () => {
          if (disconnectNotified) {
            get().addLogEntry("[JOB] Stream reconnected.", "system");
          }
          disconnectNotified = false;
        };

        eventSource.onmessage = (event) => {
          if (settled) return;

          const current = get();
          if (current.isCanceled) {
            finish("reject", new Error("canceled"));
            return;
          }

          const data = JSON.parse(event.data) as ScrapeJobEventPayload;
          const message = String(data.message || "");

          if (data.error) {
            const errorMessage = `[!!!] ERROR: ${data.error}`;
            if (current.isPaused) {
              set((state) => ({
                bufferedEvents: [...state.bufferedEvents, { data, message: errorMessage }],
              }));
            } else {
              current.processSSEMessage(errorMessage, data);
            }

            set((state) => ({
              queue: state.queue.map((item) =>
                item.id === job.id ? { ...item, status: "failed" } : item,
              ),
            }));
            finish("reject", new Error(String(data.error)));
            return;
          }

          if (data.jobStatus === "canceled") {
            current.processSSEMessage(message || "[JOB] Canceled", data);
            set((state) => ({
              queue: state.queue.map((item) =>
                item.id === job.id ? { ...item, status: "canceled" } : item,
              ),
            }));
            finish("resolve");
            return;
          }

          if (data._done) {
            const jobStats = data.stats || { leadsFound: 0, withEmail: 0 };
            set((state) => ({
              queue: state.queue.map((item) =>
                item.id === job.id
                  ? {
                      ...item,
                      status: "completed",
                      stats: {
                        avgScore: Number(jobStats.avgScore || 0),
                        leadsFound: Number(jobStats.leadsFound || 0),
                        withEmail: Number(jobStats.withEmail || 0),
                      },
                    }
                  : item,
              ),
              totalStats: {
                leadsFound: Number(jobStats.leadsFound || 0),
                withEmail: Number(jobStats.withEmail || 0),
              },
            }));
            finish("resolve");
            return;
          }

          if (current.isPaused) {
            set((state) => ({
              bufferedEvents: [...state.bufferedEvents, { data, message }],
            }));
          } else {
            current.processSSEMessage(message, data);
          }
        };

        eventSource.onerror = () => {
          if (settled) return;

          if (get().isCanceled) {
            finish("resolve");
            return;
          }

          if (!disconnectNotified) {
            disconnectNotified = true;
            get().processSSEMessage("[JOB] SSE stream disconnected. Waiting to reconnect...", {});
          }
        };
      });
    } catch (error) {
      runFailed = true;
      if (!get().isCanceled) {
        const message = error instanceof Error ? error.message : "Unknown job error";
        get().processSSEMessage(`[!!!] ERROR: ${message}`, {
          error: message,
          jobId: get().currentRemoteJobId || undefined,
          jobStatus: "failed",
        });
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === job.id ? { ...item, status: "failed" } : item,
          ),
          session: {
            ...state.session,
            stage: "idle",
            lastEvent: message,
            status: "interrupted",
          },
        }));
      }
    } finally {
      const finalState = get();
      if (finalState.timerInterval) {
        clearInterval(finalState.timerInterval);
      }
      stopLiveConnections();

      set({
        currentJobId: null,
        currentRemoteJobId: null,
        eventSource: null,
        loading: false,
        pollInterval: null,
        timerInterval: null,
      });

      if (!finalState.isCanceled && !runFailed) {
        rememberRemoteJobId(null);
        set((state) => ({
          session: { ...state.session, status: "completed", stage: "done" },
        }));
        get().addLogEntry("[DONE] Lead generation complete.", "ok");
      }
    }
  };

  return {
    queue: [],
    session: createInitialState(),
    loading: false,
    currentJobId: null,
    currentRemoteJobId: null,
    logs: [],
    elapsed: 0,
    totalStats: { leadsFound: 0, withEmail: 0 },
    latestScore: null,
    scorePulseAt: null,
    activeWebsiteUrl: null,
    activeLeadLabel: null,
    latestEmailValidityHint: null,
    latestWebsiteLabelHint: null,

    isPaused: false,
    isCanceled: false,
    bufferedEvents: [],
    eventSource: null,
    pollInterval: null,
    timerInterval: null,
    lastRemoteEventId: 0,
    logIdCounter: 0,
    jobStart: 0,

    setQueue: (action) => {
      set((state) => ({
        queue: typeof action === "function" ? action(state.queue) : action,
      }));
    },

    addToQueue: (niche, city, radius, maxDepth) => {
      set({
        queue: [createQueueItem({ city, maxDepth, niche, radius })],
      });
    },

    removeFromQueue: (id) => {
      set((state) => ({ queue: state.queue.filter((item) => item.id !== id) }));
    },

    skipJob: (id) => {
      set((state) => ({
        queue: state.queue.map((item) =>
          item.id === id ? { ...item, status: "canceled" } : item,
        ),
      }));
    },

    addLogEntry: (message, level = "default") => {
      set((state) => {
        const nextId = state.logIdCounter + 1;
        const entry: LogEntry = {
          id: nextId,
          level,
          message,
          pinned: false,
          timestamp: formatAppTime(new Date()),
        };

        return { logIdCounter: nextId, logs: [...state.logs, entry] };
      });
    },

    togglePin: (id) => {
      set((state) => ({
        logs: state.logs.map((entry) =>
          entry.id === id ? { ...entry, pinned: !entry.pinned } : entry,
        ),
      }));
    },

    processSSEMessage: (message, data) => {
      if (typeof data.eventId === "number" && data.eventId <= get().lastRemoteEventId) {
        return;
      }

      const parsed = parseSSELine(message);
      const payloadScore = scoreFromPayload(data);
      const leadHints = getLeadHintsFromMessage(message);
      const liveScore =
        payloadScore ??
        scoreFromMessage(message, get().latestScore, {
          hasValidEmail: leadHints.hasValidEmail ?? get().latestEmailValidityHint,
          websiteLabel: leadHints.websiteLabel ?? get().latestWebsiteLabelHint,
        });
      const activeContext = getActiveContextFromMessage(message);
      get().addLogEntry(message, parsed.level);

      set((state) => ({
        activeLeadLabel: activeContext.activeLeadLabel ?? state.activeLeadLabel,
        activeWebsiteUrl: activeContext.activeWebsiteUrl ?? state.activeWebsiteUrl,
        latestEmailValidityHint: payloadScore
          ? payloadScore.hasValidEmail
          : leadHints.reset
            ? null
            : leadHints.hasValidEmail ?? state.latestEmailValidityHint,
        latestWebsiteLabelHint: payloadScore
          ? payloadScore.websiteLabel
          : leadHints.reset
            ? null
            : leadHints.websiteLabel ?? state.latestWebsiteLabelHint,
        lastRemoteEventId:
          typeof data.eventId === "number"
            ? Math.max(state.lastRemoteEventId, data.eventId)
            : state.lastRemoteEventId,
        latestScore: liveScore ?? state.latestScore,
        scorePulseAt: liveScore ? Date.now() : state.scorePulseAt,
        queue: applyRemoteJobUpdate(state.queue, data),
        session: applyParseResult(state.session, parsed, message),
        totalStats:
          data.stats && typeof data.stats === "object"
            ? {
                leadsFound: Number(data.stats.leadsFound || state.totalStats.leadsFound || 0),
                withEmail: Number(data.stats.withEmail || state.totalStats.withEmail || 0),
              }
            : state.totalStats,
      }));
    },

    handlePause: () => {
      set((state) => ({
        isPaused: true,
        session: { ...state.session, status: "paused" },
      }));
    },

    handleResume: () => {
      const { bufferedEvents, processSSEMessage } = get();
      set((state) => ({
        bufferedEvents: [],
        isPaused: false,
        session: { ...state.session, status: "running" },
      }));

      for (const item of bufferedEvents) {
        processSSEMessage(item.message, item.data);
      }
    },

    handleCancel: async (options = {}) => {
      const reason = options.reason || "Canceled by operator.";
      const current = get();

      stopLiveConnections();

      if (current.timerInterval) {
        clearInterval(current.timerInterval);
      }

      set((state) => ({
        currentRemoteJobId: null,
        eventSource: null,
        isCanceled: true,
        loading: false,
        timerInterval: null,
        session: {
          ...state.session,
          lastEvent: options.interrupted
            ? "Run interrupted. Partial results already written to Vault."
            : reason,
          stage: "idle",
          status: options.interrupted ? "interrupted" : "canceled",
        },
        queue: state.currentJobId
          ? state.queue.map((item) =>
              item.id === state.currentJobId ? { ...item, status: "canceled" } : item,
            )
          : state.queue,
      }));

      if (current.currentRemoteJobId) {
        await fetch(`/api/scrape/jobs/${current.currentRemoteJobId}/cancel`, {
          method: "POST",
        }).catch(() => undefined);
      }

      rememberRemoteJobId(null);
    },

    runQueue: async () => {
      const nextPending = get().queue.find((item) => item.status === "pending");
      if (!nextPending) return;

      await runSingleTarget({
        city: nextPending.city,
        maxDepth: nextPending.maxDepth,
        niche: nextPending.niche,
        radius: nextPending.radius,
      });
    },

    launchTarget: async (target) => {
      if (get().loading) return;
      await runSingleTarget(target);
    },

    replaceActiveRun: async (target) => {
      await get().handleCancel({
        interrupted: true,
        reason: "Replaced by a new launch target.",
      });
      get().addLogEntry(
        "[JOB] Previous run interrupted. Partial results remain saved and a new target is launching.",
        "warn",
      );
      await runSingleTarget(target);
    },

    hydrateActiveRun: async () => {
      if (get().loading || get().eventSource || get().pollInterval) {
        return;
      }

      const response = await fetch("/api/scrape/jobs?limit=5", {
        cache: "no-store",
      }).catch(() => null);

      if (!response?.ok) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | {
            jobs?: Array<{
              id: string;
              city: string;
              niche: string;
              radius: string;
              maxDepth: number;
              status: string;
            }>;
          }
        | null;

      const rememberedJobId = readRememberedRemoteJobId();
      const activeJob =
        payload?.jobs?.find((job) => job.id === rememberedJobId) ??
        payload?.jobs?.find(
          (job) => job.status === "running" || job.status === "claimed" || job.status === "pending",
        );

      if (!activeJob) {
        return;
      }

      const queueItem = {
        id: `hydrate-${activeJob.id}`,
        jobId: activeJob.id,
        city: activeJob.city,
        maxDepth: String(activeJob.maxDepth),
        niche: activeJob.niche,
        radius: activeJob.radius,
        status:
          activeJob.status === "claimed"
            ? "claimed"
            : activeJob.status === "running"
              ? "running"
              : "pending",
      } satisfies QueueItem;

      if (get().timerInterval) {
        clearInterval(get().timerInterval!);
      }

      const timer = setInterval(() => {
        set((state) => ({ elapsed: state.elapsed + 1 }));
      }, 1000);

      set({
        bufferedEvents: [],
        currentJobId: queueItem.id,
        currentRemoteJobId: activeJob.id,
        elapsed: 0,
        eventSource: null,
        isCanceled: false,
        isPaused: false,
        jobStart: Date.now(),
        loading: true,
        logs: [],
        activeLeadLabel: null,
        activeWebsiteUrl: null,
        latestEmailValidityHint: null,
        latestWebsiteLabelHint: null,
        lastRemoteEventId: 0,
        latestScore: null,
        queue: [queueItem],
        scorePulseAt: null,
        session: {
          ...createInitialState(),
          currentJob: {
            city: activeJob.city,
            index: 1,
            niche: activeJob.niche,
            startedAt: Date.now(),
            total: 1,
          },
          lastEvent: `Reconnected to ${activeJob.niche} in ${activeJob.city}`,
          stage: "extracting",
          status: "running",
        },
        timerInterval: timer,
        totalStats: { leadsFound: 0, withEmail: 0 },
      });
      rememberRemoteJobId(activeJob.id);
      startRemotePolling(activeJob.id);

      get().addLogEntry(`[JOB] Reconnected to active run ${activeJob.niche} in ${activeJob.city}`, "system");

      await new Promise<void>((resolve) => {
        let settled = false;
        let disconnectNotified = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          stopLiveConnections();
          resolve();
        };

        const eventSource = new EventSource(`/api/scrape/jobs/${activeJob.id}/stream`);
        set({ eventSource });

        eventSource.onopen = () => {
          if (disconnectNotified) {
            get().addLogEntry("[JOB] Reconnected to live stream.", "system");
          }
          disconnectNotified = false;
        };

        eventSource.onmessage = (event) => {
          if (settled) return;
          const data = JSON.parse(event.data) as ScrapeJobEventPayload;
          const message = String(data.message || "");

          if (data.error) {
            get().processSSEMessage(`[!!!] ERROR: ${data.error}`, data);
            set((state) => ({
              session: { ...state.session, status: "interrupted", stage: "idle" },
            }));
            finish();
            return;
          }

          if (data._done) {
            const stats = data.stats || { leadsFound: 0, withEmail: 0 };
            set((state) => ({
              queue: state.queue.map((item) => ({ ...item, status: "completed" })),
              totalStats: {
                leadsFound: Number(stats.leadsFound || 0),
                withEmail: Number(stats.withEmail || 0),
              },
            }));
            set((state) => ({
              session: { ...state.session, status: "completed", stage: "done" },
            }));
            finish();
            return;
          }

          if (data.jobStatus === "canceled") {
            get().processSSEMessage(message || "[JOB] Canceled", data);
            set((state) => ({
              session: { ...state.session, status: "interrupted", stage: "idle" },
            }));
            finish();
            return;
          }

          get().processSSEMessage(message, data);
        };

        eventSource.onerror = () => {
          if (settled) return;
          if (!disconnectNotified) {
            disconnectNotified = true;
            get().processSSEMessage("[JOB] SSE stream disconnected. Waiting to reconnect...", {});
          }
        };
      });

      const finalState = get();
      if (finalState.timerInterval) {
        clearInterval(finalState.timerInterval);
      }
      stopLiveConnections();

      set({
        currentJobId: null,
        currentRemoteJobId: null,
        eventSource: null,
        loading: false,
        pollInterval: null,
        timerInterval: null,
      });
    },
  };
});

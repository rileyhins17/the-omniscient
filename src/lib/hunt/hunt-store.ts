import { create } from 'zustand';
import { createInitialState, applyParseResult, type HuntSessionState, resetCounters } from './hunt-session-store';
import { type QueueItem } from '@/components/hunt/queue-summary';
import { type LogEntry } from '@/components/hunt/terminal-panel';
import { parseSSELine } from './sse-parser';

interface HuntStore {
    queue: QueueItem[];
    session: HuntSessionState;
    loading: boolean;
    currentJobId: string | null;
    logs: LogEntry[];
    elapsed: number;
    totalStats: { leadsFound: number, withEmail: number };

    isPaused: boolean;
    isCanceled: boolean;
    bufferedEvents: { message: string, data: any }[];
    eventSource: EventSource | null;
    timerInterval: ReturnType<typeof setInterval> | null;
    logIdCounter: number;
    jobStart: number;

    // Actions
    setQueue: (queue: QueueItem[] | ((prev: QueueItem[]) => QueueItem[])) => void;
    addToQueue: (niche: string, city: string, radius: string, maxDepth: string) => void;
    removeFromQueue: (id: string) => void;
    skipJob: (id: string) => void;

    runQueue: () => Promise<void>;
    handlePause: () => void;
    handleResume: () => void;
    handleCancel: () => void;

    processSSEMessage: (message: string, data: any) => void;
    addLogEntry: (message: string, level?: LogEntry['level']) => void;
    togglePin: (id: number) => void;
}

export const useHuntStore = create<HuntStore>((set, get) => ({
    queue: [],
    session: createInitialState(),
    loading: false,
    currentJobId: null,
    logs: [],
    elapsed: 0,
    totalStats: { leadsFound: 0, withEmail: 0 },

    isPaused: false,
    isCanceled: false,
    bufferedEvents: [],
    eventSource: null,
    timerInterval: null,
    logIdCounter: 0,
    jobStart: 0,

    setQueue: (action) => {
        set((state) => ({
            queue: typeof action === "function" ? action(state.queue) : action
        }));
    },

    addToQueue: (niche, city, radius, maxDepth) => {
        const item: QueueItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            niche, city, radius, maxDepth,
            status: "pending"
        };
        set(state => ({ queue: [...state.queue, item] }));
    },

    removeFromQueue: (id) => {
        set(state => ({ queue: state.queue.filter(q => q.id !== id) }));
    },

    skipJob: (id) => {
        set(state => ({ queue: state.queue.map(q => q.id === id ? { ...q, status: "canceled" } : q) }));
    },

    addLogEntry: (message, level = "default") => {
        set(state => {
            const nextId = state.logIdCounter + 1;
            const entry: LogEntry = {
                id: nextId,
                message,
                timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                level,
                pinned: false,
            };
            return { logIdCounter: nextId, logs: [...state.logs, entry] };
        });
    },

    togglePin: (id) => {
        set(state => ({
            logs: state.logs.map(l => l.id === id ? { ...l, pinned: !l.pinned } : l)
        }));
    },

    processSSEMessage: (message, data) => {
        const parsed = parseSSELine(message);
        get().addLogEntry(message, parsed.level);
        set(state => ({ session: applyParseResult(state.session, parsed, message) }));
    },

    handlePause: () => {
        set(state => ({ isPaused: true, session: { ...state.session, status: "paused" } }));
    },

    handleResume: () => {
        const { bufferedEvents, processSSEMessage } = get();
        set(state => ({ isPaused: false, session: { ...state.session, status: "running" }, bufferedEvents: [] }));

        // Flush buffer
        for (const item of bufferedEvents) {
            processSSEMessage(item.message, item.data);
        }
    },

    handleCancel: () => {
        const state = get();
        state.isCanceled = true;
        if (state.eventSource) {
            state.eventSource.close();
        }
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
        }
        set(s => ({
            isCanceled: true,
            eventSource: null,
            loading: false,
            timerInterval: null,
            session: { ...s.session, status: "canceled", stage: "idle" },
            queue: s.currentJobId ? s.queue.map(q => q.id === s.currentJobId ? { ...q, status: "canceled" } : q) : s.queue
        }));
    },

    runQueue: async () => {
        const state = get();
        const pendingJobs = state.queue.filter(q => q.status === "pending");
        if (pendingJobs.length === 0) return;

        // Start timer automatically
        if (state.timerInterval) clearInterval(state.timerInterval);
        const timer = setInterval(() => {
            set(s => ({ elapsed: s.elapsed + 1 }));
        }, 1000);

        set({
            loading: true,
            logs: [],
            totalStats: { leadsFound: 0, withEmail: 0 },
            isCanceled: false,
            isPaused: false,
            bufferedEvents: [],
            session: { ...createInitialState(), status: "running" },
            elapsed: 0,
            timerInterval: timer,
        });

        for (let jobIdx = 0; jobIdx < pendingJobs.length; jobIdx++) {
            if (get().isCanceled) break;

            const job = pendingJobs[jobIdx];
            set(s => ({
                currentJobId: job.id,
                jobStart: Date.now(),
                elapsed: 0,
                session: {
                    ...s.session,
                    status: s.isPaused ? "paused" : "running",
                    stage: "extracting",
                    counters: resetCounters(),
                    currentJob: {
                        niche: job.niche,
                        city: job.city,
                        index: jobIdx + 1,
                        total: pendingJobs.length,
                        startedAt: Date.now(),
                    },
                    lastEvent: `Starting: ${job.niche} in ${job.city}`,
                },
                queue: s.queue.map(q => q.id === job.id ? { ...q, status: "running" } : q)
            }));

            get().addLogEntry(`\n[🚀] ═══════════════════════════════════════════`, "system");
            get().addLogEntry(`[🚀] QUEUE ${jobIdx + 1}/${pendingJobs.length}: ${job.niche} in ${job.city}`, "system");
            get().addLogEntry(`[🚀] ═══════════════════════════════════════════`, "system");

            try {
                await new Promise<void>((resolve, reject) => {
                    const params = new URLSearchParams({ niche: job.niche, city: job.city, radius: job.radius, maxDepth: job.maxDepth });
                    const eventSource = new EventSource(`/api/scrape?${params.toString()}`);

                    set({ eventSource });

                    eventSource.onmessage = (event) => {
                        const cur = get();
                        if (cur.isCanceled) {
                            eventSource.close();
                            reject(new Error("canceled"));
                            return;
                        }

                        const data = JSON.parse(event.data);
                        if (data.error) {
                            const msg = `[!!!] ERROR: ${data.error}`;
                            if (cur.isPaused) {
                                set(s => ({ bufferedEvents: [...s.bufferedEvents, { message: msg, data }] }));
                            } else {
                                cur.processSSEMessage(msg, data);
                            }
                            set(s => ({ queue: s.queue.map(q => q.id === job.id ? { ...q, status: "failed" } : q) }));
                            eventSource.close();
                            reject(new Error(data.error));
                            return;
                        }

                        if (data._done) {
                            const jobStats = data.stats || { leadsFound: 0, withEmail: 0 };
                            set(s => ({
                                queue: s.queue.map(q => q.id === job.id ? {
                                    ...q,
                                    status: "done",
                                    stats: { leadsFound: jobStats.leadsFound, withEmail: jobStats.withEmail, avgScore: jobStats.avgScore || 0 }
                                } : q),
                                totalStats: {
                                    leadsFound: s.totalStats.leadsFound + jobStats.leadsFound,
                                    withEmail: s.totalStats.withEmail + jobStats.withEmail
                                }
                            }));
                            eventSource.close();
                            resolve();
                            return;
                        }

                        const message = data.message || "";
                        if (cur.isPaused) {
                            set(s => ({ bufferedEvents: [...s.bufferedEvents, { message, data }] }));
                        } else {
                            cur.processSSEMessage(message, data);
                        }
                    };

                    eventSource.onerror = () => {
                        const msg = `[!!!] CRITICAL: SSE Connection Dropped.`;
                        get().processSSEMessage(msg, {});
                        set(s => ({ queue: s.queue.map(q => q.id === job.id ? { ...q, status: "failed" } : q) }));
                        eventSource.close();
                        reject(new Error("SSE dropped"));
                    };
                });
            } catch {
                // Ignore job exception, proceed to next
            }
        }

        const finalState = get();
        if (finalState.timerInterval) clearInterval(finalState.timerInterval);

        set({
            currentJobId: null,
            loading: false,
            eventSource: null,
            timerInterval: null
        });

        if (!finalState.isCanceled) {
            set(s => ({ session: { ...s.session, status: "completed", stage: "done" } }));
            get().addLogEntry(`\n[✅] ═══════════════════════════════════════════`, "ok");
            get().addLogEntry(`[✅] ALL QUEUE JOBS COMPLETE`, "ok");
            get().addLogEntry(`[✅] ═══════════════════════════════════════════`, "ok");
        }
    }
}));

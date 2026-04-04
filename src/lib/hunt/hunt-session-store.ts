/**
 * Hunt Session Store — Client-side state for Ops HUD.
 * Manages counters, pipeline stage, pause/resume buffering, and error tracking.
 */

import { type PipelineStage, type CounterKey, type ParseResult } from "./sse-parser";

export interface HuntCounters {
    found: number;
    accepted: number;
    duplicates: number;
    disqualified: number;
    enriched: number;
    callable: number;
    errors: number;
}

export type SessionStatus = "idle" | "running" | "paused" | "canceled" | "completed" | "interrupted";

export interface CurrentJob {
    niche: string;
    city: string;
    index: number;
    total: number;
    startedAt: number; // Date.now()
}

export interface HuntError {
    id: string;
    message: string;
    timestamp: string;
    jobContext: string; // "niche in city"
    rawLine: string;
    resolved: boolean;
}

export interface HuntSessionState {
    status: SessionStatus;
    stage: PipelineStage;
    counters: HuntCounters;
    currentJob: CurrentJob | null;
    errors: HuntError[];
    lastEvent: string | null;
    bufferedEvents: string[];
}

export function createInitialState(): HuntSessionState {
    return {
        status: "idle",
        stage: "idle",
        counters: { found: 0, accepted: 0, duplicates: 0, disqualified: 0, enriched: 0, callable: 0, errors: 0 },
        currentJob: null,
        errors: [],
        lastEvent: null,
        bufferedEvents: [],
    };
}

export function resetCounters(): HuntCounters {
    return { found: 0, accepted: 0, duplicates: 0, disqualified: 0, enriched: 0, callable: 0, errors: 0 };
}

/**
 * Apply a ParseResult to the session state immutably.
 */
export function applyParseResult(state: HuntSessionState, result: ParseResult, rawLine: string): HuntSessionState {
    const next = { ...state };

    // Update stage
    if (result.stage) {
        next.stage = result.stage;
    }

    // Update counters
    if (Object.keys(result.increments).length > 0) {
        next.counters = { ...state.counters };
        for (const [key, val] of Object.entries(result.increments)) {
            const k = key as CounterKey;
            // "found" is absolute from the log, not incremental
            if (k === "found") {
                next.counters[k] = val!;
            } else {
                next.counters[k] = state.counters[k] + (val || 0);
            }
        }
    }

    // Update last event
    if (result.event) {
        next.lastEvent = result.event;
    }

    // Track errors
    if (result.isError && state.currentJob) {
        next.errors = [
            ...state.errors,
            {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                message: result.event || rawLine,
                timestamp: new Date().toISOString(),
                jobContext: `${state.currentJob.niche} in ${state.currentJob.city}`,
                rawLine,
                resolved: false,
            },
        ].slice(-20); // Keep last 20
    }

    // Mark completed
    if (result.isDone) {
        next.stage = "done";
    }

    return next;
}

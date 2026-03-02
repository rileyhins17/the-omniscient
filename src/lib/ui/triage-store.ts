/**
 * Triage Session Store — localStorage persistence for triage mode.
 * Namespace: "omniscient:triage:"
 */

const PREFIX = "omniscient:triage:";

function get<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function set<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { }
}

// ═══════════════════════════════════════════════
// FILTERS
// ═══════════════════════════════════════════════
export interface TriageFilters {
    tiers: string[];
    noWebsite: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
    minRating: number;
    city: string;
    niche: string;
}

export const DEFAULT_FILTERS: TriageFilters = {
    tiers: ["S", "A", "B"],
    noWebsite: false,
    hasEmail: false,
    hasPhone: false,
    minRating: 0,
    city: "",
    niche: "",
};

export function getTriageFilters(): TriageFilters {
    return get<TriageFilters>("filters", DEFAULT_FILTERS);
}

export function setTriageFilters(filters: TriageFilters): void {
    set("filters", filters);
}

// ═══════════════════════════════════════════════
// CURRENT INDEX
// ═══════════════════════════════════════════════
export function getTriageIndex(): number {
    return get<number>("index", 0);
}

export function setTriageIndex(index: number): void {
    set("index", index);
}

// ═══════════════════════════════════════════════
// ACTION HISTORY (for undo)
// ═══════════════════════════════════════════════
export type TriageAction = "keep" | "archive" | "call_now" | "follow_up";

export interface TriageHistoryEntry {
    leadId: number;
    action: TriageAction;
    timestamp: string;
    previousIndex: number;
}

export function getTriageHistory(): TriageHistoryEntry[] {
    return get<TriageHistoryEntry[]>("history", []);
}

export function pushTriageHistory(entry: TriageHistoryEntry): void {
    const history = getTriageHistory();
    history.push(entry);
    // Keep last 100 entries max
    set("history", history.slice(-100));
}

export function popTriageHistory(): TriageHistoryEntry | null {
    const history = getTriageHistory();
    if (history.length === 0) return null;
    const entry = history.pop()!;
    set("history", history);
    return entry;
}

// ═══════════════════════════════════════════════
// FOLLOW-UP LIST
// ═══════════════════════════════════════════════
export interface FollowUpEntry {
    leadId: number;
    timestamp: string;
}

export function getFollowUpList(): FollowUpEntry[] {
    return get<FollowUpEntry[]>("followUpList", []);
}

export function addToFollowUp(leadId: number): FollowUpEntry[] {
    const list = getFollowUpList();
    if (!list.some(e => e.leadId === leadId)) {
        list.push({ leadId, timestamp: new Date().toISOString() });
        set("followUpList", list);
    }
    return list;
}

export function removeFromFollowUp(leadId: number): FollowUpEntry[] {
    const list = getFollowUpList().filter(e => e.leadId !== leadId);
    set("followUpList", list);
    return list;
}

// ═══════════════════════════════════════════════
// LOCAL ARCHIVE SET (triage-specific)
// ═══════════════════════════════════════════════
export function getTriageArchived(): number[] {
    return get<number[]>("archivedSet", []);
}

export function addTriageArchived(leadId: number): number[] {
    const s = getTriageArchived();
    if (!s.includes(leadId)) { s.push(leadId); set("archivedSet", s); }
    return s;
}

export function removeTriageArchived(leadId: number): number[] {
    const s = getTriageArchived().filter(id => id !== leadId);
    set("archivedSet", s);
    return s;
}

export function isTriageArchived(leadId: number): boolean {
    return getTriageArchived().includes(leadId);
}

// ═══════════════════════════════════════════════
// SESSION STATS (computed)
// ═══════════════════════════════════════════════
export function getTriageStats() {
    const history = getTriageHistory();
    return {
        kept: history.filter(h => h.action === "keep").length,
        archived: history.filter(h => h.action === "archive").length,
        called: history.filter(h => h.action === "call_now").length,
        followUp: history.filter(h => h.action === "follow_up").length,
        total: history.length,
    };
}

// ═══════════════════════════════════════════════
// RESET SESSION
// ═══════════════════════════════════════════════
export function resetTriageSession(): void {
    set("index", 0);
    set("history", []);
    // Don't clear filters, followUpList, or archivedSet — those persist
}

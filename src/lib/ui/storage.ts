/**
 * The Omniscient — LocalStorage Helpers
 *
 * Persist UI-only state (notes, dispositions, tags, call list, archive overrides)
 * without touching the database. All keys are namespaced under "omniscient:".
 */

const PREFIX = "omniscient:";

// ═══════════════════════════════════════════════
// Generic helpers
// ═══════════════════════════════════════════════
function getItem<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function setItem<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
        /* quota exceeded, silently fail */
    }
}

// ═══════════════════════════════════════════════
// NOTES — per lead
// ═══════════════════════════════════════════════
export interface LeadNote {
    id: string;
    text: string;
    timestamp: string; // ISO string
}

export function getLeadNotes(leadId: number): LeadNote[] {
    return getItem<LeadNote[]>(`notes:${leadId}`, []);
}

export function addLeadNote(leadId: number, text: string): LeadNote[] {
    const notes = getLeadNotes(leadId);
    const note: LeadNote = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        timestamp: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    setItem(`notes:${leadId}`, updated);
    return updated;
}

export function deleteLeadNote(leadId: number, noteId: string): LeadNote[] {
    const notes = getLeadNotes(leadId).filter(n => n.id !== noteId);
    setItem(`notes:${leadId}`, notes);
    return notes;
}

// ═══════════════════════════════════════════════
// DISPOSITIONS — per lead
// ═══════════════════════════════════════════════
export type DispositionType =
    | "not_interested"
    | "call_back"
    | "wrong_number"
    | "booked"
    | "follow_up";

export const DISPOSITION_OPTIONS: { value: DispositionType; label: string; color: string; icon: string }[] = [
    { value: "not_interested", label: "Not Interested", color: "red", icon: "👎" },
    { value: "call_back", label: "Call Back", color: "amber", icon: "📞" },
    { value: "wrong_number", label: "Wrong Number", color: "orange", icon: "❌" },
    { value: "booked", label: "Booked", color: "emerald", icon: "✅" },
    { value: "follow_up", label: "Follow-Up", color: "cyan", icon: "🔄" },
];

export interface LeadDisposition {
    type: DispositionType;
    timestamp: string;
}

export function getLeadDisposition(leadId: number): LeadDisposition | null {
    return getItem<LeadDisposition | null>(`disposition:${leadId}`, null);
}

export function setLeadDisposition(leadId: number, type: DispositionType): LeadDisposition {
    const disposition: LeadDisposition = {
        type,
        timestamp: new Date().toISOString(),
    };
    setItem(`disposition:${leadId}`, disposition);
    return disposition;
}

export function clearLeadDisposition(leadId: number): void {
    setItem(`disposition:${leadId}`, null);
}

// ═══════════════════════════════════════════════
// ARCHIVE OVERRIDE — UI-only toggle
// ═══════════════════════════════════════════════
export function getArchiveOverride(leadId: number): boolean | null {
    return getItem<boolean | null>(`archive:${leadId}`, null);
}

export function setArchiveOverride(leadId: number, archived: boolean): void {
    setItem(`archive:${leadId}`, archived);
}

// ═══════════════════════════════════════════════
// CALL LIST — global list of lead IDs
// ═══════════════════════════════════════════════
export function getCallList(): number[] {
    return getItem<number[]>("callList", []);
}

export function addToCallList(leadId: number): number[] {
    const list = getCallList();
    if (!list.includes(leadId)) {
        const updated = [...list, leadId];
        setItem("callList", updated);
        return updated;
    }
    return list;
}

export function removeFromCallList(leadId: number): number[] {
    const list = getCallList().filter(id => id !== leadId);
    setItem("callList", list);
    return list;
}

export function isInCallList(leadId: number): boolean {
    return getCallList().includes(leadId);
}

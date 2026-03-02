"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";
import { getCallList, removeFromCallList } from "@/lib/ui/storage";
import { TierBadge } from "@/components/ui/tier-badge";
import { CopyButton } from "@/components/ui/copy-button";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
    Search, Phone, Mail, Download, Copy, Trash2, X, ListChecks,
    AlertTriangle,
} from "lucide-react";

/** Snapshot of a lead in the call list — used for display without re-fetching. */
export interface CallListEntry {
    id: number;
    businessName: string;
    niche: string;
    city: string;
    phone: string | null;
    email: string | null;
    axiomTier: string | null;
    axiomScore: number | null;
}

interface CallListDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** All triage leads so we can look up details for call list IDs. */
    allLeads: CallListEntry[];
}

export function CallListDrawer({ open, onOpenChange, allLeads }: CallListDrawerProps) {
    const { toast } = useToast();
    const [search, setSearch] = useState("");
    const [callListIds, setCallListIds] = useState<number[]>([]);
    const [confirmClear, setConfirmClear] = useState(false);

    useEffect(() => {
        if (open) setCallListIds(getCallList());
    }, [open]);

    const entries = useMemo(() => {
        return callListIds
            .map(id => allLeads.find(l => l.id === id))
            .filter(Boolean) as CallListEntry[];
    }, [callListIds, allLeads]);

    const filtered = useMemo(() => {
        if (!search.trim()) return entries;
        const q = search.toLowerCase();
        return entries.filter(e =>
            e.businessName.toLowerCase().includes(q) ||
            e.city.toLowerCase().includes(q) ||
            e.niche.toLowerCase().includes(q)
        );
    }, [entries, search]);

    const handleRemove = useCallback((id: number) => {
        removeFromCallList(id);
        setCallListIds(prev => prev.filter(x => x !== id));
        toast("Removed from call list", { type: "info" });
    }, [toast]);

    const handleClearAll = useCallback(() => {
        if (!confirmClear) { setConfirmClear(true); return; }
        entries.forEach(e => removeFromCallList(e.id));
        setCallListIds([]);
        setConfirmClear(false);
        toast("Call list cleared", { type: "info" });
    }, [confirmClear, entries, toast]);

    const exportCSV = useCallback(() => {
        const headers = ["Business Name", "Niche", "City", "Phone", "Email", "Tier", "Score"];
        const rows = entries.map(e => [
            e.businessName, e.niche, e.city, e.phone || "", e.email || "",
            e.axiomTier || "", String(e.axiomScore ?? ""),
        ].map(v => v.includes(",") ? `"${v}"` : v).join(","));
        const csv = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "call_list.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast("Exported call list CSV", { type: "success" });
    }, [entries, toast]);

    const copyAllPhones = useCallback(async () => {
        const phones = entries.map(e => e.phone).filter(Boolean).join("\n");
        if (!phones) { toast("No phones to copy", { type: "error" }); return; }
        await navigator.clipboard.writeText(phones);
        toast(`Copied ${phones.split("\n").length} phone numbers`, { icon: "phone" });
    }, [entries, toast]);

    const copyAllEmails = useCallback(async () => {
        const emails = entries.map(e => e.email).filter(Boolean).join("\n");
        if (!emails) { toast("No emails to copy", { type: "error" }); return; }
        await navigator.clipboard.writeText(emails);
        toast(`Copied ${emails.split("\n").length} emails`, { icon: "email" });
    }, [entries, toast]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-[420px] sm:max-w-[420px] bg-[#0a0a0f] border-white/[0.06] flex flex-col"
            >
                <SheetHeader className="pb-0">
                    <SheetTitle className="text-white flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-emerald-400" />
                        Call List
                        <span className="text-xs font-mono text-zinc-500 ml-1">{entries.length}</span>
                    </SheetTitle>
                    <SheetDescription className="text-zinc-500 text-xs">
                        Leads marked "Keep" during triage
                    </SheetDescription>
                </SheetHeader>

                {/* Search */}
                <div className="px-4 pb-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search kept leads..."
                            className="w-full bg-black/30 border border-white/[0.06] rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-white/[0.1] transition-colors"
                        />
                    </div>
                </div>

                {/* Bulk actions */}
                <div className="px-4 flex items-center gap-2 flex-wrap">
                    <button
                        onClick={exportCSV}
                        disabled={entries.length === 0}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all disabled:opacity-30"
                    >
                        <Download className="w-3 h-3" /> Export CSV
                    </button>
                    <button
                        onClick={copyAllPhones}
                        disabled={entries.length === 0}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.1] transition-all disabled:opacity-30"
                    >
                        <Phone className="w-3 h-3" /> Copy Phones
                    </button>
                    <button
                        onClick={copyAllEmails}
                        disabled={entries.length === 0}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.1] transition-all disabled:opacity-30"
                    >
                        <Mail className="w-3 h-3" /> Copy Emails
                    </button>
                    <button
                        onClick={handleClearAll}
                        disabled={entries.length === 0}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all disabled:opacity-30 ml-auto",
                            confirmClear
                                ? "border-red-500/30 text-red-400 bg-red-500/10"
                                : "border-white/[0.06] text-zinc-600 hover:text-red-400 hover:border-red-500/20"
                        )}
                    >
                        {confirmClear ? <><AlertTriangle className="w-3 h-3" /> Confirm?</> : <><Trash2 className="w-3 h-3" /> Clear</>}
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                    {filtered.length === 0 && entries.length === 0 && (
                        <div className="flex flex-col items-center py-12 text-center">
                            <ListChecks className="w-8 h-8 text-zinc-700 mb-2" />
                            <p className="text-xs text-zinc-600">No leads in call list yet</p>
                            <p className="text-[10px] text-zinc-700 mt-1">Press 1 during triage to keep leads</p>
                        </div>
                    )}
                    {filtered.length === 0 && entries.length > 0 && (
                        <p className="text-xs text-zinc-600 text-center py-6">No matches for &ldquo;{search}&rdquo;</p>
                    )}
                    {filtered.map(entry => (
                        <div key={entry.id} className="glass rounded-lg p-3 group flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-white truncate">{entry.businessName}</span>
                                    <TierBadge tier={entry.axiomTier} score={entry.axiomScore} size="xs" />
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                                    <span>{entry.city}</span>
                                    {entry.phone && (
                                        <span className="flex items-center gap-1">
                                            <Phone className="w-2.5 h-2.5" /> {entry.phone}
                                        </span>
                                    )}
                                    {entry.email && (
                                        <span className="flex items-center gap-1 truncate max-w-[120px]">
                                            <Mail className="w-2.5 h-2.5" /> {entry.email}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {entry.phone && <CopyButton value={entry.phone} label="phone" size="xs" />}
                                {entry.email && <CopyButton value={entry.email} label="email" size="xs" />}
                                <button
                                    onClick={() => handleRemove(entry.id)}
                                    className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}

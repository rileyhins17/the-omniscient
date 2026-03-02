"use client";
import { Search } from "lucide-react";

/**
 * Search hint button in the header bar.
 * Dispatches a synthetic ⌘K event to open the command palette.
 */
export function SearchTrigger() {
    return (
        <button
            className="hidden sm:inline-flex items-center gap-2 glass rounded-lg px-3 py-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors group"
            onClick={() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
            }}
        >
            <Search className="w-3 h-3" />
            <span className="text-[11px]">Search…</span>
            <kbd className="text-[10px] font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-0.5 ml-1 group-hover:border-white/[0.1]">
                ⌘K
            </kbd>
        </button>
    );
}

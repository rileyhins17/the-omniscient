"use client";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CopyButtonProps {
    value: string;
    label?: string;
    className?: string;
    size?: "xs" | "sm" | "md";
}

/**
 * Copy-to-clipboard button with animated feedback.
 * Shows a checkmark for 2s after copying.
 */
export function CopyButton({ value, label = "Copy", className, size = "sm" }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard not available */ }
    }, [value]);

    const sizes = {
        xs: "h-5 w-5 [&_svg]:size-2.5",
        sm: "h-6 w-6 [&_svg]:size-3",
        md: "h-7 w-7 [&_svg]:size-3.5",
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={handleCopy}
                    className={cn(
                        "inline-flex items-center justify-center rounded-md transition-all",
                        "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                        "active:scale-90",
                        sizes[size],
                        copied && "text-emerald-400",
                        className
                    )}
                >
                    {copied ? <Check className="transition-transform scale-in" /> : <Copy />}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
                {copied ? "Copied!" : label}
            </TooltipContent>
        </Tooltip>
    );
}

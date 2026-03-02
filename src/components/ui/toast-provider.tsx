"use client";
import { useState, useCallback, useEffect, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { Check, X, Copy, Phone, Mail, MapPin, FileText } from "lucide-react";

// ═══════════════════════════════════════════════
// Toast Provider + Hook
// ═══════════════════════════════════════════════
interface Toast {
    id: string;
    message: string;
    type?: "success" | "info" | "error";
    icon?: "copy" | "phone" | "email" | "address" | "note";
}

interface ToastContextValue {
    toast: (message: string, opts?: { type?: Toast["type"]; icon?: Toast["icon"] }) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => { } });

export function useToast() {
    return useContext(ToastContext);
}

const ICON_MAP = {
    copy: Copy,
    phone: Phone,
    email: Mail,
    address: MapPin,
    note: FileText,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, opts?: { type?: Toast["type"]; icon?: Toast["icon"] }) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setToasts(prev => [...prev, { id, message, type: opts?.type || "success", icon: opts?.icon || "copy" }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 2500);
    }, []);

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
                {toasts.map((t) => {
                    const IconComp = t.icon ? ICON_MAP[t.icon] : Check;
                    return (
                        <div
                            key={t.id}
                            className={cn(
                                "pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl glass-ultra border shadow-2xl",
                                "animate-slide-up text-sm font-medium",
                                t.type === "success" && "border-emerald-500/30 text-emerald-300 shadow-emerald-500/10",
                                t.type === "info" && "border-cyan-500/30 text-cyan-300 shadow-cyan-500/10",
                                t.type === "error" && "border-red-500/30 text-red-300 shadow-red-500/10",
                            )}
                        >
                            <div className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center",
                                t.type === "success" && "bg-emerald-500/20",
                                t.type === "info" && "bg-cyan-500/20",
                                t.type === "error" && "bg-red-500/20",
                            )}>
                                <IconComp className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs">{t.message}</span>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

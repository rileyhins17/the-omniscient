"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, MailCheck, MailX, Loader2, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";

type GmailStatus = {
  connected: boolean;
  gmailAddress?: string;
  tokenHealthy?: boolean;
  connectedAt?: string;
  connections?: Array<{
    id: string;
    gmailAddress: string;
    tokenHealthy: boolean;
  }>;
  mailboxes?: Array<{
    id: string;
    gmailAddress: string;
    label: string | null;
    status: string;
  }>;
};

export function GmailConnectCard() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/outreach/gmail/status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = () => {
    window.location.href = "/api/outreach/gmail/connect";
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const connectionId = status?.connections?.[0]?.id;
      const res = await fetch("/api/outreach/gmail/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (res.ok) {
        setStatus({ connected: false });
      }
    } catch {
      // Silently fail
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
        <span className="text-xs text-zinc-600">Checking Gmail connection...</span>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
            <MailX className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Gmail Not Connected</div>
            <div className="text-[10px] text-zinc-500">
              Connect your Gmail to send outreach emails
            </div>
          </div>
        </div>
        <Button
          onClick={handleConnect}
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 text-xs font-bold text-white hover:from-amber-500 hover:to-orange-500"
        >
          <Mail className="h-3.5 w-3.5" />
          Connect Gmail
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
            <MailCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              Gmail Connected
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </div>
            <div className="font-mono text-[10px] text-emerald-300/80">
              {status.connections?.length || 1} mailbox{status.connections?.length === 1 ? "" : "es"} available
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleConnect}
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-emerald-600 to-cyan-600 text-xs font-bold text-white hover:from-emerald-500 hover:to-cyan-500"
          >
            <Mail className="h-3.5 w-3.5" />
            Add Mailbox
          </Button>
          <Button
            onClick={handleDisconnect}
            disabled={disconnecting}
            variant="ghost"
            size="sm"
            className="gap-1.5 border border-white/[0.08] text-xs text-zinc-500 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
          >
            <Unplug className="h-3.5 w-3.5" />
            {disconnecting ? "..." : "Disconnect One"}
          </Button>
        </div>
      </div>
      {(status.mailboxes?.length || 0) > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {status.mailboxes?.map((mailbox) => (
            <div key={mailbox.id} className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <div className="text-xs font-semibold text-white">{mailbox.label || mailbox.gmailAddress}</div>
              <div className="font-mono text-[10px] text-emerald-300/80">{mailbox.gmailAddress}</div>
              <div className="mt-1 text-[10px] text-zinc-500">{mailbox.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

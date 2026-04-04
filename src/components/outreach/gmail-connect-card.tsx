"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MailCheck, MailX, Unplug } from "lucide-react";

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
      // Keep the existing UI if the request fails.
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
      // Keep the existing UI if disconnect fails.
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-4 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
        <span className="text-sm text-zinc-400">Checking connected Gmail mailboxes...</span>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="rounded-[24px] border border-amber-500/15 bg-amber-500/[0.04] px-4 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <MailX className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">No Gmail mailbox connected</div>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Connect at least one Gmail inbox to enable manual sends, follow-ups, and automation.
              </p>
            </div>
          </div>
          <Button
            onClick={handleConnect}
            className="h-9 rounded-full bg-white px-4 text-sm text-black hover:bg-zinc-200"
          >
            <Mail className="h-4 w-4" />
            Connect Gmail
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <MailCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              Mailboxes connected
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              {status.connections?.length || 1} mailbox
              {(status.connections?.length || 1) === 1 ? "" : "es"} available for manual and automated sending.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleConnect}
            className="h-9 rounded-full bg-white px-4 text-sm text-black hover:bg-zinc-200"
          >
            <Mail className="h-4 w-4" />
            Add Mailbox
          </Button>
          <Button
            onClick={handleDisconnect}
            disabled={disconnecting}
            variant="ghost"
            className="h-9 rounded-full border border-white/10 px-4 text-sm text-zinc-300 hover:bg-white/[0.04]"
          >
            <Unplug className="h-4 w-4" />
            {disconnecting ? "Disconnecting..." : "Disconnect One"}
          </Button>
        </div>
      </div>

      {(status.mailboxes?.length || 0) > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {status.mailboxes?.map((mailbox) => (
            <div
              key={mailbox.id}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-300"
            >
              <span className="font-medium text-white">{mailbox.label || mailbox.gmailAddress}</span>
              <span className="mx-2 text-zinc-600">/</span>
              <span className="font-mono text-zinc-400">{mailbox.gmailAddress}</span>
              <span className="mx-2 text-zinc-600">/</span>
              <span className="text-zinc-500">{mailbox.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

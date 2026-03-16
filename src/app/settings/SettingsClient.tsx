"use client";

import { Monitor, ShieldCheck, TimerReset, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePerformance } from "@/lib/ui/performance";

type RuntimeStatus = {
  appBaseUrl: string;
  authAllowedCount: number;
  adminEmailCount: number;
  browserRenderingConfigured: boolean;
  databaseTarget: "cloudflare-d1" | "binding-missing";
  geminiConfigured: boolean;
  rateLimitMaxAuth: number;
  rateLimitMaxExport: number;
  rateLimitMaxScrape: number;
  rateLimitWindowSeconds: number;
  scrapeConcurrencyLimit: number;
  scrapeTimeoutMs: number;
};

function StatusPill({
  label,
  state,
}: {
  label: string;
  state: "ready" | "attention";
}) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-widest ${
        state === "ready"
          ? "bg-emerald-400/10 text-emerald-400"
          : "bg-amber-400/10 text-amber-400"
      }`}
    >
      {label}
    </span>
  );
}

export function SettingsClient({ runtimeStatus }: { runtimeStatus: RuntimeStatus }) {
  const { reducedMotion, toggle } = usePerformance();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="animate-slide-up">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="gradient-text">Settings</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Internal runtime status for the protected Omniscient deployment.
        </p>
      </div>

      <Card
        className="glass-strong animate-slide-up rounded-xl glow-emerald"
        style={{ animationDelay: "100ms" }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Monitor className="h-5 w-5 text-emerald-400" />
            Display & Performance
          </CardTitle>
          <CardDescription className="text-xs">
            Client-only display preferences remain local to the operator browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="glass flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="glass-strong flex h-9 w-9 items-center justify-center rounded-lg">
                <Zap className={`h-4 w-4 ${reducedMotion ? "text-amber-400" : "text-emerald-400"}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Performance Mode</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  Reduce decorative effects for longer sessions or lower-powered devices.
                </div>
              </div>
            </div>
            <button
              aria-label="Toggle performance mode"
              className={`relative h-6 w-11 rounded-full border transition-all duration-300 ${
                reducedMotion
                  ? "border-amber-400/40 bg-amber-400/30"
                  : "border-white/[0.06] bg-white/[0.08]"
              }`}
              onClick={toggle}
              type="button"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full transition-all duration-300 ${
                  reducedMotion
                    ? "left-[22px] bg-amber-400 shadow-lg shadow-amber-400/30"
                    : "left-0.5 bg-zinc-400"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          className="glass-strong animate-slide-up rounded-xl glow-cyan"
          style={{ animationDelay: "160ms" }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
              Security Posture
            </CardTitle>
            <CardDescription className="text-xs">
              Sensitive configuration is server-side only and never editable from this screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="glass flex items-center justify-between rounded-xl p-3">
              <span>Gemini server key</span>
              <StatusPill
                label={runtimeStatus.geminiConfigured ? "Configured" : "Missing"}
                state={runtimeStatus.geminiConfigured ? "ready" : "attention"}
              />
            </div>
            <div className="glass flex items-center justify-between rounded-xl p-3">
              <span>Allowed sign-up emails</span>
              <span className="font-mono text-xs text-muted-foreground">{runtimeStatus.authAllowedCount}</span>
            </div>
            <div className="glass flex items-center justify-between rounded-xl p-3">
              <span>Admin emails</span>
              <span className="font-mono text-xs text-muted-foreground">{runtimeStatus.adminEmailCount}</span>
            </div>
            <div className="glass flex items-center justify-between rounded-xl p-3">
              <span>App base URL</span>
              <span className="max-w-[16rem] truncate font-mono text-xs text-muted-foreground">
                {runtimeStatus.appBaseUrl}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card
          className="glass-strong animate-slide-up rounded-xl glow-emerald"
          style={{ animationDelay: "220ms" }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <TimerReset className="h-5 w-5 text-emerald-400" />
              Runtime Controls
            </CardTitle>
            <CardDescription className="text-xs">
              Cloudflare-safe limits for auth, exports, and scrape operations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="glass flex items-center justify-between rounded-xl p-3">
              <span>Database target</span>
              <StatusPill
                label={runtimeStatus.databaseTarget === "cloudflare-d1" ? "D1" : "Missing"}
                state={runtimeStatus.databaseTarget === "cloudflare-d1" ? "ready" : "attention"}
              />
            </div>
            <div className="glass flex items-center justify-between rounded-xl p-3">
              <span>Browser rendering binding</span>
              <StatusPill
                label={runtimeStatus.browserRenderingConfigured ? "Bound" : "Local fallback"}
                state={runtimeStatus.browserRenderingConfigured ? "ready" : "attention"}
              />
            </div>
            <div className="glass rounded-xl p-3 text-xs text-muted-foreground">
              <div>Auth requests: {runtimeStatus.rateLimitMaxAuth} per {runtimeStatus.rateLimitWindowSeconds}s</div>
              <div>Export requests: {runtimeStatus.rateLimitMaxExport} per {runtimeStatus.rateLimitWindowSeconds}s</div>
              <div>Scrape requests: {runtimeStatus.rateLimitMaxScrape} per {runtimeStatus.rateLimitWindowSeconds}s</div>
              <div>Scrape concurrency: {runtimeStatus.scrapeConcurrencyLimit}</div>
              <div>Scrape timeout: {Math.round(runtimeStatus.scrapeTimeoutMs / 1000)}s</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

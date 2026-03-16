import { SettingsClient } from "./SettingsClient";

import { getCloudflareBindings } from "@/lib/cloudflare";
import { getAdminEmails, getAllowedEmails, getServerEnv } from "@/lib/env";
import { requireAdminSession } from "@/lib/session";

export default async function SettingsPage() {
  await requireAdminSession();

  const env = getServerEnv();
  const bindings = getCloudflareBindings();

  return (
    <SettingsClient
      runtimeStatus={{
        appBaseUrl: env.APP_BASE_URL,
        authAllowedCount: getAllowedEmails().length,
        adminEmailCount: getAdminEmails().length,
        browserRenderingConfigured: Boolean(bindings?.BROWSER),
        databaseTarget: bindings?.DB ? "cloudflare-d1" : "binding-missing",
        geminiConfigured: Boolean(env.GEMINI_API_KEY),
        rateLimitMaxAuth: env.RATE_LIMIT_MAX_AUTH,
        rateLimitMaxExport: env.RATE_LIMIT_MAX_EXPORT,
        rateLimitMaxScrape: env.RATE_LIMIT_MAX_SCRAPE,
        rateLimitWindowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
        scrapeConcurrencyLimit: env.SCRAPE_CONCURRENCY_LIMIT,
        scrapeTimeoutMs: env.SCRAPE_TIMEOUT_MS,
      }}
    />
  );
}

import "server-only";

import { getCloudflareBindings } from "@/lib/cloudflare";

export interface AutomationLocator {
  evaluateAll<TResult>(pageFunction: (elements: any[]) => TResult): Promise<TResult>;
}

export interface AutomationPage {
  close(): Promise<void>;
  evaluate<TResult>(pageFunction: () => TResult): Promise<TResult>;
  goto(url: string, options?: { timeout?: number; waitUntil?: string }): Promise<unknown>;
  locator(selector: string): AutomationLocator;
  url(): string;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
  waitForTimeout(timeoutMs: number): Promise<void>;
}

export interface AutomationBrowserContext {
  close(): Promise<void>;
  newPage(): Promise<AutomationPage>;
}

export interface AutomationBrowser {
  close(): Promise<void>;
  newContext(options?: { locale?: string }): Promise<AutomationBrowserContext>;
}

const CLOUDFLARE_PLAYWRIGHT_MODULE = "@cloudflare/playwright";
const PLAYWRIGHT_MODULE = "playwright";

async function dynamicImport(specifier: string): Promise<any> {
  return import(specifier);
}

export async function launchAutomationBrowser(): Promise<AutomationBrowser> {
  const bindings = getCloudflareBindings();

  if (bindings?.BROWSER) {
    const { launch } = await dynamicImport(CLOUDFLARE_PLAYWRIGHT_MODULE);
    return launch(bindings.BROWSER);
  }

  const { chromium } = await dynamicImport(PLAYWRIGHT_MODULE);
  return chromium.launch({ headless: true });
}

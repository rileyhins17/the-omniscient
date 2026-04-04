"use client";

import { useCallback, useState } from "react";

import { AutomationPanel } from "@/components/outreach/automation-panel";
import { ToastProvider } from "@/components/ui/toast-provider";

type AutomationPageClientProps = {
  initialOverview: any;
};

export function AutomationPageClient({ initialOverview }: AutomationPageClientProps) {
  const [overview, setOverview] = useState(initialOverview);

  const refreshOverview = useCallback(async () => {
    const response = await fetch("/api/outreach/automation/overview");
    if (!response.ok) return;
    const data = await response.json();
    setOverview(data);
  }, []);

  return (
    <ToastProvider>
      <AutomationPanel overview={overview} onOverviewUpdated={refreshOverview} />
    </ToastProvider>
  );
}

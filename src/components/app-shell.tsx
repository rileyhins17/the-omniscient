"use client";

import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { LayoutBreadcrumb } from "@/components/layout-breadcrumb";
import { PerformanceToggle } from "@/components/system/performance-toggle";
import { SearchTrigger } from "@/components/system/search-trigger";
import { HotkeyProvider } from "@/components/system/hotkey-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const PUBLIC_PATH_PREFIXES = ["/sign-in", "/sign-up"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicPath(pathname)) {
    return (
      <main className="min-h-screen bg-background">
        <div className="p-6 sm:p-8">{children}</div>
      </main>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 w-full min-h-screen bg-background">
        <div className="sticky top-0 z-50 flex h-14 items-center border-b border-white/[0.04] glass-ultra px-4">
          <SidebarTrigger className="text-muted-foreground transition-colors hover:text-white" />
          <div className="ml-3 h-4 w-px bg-white/[0.08]" />
          <LayoutBreadcrumb />
          <div className="ml-auto flex items-center gap-3">
            <SearchTrigger />
            <PerformanceToggle />
            <div className="glass flex items-center gap-2 rounded-full px-2.5 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-glow" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                System Online
              </span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <HotkeyProvider>{children}</HotkeyProvider>
        </div>
      </main>
    </SidebarProvider>
  );
}

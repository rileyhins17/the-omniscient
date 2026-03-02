import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutBreadcrumb } from "@/components/layout-breadcrumb";
import { PerformanceProvider } from "@/lib/ui/performance";
import { PerformanceToggle } from "@/components/system/performance-toggle";
import { HotkeyProvider } from "@/components/system/hotkey-provider";
import { SearchTrigger } from "@/components/system/search-trigger";

export const metadata: Metadata = {
  title: "The Omniscient — B2B Lead Intelligence Engine",
  description: "AI-powered B2B lead extraction, enrichment, scoring, and intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <PerformanceProvider>
          <TooltipProvider delayDuration={0}>
            <SidebarProvider>
              <AppSidebar />
              <main className="flex-1 w-full bg-background min-h-screen">
                <div className="h-14 border-b border-white/[0.04] glass-ultra flex items-center px-4 sticky top-0 z-50">
                  <SidebarTrigger className="text-muted-foreground hover:text-white transition-colors" />
                  <div className="ml-3 h-4 w-px bg-white/[0.08]" />
                  <LayoutBreadcrumb />
                  <div className="ml-auto flex items-center gap-3">
                    <SearchTrigger />
                    <PerformanceToggle />
                    <div className="glass rounded-full px-2.5 py-1 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-glow" />
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                        System Online
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <HotkeyProvider>
                    {children}
                  </HotkeyProvider>
                </div>
              </main>
            </SidebarProvider>
          </TooltipProvider>
        </PerformanceProvider>
      </body>
    </html>
  );
}


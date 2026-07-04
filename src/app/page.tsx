"use client";

import {
  UserSearch,
  Mail,
  Globe,
  Phone,
  Image as ImageIcon,
  History,
  LayoutDashboard,
  Radar,
  Github,
  ShieldAlert,
} from "lucide-react";
import { ToolId, TOOLS } from "@/lib/osint/types";
import { useState } from "react";
import { UserSearchTool } from "@/components/osint/user-search";
import { EmailAnalysisTool } from "@/components/osint/email-analysis";
import { IpDomainTool } from "@/components/osint/ip-domain";
import { PhoneLookupTool } from "@/components/osint/phone-lookup";
import { ExifExtractorTool } from "@/components/osint/exif-extractor";
import { HistoryPanel } from "@/components/osint/history-panel";
import { Dashboard } from "@/components/osint/dashboard";

const ICONS: Record<ToolId, React.ElementType> = {
  dashboard: LayoutDashboard,
  user: UserSearch,
  email: Mail,
  ipdomain: Globe,
  phone: Phone,
  exif: ImageIcon,
  history: History,
};

export default function Home() {
  const [active, setActive] = useState<ToolId>("dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
          <div className="flex items-center gap-2 px-6 h-16 border-b border-border">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
              <Radar className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight">
                OsintFlow
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                OSINT Panel
              </span>
            </div>
          </div>
          <nav className="flex flex-col gap-1 p-3 flex-1">
            {TOOLS.map((tool) => {
              const Icon = ICONS[tool.id];
              const isActive = active === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActive(tool.id)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors text-left ${
                    isActive
                      ? "bg-foreground text-background font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tool.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="border-t border-border p-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Github className="h-4 w-4 shrink-0" />
              <span>Documentación</span>
            </a>
          </div>
        </aside>

        {/* Mobile top nav */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-2 h-14 px-4 border-b border-border bg-sidebar overflow-x-auto">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background shrink-0">
            <Radar className="h-4 w-4" />
          </div>
          {TOOLS.map((tool) => {
            const Icon = ICONS[tool.id];
            const isActive = active === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActive(tool.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-foreground text-background font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tool.label}
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 px-4 py-6 md:px-10 md:py-10 mt-14 md:mt-0">
            <div className="mx-auto w-full max-w-5xl">
              {active === "dashboard" && <Dashboard onNavigate={setActive} />}
              {active === "user" && <UserSearchTool />}
              {active === "email" && <EmailAnalysisTool />}
              {active === "ipdomain" && <IpDomainTool />}
              {active === "phone" && <PhoneLookupTool />}
              {active === "exif" && <ExifExtractorTool />}
              {active === "history" && <HistoryPanel />}
            </div>
          </div>

          {/* Sticky footer */}
          <footer className="mt-auto border-t border-border bg-background">
            <div className="mx-auto w-full max-w-5xl px-4 md:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                OsintFlow · Uso educativo y ético solamente.
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Respeta la privacidad y la legislación vigente.
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

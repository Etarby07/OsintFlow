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
  Link2,
  ScanSearch,
  SearchCode,
  Network,
  FileText,
  KeyRound,
  Cpu,
  Shield,
  Video,
  Braces,
  EyeOff,
  Wifi,
  FileSearch,
  Ghost,
  UserCheck,
  PlaneTakeoff,
  PhoneCall,
  AtSign,
  ScanLine,
  FolderSearch,
  Settings,
} from "lucide-react";
import {
  ToolId,
  ToolCategory,
  TOOLS,
  CATEGORY_ORDER,
} from "@/lib/osint/types";
import { useState } from "react";
import { UserSearchTool } from "@/components/osint/user-search";
import { EmailAnalysisTool } from "@/components/osint/email-analysis";
import { IpDomainTool } from "@/components/osint/ip-domain";
import { PhoneLookupTool } from "@/components/osint/phone-lookup";
import { ExifExtractorTool } from "@/components/osint/exif-extractor";
import { HistoryPanel } from "@/components/osint/history-panel";
import { Dashboard } from "@/components/osint/dashboard";
import { LinkAnalyzerTool } from "@/components/osint/link-analyzer";
import { DorkBuilderTool } from "@/components/osint/dork-builder";
import { ReverseImageTool } from "@/components/osint/reverse-image";
import { PgpKeysTool } from "@/components/osint/pgp-keys";
import { SubdomainScannerTool } from "@/components/osint/subdomain-scanner";
import { HibpCheckerTool } from "@/components/osint/hibp-checker";
import { DocMetadataTool } from "@/components/osint/doc-metadata";
import { TechStackTool } from "@/components/osint/tech-stack";
import { HttpHeadersTool } from "@/components/osint/http-headers";
import { WebcamDorkerTool } from "@/components/osint/webcam-dorker";
import { DecoderTool } from "@/components/osint/decoder";
import { AnonymityTool } from "@/components/osint/anonymity-detector";
import { WifiLocatorTool } from "@/components/osint/wifi-locator";
import { PastebinScannerTool } from "@/components/osint/pastebin-scanner";
import { DarkWebTool } from "@/components/osint/darkweb-search";
import { WhoisHistoryTool } from "@/components/osint/whois-history";
import { PepCheckTool } from "@/components/osint/pep-check";
import { TrackingTool } from "@/components/osint/tracking";
import { CallerIdTool } from "@/components/osint/caller-id";
import { EmailGenTool } from "@/components/osint/emailgen";
import { StegoTool } from "@/components/osint/stego-analyzer";
import { DirBusterTool } from "@/components/osint/dirbuster";
import { SettingsPanel } from "@/components/osint/settings-panel";
import { WelcomeDialog } from "@/components/osint/welcome-dialog";

const ICONS: Record<ToolId, React.ElementType> = {
  dashboard: LayoutDashboard,
  user: UserSearch,
  email: Mail,
  phone: Phone,
  callerid: PhoneCall,
  pgp: KeyRound,
  pep: UserCheck,
  emailgen: AtSign,
  ipdomain: Globe,
  anonymity: EyeOff,
  subdomain: Network,
  whoishistory: History,
  techstack: Cpu,
  headers: Shield,
  dirbuster: FolderSearch,
  exif: ImageIcon,
  document: FileText,
  stego: ScanLine,
  image: ScanSearch,
  webcam: Video,
  hibp: ShieldAlert,
  pastebin: FileSearch,
  darkweb: Ghost,
  link: Link2,
  dorks: SearchCode,
  decoder: Braces,
  wifi: Wifi,
  tracking: PlaneTakeoff,
  history: History,
  settings: Settings,
};

export default function Home() {
  const [active, setActive] = useState<ToolId>("dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <WelcomeDialog />
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
          <div className="flex items-center gap-2 px-6 h-16 border-b border-border shrink-0">
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
          <nav className="flex flex-col gap-3 p-3 flex-1 overflow-y-auto">
            {CATEGORY_ORDER.map((cat) => {
              const catTools = TOOLS.filter((t) => t.category === cat);
              if (catTools.length === 0) return null;
              return (
                <div key={cat} className="flex flex-col gap-1">
                  {cat !== "Sistema" && (
                    <span className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {cat}
                    </span>
                  )}
                  {catTools.map((tool) => {
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
                </div>
              );
            })}
          </nav>
          <div className="border-t border-border p-3 shrink-0">
            <a
              href="https://github.com/etarby07"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Github className="h-4 w-4 shrink-0" />
              <span>etarby07</span>
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
              {active === "phone" && <PhoneLookupTool />}
              {active === "callerid" && <CallerIdTool />}
              {active === "pgp" && <PgpKeysTool />}
              {active === "pep" && <PepCheckTool />}
              {active === "emailgen" && <EmailGenTool />}
              {active === "ipdomain" && <IpDomainTool />}
              {active === "anonymity" && <AnonymityTool />}
              {active === "subdomain" && <SubdomainScannerTool />}
              {active === "whoishistory" && <WhoisHistoryTool />}
              {active === "techstack" && <TechStackTool />}
              {active === "headers" && <HttpHeadersTool />}
              {active === "dirbuster" && <DirBusterTool />}
              {active === "exif" && <ExifExtractorTool />}
              {active === "document" && <DocMetadataTool />}
              {active === "stego" && <StegoTool />}
              {active === "image" && <ReverseImageTool />}
              {active === "webcam" && <WebcamDorkerTool />}
              {active === "hibp" && <HibpCheckerTool />}
              {active === "pastebin" && <PastebinScannerTool />}
              {active === "darkweb" && <DarkWebTool />}
              {active === "link" && <LinkAnalyzerTool />}
              {active === "dorks" && <DorkBuilderTool />}
              {active === "decoder" && <DecoderTool />}
              {active === "wifi" && <WifiLocatorTool />}
              {active === "tracking" && <TrackingTool />}
              {active === "history" && <HistoryPanel />}
              {active === "settings" && <SettingsPanel />}
            </div>
          </div>

          {/* Sticky footer */}
          <footer className="mt-auto border-t border-border bg-background">
            <div className="mx-auto w-full max-w-5xl px-4 md:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                OsintFlow · por{" "}
                <a
                  href="https://github.com/etarby07"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  etarby07
                </a>{" "}
                · Uso educativo y ético.
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

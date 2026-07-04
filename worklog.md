# OsintFlow - Worklog

This file tracks the work done by all agents on the OsintFlow project.

---
Task ID: 0
Agent: Main Orchestrator
Task: Coordinate the full build of OsintFlow, an OSINT web application.

Work Log:
- Reviewed existing Next.js 16 project structure
- Planned architecture: Next.js fullstack + Prisma/SQLite + pure black/white dark theme
- Defined 6 OSINT tools: User Search, Email Analysis, IP/Domain Recon, Phone Lookup, EXIF Extractor, History & Export

Stage Summary:
- Project initialized, ready to start building tools

---
Task ID: FINAL
Agent: Main Orchestrator
Task: Complete OsintFlow build, Docker packaging, README, and browser verification.

Work Log:
- Updated Prisma schema with Investigation model (tool, query, results, createdAt) and pushed to SQLite
- Configured pure black/white dark-first minimalist theme (oklch(0 0 0) background)
- Built sidebar layout with 6 OSINT tools + dashboard, responsive mobile top-nav, sticky footer
- Implemented User Search (Sherlock-like): 30+ platforms checked in parallel with heuristics
- Implemented Email Analysis: format validation, MX records, Gravatar check, local breach DB, platform probes
- Implemented IP/Domain Recon: DNS (A/MX/TXT/NS), RDAP/WHOIS, ip-api.com geolocation, Cloudflare/WAF detection by IP ranges + headers
- Implemented Phone Lookup: libphonenumber-js parsing, country/carrier estimation, WhatsApp wa.me link
- Implemented EXIF Extractor: drag&drop image upload, exifr parsing (EXIF/IPTC/XMP/ICC/GPS), metadata table with max-h-96 scroll
- Implemented History & Export: Prisma CRUD, JSON/CSV export endpoints, filter/delete/clear-all UI
- Created Dockerfile (3-stage: deps/build/runner), docker-entrypoint.sh (prisma db push + node server), docker-compose.yml with persistent volume
- Wrote extensive beginner-friendly README.md (OSINT explanation, per-tool use cases, Docker install for Win/Mac/Linux, step-by-step, legal notice)
- Verified with Agent Browser: dashboard renders, all 6 tools tested end-to-end (torvalds user search found 14 profiles, example.com IP/domain showed Cloudflare+WHOIS+DNS, +34 phone showed Spain+carrier, test@gmail.com email showed MX+breaches, EXIF extracted 37 fields incl Make/Model/Software), history saved all 4 investigations, JSON/CSV export buttons present, sticky footer verified on short (577=577) and long pages, mobile responsive nav works, zero console errors, lint clean

Stage Summary:
- OsintFlow is fully functional and browser-verified
- All 6 OSINT tools work end-to-end with real data
- History persistence (SQLite via Prisma) confirmed working
- Docker packaging complete (docker compose up -d --build)
- README.md is extensive and beginner-friendly (Spanish)
- Pure black/white minimalist design implemented as requested

---
Task ID: 3-A
Agent: full-stack-developer
Task: Build Link Analyzer (URL Unshortener + Wayback) and Google Dorks Builder tools

Work Log:
- Read worklog.md and existing code patterns (tool-shell, ip-domain component, ipdomain/email API routes, history-client, badge/button/select/label UI components) to match conventions exactly
- Created `src/app/api/osint/link/route.ts`:
  - POST handler accepts `{ url }`, prepends `https://` if scheme missing, validates URL via `new URL()` and rejects non-http(s) schemes
  - Follows redirect chain manually with `fetch(url, { redirect: "manual" })`, collecting `{ url, status, location }` per hop; resolves relative Location headers against current URL; caps at 15 hops; 6s per-hop timeout via AbortController; desktop Chrome User-Agent
  - Best-effort `<title>` extraction from final URL (6s timeout, follows redirects, decodes common HTML entities)
  - Queries Wayback Machine availability API (`archive.org/wayback/available`), parses `archived_snapshots.closest` → `{ timestamp, url, status }`, always builds calendar URL `https://web.archive.org/web/*/${finalUrl}`
  - Returns full JSON structure `{ input, finalUrl, title?, redirects[], wayback?, notes[] }`; always returns 200 (only truly fatal errors return 500); GET handler returns a small info object
- Created `src/components/osint/link-analyzer.tsx` (export `LinkAnalyzerTool`):
  - ToolShell titled "Analizador de Enlaces" with `<Link2>` icon; form with monospace Input + "Analizar" Button
  - Loading Card with `Loader2` spinner; results split into: summary Card (final URL in monospace + "Abrir" external link + page title + redirect count), redirect-chain Card (ordered list with status badges + monospace URLs + clickable Location sub-lines, or "La URL no tiene redirecciones" note), Wayback Card (timestamp + "Ver captura" + "Ver calendario de capturas" links, or no-snapshot message), Observaciones Card for notes
  - Saves history with `saveHistory({ tool: "link", query, results })`; uses `useToast` for success/error
- Created `src/components/osint/dork-builder.tsx` (export `DorkBuilderTool`) — pure frontend, no API:
  - ToolShell titled "Generador de Google Dorks" with `<SearchCode>` icon
  - 6 fields in a responsive 2-col grid: site, filetype (Select with none + 13 types), terms (quoted when contains spaces), exclude (whitespace-split, each prefixed with `-`), intitle, inurl
  - Dork built live in `useMemo`; shown in readonly monospace Input; Copiar button (clipboard + toast "Dork copiado"); "Buscar en Google" button opens `google.com/search?q=...` in new tab, disabled when dork empty, saves history on click; Limpiar reset button
  - "Ejemplos rápidos" with 6 preset buttons (PDFs confidenciales, configs expuestos, listados de directorios, SQL expuestos, PPT con datos, logs expuestos) that fill fields and update the dork
  - Muted ethical-use disclaimer at the bottom
- Ran `bun run lint`: 0 errors. The only 2 warnings are unused eslint-disable directives in the pre-existing `src/components/osint/map-view.tsx` (not created/modified by this task)
- Verified both component files export the exact names `LinkAnalyzerTool` and `DorkBuilderTool`

Stage Summary:
- 3 new files created (no existing files modified):
  - `src/app/api/osint/link/route.ts` — URL unshortener + Wayback Machine API
  - `src/components/osint/link-analyzer.tsx` — `LinkAnalyzerTool`
  - `src/components/osint/dork-builder.tsx` — `DorkBuilderTool`
- Both tools follow the established pure black/white dark-first theme, ToolShell wrapper, shadcn/ui components, useToast, and saveHistory patterns
- Link analyzer integrates server-side redirect-following (manual, 15-hop cap, 6s/hop) with Wayback snapshot lookup; dork builder is fully client-side with live preview, copy, Google search, and presets
- Lint clean (0 errors); ready to be wired into the dashboard/sidebar by the orchestrator

---
Task ID: 3-C
Agent: full-stack-developer
Task: Build Subdomain & SSL Scanner (crt.sh) and HaveIBeenPwned checker

Work Log:
- Read worklog.md and existing tool patterns (email-analysis, ip-domain, tool-shell, history-client, globals.css)
- Created /api/osint/subdomain route: validates domain, queries crt.sh CT logs with 20s AbortController timeout and a real-browser User-Agent, parses JSON array, splits name_value by newlines, strips wildcard (*.) prefix, dedupes subdomains matching the target domain, tracks firstSeen (min not_before), lastSeen (max not_after) and certCount per subdomain, sorts alphabetically; graceful fallbacks for non-JSON / empty / HTTP errors / AbortError returning count 0 with explanatory notes; always HTTP 200. Added GET info handler.
- Created subdomain-scanner.tsx: ToolShell with Network icon, form with monospace Input + "Escanear" button, loading Card with spinner + "crt.sh puede tardar 10-20 segundos" note, summary Card ("X subdominios encontrados"), scrollable list (max-h-96 overflow-y-auto) of subdomain Cards where each name is a clickable external link (https://${name}) opening new tab with ExternalLink icon, badges for firstSeen (Calendar), lastSeen (CalendarClock) and certCount (FileCertificate), empty state Card when count is 0, notes Card, saveHistory via tool:"subdomain", useToast feedback.
- Created /api/osint/hibp route: validates email; if HIBP_API_KEY present, calls real HIBP v3 breachedaccount endpoint with hibp-api-key/user-agent/accept headers and 10s timeout, handling 404 (no breaches), 401 (bad key -> local fallback + note), 429 (rate limited -> local fallback + note), other non-ok -> local fallback; maps HIBP response to {name, domain, date, dataClasses, pwnCount, description, isVerified}. If no API key, falls back to curated local DB of 12 well-known breaches (LinkedIn Scrape, Collection #1, Adobe, Dropbox, Yahoo, Canva, MyFitnessPal, MyHeritage, Twitter, Facebook, Dubsmash, Armor Games) matching by email domain OR generic mass breach (Collection #1) only for common providers (gmail/yahoo/hotmail/outlook/live/aol/icloud/protonmail/proton.me). Always returns source: "hibp"|"local", breaches[], notes[]. Added GET returning {configured: !!HIBP_API_KEY}.
- Created hibp-checker.tsx: ToolShell with ShieldAlert icon, email Input + "Comprobar" button, loading Card, prominent summary banner Card (ShieldAlert/ShieldCheck icon) with email + count + source badge (HaveIBeenPwned/DB local), local-source info Card linking to haveibeenpwned.com/API/Key, list of breach Cards each showing name + isVerified badge + date (Calendar) + pwnCount formatted (Users) + domain link (Globe), dataClasses as secondary badges, sanitized description text (HTML stripped), notes Card, saveHistory via tool:"hibp", useToast feedback (destructive variant when breaches found).
- Ran `bun run lint` — 0 errors; only 4 pre-existing warnings in map-view.tsx and reverse-image.tsx (untouched files). Dev log shows clean compilation.
- Verified both components export the exact names `SubdomainScannerTool` and `HibpCheckerTool` via grep.

Stage Summary:
- Created 4 new files (no existing files modified):
  - src/app/api/osint/subdomain/route.ts — crt.sh CT log scanner with 20s timeout, JSON/non-JSON/timeout fallbacks
  - src/components/osint/subdomain-scanner.tsx — SubdomainScannerTool with scrollable list, external links, date/cert badges
  - src/app/api/osint/hibp/route.ts — HaveIBeenPwned v3 integration with local 12-breach fallback DB
  - src/components/osint/hibp-checker.tsx — HibpCheckerTool with summary banner, breach cards, source badge
- Both tools integrate with existing ToolShell, useToast, saveHistory, and pure black/white theme tokens
- Lint clean (0 errors in new files), dev server compiles successfully
- Note: the new tools are NOT wired into the sidebar/dashboard (those are existing files I was instructed not to modify); an orchestrator can add `subdomain` and `hibp` ToolId entries and import the components when integrating

---
Task ID: 3-B
Agent: full-stack-developer
Task: Build Reverse Image Search and PGP Keys lookup tools

Work Log:
- Read worklog.md and reviewed existing tool patterns (tool-shell, exif-extractor, email-analysis, history-client) to match conventions
- Created src/components/osint/reverse-image.tsx — pure frontend ReverseImageTool with Tabs (Por URL / Subir imagen):
  - URL tab: Input + "Generar enlaces" button, validates http(s) prefix, shows preview img, renders 4 engine Cards (Google Lens, Yandex, TinEye, Bing) with per-engine description and "Abrir búsqueda" external link
  - Upload tab: drag&drop zone (border-2 border-dashed, drag states) + hidden file input + "Seleccionar imagen" button, validates image type and 15MB max, creates local object URL preview, renders 4 Cards linking to each engine upload page with manual-upload note
  - Saves history via saveHistory({ tool: "image", ... }); uses useToast for feedback
- Created src/app/api/osint/pgp/route.ts — POST handler validating email regex, querying keyserver.ubuntu.com (vindex mr format) for metadata + keys.openpgp.org for armored key block, with 8s timeouts:
  - Parses vindex pub/uid lines: fingerprint (uppercase), algorithm (maps 1=RSA, 17=DSA, 18=ECDH, 19=ECDSA, 22=EdDSA, etc.), key length, creation/expiry ISO dates, user IDs (decodes percent-encoding + HTML entities)
  - Falls back to ubuntu keyserver op=get if openpgp.org lacks armor
  - Returns { email, found, fingerprint, algorithm, keyLength, created, expires, userIds, armored, source, notes }
  - GET handler returns a small info object; all responses return 200
- Created src/components/osint/pgp-keys.tsx — PgpKeysTool with email form, loading Card, found/not-found branches:
  - Found: Info Card (fingerprint grouped by 4 hex chars in monospace, algorithm+length, creation/expiry dates, source keyserver), User IDs Card (max-h-64 scroll, monospace list with divide-y), ASCII armor Card (readonly Textarea font-mono max-h-64 + "Copiar clave" button with clipboard+toast), Notes Card
  - Not found: dedicated Card explaining that PGP keys are uncommon outside dev/security circles, plus notes list
  - Saves history via saveHistory({ tool: "pgp", ... })
- Ran bun run lint: initial 2 warnings on my files (unused eslint-disable directives for img elements) — removed them; final run shows 0 errors and only 2 pre-existing warnings in map-view.tsx (not my files)

Stage Summary:
- src/components/osint/reverse-image.tsx — ReverseImageTool (pure frontend, Tabs with URL/upload modes, 4 engine Cards per mode, drag&drop with 15MB validation)
- src/app/api/osint/pgp/route.ts — POST + GET handlers, dual-keyserver lookup (ubuntu vindex for metadata + openpgp.org for armor), algorithm mapping, ISO dates, HTML/percent-decoded user IDs
- src/components/osint/pgp-keys.tsx — PgpKeysTool with email form, full key info grid, scrollable user IDs, copy-to-clipboard ASCII armor, found/not-found/notes Cards
- Lint clean for all new files (0 errors, 0 warnings on my files)
- Both components export the exact required names ReverseImageTool and PgpKeysTool
- No existing files modified

---
Task ID: 3-D
Agent: full-stack-developer
Task: Build Document Metadata Extractor (PDF, DOCX, XLSX, PPTX)

Work Log:
- Read worklog.md and reviewed existing patterns (exif-extractor.tsx, exif route, tool-shell.tsx, history-client.ts) to match conventions exactly
- Created src/app/api/osint/document/route.ts — POST + GET handlers:
  - POST receives FormData with `file` field, validates File instance + 15MB max + extension/MIME (pdf/docx/xlsx/pptx)
  - PDF parser (no external lib): scans whole Buffer for `/Key` patterns (/Title, /Author, /Subject, /Keywords, /Creator, /Producer, /CreationDate, /ModDate, /Trapped). Handles literal `( ... )` strings with escape sequences (`\(`, `\)`, `\\`, `\n`, `\r`, `\t`, `\b`, `\f`, octal `\nnn`, line continuations, nested parens) and hex `< ... >` strings. Detects UTF-16BE BOM (0xFE 0xFF) for Unicode literal/hex strings. Converts PDF dates `D:YYYYMMDDHHmmss+HH'mm'` to ISO format. Validates preceding char to avoid matching `/Title` inside `/Titleish`.
  - OOXML parser (DOCX/XLSX/PPTX) uses JSZip to read `docProps/core.xml` (Dublin Core: dc:creator, dc:title, dc:subject, dc:keywords, cp:lastModifiedBy, dcterms:created, dcterms:modified, cp:revision, cp:category, cp:version, cp:contentStatus, dc:identifier, dc:language) and `docProps/app.xml` (Application, AppVersion, Company, Manager, Template, TotalTime, Pages/Words/Characters/Lines/Paragraphs, Slides/Notes/HiddenSlides, Worksheets, etc.)
  - Regex-based XML extractor with namespace-agnostic local-name matching + XML entity decoder (&lt; &gt; &quot; &apos; &#NN; &#xNN; &amp;)
  - Sets format per extension: "PDF", "Word (DOCX)", "Excel (XLSX)", "PowerPoint (PPTX)"
  - Sorts metadata keys alphabetically; builds notes: "Autor original: X" / "Software usado: Y" / "Empresa: Z" / "Manager: W" highlights first, then parse-error notes, then "No se encontraron metadatos en este documento" if empty
  - Parse errors handled gracefully (try/catch) — returns whatever was extracted plus an error note; only truly fatal errors return 500. Validation errors (no file / too big / unsupported type) return 400. GET returns supported formats + field list.
- Created src/components/osint/doc-metadata.tsx — DocMetadataTool client component:
  - ToolShell with title "Metadatos de Documentos", description, icon <FileText className="h-6 w-6" />
  - Drag&drop zone (border-2 border-dashed, dragOver states with border-foreground bg-accent/30) + hidden file input accept=".pdf,.docx,.xlsx,.pptx" + "Seleccionar documento" Button. Toast on invalid type/size.
  - POSTs FormData to /api/osint/document, shows loading Card with spinner "Extrayendo metadatos..."
  - File info Card: FileText icon, monospace filename, KB size, fileType, format Badge + Autor/Software Badges
  - "Datos destacados" Card (most OSINT-relevant): 2-col grid showing Autor/Creador and Software in monospace with descriptive helper text
  - "Todos los metadatos" Card with Table inside max-h-96 overflow-y-auto container (sticky header, monospace Campo/Valor columns with break-all)
  - Notas Card with AlertCircle icon and bullet list when notes exist
  - Empty metadata: muted message explaining metadata may have been stripped
  - Saves history via saveHistory({ tool: "document", query: file.name, results: data }); uses useToast for feedback
- Ran `bun run lint`: 0 errors, only 2 pre-existing warnings in map-view.tsx (NOT my files). My new files are lint-clean.
- Verified export name is exactly `DocMetadataTool` and API route exports POST + GET.

Stage Summary:
- src/app/api/osint/document/route.ts — POST + GET handlers. Manual PDF /Info dictionary parser (no external lib) handling literal/hex strings, escapes, octal, UTF-16BE BOM, and PDF-date→ISO conversion. OOXML parser via JSZip for docProps/core.xml + docProps/app.xml with regex-based namespace-agnostic XML tag extraction. Sorts metadata alphabetically, returns { fileName, fileSize, fileType, format, metadata, notes }. Graceful error handling, 200 for parse errors, 400 for validation, 500 only for fatal.
- src/components/osint/doc-metadata.tsx — DocMetadataTool client component with drag&drop, file info, prominent Autor/Software card, scrollable metadata table, and notes. Reuses EXIF tool visual patterns. Calls saveHistory({ tool: "document", ... }).
- No existing files modified. Lint clean for new files. Component exports the exact required name `DocMetadataTool`.

---
Task ID: FINAL-2
Agent: Main Orchestrator
Task: Add 7 new OSINT tools + Leaflet map enhancement, integrate, and verify end-to-end.

Work Log:
- Installed leaflet, @types/leaflet, jszip
- Created MapView component (pure Leaflet via dynamic import, CartoDB dark tiles, marker with popup) — avoids SSR window issues
- Integrated MapView into existing IP/Domain tool: renders dark map with marker when geo.lat/lon present
- Dispatched 4 parallel full-stack-developer subagents (Tasks 3-A, 3-B, 3-C, 3-D) to build 7 new tools:
  - 3-A: Link Analyzer (URL unshortener + Wayback) + Dork Builder
  - 3-B: Reverse Image Search (frontend-only, 4 engines) + PGP Keys lookup (keys.openpgp.org + ubuntu keyserver)
  - 3-C: Subdomain Scanner (crt.sh) + HIBP checker (real API w/ key, local fallback)
  - 3-D: Document Metadata Extractor (PDF manual /Info parse + OOXML via JSZip for docx/xlsx/pptx)
- All subagents created files only (no existing files modified), appended their own worklog sections
- Wired up types.ts (added 7 new ToolId entries to TOOLS array) and page.tsx (imports + ICONS + conditional rendering)
- Fixed 2 non-existent lucide icons (ImageSearch -> ScanSearch, FileCertificate -> BadgeCheck) in reverse-image.tsx and subdomain-scanner.tsx
- Fixed dashboard.tsx ICONS record (was missing 7 new tool icons -> "Element type is invalid" runtime error; added all entries)
- Improved PDF metadata parser: accept `)` and `>` as valid preceding separators for /Info keys (handles PDFs with consecutive fields)
- Verified with Agent Browser: all 14 sidebar items render, dashboard shows 13 tool cards
  - Dork Builder: fields fill, dork generates live, buttons enable
  - Link Analyzer: bit.ly URL resolved, redirect chain + Wayback snapshot shown
  - Subdomain Scanner: crt.sh returned dev/m/products/support/www.example.com
  - HIBP checker: gmail detected in Collection #1 (local mode)
  - PGP Keys: responded gracefully (not found for tested email)
  - Reverse Image Search: 4 engine links generated from image URL
  - Document Metadata: PDF extracted Title/Author/Creator/Producer/Subject/CreationDate/ModDate
  - IP/Domain map: Leaflet rendered (910x256, 8 dark tiles, 1 marker) for 8.8.8.8 geolocation
  - History: new tool searches (link, subdomain, hibp) saved correctly
- Lint clean (0 errors, 0 warnings), dev.log clean (no errors)
- Updated README.md: header now says "Trece herramientas", TOC updated with 13 sections, IP/Dominio section mentions map, 7 new tool sections added with use cases, History renumbered to 13

Stage Summary:
- OsintFlow now has 13 OSINT tools (was 6) + Leaflet map in IP tool
- All 7 new tools browser-verified end-to-end with real data
- Map renders with dark theme matching the app
- README fully updated for the new functionality
- Lint and runtime both clean

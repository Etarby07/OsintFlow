# Task 4-D — full-stack-developer

## Task
Build Email Permutation Generator/Verifier, Steganography Analyzer (LSB), and DirBuster Lite for the OsintFlow Next.js 16 project.

## Files created (no existing files modified)
- `src/app/api/osint/emailgen/route.ts` — POST + GET. Generates ~14 email permutations from first/last name + domain; verifies first 6 via raw SMTP (Node `net` to top-priority MX on port 25, 6s timeout, HELO/MAIL FROM/RCPT TO/QUIT state machine, multi-line response handling). Catch-all detection via fake `zzztest999-osintflow@` probe. Always 200. Ethical disclaimer in notes.
- `src/components/osint/emailgen.tsx` — exports `EmailGenTool`. Form (3 inputs), muted ethical disclaimer, loading card, summary card (valid/invalid/unknown + catch-all badges), scrollable permutations table (max-h-80), copy-valid button, MX records card, notes card. Saves history `tool: "emailgen"`.
- `src/app/api/osint/stego/route.ts` — POST + GET. Validates PNG/BMP/JPG ≤10MB; uses `sharp` to decode to raw sRGB; extracts LSB plane (R→G→B per pixel, row-major, first 2048 bytes); hex preview (256 B), ASCII preview (512 B), file-signature detection (PNG/JPG/ZIP/PDF/GIF), per-channel % of 1s, printable-ASCII runs ≥8 chars. Always 200.
- `src/components/osint/stego-analyzer.tsx` — exports `StegoTool`. Drag&drop zone (matches EXIF style), detected-signature card, LSB plane-stats table, hex/ASCII `<pre>` previews, text-fragments list, notes. Saves history `tool: "stego"`.
- `src/app/api/osint/dirbuster/route.ts` — POST + GET. 70-path built-in wordlist, concurrency-6 pool with 90s deadline, manual-redirect GET probes with 5s AbortController timeout, desktop UA, status classification (200/401/403/3xx/other, 404 & network errors skipped), sorted found list, ethical disclaimer. Always 200.
- `src/components/osint/dirbuster.tsx` — exports `DirBusterTool`. Prominent ethical disclaimer card first (border-destructive/40), form, loading note up to 90s, summary + scrollable found-paths table (max-h-96) with external links, notes. Saves history `tool: "dirbuster"`.

## Verification
- `bun run lint` — 0 errors, 0 warnings (completely clean).
- Exports confirmed via ripgrep: `EmailGenTool` (emailgen.tsx:66), `StegoTool` (stego-analyzer.tsx:49), `DirBusterTool` (dirbuster.tsx:66). All 3 API routes export POST + GET.
- Follows pure black/white dark-first theme tokens (bg-background, text-foreground, border-border, destructive, muted-foreground, accent) — no indigo/blue/colored accents.
- All ToolShell-wrapped, useToast feedback, saveHistory persistence, AbortController timeouts, always-200-when-possible, NextRequest/NextResponse.

## Notes for orchestrator
Tools are NOT wired into sidebar/dashboard/types.ts (those are existing files I was instructed not to modify). To integrate: add `emailgen`, `stego`, `dirbuster` ToolId entries to the TOOLS array in `src/lib/osint/types.ts`, import the components in `src/app/page.tsx` and `src/components/osint/dashboard.tsx`, and add icon entries to the ICONS records.

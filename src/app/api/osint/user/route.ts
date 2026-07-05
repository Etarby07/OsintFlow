import { NextRequest, NextResponse } from "next/server";

// Platforms list: name + URL builder. URL receives the alias.
// These are public profile URL patterns; OsintFlow only checks reachability.
const PLATFORMS: { name: string; url: (alias: string) => string }[] = [
  { name: "GitHub", url: (a) => `https://github.com/${a}` },
  { name: "GitLab", url: (a) => `https://gitlab.com/${a}` },
  { name: "Twitter / X", url: (a) => `https://x.com/${a}` },
  { name: "Instagram", url: (a) => `https://instagram.com/${a}` },
  { name: "TikTok", url: (a) => `https://www.tiktok.com/@${a}` },
  { name: "YouTube", url: (a) => `https://www.youtube.com/@${a}` },
  { name: "Reddit", url: (a) => `https://www.reddit.com/user/${a}` },
  { name: "Twitch", url: (a) => `https://www.twitch.tv/${a}` },
  { name: "Pinterest", url: (a) => `https://www.pinterest.com/${a}` },
  { name: "Medium", url: (a) => `https://medium.com/@${a}` },
  { name: "Dev.to", url: (a) => `https://dev.to/${a}` },
  { name: "HackerNews", url: (a) => `https://news.ycombinator.com/user?id=${a}` },
  { name: "Steam", url: (a) => `https://steamcommunity.com/id/${a}` },
  { name: "Spotify", url: (a) => `https://open.spotify.com/user/${a}` },
  { name: "SoundCloud", url: (a) => `https://soundcloud.com/${a}` },
  { name: "Vimeo", url: (a) => `https://vimeo.com/${a}` },
  { name: "Flickr", url: (a) => `https://www.flickr.com/people/${a}` },
  { name: "Behance", url: (a) => `https://www.behance.net/${a}` },
  { name: "Dribbble", url: (a) => `https://dribbble.com/${a}` },
  { name: "Keybase", url: (a) => `https://keybase.io/${a}` },
  { name: "Telegram (public)", url: (a) => `https://t.me/${a}` },
  { name: "VK", url: (a) => `https://vk.com/${a}` },
  { name: "Patreon", url: (a) => `https://www.patreon.com/${a}` },
  { name: "Mastodon (mstdn)", url: (a) => `https://mstdn.social/@${a}` },
  { name: "Blogger", url: (a) => `https://${a}.blogspot.com` },
  { name: "WordPress", url: (a) => `https://${a}.wordpress.com` },
  { name: "Replit", url: (a) => `https://replit.com/@${a}` },
  { name: "Codeberg", url: (a) => `https://codeberg.org/${a}` },
  { name: "About.me", url: (a) => `https://about.me/${a}` },
  { name: "Linktree", url: (a) => `https://linktr.ee/${a}` },
];

// Simple in-memory cache to avoid re-checking the same alias within a session.
const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 min

async function checkPlatform(
  name: string,
  url: string
): Promise<{ platform: string; url: string; exists: boolean; status: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OsintFlow/1.0; +https://github.com/osintflow)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);

    const status = res.status;
    // Heuristic: 2xx + not obviously a 404 page => candidate "found".
    let exists = status >= 200 && status < 400;
    if (exists) {
      try {
        const text = await res.text();
        const lower = text.toLowerCase();
        // Common "not found" signals across platforms.
        if (
          lower.includes("user not found") ||
          lower.includes("page not found") ||
          lower.includes("couldn't find") ||
          lower.includes("this profile does not exist") ||
          lower.includes("does not exist") ||
          (name === "Twitter / X" && lower.includes("this account doesn"))
        ) {
          exists = false;
        }
      } catch {
        /* ignore body read errors */
      }
    }
    // Telegram always returns 200 even for non-existent; treat as "possible".
    if (name === "Telegram (public)") {
      exists = status >= 200 && status < 400;
    }
    return { platform: name, url, exists, status };
  } catch {
    return { platform: name, url, exists: false, status: 0 };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const alias = String(body?.alias ?? "").trim();
    if (!alias) {
      return NextResponse.json(
        { error: "Alias requerido" },
        { status: 400 }
      );
    }
    if (!/^[a-zA-Z0-9._-]{2,40}$/.test(alias)) {
      return NextResponse.json(
        { error: "Alias inválido. Usa letras, números, . _ - (2-40 caracteres)" },
        { status: 400 }
      );
    }

    const cacheKey = alias.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ alias, profiles: cached.data });
    }

    const tasks = PLATFORMS.map((p) => checkPlatform(p.name, p.url(alias)));
    const profiles = await Promise.all(tasks);

    cache.set(cacheKey, { ts: Date.now(), data: profiles });

    return NextResponse.json({ alias, profiles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    platforms: PLATFORMS.map((p) => p.name),
    count: PLATFORMS.length,
  });
}

/**
 * Parse external video links (YouTube + Facebook) for embedding in social posts.
 * Returns a structured object suitable for storage and rendering.
 */

export type VideoProvider = "youtube" | "facebook";

export interface ParsedVideoEmbed {
  provider: VideoProvider;
  url: string;        // Original (canonicalized) URL
  videoId: string;    // Provider-specific ID (or original URL for FB if not extractable)
  embedUrl: string;   // Iframe src URL
  thumbnail?: string; // Optional poster
}

/* ------------------------------ YouTube ------------------------------ */

const YT_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
];

function parseYouTube(u: URL): ParsedVideoEmbed | null {
  let id: string | null = null;

  if (u.hostname === "youtu.be") {
    id = u.pathname.slice(1).split("/")[0] || null;
  } else if (u.pathname.startsWith("/watch")) {
    id = u.searchParams.get("v");
  } else if (u.pathname.startsWith("/shorts/")) {
    id = u.pathname.split("/")[2] || null;
  } else if (u.pathname.startsWith("/embed/")) {
    id = u.pathname.split("/")[2] || null;
  } else if (u.pathname.startsWith("/live/")) {
    id = u.pathname.split("/")[2] || null;
  }

  if (!id || !/^[\w-]{6,}$/.test(id)) return null;

  return {
    provider: "youtube",
    url: `https://www.youtube.com/watch?v=${id}`,
    videoId: id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.webp`,
  };
}

/* ------------------------------ Facebook ------------------------------ */

const FB_HOSTS = [
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "fb.watch",
  "fb.com",
];

function parseFacebook(u: URL): ParsedVideoEmbed | null {
  // Many shapes: /watch?v=ID, /watch/?v=ID, /<page>/videos/ID,
  // /reel/ID, /share/v/ID, /share/r/ID, fb.watch/<short>
  let id: string | null = null;

  if (u.hostname === "fb.watch" || u.hostname === "fb.com") {
    // Short link — we cannot resolve without a HEAD request; just embed the raw URL.
    id = u.pathname.replace(/^\/+|\/+$/g, "") || u.toString();
  } else if (u.pathname.startsWith("/watch")) {
    id = u.searchParams.get("v") || null;
  } else if (/\/videos\/(\d+)/.test(u.pathname)) {
    id = u.pathname.match(/\/videos\/(\d+)/)?.[1] || null;
  } else if (/\/reel\/(\d+)/.test(u.pathname)) {
    id = u.pathname.match(/\/reel\/(\d+)/)?.[1] || null;
  } else if (u.pathname.startsWith("/share/")) {
    id = u.pathname.split("/").filter(Boolean).pop() || null;
  } else if (/\/posts\/(\w+)/.test(u.pathname)) {
    id = u.pathname.match(/\/posts\/(\w+)/)?.[1] || null;
  }

  if (!id) return null;

  // Facebook's official video plugin accepts the full canonical URL.
  const canonical = u.toString();
  const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
    canonical
  )}&show_text=false&autoplay=false`;

  return {
    provider: "facebook",
    url: canonical,
    videoId: id,
    embedUrl,
  };
}

/* ------------------------------ Main API ------------------------------ */

export function parseVideoEmbed(input: string): ParsedVideoEmbed | null {
  if (!input) return null;
  const text = input.trim();

  // Quick URL extraction in case user pastes text + link
  const match = text.match(/https?:\/\/[^\s]+/i);
  const raw = match ? match[0] : text;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();
  if (YT_HOSTS.includes(host)) return parseYouTube(u);
  if (FB_HOSTS.includes(host)) return parseFacebook(u);
  return null;
}

export function isSupportedVideoUrl(input: string): boolean {
  return !!parseVideoEmbed(input);
}

export function providerLabel(p: VideoProvider): string {
  return p === "youtube" ? "YouTube" : "Facebook";
}

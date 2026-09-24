/**
 * Forensic data collector — ONLY runs for users on the watchlist.
 *
 * Collects deep browser/device fingerprints suitable for evidence:
 *  - Canvas / WebGL / Audio fingerprints (persist across incognito)
 *  - Hardware info (GPU, CPU cores, memory, touch)
 *  - Screen / timezone / locale / fonts / plugins
 *  - WebRTC IP leak (real IP behind VPN, when browser allows)
 *  - Behavioral metrics (typing speed, mouse pattern, session duration)
 *
 * Runs at most once per session. Fire-and-forget. Never blocks UI.
 */
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "forensic-collected-v1";
const VISITOR_ID_KEY = "visitor-id";
const IP_CACHE_KEY = "visitor-ip-cache";

function getVisitorId(): string | null {
  try { return localStorage.getItem(VISITOR_ID_KEY); } catch { return null; }
}
function getProfileId(): string | null {
  try {
    const s = localStorage.getItem("customer-session");
    return s ? JSON.parse(s).profile_id || JSON.parse(s).profileId || null : null;
  } catch { return null; }
}
function getProfilePhone(): string | null {
  try {
    const s = localStorage.getItem("customer-session");
    return s ? JSON.parse(s).phone || null : null;
  } catch { return null; }
}
function getCachedIp(): string | null {
  try { return sessionStorage.getItem(IP_CACHE_KEY); } catch { return null; }
}

// ────────────────────────────────────────────────────────────────
// Fingerprint helpers (best-effort, swallow all errors)
// ────────────────────────────────────────────────────────────────
async function sha256(input: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
}

function canvasFingerprint(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 280; c.height = 60;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("Griha Nova forensic-🌱-fp", 2, 15);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Griha Nova forensic-🌱-fp", 4, 17);
    return c.toDataURL();
  } catch { return ""; }
}

function webglFingerprint(): { vendor: string; renderer: string; raw: string } {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") as WebGLRenderingContext | null;
    if (!gl) return { vendor: "", renderer: "", raw: "" };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg ? String(gl.getParameter((dbg as any).UNMASKED_VENDOR_WEBGL) || "") : "";
    const renderer = dbg ? String(gl.getParameter((dbg as any).UNMASKED_RENDERER_WEBGL) || "") : "";
    const raw = `${gl.getParameter(gl.VERSION)}|${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}|${vendor}|${renderer}`;
    return { vendor, renderer, raw };
  } catch { return { vendor: "", renderer: "", raw: "" }; }
}

async function audioFingerprint(): Promise<string> {
  try {
    const Ctx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!Ctx) return "";
    const ctx = new Ctx(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 10000;
    const compressor = ctx.createDynamicsCompressor();
    osc.connect(compressor);
    compressor.connect(ctx.destination);
    osc.start(0);
    const buf = await ctx.startRendering();
    let sum = 0;
    const data = buf.getChannelData(0);
    for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
    return sum.toString();
  } catch { return ""; }
}

function detectFonts(): string[] {
  try {
    const baseFonts = ["monospace", "sans-serif", "serif"];
    const testString = "mmmmmmmmmmlli";
    const testSize = "72px";
    const candidates = [
      "Arial","Verdana","Times New Roman","Courier New","Georgia","Palatino","Garamond",
      "Bookman","Comic Sans MS","Trebuchet MS","Arial Black","Impact","Tahoma",
      "Lucida Sans","Calibri","Cambria","Consolas","SolaimanLipi","Kalpurush","Nikosh",
      "SutonnyMJ","Bangla","Noto Sans Bengali","Helvetica","Roboto","Segoe UI",
    ];
    const body = document.body;
    const span = document.createElement("span");
    span.style.fontSize = testSize;
    span.style.position = "absolute";
    span.style.left = "-9999px";
    span.style.visibility = "hidden";
    span.innerHTML = testString;
    body.appendChild(span);
    const baseSizes: Record<string, { w: number; h: number }> = {};
    for (const b of baseFonts) {
      span.style.fontFamily = b;
      baseSizes[b] = { w: span.offsetWidth, h: span.offsetHeight };
    }
    const detected: string[] = [];
    for (const f of candidates) {
      let isDetected = false;
      for (const b of baseFonts) {
        span.style.fontFamily = `'${f}',${b}`;
        if (span.offsetWidth !== baseSizes[b].w || span.offsetHeight !== baseSizes[b].h) {
          isDetected = true; break;
        }
      }
      if (isDetected) detected.push(f);
    }
    body.removeChild(span);
    return detected;
  } catch { return []; }
}

async function webrtcLeak(): Promise<{ local: string[]; public: string }> {
  return new Promise((resolve) => {
    const local = new Set<string>();
    let pub = "";
    try {
      const RTCConn = (window as any).RTCPeerConnection
        || (window as any).webkitRTCPeerConnection
        || (window as any).mozRTCPeerConnection;
      if (!RTCConn) return resolve({ local: [], public: "" });
      const pc = new RTCConn({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pc.createDataChannel("");
      pc.onicecandidate = (ev: any) => {
        if (!ev || !ev.candidate) return;
        const c = ev.candidate.candidate as string;
        const m = c.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9:]+:[a-f0-9:]+)/i);
        if (m && m[1]) {
          const ip = m[1];
          if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.|fe80:|::1)/i.test(ip)) {
            local.add(ip);
          } else {
            pub = ip;
          }
        }
      };
      pc.createOffer().then((o: any) => pc.setLocalDescription(o)).catch(() => {});
      setTimeout(() => {
        try { pc.close(); } catch {}
        resolve({ local: Array.from(local), public: pub });
      }, 2500);
    } catch { resolve({ local: [], public: "" }); }
  });
}

async function batteryInfo(): Promise<any> {
  try {
    const b = await (navigator as any).getBattery?.();
    if (!b) return null;
    return { level: b.level, charging: b.charging, chargingTime: b.chargingTime, dischargingTime: b.dischargingTime };
  } catch { return null; }
}

// ────────────────────────────────────────────────────────────────
// Behavioral tracking
// ────────────────────────────────────────────────────────────────
const sessionStart = Date.now();
let mouseMoves = 0;
let keystrokes = 0;
let lastKeystroke = 0;
const keystrokeIntervals: number[] = [];

if (typeof window !== "undefined") {
  window.addEventListener("mousemove", () => { mouseMoves++; }, { passive: true });
  window.addEventListener("keydown", () => {
    keystrokes++;
    const now = Date.now();
    if (lastKeystroke) keystrokeIntervals.push(now - lastKeystroke);
    lastKeystroke = now;
  }, { passive: true });
}

function behavioralMetrics() {
  const avgKeyInterval = keystrokeIntervals.length
    ? keystrokeIntervals.reduce((a,b)=>a+b,0) / keystrokeIntervals.length
    : 0;
  return {
    mouse_moves: mouseMoves,
    keystrokes,
    avg_keystroke_interval_ms: Math.round(avgKeyInterval),
    typing_samples: keystrokeIntervals.length,
  };
}

// ────────────────────────────────────────────────────────────────
// Main entry — collect & ship
// ────────────────────────────────────────────────────────────────
export async function collectForensicData(actionType: string = "page_view", actionDetails?: Record<string, any>): Promise<void> {
  // Run once per session per action
  try {
    const key = `${SESSION_KEY}:${actionType}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {}

  // Defer to idle so it never competes with main UI work
  const run = async () => {
    try {
      const [audio, webrtc, battery] = await Promise.all([
        audioFingerprint(),
        webrtcLeak(),
        batteryInfo(),
      ]);
      const webgl = webglFingerprint();
      const canvas = canvasFingerprint();
      const fonts = detectFonts();

      const screen_info = {
        width: screen.width,
        height: screen.height,
        avail_width: screen.availWidth,
        avail_height: screen.availHeight,
        color_depth: screen.colorDepth,
        pixel_depth: screen.pixelDepth,
        device_pixel_ratio: window.devicePixelRatio,
        orientation: (screen as any).orientation?.type || null,
      };

      const hardware_info = {
        cpu_cores: (navigator as any).hardwareConcurrency || null,
        device_memory_gb: (navigator as any).deviceMemory || null,
        max_touch_points: navigator.maxTouchPoints || 0,
        platform: navigator.platform,
        webgl_vendor: webgl.vendor,
        webgl_renderer: webgl.renderer,
      };

      const network_info = (navigator as any).connection ? {
        effective_type: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt,
        save_data: (navigator as any).connection.saveData,
      } : null;

      const plugins: any[] = [];
      try {
        for (let i = 0; i < (navigator.plugins?.length || 0); i++) {
          const p = navigator.plugins[i];
          plugins.push({ name: p.name, filename: p.filename, description: p.description });
        }
      } catch {}

      const fpRaw = [
        canvas, webgl.raw, audio, fonts.join(","),
        navigator.userAgent, navigator.platform, screen.width, screen.height,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.languages?.join(","),
      ].join("||");
      const device_fingerprint = await sha256(fpRaw);
      const canvas_fp = await sha256(canvas);
      const webgl_fp = await sha256(webgl.raw);

      const payload = {
        visitor_profile_id: getProfileId(),
        visitor_id: getVisitorId(),
        phone: getProfilePhone(),
        ip_address: getCachedIp(),
        page_path: typeof window !== "undefined" ? window.location.pathname : null,
        referrer: typeof document !== "undefined" ? document.referrer : null,
        action_type: actionType,
        action_details: actionDetails || null,
        user_agent: navigator.userAgent,
        device_fingerprint,
        canvas_fingerprint: canvas_fp,
        webgl_fingerprint: webgl_fp,
        audio_fingerprint: audio,
        fonts_list: fonts,
        screen_info,
        hardware_info,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        languages: Array.from(navigator.languages || []),
        platform: navigator.platform,
        plugins,
        battery_info: battery,
        network_info,
        webrtc_local_ips: webrtc.local,
        webrtc_public_ip: webrtc.public,
        session_duration_ms: Date.now() - sessionStart,
        behavioral_metrics: behavioralMetrics(),
      };

      // Server-side checks if user matches watchlist; if not, drops the payload.
      supabase.functions.invoke("forensic-collect", { body: payload }).catch(() => {});
    } catch {
      // Never throw
    }
  };

  if (typeof (window as any).requestIdleCallback === "function") {
    (window as any).requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
}

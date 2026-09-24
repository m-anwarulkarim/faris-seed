// Lightweight User-Agent parser for the admin order edit device panel.
// Surfaces device model, OS, browser, and in-app webview context (Instagram,
// Facebook, FB Lite, Messenger, TikTok, etc.) without an external dependency.

export interface ParsedUA {
  deviceType: "ফোন" | "ট্যাবলেট" | "PC" | "অজানা";
  deviceModel: string | null;     // e.g. "Samsung SM-A107F (Galaxy A10s)"
  os: string | null;              // e.g. "Android 11"
  browser: string | null;         // e.g. "Chrome 146"
  inApp: string | null;           // e.g. "Instagram in-app browser"
  raw: string;
}

const SAMSUNG_MODELS: Record<string, string> = {
  "SM-A107F": "Galaxy A10s",
  "SM-A105F": "Galaxy A10",
  "SM-A125F": "Galaxy A12",
  "SM-A325F": "Galaxy A32",
  "SM-A515F": "Galaxy A51",
  "SM-A536": "Galaxy A53 5G",
  "SM-G973": "Galaxy S10",
  "SM-G991": "Galaxy S21",
  "SM-N975": "Galaxy Note 10+",
};

function detectOS(ua: string): string | null {
  const u = ua;
  let m = u.match(/Android\s([\d.]+)/i);
  if (m) return `Android ${m[1]}`;
  m = u.match(/iPhone OS\s([\d_]+)/i) || u.match(/CPU OS\s([\d_]+)/i);
  if (m) return `iOS ${m[1].replace(/_/g, ".")}`;
  m = u.match(/Mac OS X\s([\d_.]+)/i);
  if (m) return `macOS ${m[1].replace(/_/g, ".")}`;
  m = u.match(/Windows NT\s([\d.]+)/i);
  if (m) {
    const map: Record<string, string> = {
      "10.0": "Windows 10/11",
      "6.3": "Windows 8.1",
      "6.2": "Windows 8",
      "6.1": "Windows 7",
    };
    return map[m[1]] || `Windows NT ${m[1]}`;
  }
  if (/Linux/i.test(u)) return "Linux";
  return null;
}

function detectDeviceType(ua: string): ParsedUA["deviceType"] {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "ট্যাবলেট";
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "ফোন";
  if (/Android/i.test(ua)) return "ফোন";
  if (/Windows|Macintosh|Linux/i.test(ua)) return "PC";
  return "অজানা";
}

function detectDeviceModel(ua: string): string | null {
  // iPhone / iPad
  if (/iPhone/i.test(ua)) return "Apple iPhone";
  if (/iPad/i.test(ua)) return "Apple iPad";

  // Samsung — pull model code like SM-A107F
  const sam = ua.match(/(SM-[A-Z0-9]+)/i);
  if (sam) {
    const code = sam[1].toUpperCase();
    const friendly =
      SAMSUNG_MODELS[code] ||
      Object.entries(SAMSUNG_MODELS).find(([k]) => code.startsWith(k))?.[1];
    return friendly ? `Samsung ${code} (${friendly})` : `Samsung ${code}`;
  }

  // Generic Android: try to grab "Build/" model token
  const buildMatch = ua.match(/;\s*([^;)]+)\s+Build\//i);
  if (buildMatch) return buildMatch[1].trim();

  // Xiaomi / Redmi / Vivo / Oppo / Realme model brands quick win
  const brand = ua.match(/(Redmi|Xiaomi|Vivo|OPPO|Realme|OnePlus|Huawei|Infinix|Tecno|Itel|Nokia|HTC|Symphony|Walton)\s+([A-Z0-9\-_]+)/i);
  if (brand) return `${brand[1]} ${brand[2]}`;

  return null;
}

function detectInApp(ua: string): string | null {
  if (/FBAN\/FBIOS|FBAV|FB_IAB|FBAN\/.*FBLite/i.test(ua) && /FBLite|FB_IAB.*FBLite/i.test(ua))
    return "Facebook Lite in-app browser";
  if (/Messenger|MessengerForiOS|MessengerLite/i.test(ua)) return "Messenger in-app browser";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook in-app browser";
  if (/Instagram/i.test(ua)) return "Instagram in-app browser";
  if (/TikTok|musical_ly|Bytedance/i.test(ua)) return "TikTok in-app browser";
  if (/Twitter|TwitterAndroid/i.test(ua)) return "X (Twitter) in-app browser";
  if (/Line\//i.test(ua)) return "LINE in-app browser";
  if (/Snapchat/i.test(ua)) return "Snapchat in-app browser";
  if (/; wv\)|Version\/[\d.]+ Chrome\/[\d.]+ Mobile/i.test(ua) && /WebView/i.test(ua))
    return "Android WebView";
  return null;
}

function detectBrowser(ua: string): string | null {
  // In-app browsers are reported separately, but we still try a base browser name.
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/Edg\/([\d.]+)/))) return `Edge ${m[1].split(".")[0]}`;
  if ((m = ua.match(/OPR\/([\d.]+)/))) return `Opera ${m[1].split(".")[0]}`;
  if ((m = ua.match(/Chrome\/([\d.]+)/)) && !/Edg|OPR/.test(ua))
    return `Chrome ${m[1].split(".")[0]}`;
  if ((m = ua.match(/Firefox\/([\d.]+)/))) return `Firefox ${m[1].split(".")[0]}`;
  if ((m = ua.match(/Version\/([\d.]+).*Safari/)) && !/Chrome/.test(ua))
    return `Safari ${m[1].split(".")[0]}`;
  return null;
}

export function parseUserAgent(ua: string | null | undefined): ParsedUA | null {
  if (!ua) return null;
  return {
    deviceType: detectDeviceType(ua),
    deviceModel: detectDeviceModel(ua),
    os: detectOS(ua),
    browser: detectBrowser(ua),
    inApp: detectInApp(ua),
    raw: ua,
  };
}

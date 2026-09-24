/**
 * Bot detection utility
 * Detects known bots, crawlers, and headless browsers
 */

export interface BotInfo {
  isBot: boolean;
  botName: string;
  botCategory: "search_engine" | "social" | "seo_tool" | "ai" | "monitoring" | "other";
}

const BOT_PATTERNS: { pattern: RegExp; name: string; category: BotInfo["botCategory"] }[] = [
  // Search Engines
  { pattern: /Googlebot/i, name: "Googlebot", category: "search_engine" },
  { pattern: /Googlebot-Image/i, name: "Googlebot-Image", category: "search_engine" },
  { pattern: /Googlebot-Video/i, name: "Googlebot-Video", category: "search_engine" },
  { pattern: /Google-InspectionTool/i, name: "Google-InspectionTool", category: "search_engine" },
  { pattern: /Storebot-Google/i, name: "Storebot-Google", category: "search_engine" },
  { pattern: /AdsBot-Google/i, name: "AdsBot-Google", category: "search_engine" },
  { pattern: /Mediapartners-Google/i, name: "Mediapartners-Google", category: "search_engine" },
  { pattern: /bingbot/i, name: "Bingbot", category: "search_engine" },
  { pattern: /Baiduspider/i, name: "Baiduspider", category: "search_engine" },
  { pattern: /YandexBot/i, name: "YandexBot", category: "search_engine" },
  { pattern: /DuckDuckBot/i, name: "DuckDuckBot", category: "search_engine" },
  { pattern: /Sogou/i, name: "Sogou", category: "search_engine" },
  { pattern: /Yahoo! Slurp/i, name: "Yahoo Slurp", category: "search_engine" },

  // Social Media
  { pattern: /facebookexternalhit/i, name: "Facebook Crawler", category: "social" },
  { pattern: /Facebot/i, name: "Facebot", category: "social" },
  { pattern: /Twitterbot/i, name: "Twitterbot", category: "social" },
  { pattern: /LinkedInBot/i, name: "LinkedInBot", category: "social" },
  { pattern: /WhatsApp/i, name: "WhatsApp Preview", category: "social" },
  { pattern: /Slackbot/i, name: "Slackbot", category: "social" },
  { pattern: /TelegramBot/i, name: "TelegramBot", category: "social" },
  { pattern: /Discordbot/i, name: "Discordbot", category: "social" },
  { pattern: /PinterestBot/i, name: "Pinterest", category: "social" },
  { pattern: /Snapchat/i, name: "Snapchat", category: "social" },

  // SEO Tools
  { pattern: /AhrefsBot/i, name: "AhrefsBot", category: "seo_tool" },
  { pattern: /SemrushBot/i, name: "SemrushBot", category: "seo_tool" },
  { pattern: /DotBot/i, name: "DotBot", category: "seo_tool" },
  { pattern: /MJ12bot/i, name: "Majestic", category: "seo_tool" },
  { pattern: /MojeekBot/i, name: "MojeekBot", category: "seo_tool" },
  { pattern: /DataForSeoBot/i, name: "DataForSeoBot", category: "seo_tool" },
  { pattern: /Screaming Frog/i, name: "Screaming Frog", category: "seo_tool" },
  { pattern: /rogerbot/i, name: "Moz Rogerbot", category: "seo_tool" },

  // AI Bots
  { pattern: /GPTBot/i, name: "GPTBot (OpenAI)", category: "ai" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot (Anthropic)", category: "ai" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT-User", category: "ai" },
  { pattern: /Google-Extended/i, name: "Google-Extended (AI)", category: "ai" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot", category: "ai" },
  { pattern: /Bytespider/i, name: "Bytespider (ByteDance)", category: "ai" },
  { pattern: /PetalBot/i, name: "PetalBot (Huawei)", category: "ai" },
  { pattern: /CCBot/i, name: "CCBot (Common Crawl)", category: "ai" },

  // Monitoring / Uptime
  { pattern: /UptimeRobot/i, name: "UptimeRobot", category: "monitoring" },
  { pattern: /Pingdom/i, name: "Pingdom", category: "monitoring" },
  { pattern: /StatusCake/i, name: "StatusCake", category: "monitoring" },
  { pattern: /Site24x7/i, name: "Site24x7", category: "monitoring" },

  // Generic patterns (last resort)
  { pattern: /bot(?![a-z])/i, name: "Unknown Bot", category: "other" },
  { pattern: /crawler/i, name: "Unknown Crawler", category: "other" },
  { pattern: /spider/i, name: "Unknown Spider", category: "other" },
  { pattern: /headless/i, name: "Headless Browser", category: "other" },
  { pattern: /PhantomJS/i, name: "PhantomJS", category: "other" },
  { pattern: /Lighthouse/i, name: "Lighthouse", category: "monitoring" },
  { pattern: /PTST/i, name: "PageSpeed Insights", category: "monitoring" },
  { pattern: /Chrome-Lighthouse/i, name: "Lighthouse", category: "monitoring" },
];

let _cached: BotInfo | null = null;

export function detectBot(userAgent?: string): BotInfo {
  if (_cached && !userAgent) return _cached;

  const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!ua) {
    const result: BotInfo = { isBot: false, botName: "", botCategory: "other" };
    if (!userAgent) _cached = result;
    return result;
  }

  // Check navigator.webdriver (headless browsers)
  if (typeof navigator !== "undefined" && (navigator as any).webdriver) {
    const result: BotInfo = { isBot: true, botName: "Headless Browser (webdriver)", botCategory: "other" };
    if (!userAgent) _cached = result;
    return result;
  }

  for (const { pattern, name, category } of BOT_PATTERNS) {
    if (pattern.test(ua)) {
      const result: BotInfo = { isBot: true, botName: name, botCategory: category };
      if (!userAgent) _cached = result;
      return result;
    }
  }

  const result: BotInfo = { isBot: false, botName: "", botCategory: "other" };
  if (!userAgent) _cached = result;
  return result;
}

export function isBot(userAgent?: string): boolean {
  return detectBot(userAgent).isBot;
}

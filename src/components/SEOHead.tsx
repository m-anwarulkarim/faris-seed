import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description?: string;
  image?: string | null;
  url?: string;
  type?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const SITE_NAME = "Griha Nova";
const SITE_URL = "https://grihanova.com";
const DEFAULT_DESC = "GrihaNova — ফ্যাশন, এক্সেসরিজ, ইলেকট্রনিক্স, হোম ও কিডস পণ্যের আধুনিক অনলাইন শপ। সারাদেশে ক্যাশ অন ডেলিভারি।";
const DEFAULT_IMAGE = "https://storage.googleapis.com/gpt-engineer-file-uploads/zPJGgdf73cObI0yzP8Qljf2mgRs2/social-images/social-1774167712019-10206070.webp";
const JSON_LD_ID = "seo-json-ld";

function setMeta(property: string, content: string, isName = false) {
  const selector = isName ? `meta[name="${property}"]` : `meta[property="${property}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    if (isName) el.setAttribute("name", property);
    else el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export default function SEOHead({ title, description, image, url, type = "website", jsonLd }: SEOHeadProps) {
  useEffect(() => {
    const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
    const desc = description || DEFAULT_DESC;
    const img = image || DEFAULT_IMAGE;
    const pageUrl = url || `${SITE_URL}${window.location.pathname}`;

    document.title = fullTitle;
    setMeta("description", desc, true);
    setMeta("og:title", fullTitle);
    setMeta("og:description", desc);
    setMeta("og:image", img);
    setMeta("og:url", pageUrl);
    setMeta("og:type", type);
    setMeta("og:site_name", SITE_NAME);
    setMeta("twitter:card", "summary_large_image", true);
    setMeta("twitter:title", fullTitle, true);
    setMeta("twitter:description", desc, true);
    setMeta("twitter:image", img, true);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", pageUrl);

    // JSON-LD (supports single object or array)
    const ldItems = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    // Remove old scripts
    document.querySelectorAll(`script.${JSON_LD_ID}`).forEach((el) => el.remove());
    ldItems.forEach((item, i) => {
      const script = document.createElement("script");
      script.className = JSON_LD_ID;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(item);
      document.head.appendChild(script);
    });

    return () => {
      document.title = SITE_NAME;
      setMeta("description", DEFAULT_DESC, true);
      setMeta("og:title", SITE_NAME);
      setMeta("og:description", DEFAULT_DESC);
      setMeta("og:image", DEFAULT_IMAGE);
      setMeta("twitter:title", SITE_NAME, true);
      setMeta("twitter:description", DEFAULT_DESC, true);
      setMeta("twitter:image", DEFAULT_IMAGE, true);
      document.querySelectorAll(`script.${JSON_LD_ID}`).forEach((el) => el.remove());
    };
  }, [title, description, image, url, type, jsonLd]);

  return null;
}

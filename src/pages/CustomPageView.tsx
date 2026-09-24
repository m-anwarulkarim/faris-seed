import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCheckoutDialog } from "@/contexts/CheckoutDialogContext";
import { loadPageBuilderFonts } from "@/lib/lazyFonts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ExternalLink, Loader2, Check } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { useCart } from "@/contexts/CartContext";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { toast } from "sonner";
import { getDeliveryCharge } from "@/lib/delivery";
import { DELIVERY_CONFIG_EVENT, getDeliveryTiers, loadDeliveryTiers, loadDhakaConfig, loadTiersEnabled, getDhakaConfig, getSavedDeliveryArea, setSavedDeliveryArea } from "@/lib/deliveryTiers";

// Landing-page delivery charge resolver.
// Source of truth: global admin delivery tiers at /e/settings/delivery-tiers.
function resolveLandingDeliveryCharge(
  data: any,
  subtotal: number,
): number {
  if (!data?.showDelivery) return 0;
  return getDeliveryCharge(subtotal);
}


export interface Block {
  id: string;
  type: "hero" | "text" | "heading" | "paragraph" | "image" | "button" | "product" | "video" | "divider" | "features" | "countdown" | "testimonial" | "faq" | "product-grid" | "gallery" | "banner" | "social-proof" | "spacer" | "html" | "comparison" | "pricing" | "contact-form" | "map" | "columns" | "flex-container" | "grid-container" | "image-slider" | "checkout-form" | "combo-grid";
  data: Record<string, any>;
}

interface LandingProduct {
  productId: string;
  autoCart: boolean;
}

export default function CustomPageView() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { open: openCheckoutDialog } = useCheckoutDialog();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [landingProducts, setLandingProducts] = useState<LandingProduct[]>([]);
  const { items, addItem } = useCart();
  const autoCartDone = useRef(false);
  const [, setDeliveryConfigVersion] = useState(0);

  // Load page-builder fonts lazily for custom pages
  useEffect(() => { loadPageBuilderFonts(); }, []);

  // Keep landing-page checkout delivery charge synced with admin delivery tiers.
  useEffect(() => {
    Promise.all([loadDeliveryTiers(), loadDhakaConfig(), loadTiersEnabled()])
      .finally(() => setDeliveryConfigVersion((v) => v + 1));
    const handler = () => setDeliveryConfigVersion((v) => v + 1);
    window.addEventListener(DELIVERY_CONFIG_EVENT, handler);
    return () => window.removeEventListener(DELIVERY_CONFIG_EVENT, handler);
  }, []);

  useEffect(() => {
    const fetchPage = async () => {
      const fullSlug = `/${slug}`;
      const { data } = await supabase
        .from("custom_pages")
        .select("*")
        .eq("slug", fullSlug)
        .eq("is_published", true)
        .maybeSingle();
      setPage(data);

      if (data?.content) {
        try {
          const parsed = JSON.parse(data.content);
          if (Array.isArray(parsed)) {
            // Legacy format
            setBlocks(parsed);
          } else if (parsed && typeof parsed === "object") {
            setBlocks(Array.isArray(parsed.blocks) ? parsed.blocks : []);
            setLandingProducts(Array.isArray(parsed.landingProducts) ? parsed.landingProducts : []);
          }
        } catch {
          // Not JSON, will render as plain text
        }
      }

      setLoading(false);
    };
    fetchPage();
  }, [slug]);

  // Auto-cart logic
  useEffect(() => {
    if (autoCartDone.current || landingProducts.length === 0) return;
    const sessionKey = `auto-cart-${slug}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const autoCartItems = landingProducts.filter(lp => lp.autoCart);
    if (autoCartItems.length === 0) return;

    const productIds = autoCartItems.map(lp => lp.productId);

    supabase
      .from("products_public")
      .select("id, name, regular_price, offer_price, product_image, short_description, unlock_threshold")
      .in("id", productIds)
      .then(({ data: prods }) => {
        if (!prods || prods.length === 0) return;
        prods.forEach((p: any) => {
          // Skip if already in cart
          if (items.find(ci => ci.id === p.id)) return;
          const isFreeGift = !!p.unlock_threshold && p.unlock_threshold > 0;
          addItem({
            id: p.id,
            name: p.name,
            price: isFreeGift ? 0 : (p.offer_price || p.regular_price),
            oldPrice: isFreeGift ? null : (p.offer_price ? p.regular_price : null),
            image: p.product_image || "",
            unlockThreshold: isFreeGift ? p.unlock_threshold : null,
          });
        });
        sessionStorage.setItem(sessionKey, "1");
        autoCartDone.current = true;
      });
  }, [landingProducts, slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!page) {
    navigate("/", { replace: true });
    return null;
  }

  // If content wasn't valid JSON blocks, render as plain text
  if (blocks.length === 0 && !page.content?.startsWith("{") && !page.content?.startsWith("[")) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead title={page.title} />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <h1 className="text-2xl font-bold mb-4">{page.title}</h1>
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">{page.content}</div>
        </div>
      </div>
    );
  }

  const hasLandingProducts = landingProducts.length > 0;

  // Extract page-level style
  const pageStyle: React.CSSProperties = (() => {
    try {
      const parsed = JSON.parse(page.content || "{}");
      if (parsed?.customCss) {
        const s = typeof parsed.customCss === "string" ? JSON.parse(parsed.customCss) : parsed.customCss;
        return buildStyleObj(s);
      }
      return {};
    } catch { return {}; }
  })();

  return (
    <div className="min-h-screen bg-background" style={pageStyle}>
      <SEOHead title={page.title} />
      <div className={`w-full ${hasLandingProducts ? "pb-12" : ""}`}>
        {blocks.filter(b => !b.data?._hidden).map((block) => (
          <BlockRenderer key={block.id} block={block} />
        ))}
      </div>

      {/* Sticky compact checkout button */}
      {hasLandingProducts && (
        <div className="fixed bottom-6 left-16 right-16 z-50">
          <Button
            className="w-full h-10 rounded-full text-sm font-bold gap-1.5 shadow-xl"
            style={{ fontFamily: "'Hind Siliguri', sans-serif" }}
            onClick={() => {
              const checkoutEl = document.querySelector('[data-block-type="checkout-form"]');
              if (checkoutEl) {
                checkoutEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                openCheckoutDialog();
              }
            }}
          >
            <ShoppingBag className="w-4 h-4" />
            অর্ডার করুন
          </Button>
        </div>
      )}
    </div>
  );
}
export function buildStyleObj(s: Record<string, any>): React.CSSProperties {
  const style: Record<string, any> = {};
  const directKeys = [
    "backgroundColor", "color", "fontSize", "fontWeight", "textAlign",
    "borderRadius", "border", "borderColor", "width", "height",
    "minWidth", "maxWidth", "boxShadow", "background", "display",
    "gap", "justifyContent", "overflow", "position", "zIndex",
    "transform", "transition", "letterSpacing", "lineHeight",
    "textDecoration", "textTransform", "fontFamily",
    // New keys
    "flexDirection", "flexWrap", "alignItems",
    "gridTemplateColumns", "gridTemplateRows",
    "top", "right", "bottom", "left",
    "cursor", "aspectRatio", "objectFit", "wordBreak", "whiteSpace",
    "filter", "backdropFilter", "outline", "listStyle",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "marginTop", "marginRight", "marginBottom", "marginLeft",
  ];
  for (const key of directKeys) {
    if (s[key]) style[key] = s[key];
  }
  if (s.padding && !s.paddingTop) style.padding = typeof s.padding === "number" ? `${s.padding}px` : s.padding;
  if (s.margin && !s.marginTop) style.margin = typeof s.margin === "number" ? `${s.margin}px` : s.margin;
  if (s.borderRadius && typeof s.borderRadius === "number") style.borderRadius = `${s.borderRadius}px`;
  if (s.opacity !== undefined && s.opacity !== 100) style.opacity = s.opacity / 100;

  // Parse raw CSS overrides
  if (s._rawCss) {
    const lines = s._rawCss.split("\n").filter((l: string) => l.includes(":"));
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      const prop = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).replace(/;$/, "").trim();
      if (prop && val) {
        const camelProp = prop.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
        style[camelProp] = val;
      }
    }
  }
  return style;
}

export function BlockRenderer({ block }: { block: Block }) {
  const blockStyle = block.data?._style ? buildStyleObj(block.data._style) : {};

  const inner = (() => {
    switch (block.type) {
      case "hero": {
        const bgStyle = block.data.bgImage
          ? `linear-gradient(160deg, rgba(20,60,30,0.92), rgba(30,80,40,0.88)), url(${block.data.bgImage}) center/cover`
          : block.data.bgColor || "linear-gradient(160deg, hsl(142, 55%, 22%), hsl(142, 50%, 32%))";
        const hasPrice = block.data.regularPrice || block.data.offerPrice;
        return (
          <div
            className="relative w-full flex flex-col items-center text-center px-4 pt-5 pb-6 overflow-hidden"
            style={{ background: bgStyle, fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}
          >
            {/* Decorative circles */}
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/5" />
            <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-white/[0.03]" />

            {/* Subtitle / category line */}
            {block.data.subtitle && (
              <p className="relative text-xs text-white/80 mb-1 tracking-wider font-medium">{block.data.subtitle}</p>
            )}

            {/* Main title */}
            {block.data.title && (
              <h1
                className="relative font-extrabold text-white mb-3 whitespace-nowrap w-full drop-shadow-sm"
                style={{ fontSize: 'clamp(1.3rem, 6.5vw, 2.2rem)' }}
              >
                {block.data.title}
              </h1>
            )}

            {/* Price comparison boxes */}
            {hasPrice && (
              <div className="relative grid grid-cols-2 gap-2.5 w-full max-w-sm mb-3">
                {/* Regular price */}
                <div className="bg-white/95 backdrop-blur-sm rounded-xl py-2.5 px-3 text-center shadow-md border border-white/20">
                  <p className="text-[10px] text-gray-500 font-medium mb-0.5 tracking-wide">রেগুলার মূল্য</p>
                  <p className="text-base font-extrabold text-gray-400 line-through decoration-red-500 decoration-2">
                    {block.data.regularPrice || "০"} টাকা
                  </p>
                </div>
                {/* Offer price */}
                <div className="bg-white backdrop-blur-sm rounded-xl py-2.5 px-3 text-center shadow-md border border-emerald-100 ring-2 ring-emerald-500/20">
                  <p className="text-[10px] text-gray-500 font-medium mb-0.5 tracking-wide">অফার মূল্য</p>
                  <p className="text-base font-extrabold text-emerald-700">
                    {block.data.offerPrice || "০"} টাকা
                  </p>
                </div>
              </div>
            )}

            {/* Trust text */}
            {block.data.trustText && (
              <div className="relative mb-3">
                <p className="text-[12px] text-white font-semibold bg-white/10 border border-white/15 rounded-full px-5 py-1.5 backdrop-blur-sm shadow-sm">
                  {block.data.trustText}
                </p>
              </div>
            )}

            {/* Delivery info boxes */}
            {(block.data.deliveryLabel || block.data.deliveryOffer) && (
              <div className="relative grid grid-cols-2 gap-2.5 w-full max-w-sm mb-3">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl py-2 px-2.5 text-center shadow-md border border-white/20">
                  <p className="text-[10px] text-gray-500 font-medium">হোম ডেলিভারি</p>
                  <p className="text-[13px] font-bold text-gray-800">{block.data.deliveryLabel || "রেগুলার ১২০ টাকা"}</p>
                </div>
                <div className="bg-white backdrop-blur-sm rounded-xl py-2 px-2.5 text-center shadow-md border border-emerald-100 ring-2 ring-emerald-500/20">
                  <p className="text-[10px] text-gray-500 font-medium">এখন সারাদেশে</p>
                  <p className="text-[13px] font-bold text-emerald-700">{block.data.deliveryOffer || "মাত্র ৪৮ টাকা"}</p>
                </div>
              </div>
            )}

            {/* Bottom summary text */}
            {block.data.summaryText && (
              <p className="relative text-sm font-bold text-white drop-shadow-sm">{block.data.summaryText}</p>
            )}

            {/* Sub-heading under summary */}
            {block.data.packageLabel && (
              <p className="relative text-xs text-amber-200 font-semibold mt-1.5 tracking-wide">{block.data.packageLabel}</p>
            )}

            {block.data.buttonText && (
              <a href={block.data.buttonLink || "#"} className="relative mt-3">
                <Button size="lg" className="rounded-full h-10 px-8 text-sm font-semibold shadow-xl">
                  {block.data.buttonText}
                </Button>
              </a>
            )}
          </div>
        );
      }
      case "text":
        return (
          <div className="max-w-2xl mx-auto px-5 py-8">
            {block.data.heading && (
              <h2 className="text-xl font-bold text-foreground mb-3">{block.data.heading}</h2>
            )}
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {block.data.body || ""}
            </div>
          </div>
        );
      case "heading": {
        const level = block.data.level || 2;
        const sizeClass = level === 1 ? "text-3xl" : level === 3 ? "text-lg" : level === 4 ? "text-base" : "text-xl";
        const Tag = `h${level}` as keyof JSX.IntrinsicElements;
        const headingStyle = block.data._style ? buildStyleObj(block.data._style) : {};
        return (
          <div className="max-w-2xl mx-auto px-5 py-4">
            <Tag style={headingStyle} className={`font-bold ${sizeClass}`}>
              {block.data.text || "শিরোনাম"}
            </Tag>
          </div>
        );
      }
      case "paragraph":
        return (
          <div className="max-w-2xl mx-auto px-5 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {block.data.text || ""}
            </p>
          </div>
        );
      case "image":
        return (
          <div className={`w-full ${block.data.fullWidth ? "" : "max-w-2xl mx-auto"} px-5 py-4`}>
            {block.data.src && (
              <img
                src={block.data.src}
                alt={block.data.alt || ""}
                className="w-full rounded-xl object-cover"
                style={{ maxHeight: block.data.maxHeight || "400px" }}
              />
            )}
            {block.data.caption && (
              <p className="text-xs text-muted-foreground text-center mt-2">{block.data.caption}</p>
            )}
          </div>
        );
      case "button":
        return (
          <div className="flex justify-center px-5 py-4">
            <a href={block.data.link || "#"} target={block.data.external ? "_blank" : undefined} rel="noopener noreferrer">
              <Button
                size="lg"
                variant={block.data.variant || "default"}
                className="rounded-xl h-12 px-8 text-base font-semibold gap-2 shadow"
              >
                {block.data.icon === "cart" && <ShoppingBag className="w-5 h-5" />}
                {block.data.icon === "link" && <ExternalLink className="w-5 h-5" />}
                {block.data.text || "বাটন"}
              </Button>
            </a>
          </div>
        );
      case "product":
        if (!block.data.productId) {
          return (
            <div className="max-w-2xl mx-auto px-5 py-8">
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <span className="text-3xl block mb-2">📦</span>
                <p className="text-sm text-muted-foreground">প্রোডাক্ট সিলেক্ট করুন</p>
              </div>
            </div>
          );
        }
        return <ProductBlock productId={block.data.productId} />;
      case "video":
        return (
          <div className="max-w-2xl mx-auto px-5 py-4">
            {block.data.heading && (
              <h3 className="text-lg font-semibold text-foreground mb-3">{block.data.heading}</h3>
            )}
            {block.data.url ? (
              <div className="aspect-video rounded-xl overflow-hidden bg-muted">
                <iframe
                  src={getEmbedUrl(block.data.url)}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            ) : (
              <div className="aspect-video rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                <div className="text-center">
                  <span className="text-3xl block mb-2">🎬</span>
                  <p className="text-sm text-muted-foreground">ভিডিও URL দিন</p>
                </div>
              </div>
            )}
          </div>
        );
      case "divider":
        return <div className="max-w-2xl mx-auto px-5 py-4"><hr className="border-border" /></div>;
      case "features":
        return (
          <div className="max-w-2xl mx-auto px-5 py-8">
            {block.data.heading && (
              <h2 className="text-xl font-bold text-foreground mb-4 text-center">{block.data.heading}</h2>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(block.data.items || []).map((item: any, i: number) => (
                <div key={i} className="bg-muted/50 rounded-xl p-4 text-center">
                  <span className="text-2xl block mb-1">{item.emoji || "✅"}</span>
                  <p className="text-xs font-medium text-foreground">{item.title}</p>
                  {item.desc && <p className="text-[10px] text-muted-foreground mt-1">{item.desc}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      case "countdown":
        return <CountdownBlock data={block.data} />;
      case "testimonial":
        return (
          <div className="max-w-2xl mx-auto px-5 py-8">
            {block.data.heading && <h2 className="text-xl font-bold text-foreground mb-4 text-center">{block.data.heading}</h2>}
            <div className="space-y-4">
              {(block.data.items || []).map((item: any, i: number) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    {item.avatar && <img src={item.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name || "গ্রাহক"}</p>
                      {item.role && <p className="text-[10px] text-muted-foreground">{item.role}</p>}
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {Array.from({ length: item.rating || 5 }).map((_, s) => (
                        <span key={s} className="text-yellow-400 text-sm">⭐</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.text || ""}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "faq":
        return (
          <div className="max-w-2xl mx-auto px-5 py-8">
            {block.data.heading && <h2 className="text-xl font-bold text-foreground mb-4 text-center">{block.data.heading}</h2>}
            <Accordion type="single" collapsible className="w-full">
              {(block.data.items || []).map((item: any, i: number) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-sm text-foreground">{item.question || "প্রশ্ন"}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{item.answer || ""}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );
      case "product-grid":
        return <ProductGridBlock data={block.data} />;
      case "gallery":
        return (
          <div className="max-w-2xl mx-auto px-5 py-6">
            {block.data.heading && <h2 className="text-lg font-bold text-foreground mb-3">{block.data.heading}</h2>}
            <div className={`grid gap-2 ${block.data.cols === 3 ? "grid-cols-3" : block.data.cols === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
              {(block.data.images || []).map((img: any, i: number) => (
                <img key={i} src={img.src} alt={img.alt || ""} className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          </div>
        );
      case "banner":
        return (
          <div className="w-full px-5 py-3" style={{ background: block.data.bgColor || "hsl(var(--primary))" }}>
            <div className="max-w-2xl mx-auto flex items-center justify-center gap-3 text-center">
              {block.data.emoji && <span className="text-xl">{block.data.emoji}</span>}
              <p className="text-sm font-semibold" style={{ color: block.data.textColor || "#fff" }}>{block.data.text || "ব্যানার টেক্সট"}</p>
              {block.data.buttonText && (
                <a href={block.data.buttonLink || "#"}>
                  <Button size="sm" variant="secondary" className="h-7 text-xs rounded-full">{block.data.buttonText}</Button>
                </a>
              )}
            </div>
          </div>
        );
      case "social-proof":
        return (
          <div className="max-w-2xl mx-auto px-5 py-8">
            <div className="flex flex-wrap items-center justify-center gap-6">
              {(block.data.items || []).map((item: any, i: number) => (
                <div key={i} className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-primary">{item.value || "0"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.label || "লেবেল"}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "spacer":
        return <div style={{ height: block.data.height || "40px" }} />;
      case "html":
        return (
          <div className="max-w-2xl mx-auto px-5 py-4">
            <div dangerouslySetInnerHTML={{ __html: block.data.code || "" }} />
          </div>
        );
      case "comparison":
        return (
          <div className="max-w-2xl mx-auto px-5 py-8 overflow-x-auto">
            {block.data.heading && <h2 className="text-xl font-bold text-foreground mb-4 text-center">{block.data.heading}</h2>}
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b border-border text-muted-foreground">ফিচার</th>
                  {(block.data.columns || []).map((col: string, i: number) => (
                    <th key={i} className="p-2 border-b border-border text-foreground text-center">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(block.data.rows || []).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-border">
                    <td className="p-2 text-foreground font-medium">{row.feature}</td>
                    {(row.values || []).map((v: string, j: number) => (
                      <td key={j} className="p-2 text-center text-muted-foreground">{v === "true" ? "✅" : v === "false" ? "❌" : v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "pricing":
        return (
          <div className="max-w-3xl mx-auto px-5 py-8">
            {block.data.heading && <h2 className="text-xl font-bold text-foreground mb-6 text-center">{block.data.heading}</h2>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(block.data.plans || []).map((plan: any, i: number) => (
                <div key={i} className={`bg-card border rounded-2xl p-5 text-center ${plan.highlight ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border"}`}>
                  <h3 className="text-lg font-bold text-foreground">{plan.name || "প্ল্যান"}</h3>
                  <p className="text-3xl font-bold text-primary my-3">৳{plan.price || "0"}</p>
                  {plan.period && <p className="text-xs text-muted-foreground mb-4">/{plan.period}</p>}
                  <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                    {(plan.features || []).map((f: string, fi: number) => (
                      <li key={fi}>✅ {f}</li>
                    ))}
                  </ul>
                  {plan.buttonText && (
                    <a href={plan.buttonLink || "#"}>
                      <Button className="w-full rounded-xl">{plan.buttonText}</Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case "contact-form":
        return (
          <div className="max-w-md mx-auto px-5 py-8">
            {block.data.heading && <h2 className="text-xl font-bold text-foreground mb-4 text-center">{block.data.heading}</h2>}
            <div className="space-y-3 bg-card border border-border rounded-2xl p-5">
              <input type="text" placeholder={block.data.namePlaceholder || "আপনার নাম"} className="w-full h-10 px-3 border border-border rounded-xl text-sm bg-background" disabled />
              <input type="text" placeholder={block.data.phonePlaceholder || "ফোন নম্বর"} className="w-full h-10 px-3 border border-border rounded-xl text-sm bg-background" disabled />
              <textarea placeholder={block.data.messagePlaceholder || "আপনার মেসেজ"} rows={3} className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" disabled />
              <Button className="w-full rounded-xl" disabled>{block.data.buttonText || "পাঠান"}</Button>
            </div>
            <p className="text-[9px] text-muted-foreground text-center mt-2">ফর্ম পাবলিশ পেজে কাজ করবে</p>
          </div>
        );
      case "map":
        return (
          <div className="max-w-2xl mx-auto px-5 py-4">
            <div className="aspect-video rounded-xl overflow-hidden bg-muted">
              {block.data.embedUrl ? (
                <iframe src={block.data.embedUrl} className="w-full h-full" allowFullScreen loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Google Maps embed URL দিন</div>
              )}
            </div>
          </div>
        );
      case "columns": {
        const cols = block.data.cols || 2;
        const items: any[] = block.data.items || [];
        return (
          <div className="max-w-4xl mx-auto px-5 py-6">
            {block.data.heading && (
              <h2 className="text-xl font-bold text-foreground mb-4 text-center">{block.data.heading}</h2>
            )}
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {items.map((item: any, i: number) => (
                <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border">
                  {item.image && <img src={item.image} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />}
                  {item.heading && <h3 className="text-sm font-semibold text-foreground mb-1">{item.heading}</h3>}
                  {item.body && <p className="text-xs text-muted-foreground">{item.body}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      }
      case "flex-container": {
        const children: Block[] = block.data.children || [];
        return (
          <div
            style={{
              display: "flex",
              flexDirection: block.data.direction || "row",
              gap: `${block.data.gap || 8}px`,
              justifyContent: block.data.justify || "flex-start",
              alignItems: block.data.align || "stretch",
              flexWrap: block.data.wrap || "wrap",
            }}
            className="w-full px-4 py-4"
          >
            {children.map((child) => (
              <BlockRenderer key={child.id} block={child} />
            ))}
            {children.length === 0 && (
              <div className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center">
                <span className="text-2xl block mb-2">📦</span>
                <p className="text-sm text-muted-foreground">চাইল্ড ব্লক যোগ করুন</p>
              </div>
            )}
          </div>
        );
      }
      case "grid-container": {
        const children: Block[] = block.data.children || [];
        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${block.data.gridCols || 2}, 1fr)`,
              gap: `${block.data.gap || 8}px`,
            }}
            className="w-full px-4 py-4"
          >
            {children.map((child) => (
              <BlockRenderer key={child.id} block={child} />
            ))}
            {children.length === 0 && (
              <div className="col-span-full border-2 border-dashed border-border rounded-xl p-8 text-center">
                <span className="text-2xl block mb-2">📦</span>
                <p className="text-sm text-muted-foreground">চাইল্ড ব্লক যোগ করুন</p>
              </div>
            )}
          </div>
        );
      }
      case "image-slider":
        return <ImageSliderBlock data={block.data} />;
      case "checkout-form":
        return <CheckoutFormBlock data={block.data} />;
      default:
        return null;
    }
  })();

  if (Object.keys(blockStyle).length > 0) {
    const wrapStyle: React.CSSProperties = {
      ...blockStyle,
      ...(blockStyle.color ? { ['--block-color' as any]: blockStyle.color } : {}),
    };
    return (
      <div style={wrapStyle} className={blockStyle.color ? "[&_*]:!text-[var(--block-color)]" : ""} data-block-type={block.type}>
        {inner}
      </div>
    );
  }
  return <div data-block-type={block.type}>{inner}</div>;
}

function ImageSliderBlock({ data }: { data: Record<string, any> }) {
  const images: { src: string; alt?: string; link?: string }[] = data.images || [];
  const interval = (data.interval || 3) * 1000;
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, interval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [images.length, interval]);

  if (images.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">স্লাইডারে ছবি যোগ করুন</p>
      </div>
    );
  }

  const goTo = (idx: number) => {
    setCurrent(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, interval);
  };

  const slide = images[current];
  const inner = (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: data.aspectRatio || "16/9" }}>
      {images.map((img, i) => (
        <img
          key={i}
          src={img.src}
          alt={img.alt || ""}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: i === current ? 1 : 0 }}
          loading="lazy"
        />
      ))}

      {/* Arrows */}
      {images.length > 1 && data.showArrows !== false && (
        <>
          <button
            onClick={() => goTo((current - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
          >
            ‹
          </button>
          <button
            onClick={() => goTo((current + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
          >
            ›
          </button>
        </>
      )}

      {/* Dots */}
      {images.length > 1 && data.showDots !== false && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white scale-125" : "bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full">
      {data.heading && <h2 className="text-lg font-bold text-foreground mb-3 px-5">{data.heading}</h2>}
      {slide?.link ? <a href={slide.link}>{inner}</a> : inner}
    </div>
  );
}

function CheckoutFormBlock({ data }: { data: Record<string, any> }) {
  const navigate = useNavigate();
  const { items, clearCart, updateQuantity } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef(false);
  const [, setDeliveryAreaVersion] = useState(0);
  const dhakaCfg = getDhakaConfig();
  const deliveryArea = getSavedDeliveryArea() ?? "outside";
  const chooseDeliveryArea = (area: "inside" | "outside") => {
    setSavedDeliveryArea(area);
    setDeliveryAreaVersion((v) => v + 1);
  };

  // Track which cart items are selected (default: all selected)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsInitialized = useRef(false);

  // Initialize selectedIds when items change
  useEffect(() => {
    if (items.length > 0 && !selectedIdsInitialized.current) {
      setSelectedIds(new Set(items.map(i => i.id)));
      selectedIdsInitialized.current = true;
    } else if (items.length > 0) {
      // Add newly added items to selection
      setSelectedIds(prev => {
        const next = new Set(prev);
        items.forEach(i => { if (!prev.has(i.id)) next.add(i.id); });
        return next.size !== prev.size ? next : prev;
      });
    }
  }, [items]);

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedItems = items.filter(i => selectedIds.has(i.id));

  const handleSubmit = async () => {
    if (submitRef.current) return;
    if (data.showName !== false && !name.trim()) { toast.error("নাম লিখুন"); return; }
    if (!phone.trim() || !/^01\d{9}$/.test(phone.trim())) { toast.error("সঠিক ১১ ডিজিটের ফোন নম্বর দিন"); return; }
    if (data.showAddress !== false && !address.trim()) { toast.error("ঠিকানা লিখুন"); return; }
    if (selectedItems.length === 0) { toast.error("অন্তত একটি পণ্য সিলেক্ট করুন"); return; }

    submitRef.current = true;
    setSubmitting(true);

    try {
      const subtotal = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const deliveryCharge = resolveLandingDeliveryCharge(data, subtotal);
      const totalAmount = subtotal + deliveryCharge;
      const visitorId = localStorage.getItem("visitor-fingerprint") || null;

      const noteText = [
        data.showNote && note.trim() ? note.trim() : null,
        data.showDelivery && deliveryCharge >= 0 ? `[ডেলিভারি: ৳${deliveryCharge}]` : null,
      ].filter(Boolean).join(" ") || null;

      const { data: orderRows, error: orderErr } = await supabase.rpc("place_order", {
        p_customer_name: name.trim() || "কাস্টমার",
        p_phone: phone.trim(),
        p_address: address.trim() || "N/A",
        p_note: noteText,
        p_total_amount: totalAmount,
        p_delivery_charge: deliveryCharge,
        p_visitor_id: visitorId,
        p_traffic_source: sessionStorage.getItem("traffic-source") || "landing-page",
      });

      if (orderErr || !orderRows || orderRows.length === 0) throw orderErr || new Error("Order failed");
      const order = orderRows[0];

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const orderItems = selectedItems.map((item) => {
        const rawId = String(item.id).split("::")[0];
        return {
          order_id: order.id,
          product_id: UUID_RE.test(rawId) ? rawId : null,
          product_name: item.name,
          product_image: item.image || null,
          quantity: item.quantity,
          unit_price: item.price,
        };
      });

      await supabase.from("order_items").insert(orderItems);

      await supabase.from("incomplete_orders").delete().eq("phone", phone.trim()).then(() => {});

      clearCart();
      navigate(`/order-confirmed?id=${order.order_id}`);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("REPEAT_ORDER_BLOCKED")) {
        toast.error(
          "আপনি ইতোমধ্যে অর্ডার করেছেন। আপনাকে যদি call দেওয়া না হয়ে থাকে তাহলে call দেওয়া হবে, বিস্তারিত কথা বলে নিতে পারবেন। আর যদি call দেওয়া হয়ে থাকে তাহলে আপনার অর্ডার confirm করে পাঠানো হয়েছে।",
          { duration: 8000 }
        );
      } else if (msg.includes("ACCESS_DENIED")) {
        toast.error("আপনার অ্যাক্সেস বন্ধ করা হয়েছে");
      } else {
        toast.error("অর্ডার প্লেস করতে সমস্যা হয়েছে");
      }
      submitRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 py-8">
      {data.heading && <h2 className="text-xl font-bold text-foreground mb-4 text-center">{data.heading}</h2>}
      <div className="space-y-3 bg-card border border-border rounded-2xl p-5 shadow-sm">
        {data.showName !== false && (
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">{data.nameLabel || "আপনার নাম"}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={data.namePlaceholder || "নাম লিখুন"}
              className="w-full h-10 px-3 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">{data.phoneLabel || "ফোন নম্বর"}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
            placeholder={data.phonePlaceholder || "01XXXXXXXXX"}
            className="w-full h-10 px-3 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {data.showAddress !== false && (
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">{data.addressLabel || "ঠিকানা"}</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={data.addressPlaceholder || "সম্পূর্ণ ঠিকানা লিখুন"}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        {data.showNote && (
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">{data.noteLabel || "নোট"}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={data.notePlaceholder || "বিশেষ কোনো তথ্য থাকলে লিখুন"}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        {data.showOverview !== false && items.length > 0 && (() => {
          const subtotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0);
          const deliveryCharge = resolveLandingDeliveryCharge(data, subtotal);
          const grandTotal = subtotal + deliveryCharge;
          return (
            <div className="border border-border rounded-xl p-3 bg-muted/30 space-y-2">
              <h3 className="text-xs font-semibold text-foreground">{data.overviewTitle || "অর্ডার সামারি"}</h3>
              {items.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div key={item.id} className={`flex items-center gap-2 text-xs rounded-lg p-1.5 transition-colors ${isSelected ? "text-foreground bg-primary/5" : "text-muted-foreground opacity-60"}`}>
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background hover:border-muted-foreground"}`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                    {data.overviewShowImage && item.image && (
                      <img src={item.image} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                    )}
                    <span className="truncate flex-1">{item.name}</span>
                    {isSelected && data.overviewAllowQty ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded-md border border-border bg-background flex items-center justify-center text-xs hover:bg-muted">−</button>
                        <span className="w-5 text-center font-medium">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded-md border border-border bg-background flex items-center justify-center text-xs hover:bg-muted">+</button>
                      </div>
                    ) : isSelected ? (
                      <span className="flex-shrink-0">× {item.quantity}</span>
                    ) : null}
                    {isSelected && <span className="font-medium flex-shrink-0 w-14 text-right">৳{item.price * item.quantity}</span>}
                  </div>
                );
              })}
              {selectedItems.length > 0 && (
                <div className="border-t border-border pt-1.5 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>সাবটোটাল</span>
                    <span>৳{subtotal}</span>
                  </div>
                  {data.showDelivery && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>ডেলিভারি চার্জ</span>
                      <span className={deliveryCharge === 0 ? "text-primary font-medium" : ""}>{deliveryCharge === 0 ? "ফ্রি" : `৳${deliveryCharge}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border">
                    <span>সর্বমোট</span>
                    <span>৳{grandTotal}</span>
                  </div>
                </div>
              )}
              {selectedItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-1">অন্তত একটি পণ্য সিলেক্ট করুন</p>
              )}
            </div>
          );
        })()}
        {data.showDelivery && items.length === 0 && (
          <div className="border border-border rounded-xl p-3 bg-muted/30 space-y-1.5">
            <h3 className="text-xs font-semibold text-foreground">ডেলিভারি চার্জ</h3>
            {getDeliveryTiers().map((tier, i) => (
              <div key={i} className="flex justify-between text-xs text-muted-foreground">
                <span>৳{tier.threshold}+ অর্ডারে</span>
                <span className="font-medium text-foreground">{tier.charge === 0 ? "ফ্রি" : `৳${tier.charge}`}</span>
              </div>
            ))}
          </div>
        )}
        {data.showDelivery && dhakaCfg.enabled && (
          <div className="border border-border rounded-xl p-3 bg-muted/30 space-y-2">
            <h3 className="text-xs font-semibold text-foreground">ডেলিভারি লোকেশন *</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "inside" as const, label: "ঢাকার মধ্যে", charge: dhakaCfg.inside },
                { value: "outside" as const, label: "ঢাকার বাইরে", charge: dhakaCfg.outside },
              ].map((opt) => {
                const selected = deliveryArea === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => chooseDeliveryArea(opt.value)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                      selected
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <span className="block truncate">{opt.label}</span>
                    <span className="block font-bold">৳{opt.charge}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <Button
          onClick={handleSubmit}
          disabled={submitting || selectedItems.length === 0}
          className="w-full h-12 rounded-xl text-base font-semibold gap-2 shadow-lg"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
          {data.buttonText || "অর্ডার কনফার্ম করুন"}
        </Button>
      </div>
    </div>
  );
}

function ProductBlock({ productId }: { productId: string }) {
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    if (!productId) return;
    supabase
      .from("products_public")
      .select("id, name, regular_price, offer_price, product_image, short_description, slug")
      .eq("id", productId)
      .maybeSingle()
      .then(({ data }) => setProduct(data));
  }, [productId]);

  if (!product) return null;

  const price = product.offer_price || product.regular_price;
  const hasDiscount = product.offer_price && product.offer_price < product.regular_price;

  return (
    <div className="max-w-sm mx-auto px-5 py-6">
      <div className="bg-card border rounded-2xl overflow-hidden shadow-lg">
        {product.product_image && (
          <img src={product.product_image} alt={product.name} className="w-full aspect-square object-cover" />
        )}
        <div className="p-4 space-y-2">
          <h3 className="font-bold text-lg text-foreground">{product.name}</h3>
          {product.short_description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{product.short_description}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">৳{price}</span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">৳{product.regular_price}</span>
            )}
          </div>
          <a href={product.slug ? `/product/${product.slug}` : `/product/${product.id}`}>
            <Button className="w-full rounded-xl gap-2 mt-2">
              <ShoppingBag className="w-4 h-4" /> অর্ডার করুন
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

function CountdownBlock({ data }: { data: Record<string, any> }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    if (!data.endDate) return;
    const target = new Date(data.endDate).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data.endDate]);

  return (
    <div className="max-w-md mx-auto px-5 py-8 text-center">
      {data.heading && <h2 className="text-lg font-bold text-foreground mb-4">{data.heading}</h2>}
      <div className="flex items-center justify-center gap-3">
        {(["days", "hours", "mins", "secs"] as const).map((k) => (
          <div key={k} className="bg-card border border-border rounded-xl p-3 min-w-[60px] shadow-sm">
            <p className="text-2xl font-bold text-primary">{timeLeft[k].toString().padStart(2, "0")}</p>
            <p className="text-[9px] text-muted-foreground mt-1">{k === "days" ? "দিন" : k === "hours" ? "ঘণ্টা" : k === "mins" ? "মিনিট" : "সেকেন্ড"}</p>
          </div>
        ))}
      </div>
      {data.subtitle && <p className="text-sm text-muted-foreground mt-3">{data.subtitle}</p>}
    </div>
  );
}

function ProductGridBlock({ data }: { data: Record<string, any> }) {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    let query = supabase.from("products_public").select("id, name, regular_price, offer_price, product_image, slug");
    if (data.category) query = query.eq("category", data.category);
    query.order("position").limit(data.limit || 6).then(({ data: prods }) => setProducts(prods || []));
  }, [data.category, data.limit]);

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      {data.heading && <h2 className="text-xl font-bold text-foreground mb-4 text-center">{data.heading}</h2>}
      <div className={`grid gap-3 ${data.cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {products.map((p) => (
          <a key={p.id} href={p.slug ? `/product/${p.slug}` : `/product/${p.id}`} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {p.product_image && <img src={p.product_image} alt={p.name} className="w-full aspect-square object-cover" />}
            <div className="p-2.5">
              <p className="text-xs font-medium text-foreground line-clamp-2">{p.name}</p>
              <p className="text-sm font-bold text-primary mt-1">৳{p.offer_price || p.regular_price}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function getEmbedUrl(url: string): string {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  if (url.includes("facebook.com")) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  }
  return url;
}

export const MemoizedBlockRenderer = React.memo(BlockRenderer);

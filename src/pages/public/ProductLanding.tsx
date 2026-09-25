import { Link, useParams, useLocation } from "react-router-dom";
import { useEffect, useRef, useState, type ComponentType } from "react";

import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gift,
  HelpCircle,
  Leaf,
  MessageCircle,
  Package,
  PartyPopper,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Star,
  Sun,
  Truck,
} from "lucide-react";

import { LandingTopBar } from "@/components/product/landing-chrome";
import { OrderForm } from "@/components/product/order-form";
import { Button } from "@/components/pub/button";
import { useCatalogProduct } from "@/data/product-store";
import { useLandingPage, type SectionKey } from "@/data/landing-store";
import { bn } from "@/lib/format";
import { trackViewContent } from "@/lib/metaEvents";

/* ==== Theme (matches the /lp/pudina landing style) ==== */
const PRIMARY = "#1b7a3e";
const ACCENT = "#c8ecd3";
const GREEN = "#2d7d0e";
const GOLD = "#ffc107";
const CTA_A = "#25a04f";
const CTA_B = "#14682f";
const SOFT_BG = "#f1fbf4";

const FONT: React.CSSProperties = {
  fontFamily: "'Hind Siliguri','Anek Bangla',system-ui,sans-serif",
};

const money = (n: number) => `${bn(n)}৳`;

const benefitIcons: Record<string, ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  sprout: Sprout,
  leaf: Leaf,
  package: Package,
  truck: Truck,
  shield: ShieldCheck,
  sun: Sun,
};

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity .7s ease ${delay}ms, transform .7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Petals() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 14 }).map((_, i) => {
        const left = (i * 7.3) % 100;
        const size = 10 + ((i * 3) % 14);
        const dur = 14 + (i % 6) * 2;
        const delay = (i % 8) * 1.2;
        const color = i % 3 === 0 ? PRIMARY : i % 3 === 1 ? ACCENT : GOLD;
        return (
          <span
            key={i}
            className="lp-petal"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: color,
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function useMidnightCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  const diff = Math.max(0, end.getTime() - now);
  return {
    h: Math.floor(diff / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

function FlipDigit({ value, label }: { value: number; label: string }) {
  const v = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div
        key={v}
        className="lp-flip min-w-[54px] rounded-xl px-3 py-2 text-center text-2xl font-extrabold md:min-w-[72px] md:px-4 md:py-3 md:text-4xl"
        style={{
          background: "linear-gradient(180deg,#0d3d1c,#062510)",
          color: GOLD,
          boxShadow: "0 0 20px rgba(255,193,7,0.25)",
        }}
      >
        {v.replace(/\d/g, (d) => bn(Number(d)))}
      </div>
      <span className="mt-1 text-[11px] font-semibold text-white/90 md:text-xs">{label}</span>
    </div>
  );
}

function HeroCarousel({ images, name }: { images: string[]; name: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setIdx(clamped);
  };

  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % images.length;
        const el = trackRef.current;
        if (el) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [images.length]);

  return (
    <div className="mx-auto mt-6 max-w-md md:max-w-3xl lg:max-w-4xl">
      <div className="relative overflow-hidden rounded-3xl shadow-xl" style={{ border: `3px solid ${PRIMARY}` }}>
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIdx(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {images.map((src, i) => (
            <img
              key={src + i}
              src={src}
              alt={`${name} ${i + 1}`}
              className="h-64 w-full flex-shrink-0 snap-center object-cover md:h-[420px] lg:h-[500px]"
              style={{ width: "100%" }}
              loading={i === 0 ? "eager" : "lazy"}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="আগের ছবি"
              onClick={() => goTo(idx - 1)}
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"
            >
              <ChevronLeft className="h-5 w-5" style={{ color: PRIMARY }} />
            </button>
            <button
              type="button"
              aria-label="পরের ছবি"
              onClick={() => goTo(idx + 1)}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"
            >
              <ChevronRight className="h-5 w-5" style={{ color: PRIMARY }} />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`ছবি ${i + 1}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: idx === i ? 18 : 6,
                    background: idx === i ? "#fff" : "rgba(255,255,255,0.6)",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {images.map((src, i) => (
            <button
              key={src + "-thumb-" + i}
              onClick={() => goTo(i)}
              className="flex-shrink-0 overflow-hidden rounded-lg transition"
              style={{
                border: idx === i ? `2px solid ${PRIMARY}` : "2px solid transparent",
                opacity: idx === i ? 1 : 0.65,
              }}
            >
              <img src={src} alt="" className="h-14 w-14 object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Review = { name: string; location: string; text: string; rating: number };

function ReviewsSlider({ reviews }: { reviews: Review[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reviews.length <= 1) return;
    const t = setInterval(() => setIdx((p) => (p + 1) % reviews.length), 3500);
    return () => clearInterval(t);
  }, [paused, reviews.length]);

  return (
    <div
      className="relative mx-auto max-w-2xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {reviews.map((r, i) => (
            <div key={r.name + i} className="w-full flex-shrink-0 px-1">
              <div
                className="rounded-2xl bg-white p-5 text-center md:p-6"
                style={{ border: `2px solid ${ACCENT}`, background: `linear-gradient(180deg,#fff,${SOFT_BG})` }}
              >
                <div className="mb-2 flex justify-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className="h-4 w-4"
                      style={{ color: s < r.rating ? GOLD : "#d4d4d4", fill: s < r.rating ? GOLD : "transparent" }}
                    />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-neutral-700 md:text-base">“{r.text}”</p>
                <div className="mt-3 text-sm font-extrabold" style={{ color: PRIMARY }}>
                  {r.name}
                </div>
                <div className="text-xs text-neutral-500">{r.location}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {reviews.length > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {reviews.map((_, i) => (
            <button
              key={i}
              aria-label={`রিভিউ ${i + 1}`}
              onClick={() => setIdx(i)}
              className="h-1.5 rounded-full transition-all"
              style={{ width: idx === i ? 18 : 6, background: idx === i ? PRIMARY : ACCENT }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductLandingPage() {
  const { slug } = useParams();
  const product = useCatalogProduct(slug);
  const c = useLandingPage(product);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { h, m, s } = useMidnightCountdown();

  const location = useLocation();

  useEffect(() => {
    if (!product?.slug) return;
    trackViewContent(product.slug, product.name, product.price);
  }, [product?.slug, product?.name, product?.price]);

  useEffect(() => {
    if (location.hash === "#order") {
      const timer = setTimeout(() => {
        const el = document.getElementById("order");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location.hash, product?.slug]);

  const scrollToOrder = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const el = document.getElementById("order");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!product || !c) {
    return (
      <div className="flex min-h-screen flex-col bg-white" style={FONT}>
        <LandingTopBar />
        <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-20">
          <h1 className="text-3xl font-extrabold">প্রোডাক্ট পাওয়া যায়নি</h1>
          <p className="text-neutral-600">"{slug}" স্লাগে কোনো প্রোডাক্ট নেই।</p>
          <Button asChild variant="outline">
            <Link to="/#products">
              <ArrowLeft /> সব প্রোডাক্ট দেখুন
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const images = product.images && product.images.length > 0 ? product.images : [product.image];
  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const blocks: Record<SectionKey, JSX.Element | null> = {
    /* 1. HERO */
    hero: (
      <section
        key="hero"
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${ACCENT} 0%, #ffffff 60%)` }}
      >
        <Petals />
        <div className="relative mx-auto w-full max-w-5xl px-4 pb-10 pt-8 text-center">
          <h1
            className="lp-hero-title inline-flex flex-wrap items-center justify-center gap-2 text-2xl font-extrabold leading-snug md:text-4xl"
            style={{ color: "#0d3d1c" }}
          >
            <Leaf className="h-7 w-7 md:h-9 md:w-9" style={{ color: PRIMARY }} />
            <span>{c.headline}</span>
          </h1>
          <p className="lp-hero-sub mt-3 text-base font-semibold text-neutral-700 md:text-lg">{c.subheadline}</p>

          {discount > 0 && (
            <div className="mt-5 flex justify-center">
              <span
                className="lp-hero-badge inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-extrabold md:text-base"
                style={{ background: GOLD, color: "#0d3d1c", boxShadow: "0 6px 20px -4px rgba(255,193,7,0.6)" }}
              >
                <PartyPopper className="h-4 w-4" /> {bn(discount)}% ছাড় — আজকের জন্য!
              </span>
            </div>
          )}

          <HeroCarousel images={images} name={product.name} />

          <div className="mt-5 flex flex-wrap items-end justify-center gap-3">
            <span className="text-4xl font-extrabold" style={{ color: CTA_B }}>
              {money(product.price)}
            </span>
            {product.oldPrice ? (
              <span className="pb-1 text-lg text-neutral-500 line-through">{money(product.oldPrice)}</span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {[c.packSize, `${c.germination} গজানোর হার`, "ক্যাশ অন ডেলিভারি"].map((t) => (
              <span
                key={t}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold"
                style={{ border: `1px solid ${ACCENT}`, color: PRIMARY }}
              >
                {t}
              </span>
            ))}
          </div>

          <div className="mt-6">
            <a
              href="#order"
              onClick={scrollToOrder}
              className="lp-cta inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-extrabold text-white md:text-lg"
              style={{ background: `linear-gradient(90deg, ${CTA_A}, ${CTA_B})`, boxShadow: `0 8px 24px -6px ${CTA_A}` }}
            >
              <ShoppingCart className="h-5 w-5" /> এখনই অর্ডার করুন
            </a>
          </div>
        </div>

        {/* countdown */}
        <div className="relative pb-10">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <div className="rounded-2xl px-4 py-6 md:py-8" style={{ background: `linear-gradient(135deg, ${CTA_B}, #0d3d1c)` }}>
              <p className="inline-flex items-center gap-2 text-base font-bold text-white md:text-lg">
                <Clock className="h-5 w-5" /> অফার শেষ হতে বাকি
              </p>
              <div className="mt-4 flex justify-center gap-3 md:gap-5">
                <FlipDigit value={h} label="ঘণ্টা" />
                <FlipDigit value={m} label="মিনিট" />
                <FlipDigit value={s} label="সেকেন্ড" />
              </div>
            </div>
          </div>
        </div>
      </section>
    ),

    /* 2. BENEFITS */
    benefits: c.benefits.length ? (
      <section key="benefits" className="bg-white py-10">
        <div className="mx-auto max-w-5xl px-4">
          <Reveal>
            <h2 className="mb-8 text-center text-2xl font-extrabold md:text-3xl" style={{ color: PRIMARY }}>
              কেন এই বীজ কিনবেন?
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {c.benefits.map((b, i) => {
              const Icon = benefitIcons[b.icon] ?? BadgeCheck;
              return (
                <Reveal key={b.title} delay={i * 80}>
                  <div
                    className="lp-lift h-full rounded-2xl p-4 text-center md:p-5"
                    style={{ border: `2px solid ${ACCENT}`, background: `linear-gradient(180deg,#fff,${SOFT_BG})` }}
                  >
                    <div className="mb-2 flex justify-center">
                      <span
                        className="inline-flex h-12 w-12 items-center justify-center rounded-full md:h-14 md:w-14"
                        style={{ background: PRIMARY }}
                      >
                        <Icon className="h-6 w-6 md:h-7 md:w-7" style={{ color: "#fff" }} />
                      </span>
                    </div>
                    <div className="text-sm font-extrabold md:text-base" style={{ color: PRIMARY }}>
                      {b.title}
                    </div>
                    <div className="mt-1 break-words pb-1 text-xs leading-relaxed text-neutral-600 md:text-sm">
                      {b.text}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    ) : null,

    /* 3. DETAILS + HIGHLIGHTS */
    details: (
      <section key="details" className="py-10" style={{ background: SOFT_BG }}>
        <div className="mx-auto max-w-4xl px-4">
          <Reveal>
            <h2 className="mb-6 inline-flex w-full items-center justify-center gap-2 text-center text-2xl font-extrabold md:text-3xl" style={{ color: PRIMARY }}>
              <Sprout className="h-6 w-6 md:h-7 md:w-7" /> প্রোডাক্ট সম্পর্কে
            </h2>
          </Reveal>

          {c.highlights.length ? (
            <Reveal>
              <ul className="mx-auto mb-6 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {c.highlights.map((hl) => (
                  <li
                    key={hl}
                    className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-700"
                    style={{ border: `1px solid ${ACCENT}` }}
                  >
                    <Check className="h-4 w-4 shrink-0" style={{ color: GREEN }} /> {hl}
                  </li>
                ))}
              </ul>
            </Reveal>
          ) : null}

          {product.descriptionHtml ? (
            <Reveal>
              <div
                className="prose-sm mx-auto max-w-2xl text-sm leading-relaxed text-neutral-700 [&_ul]:list-disc [&_ul]:pl-5 md:text-base"
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
              />
            </Reveal>
          ) : null}

          <div className="mx-auto mt-4 flex max-w-2xl flex-col gap-3">
            {c.description.map((p) => (
              <Reveal key={p.slice(0, 24)}>
                <p className="text-sm leading-relaxed text-neutral-700 md:text-base">{p}</p>
              </Reveal>
            ))}
          </div>

          {c.usage.length ? (
            <div className="relative mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              <div
                className="absolute left-[12%] right-[12%] top-6 hidden h-0.5 md:block"
                style={{ background: `repeating-linear-gradient(90deg, ${PRIMARY} 0 8px, transparent 8px 16px)` }}
              />
              {c.usage.map((u, i) => (
                <Reveal key={u} delay={i * 150}>
                  <div className="relative h-full rounded-2xl bg-white p-4 text-center" style={{ border: `2px solid ${ACCENT}` }}>
                    <div
                      className="mx-auto -mt-8 mb-2 flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold text-white"
                      style={{ background: `linear-gradient(135deg,${PRIMARY},${CTA_B})`, boxShadow: `0 6px 16px -4px ${PRIMARY}` }}
                    >
                      {bn(i + 1)}
                    </div>
                    <div className="text-xs leading-relaxed text-neutral-700 md:text-sm">{u}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    ),

    /* 4. ORDER FORM */
    order: (
      <section key="order" id="order" className="bg-white py-10 scroll-mt-14">
        <div className="mx-auto max-w-3xl px-4">
          <Reveal>
            <h2 className="mb-5 inline-flex w-full items-center justify-center gap-2 text-center text-2xl font-extrabold md:text-3xl" style={{ color: PRIMARY }}>
              <Gift className="h-6 w-6 md:h-7 md:w-7" /> প্যাকেজ বেছে অর্ডার করুন
            </h2>
          </Reveal>
          <Reveal>
            <div
              className="rounded-3xl p-1 md:p-2"
              style={{ border: `2px solid ${PRIMARY}`, boxShadow: "0 20px 60px -20px rgba(27,122,62,0.4)" }}
            >
              <OrderForm product={product} />
            </div>
          </Reveal>
        </div>
      </section>
    ),

    /* 5. REVIEWS */
    reviews: c.reviews.length ? (
      <section key="reviews" className="py-10" style={{ background: SOFT_BG }}>
        <div className="mx-auto max-w-5xl px-4">
          <Reveal>
            <h2 className="mb-8 inline-flex w-full items-center justify-center gap-2 text-center text-2xl font-extrabold md:text-3xl" style={{ color: PRIMARY }}>
              <MessageCircle className="h-6 w-6 md:h-7 md:w-7" /> কাস্টমার রিভিউ
            </h2>
          </Reveal>
          <ReviewsSlider reviews={c.reviews as Review[]} />
        </div>
      </section>
    ) : null,

    /* 6. FAQ */
    faq: c.faqs.length ? (
      <section key="faq" className="bg-white py-10">
        <div className="mx-auto max-w-3xl px-4">
          <Reveal>
            <h2 className="mb-6 inline-flex w-full items-center justify-center gap-2 text-center text-2xl font-extrabold md:text-3xl" style={{ color: PRIMARY }}>
              <HelpCircle className="h-6 w-6 md:h-7 md:w-7" /> প্রশ্নোত্তর
            </h2>
          </Reveal>
          <div className="space-y-3">
            {c.faqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} className="overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${ACCENT}` }}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold md:text-base"
                    style={{ color: PRIMARY }}
                  >
                    {f.q}
                    <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  <div
                    className="overflow-hidden px-4 text-sm text-neutral-700 transition-all"
                    style={{ maxHeight: open ? 300 : 0, paddingBottom: open ? 14 : 0 }}
                  >
                    {f.a}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    ) : null,

    /* 7. CLOSING CTA */
    cta: (
      <section key="cta" className="py-12" style={{ background: `linear-gradient(135deg, ${CTA_B}, #0d3d1c)` }}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 text-center">
          <h2 className="text-2xl font-extrabold text-white md:text-3xl">
            {product.name} — আজই ঘরে বসে অর্ডার করুন
          </h2>
          <p className="text-sm text-white/80 md:text-base">
            ক্যাশ অন ডেলিভারি, সারা বাংলাদেশে দ্রুত পৌঁছে দেওয়া হয়।
          </p>
          <a
            href="#order"
            onClick={scrollToOrder}
            className="lp-cta inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-extrabold md:text-lg"
            style={{ background: `linear-gradient(90deg,${GOLD},#ffb300)`, color: "#0d3d1c" }}
          >
            <ShoppingCart className="h-5 w-5" /> এখনই অর্ডার করুন
          </a>
        </div>
      </section>
    ),
  };

  return (
    <div className="min-h-screen bg-white pb-24 text-black md:pb-0" style={FONT}>
      <style>{`
        @keyframes lpFadeUp { from { opacity: 0; transform: translateY(20px);} to { opacity: 1; transform: translateY(0);} }
        @keyframes lpPulseWiggle {
          0%,100% { transform: scale(1) rotate(-2deg); box-shadow: 0 0 0 0 rgba(255,193,7,0.6); }
          50% { transform: scale(1.06) rotate(2deg); box-shadow: 0 0 0 16px rgba(255,193,7,0); }
        }
        @keyframes lpShine { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(220%) skewX(-20deg); } }
        @keyframes lpMarquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes lpPetalFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: .85; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        @keyframes lpFlipIn { 0% { transform: rotateX(-90deg); opacity: 0; } 100% { transform: rotateX(0); opacity: 1; } }
        .lp-hero-title { animation: lpFadeUp .8s ease .1s both; }
        .lp-hero-sub { animation: lpFadeUp .8s ease .3s both; }
        .lp-hero-badge { animation: lpPulseWiggle 2.2s ease-in-out infinite; }
        .lp-cta { position: relative; overflow: hidden; }
        .lp-cta::after {
          content: ""; position: absolute; top: 0; left: 0; width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
          animation: lpShine 3s ease-in-out infinite;
        }
        .lp-marquee-track { display: inline-flex; gap: 3rem; animation: lpMarquee 22s linear infinite; }
        .lp-petal {
          position: absolute; top: -10vh; border-radius: 50% 0 50% 50%;
          opacity: .8; animation-name: lpPetalFall; animation-timing-function: linear; animation-iteration-count: infinite;
        }
        .lp-flip { animation: lpFlipIn .5s ease; transform-origin: 50% 0; }
        .lp-lift { transition: transform .3s ease, box-shadow .3s ease; }
        .lp-lift:hover { transform: translateY(-6px); box-shadow: 0 12px 32px -8px rgba(27,122,62,0.35); }
        @media (prefers-reduced-motion: reduce) {
          .lp-petal, .lp-hero-badge, .lp-cta::after, .lp-marquee-track { animation: none !important; }
        }
      `}</style>

      {/* Flash offer marquee */}
      <div className="sticky top-0 z-40 overflow-hidden text-white" style={{ background: PRIMARY }}>
        <div className="whitespace-nowrap py-2">
          <div className="lp-marquee-track px-4 text-sm font-bold md:text-base">
            {[0, 1].map((k) => (
              <span key={k} className="inline-flex items-center gap-8">
                <span>🔥 {product.name} — মাত্র {money(product.price)}</span>
                <span>| ২ প্যাক নিলে বাড়তি ছাড়</span>
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="h-4 w-4" /> ২+ প্যাকে ফ্রি ডেলিভারি!
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <LandingTopBar />

      <main>
        {(() => {
          // "কেন এই বীজ কিনবেন?" and "প্রোডাক্ট সম্পর্কে" always render right after the order form
          const enabled = c.sections.filter((s) => s.enabled).map((s) => s.key);
          const orderIdx = enabled.indexOf("order");
          const moveAfterOrder = ["benefits", "details"];
          const toMove = enabled
            .map((k, i) => ({ k, i }))
            .filter(({ k, i }) => moveAfterOrder.includes(k) && orderIdx !== -1 && i < orderIdx)
            .sort((a, b) => a.i - b.i);
          for (const { k } of toMove.reverse()) {
            enabled.splice(enabled.indexOf(k), 1);
          }
          const newOrderIdx = enabled.indexOf("order");
          for (const { k } of toMove.reverse()) {
            enabled.splice(newOrderIdx + 1, 0, k);
          }
          return enabled.map((k) => blocks[k]).filter(Boolean);
        })()}
      </main>

      <footer className="border-t bg-white py-5 text-center text-xs text-neutral-600">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
          <p>© {new Date().getFullYear()} FARIS SEED</p>
          <div className="flex items-center gap-1.5 font-medium">
            <span>Crafted with</span>
            <span className="inline-block animate-bounce text-red-500">❤️</span>
            <span>Developed by</span>
            <a
              href="https://wa.me/8801560007231?text=Hello%20HAQPLUS%20IT"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 transition-all duration-300 hover:scale-105 hover:bg-emerald-600 hover:text-white"
            >
              HAQPLUS IT
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">🚀</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Sticky mobile order bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden"
        style={{ boxShadow: "0 -4px 20px -6px rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-black">{product.name}</div>
            <div className="text-xs">
              {product.oldPrice ? (
                <span className="mr-1.5 text-neutral-400 line-through">{money(product.oldPrice)}</span>
              ) : null}
              <span className="font-extrabold" style={{ color: CTA_B }}>
                {money(product.price)}
              </span>
            </div>
          </div>
          <a
            href="#order"
            onClick={scrollToOrder}
            className="lp-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold text-white"
            style={{ background: `linear-gradient(90deg,${CTA_A},${CTA_B})` }}
          >
            <ShoppingCart className="h-4 w-4" /> অর্ডার করুন
          </a>
        </div>
      </div>
    </div>
  );
}

export default ProductLandingPage;

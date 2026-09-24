import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Quote, ShoppingCart, Star, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import Autoplay from "embla-carousel-autoplay";
import heroSeeds from "@/assets/hero-seeds.webp";
import { toast } from "sonner";

import { addToCart } from "@/data/cart";
import { Footer } from "@/components/site/footer";

import { Navbar } from "@/components/site/navbar";
import { Badge } from "@/components/pub/badge";
import { Button } from "@/components/pub/button";
import { Card, CardContent } from "@/components/pub/card";
import { Section, SectionHeading } from "@/components/pub/section";
import { useCatalog } from "@/data/product-store";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/pub/carousel";


const reviews = [
  {
    name: "রফিকুল ইসলাম",
    location: "বগুড়া",
    text: "টমেটোর বীজ থেকে প্রায় সব গাছই গজিয়েছে। এবার ফলনও দ্বিগুণ হয়েছে। প্যাকেজিং খুব ভালো ছিল।",
  },
  {
    name: "সাদিয়া আফরিন",
    location: "ঢাকা",
    text: "ছাদ বাগানের জন্য গাঁদা আর শশার বীজ নিয়েছিলাম। ১০ দিনেই চারা বের হয়েছে, দামও রিজনেবল।",
  },
  {
    name: "মোঃ জাহাঙ্গীর",
    location: "যশোর",
    text: "ক্যাশ অন ডেলিভারিতে অর্ডার করেছি, পরদিনই কুরিয়ারে পেয়ে গেছি। বিশ্বস্ত সেলার।",
  },
  {
    name: "নাজমুল হাসান",
    location: "সিলেট",
    text: "আগে বাজার থেকে বীজ কিনে ঠকেছি। এখান থেকে নেওয়ার পর germination নিয়ে আর চিন্তা নেই।",
  },
];

const heroSlides = [
  {
    id: 1,
    image: heroSeeds,
    title: "সেরা মানের বীজ, সেরা ফলন",
    subtitle: "আমাদের প্রিমিয়াম বীজে বাগান হবে আরও সবুজ ও সতেজ।",
    cta: "বীজ দেখুন",
    link: "#products",
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&q=80&w=2000",
    title: "নিশ্চিত অংকুরোদগমের গ্যারান্টি",
    subtitle: "প্রতিটি বীজ যাচাইকৃত এবং ১০০% জার্মিনেশন গ্যারান্টি যুক্ত।",
    cta: "অর্ডার করুন",
    link: "#products",
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1592419044706-39796d40f98c?auto=format&fit=crop&q=80&w=2000",
    title: "সারা দেশে ক্যাশ অন ডেলিভারি",
    subtitle: "ঘরে বসেই অর্ডার করুন আপনার পছন্দের সবজি ও ফুলের বীজ।",
    cta: "কালেকশন দেখুন",
    link: "#products",
  },
];

function HomePage() {
  const catalog = useCatalog().filter((p) => p.active);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Slider */}
        <section className="relative overflow-hidden bg-secondary/30">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            plugins={[
              Autoplay({
                delay: 5000,
              }),
            ]}
            className="w-full"
          >
            <CarouselContent>
              {heroSlides.map((slide) => (
                <CarouselItem key={slide.id}>
                  <div className="relative h-[400px] w-full overflow-hidden md:h-[500px] lg:h-[600px]">
                    {/* Background Image with Overlay */}
                    <div className="absolute inset-0">
                      <img
                        src={slide.image}
                        alt={slide.title}
                        className="size-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40" />
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-deep/60 to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="relative flex h-full items-center px-6 sm:px-12 lg:px-24">
                      <div className="max-w-2xl text-white">
                        <Badge variant="soft" className="mb-4 bg-accent/20 text-accent-foreground backdrop-blur-md border-accent/20 px-3 py-1">
                          Premium Seeds
                        </Badge>
                        <h1 className="mb-4 font-display text-4xl font-bold leading-tight text-balance-tight md:text-5xl lg:text-6xl">
                          {slide.title}
                        </h1>
                        <p className="mb-8 text-lg text-white/90 md:text-xl max-w-lg">
                          {slide.subtitle}
                        </p>
                        <div className="flex flex-wrap gap-4">
                          <Button 
                            variant="cta" 
                            size="lg" 
                            asChild
                            className="h-12 px-8 text-base shadow-accent"
                          >
                            <a href={slide.link}>{slide.cta}</a>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="lg" 
                            className="h-12 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm"
                            asChild
                          >
                            <a href="#products">বিস্তারিত জানুন</a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="absolute bottom-4 right-12 hidden gap-2 md:flex">
              <CarouselPrevious className="static translate-y-0 bg-white/10 text-white hover:bg-white/20 border-white/20 backdrop-blur-sm" />
              <CarouselNext className="static translate-y-0 bg-white/10 text-white hover:bg-white/20 border-white/20 backdrop-blur-sm" />
            </div>
          </Carousel>
        </section>
        {/* Product showcase */}
        <Section id="products" spacing="lg" width="wide" className="scroll-mt-20">
          <SectionHeading
            align="center"
            className="mx-auto items-center text-center"
            title="জনপ্রিয় পণ্য"
          />
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {catalog.map((p) => (
              <Card key={p.slug} variant="product" className="group relative flex h-full flex-col">
                <Link to={`/product/${p.slug}`} className="block overflow-hidden">
                  <div className="relative aspect-[4/3] bg-secondary">
                    <img
                      src={p.image}
                      alt={`${p.name} — ${p.nameEn}`}
                      loading="lazy"
                      width={768}
                      height={768}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-2 top-2 flex flex-col gap-1 sm:left-3 sm:top-3">
                      {p.tag === "bestseller" ? (
                        <Badge variant="bestseller" className="px-2 py-0.5 text-[10px] sm:text-xs">
                          Best Seller
                        </Badge>
                      ) : null}
                      {p.tag === "new" ? (
                        <Badge variant="soft" className="px-2 py-0.5 text-[10px] sm:text-xs">
                          নতুন
                        </Badge>
                      ) : null}
                      {p.tag === "limited" ? (
                        <Badge variant="limited" className="px-2 py-0.5 text-[10px] sm:text-xs">
                          সীমিত স্টক
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </Link>
                <CardContent className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-5">
                  <Badge
                    variant={p.inStock ? "stock" : "outOfStock"}
                    className="w-fit px-2 py-0 text-[10px] sm:text-xs"
                  >
                    {p.inStock ? "In Stock" : "Out of Stock"}
                  </Badge>
                  <Link to={`/product/${p.slug}`} className="block">
                    <h3 className="font-display text-sm font-bold leading-tight sm:text-lg">
                      {p.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:mt-1 sm:text-sm">
                      {p.tagline}
                    </p>
                  </Link>
                  <div className="mt-auto flex flex-col gap-2">
                    <div className="flex items-end gap-1.5 sm:gap-2">
                      <span className="font-display text-base font-extrabold sm:text-xl">
                        ৳ {p.price}
                      </span>
                      {p.oldPrice ? (
                        <span className="pb-0.5 text-[10px] text-muted-foreground line-through sm:text-sm">
                          ৳ {p.oldPrice}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <Button
                        variant="cta"
                        size="sm"
                        className="h-8 w-full text-[10px] sm:h-9 sm:text-xs"
                        asChild
                      >
                        <Link to={`/product/${p.slug}#order`}>
                          অর্ডার করুন
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-[10px] sm:h-9 sm:text-xs"
                        disabled={!p.inStock}
                        onClick={() => {
                          addToCart({
                            slug: p.slug,
                            name: p.name,
                            price: p.price,
                            image: p.image,
                          });
                          toast.success(`${p.name} কার্টে যুক্ত হয়েছে`);
                        }}
                      >
                        <ShoppingCart className="mr-1 size-3 sm:mr-1.5 sm:size-4" /> Add to Cart
                      </Button>

                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        {/* Reviews */}
        <Section tone="muted" spacing="lg" width="wide">
          <SectionHeading
            eyebrow="কাস্টমার রিভিউ"
            title="কৃষক ও বাগানীরা যা বলছেন"
            description="সারা দেশের হাজারো কাস্টমারের বাস্তব অভিজ্ঞতা।"
          />
          <Carousel
            opts={{ align: "start", loop: true }}
            plugins={[Autoplay({ delay: 3500, stopOnInteraction: false })]}
            className="mt-10"
          >
            <CarouselContent className="-ml-4">
              {reviews.map((r) => (
                <CarouselItem
                  key={r.name}
                  className="pl-4 basis-[85%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                >
                  <Card variant="flat" className="h-full">
                    <CardContent className="flex h-full flex-col gap-4 p-6">
                      <Quote className="size-6 text-accent" />
                      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
                      <span className="flex text-accent">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className="size-3.5 fill-current" />
                        ))}
                      </span>
                      <div>
                        <p className="font-display text-sm font-bold">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.location}</p>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </Carousel>
        </Section>
      </main>

      <Footer />
    </div>
  );
}

export default HomePage;

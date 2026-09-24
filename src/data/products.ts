import tomato from "@/assets/product-tomato.webp";
import chili from "@/assets/product-chili.webp";
import carrot from "@/assets/product-carrot.webp";
import brinjal from "@/assets/product-brinjal.webp";
import cucumber from "@/assets/product-cucumber.webp";
import pumpkin from "@/assets/product-pumpkin.webp";
import marigold from "@/assets/product-marigold.webp";

export type ProductTag = "bestseller" | "new" | "limited" | null;

export interface Product {
  slug: string;
  name: string;
  nameEn: string;
  tagline: string;
  price: number;
  oldPrice?: number;
  image: string;
  images?: string[]; // Multiple images for slider

  inStock: boolean;
  tag: ProductTag;
}

export const products: Product[] = [
  {
    slug: "hybrid-tomato-seeds",
    name: "Portulaca / Time Flower seed",
    nameEn: "Hybrid Tomato Seeds",
    tagline: "উচ্চ ফলনশীল, ৫০ পিস প্যাক",
    price: 250,
    oldPrice: 350,
    image: tomato,
    images: [tomato, chili, carrot], // Demos
    inStock: true,
    tag: "bestseller",
  },

  {
    slug: "green-chili-seeds",
    name: "Zinnia Flower seed",
    nameEn: "Green Chili Seeds",
    tagline: "ঝাঁঝালো স্বাদ, সারা বছর ফলন",
    price: 200,
    oldPrice: 280,
    image: chili,
    images: [chili, tomato, brinjal], // Added multiple images for the slider
    inStock: true,
    tag: "bestseller",
  },

  {
    slug: "carrot-seeds",
    name: "বারি-১২/ কেজি বেগুন",
    nameEn: "Premium Carrot Seeds",
    tagline: "মিষ্টি ও রসালো শীতকালীন গাজর",
    price: 180,
    image: carrot,
    images: [carrot, cucumber, pumpkin],
    inStock: true,
    tag: null,
  },
  {
    slug: "brinjal-seeds",
    name: "কেরালা শিম ",
    nameEn: "Long Brinjal Seeds",
    tagline: "লম্বা জাত, রোগ প্রতিরোধী",
    price: 220,
    image: brinjal,
    images: [brinjal, chili, tomato],
    inStock: true,
    tag: "new",
  },
  {
    slug: "cucumber-seeds",
    name: "শশা বীজ",
    nameEn: "Cucumber Seeds",
    tagline: "দ্রুত ফলন, টবেও চাষ উপযোগী",
    price: 190,
    image: cucumber,
    images: [cucumber, carrot, pumpkin],
    inStock: true,
    tag: null,
  },
  {
    slug: "pumpkin-seeds",
    name: "মিষ্টি কুমড়া বীজ",
    nameEn: "Sweet Pumpkin Seeds",
    tagline: "বড় আকারের ফল, দীর্ঘ সংরক্ষণ",
    price: 210,
    image: pumpkin,
    images: [pumpkin, cucumber, marigold],
    inStock: false,
    tag: "limited",
  },
  {
    slug: "marigold-flower-seeds",
    name: "গাঁদা ফুলের বীজ",
    nameEn: "Marigold Flower Seeds",
    tagline: "ছাদ বাগানের জন্য পারফেক্ট",
    price: 150,
    image: marigold,
    images: [marigold, pumpkin, chili],
    inStock: true,
    tag: null,
  },
];


export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/* ---------------- Landing page content (reusable template data) ---------------- */

export type BenefitIcon = "sprout" | "leaf" | "package" | "truck" | "shield" | "sun";

export interface Benefit {
  icon: BenefitIcon;
  title: string;
  text: string;
}

export interface Review {
  name: string;
  location: string;
  rating: number;
  text: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface LandingContent {
  headline: string;
  subheadline: string;
  highlights: string[];
  benefits: Benefit[];
  description: string[];
  usage: string[];
  reviews: Review[];
  faqs: Faq[];
  packSize: string;
  germination: string;
}

/** Shared fallbacks so a new product only needs name, price, image & tagline. */
const defaultBenefits: Benefit[] = [
  { icon: "sprout", title: "৯৫%+ Germination", text: "ল্যাব-টেস্টেড বীজ, প্রতিটি ব্যাচ যাচাই করা" },
  { icon: "leaf", title: "১০০% অর্গানিক", text: "কোনো ক্ষতিকর কেমিক্যাল ট্রিটমেন্ট নেই" },
  { icon: "package", title: "প্রিমিয়াম প্যাকেজিং", text: "এয়ার-টাইট ফয়েল প্যাক, দীর্ঘ সংরক্ষণ" },
  { icon: "truck", title: "ক্যাশ অন ডেলিভারি", text: "সারা দেশে ২৪–৭২ ঘণ্টায় হোম ডেলিভারি" },
];

const defaultReviews: Review[] = [
  {
    name: "রফিকুল ইসলাম",
    location: "বগুড়া",
    rating: 5,
    text: "বীজের গজানোর হার দুর্দান্ত। প্যাকেজিংও খুব ভালো ছিল, ডেলিভারি দ্রুত পেয়েছি।",
  },
  {
    name: "সাবরিনা আক্তার",
    location: "ঢাকা",
    rating: 5,
    text: "ছাদ বাগানের জন্য নিয়েছিলাম, প্রায় সব বীজই গজিয়েছে। আবার অর্ডার করব।",
  },
  {
    name: "মোঃ জাহিদ",
    location: "যশোর",
    rating: 4,
    text: "দাম অনুযায়ী কোয়ালিটি ভালো। ক্যাশ অন ডেলিভারিতে নিতে পেরে নিশ্চিন্ত লেগেছে।",
  },
];

const defaultFaqs: Faq[] = [
  { q: "ডেলিভারি কত দিনে পাব?", a: "ঢাকার ভেতরে ২৪–৪৮ ঘণ্টা এবং ঢাকার বাইরে ৪৮–৭২ ঘণ্টার মধ্যে হোম ডেলিভারি করা হয়।" },
  { q: "পেমেন্ট কীভাবে করব?", a: "ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে ডেলিভারি ম্যানকে টাকা পরিশোধ করবেন।" },
  { q: "বীজ না গজালে কী হবে?", a: "সঠিক নিয়মে বপনের পরও গজানোর হার ৮০%-এর নিচে হলে আমরা বীজ রিপ্লেস করে দিই।" },
  { q: "ডেলিভারি চার্জ কত?", a: "সারা বাংলাদেশে ডেলিভারি চার্জ মাত্র ৫০ টাকা। তবে একের অধিক (২টি বা তার বেশি) প্যাক অর্ডারে ডেলিভারি চার্জ একদম ফ্রি!" },
];

const landingOverrides: Partial<Record<string, Partial<LandingContent>>> = {
  "hybrid-tomato-seeds": {
    headline: "সারা বছর ধরে থোকায় থোকায় টমেটো",
    highlights: ["গাছপ্রতি ৮–১০ কেজি ফলন", "রোগ প্রতিরোধী হাইব্রিড জাত", "৫০ পিস বীজের প্যাক"],
  },
  "green-chili-seeds": {
    headline: "ঝাঁঝালো স্বাদের কাঁচা মরিচ, ঘরেই",
    highlights: ["সারা বছর ফলন", "টব ও জমিতে সমান উপযোগী", "উচ্চ ঝাল মাত্রা"],
  },
  "marigold-flower-seeds": {
    headline: "ছাদ বাগান ভরে উঠবে গাঁদা ফুলে",
    highlights: ["দীর্ঘ সময় ফুল থাকে", "পোকা প্রতিরোধে সহায়ক", "সহজ পরিচর্যা"],
  },
};

export function getLandingContent(product: Product): LandingContent {
  const o = landingOverrides[product.slug] ?? {};
  return {
    headline: o.headline ?? `${product.name} — ${product.tagline}`,
    subheadline:
      o.subheadline ??
      `প্রতিটি প্যাকেটের ${product.name} ল্যাব-টেস্টেড ও যাচাইকৃত। উচ্চ germination rate নিশ্চিত করে আমরা সারা বাংলাদেশে ক্যাশ অন ডেলিভারিতে পৌঁছে দিই।`,
    highlights: o.highlights ?? ["উচ্চ ফলনশীল জাত", "ল্যাব-টেস্টেড বীজ", "ক্যাশ অন ডেলিভারি"],
    benefits: o.benefits ?? defaultBenefits,
    description:
      o.description ?? [
        `${product.name} (${product.nameEn}) আমাদের সবচেয়ে যাচাইকৃত জাতগুলোর একটি। প্রতিটি ব্যাচ বপনের আগে germination test করা হয়, ফলে আপনি পাচ্ছেন নিশ্চিত অঙ্কুরোদগম ও সুস্থ সবল চারা।`,
        "বীজ সংগ্রহ থেকে প্যাকেজিং পর্যন্ত পুরো প্রক্রিয়া নিয়ন্ত্রিত পরিবেশে করা হয়। এয়ার-টাইট ফয়েল প্যাকেজিং বীজের আর্দ্রতা ধরে রাখে, তাই দীর্ঘদিন সংরক্ষণ করেও গুণ নষ্ট হয় না।",
      ],
    usage:
      o.usage ?? [
        "বপনের আগে বীজ ৬–৮ ঘণ্টা পানিতে ভিজিয়ে রাখুন।",
        "ঝুরঝুরে মাটিতে ০.৫–১ সেমি গভীরে বীজ বপন করুন।",
        "প্রতিদিন হালকা পানি দিন, মাটি যেন কখনো শুকিয়ে না যায়।",
        "চারা ৪–৫ পাতা হলে মূল জমি বা বড় টবে স্থানান্তর করুন।",
      ],
    reviews: o.reviews ?? defaultReviews,
    faqs: o.faqs ?? defaultFaqs,
    packSize: o.packSize ?? "১ প্যাক (৫০ পিস বীজ)",
    germination: o.germination ?? "৯৫%+",
  };
}

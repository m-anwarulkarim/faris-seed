import zinnia from "@/assets/product-zinnia.webp";

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
    slug: "multicolor-zinnia-flower-seeds",
    name: "মাল্টি কালার জিনিয়া ফুলের বীজ",
    nameEn: "Multicolor Zinnia Flower Seeds",
    tagline: "অফুরন্ত প্রিমিয়াম রঙ, ৯৫%+ অংকুরোদগম গ্যারান্টি, ছাদ বাগান ও টবের জন্য সেরা",
    price: 180,
    oldPrice: 280,
    image: zinnia,
    images: [zinnia],
    inStock: true,
    tag: "bestseller",
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug) ?? products[0];
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
  { icon: "leaf", title: "১০০% প্রিমিয়াম বীজ", text: "ছাদ ও মাঠের যেকোনো মাটিতে সহজ চাষযোগ্য" },
  { icon: "package", title: "এয়ার-টাইট ফয়েল প্যাক", text: "বীজের আর্দ্রতা ধরে রাখে, দীর্ঘদিন সংরক্ষণযোগ্য" },
  { icon: "truck", title: "ক্যাশ অন ডেলিভারি", text: "সারা বাংলাদেশে ২৪–৭২ ঘণ্টায় দ্রুত হোম ডেলিভারি" },
];

const defaultReviews: Review[] = [
  {
    name: "শারমিন আক্তার",
    location: "ঢাকা",
    rating: 5,
    text: "জিনিয়া বীজের প্যাকটা অনেক ভালো ছিল। প্রায় সব বীজ থেকে সুন্দর সুন্দর রঙ-বেরঙের ফুটফুটে চারা গজিয়েছে!",
  },
  {
    name: "আব্দুল করিম",
    location: "বগুড়া",
    rating: 5,
    text: "এক প্যাকেটে এতো সুন্দর বাহারি রঙের ফুল একসাথে পাবো ভাবিনি। বীজ গজানোর হারও খুব চমৎকার।",
  },
  {
    name: "মো জাহিদুল হাসান",
    location: "যশোর",
    rating: 5,
    text: "ক্যাশ অন ডেলিভারিতে ২ দিনেই হাতে পেলাম। প্যাকেজিং খুব সুরক্ষিত ছিল। ধন্যবাদ ফারিস সিড।",
  },
  {
    name: "মেহেরুন্নেসা চৌধুরী",
    location: "সিলেট",
    rating: 5,
    text: "ছাদ বাগানে টবে লাগিয়েছিলাম। ৪০ দিনের মাথায় মাশাল্লাহ প্রচুর ফুল ফুটেছে, বাগানটাই দেখতে অসাধারণ লাগছে।",
  },
];

const defaultFaqs: Faq[] = [
  { q: "একটি প্যাকেটে কতটি বীজ থাকে?", a: "প্রতিটি প্যাকেটে ৫০টিরও বেশি উচ্চ ফলনশীল প্রিমিয়াম মাল্টি কালার জিনিয়া ফুলের বীজ থাকে।" },
  { q: "বীজ না গজালে কী হবে?", a: "সঠিক নিয়মে বপনের পরও অঙ্কুরোদগমের হার ৮০%-এর নিচে হলে আমরা বীজ সম্পূর্ণ ফ্রি-তে রিপ্লেস করে দিই।" },
  { q: "ডেলিভারি চার্জ কত?", a: "সারা বাংলাদেশে ডেলিভারি চার্জ মাত্র ৫০ টাকা। ২টি বা তার বেশি প্যাক অর্ডার করলে ডেলিভারি চার্জ একদম ফ্রি!" },
  { q: "কত দিনে গাছে ফুল ফোটে?", a: "বীজ থেকে চারা বের হওয়ার ৪০ থেকে ৫০ দিনের মধ্যেই গাছে প্রচুর উজ্জ্বল ও নয়নজুড়ানো ফুল ফুটতে শুরু করে।" },
];

const landingOverrides: Partial<Record<string, Partial<LandingContent>>> = {
  "multicolor-zinnia-flower-seeds": {
    headline: "ছাদ ও বাগান ভরিয়ে তুলুন নয়নজুড়ানো বাহারি রঙের জিনিয়া ফুলে",
    subheadline: "আমাদের হাই-জার্মিনেশন প্রিমিয়াম প্যাকেটের মাল্টি কালার জিনিয়া ফুল চাষ করে আপনার বাগানকে অনন্য সুন্দর রূপ দিন। ল্যাব-টেস্টেড ফ্রেশ বীজ।",
    highlights: [
      "অফুরন্ত উজ্জ্বল রঙের মিশ্রণ (লাল, হলুদ, গোলাপী, সাদা, বেগুনী, কমলা)",
      "সহজ চারা তৈরি ও দ্রুত ফুল আসার নিশ্চয়তা (৪০–৫০ দিনে ফুল)",
      "টব, ছাদ বাগান এবং সীমানা বাগানের জন্য অত্যন্ত উপযোগী",
      "৯৫%+ অংকুরোদগমের সেরা ল্যাব-টেস্টেড পারফেক্ট ব্যাচ",
    ],
    description: [
      "জ জিনিয়া (Zinnia) অত্যন্ত চমৎকার রঙিন ও দীর্ঘস্থায়ী ফুল গাছ। মাল্টি কালার জিনিয়া বীজের এই প্যাকেটে আপনি পাবেন লাল, গোলাপী, হলুদ, সাদা, বেগুনী ও কমলার মতো উজ্জ্বল ও নয়নজুড়ানো রূপের বৈচিত্র্য।",
      "এই বীজ অত্যন্ত সহজে অঙ্কুরিত হয় এবং চারা রোপণের মাত্র ৪০ থেকে ৫০ দিনের মধ্যেই প্রচুর ফুল ফুটতে শুরু করে। রোদ উজ্জ্বল স্থানে ও টবে খুব ভালো জন্মায়। প্রতিটি ফয়েল প্যাক এয়ার-টাইট ও সম্পূর্ণ আর্দ্রতারোধী।",
    ],
    usage: [
      "বীজ বপনের আগে ৪–৬ ঘণ্টা পরিষ্কার পানিতে ভিজিয়ে রাখুন।",
      "টব বা চারা তৈরির পাত্রে ঝুরঝুরে জৈব সারযুক্ত মাটিতে ০.৫ সেমি গভীরে ছিটিয়ে হালকা মাটি দিয়ে ঢেকে দিন।",
      "হালকা স্প্রে করে পানি দিন এবং সরাসরি কড়া রোদ এড়িয়ে ছায়াযুক্ত স্থানে রাখুন (৩–৫ দিনে চারা গজাবে)।",
      "চারা ৩–৪ ইঞ্চি লম্বা হলে পর্যাপ্ত আলো বাতাসযুক্ত স্থানে বা বড় টবে স্থানান্তর করুন।",
    ],
  },
};

export function getLandingContent(product: Product): LandingContent {
  const o = landingOverrides[product.slug] ?? landingOverrides["multicolor-zinnia-flower-seeds"] ?? {};
  return {
    headline: o.headline ?? `${product.name} — ${product.tagline}`,
    subheadline:
      o.subheadline ??
      `প্রতিটি প্যাকেটের ${product.name} ল্যাব-টেস্টেড ও যাচাইকৃত। উচ্চ germination rate নিশ্চিত করে আমরা সারা বাংলাদেশে ক্যাশ অন ডেলিভারিতে পৌঁছে দিই।`,
    highlights: o.highlights ?? ["উচ্চ ফলনশীল জাত", "ল্যাব-টেস্টেড বীজ", "ক্যাশ অন ডেলিভারি"],
    benefits: o.benefits ?? defaultBenefits,
    description:
      o.description ?? [
        `${product.name} (${product.nameEn}) আমাদের সবচেয়ে পছন্দনীয় ফুল বীজের একটি। প্রতিটি ব্যাচ বপনের আগে germination test করা হয়, ফলে আপনি পাচ্ছেন নিশ্চিত অঙ্কুরোদগম ও সুস্থ সবল চারা।`,
        "বীজ সংগ্রহ থেকে প্যাকেজিং পর্যন্ত পুরো প্রক্রিয়া নিয়ন্ত্রিত পরিবেশে করা হয়। এয়ার-টাইট ফয়েল প্যাকেজিং বীজের আর্দ্রতা ধরে রাখে, তাই দীর্ঘদিন সংরক্ষণ করেও গুণ নষ্ট হয় না।",
      ],
    usage:
      o.usage ?? [
        "বপনের আগে বীজ ৪–৬ ঘণ্টা পানিতে ভিজিয়ে রাখুন।",
        "ঝুরঝুরে মাটিতে ০.৫ সেমি গভীরে বীজ বপন করুন।",
        "প্রতিদিন হালকা স্প্রে করে পানি দিন, মাটি যেন কখনো শুকিয়ে না যায়।",
        "চারা ৩–৪ ইঞ্চি লম্বা হলে মূল জমি বা বড় টবে স্থানান্তর করুন।",
      ],
    reviews: o.reviews ?? defaultReviews,
    faqs: o.faqs ?? defaultFaqs,
    packSize: o.packSize ?? "১ প্যাক (৫০+ বীজ)",
    germination: o.germination ?? "৯৫%+",
  };
}

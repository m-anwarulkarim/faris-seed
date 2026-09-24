export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterSocial = { icon: "Facebook" | "Instagram" | "Youtube" | "WhatsApp"; href: string; enabled: boolean };

export type FooterConfig = {
  brandTagline: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  socials: FooterSocial[];
  quickLinks: FooterColumn;
  usefulLinks: FooterColumn;
  copyright: string;
};

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  brandTagline: "বাংলাদেশের অন্যতম সেরা অনলাইন শপ। সব পণ্য অনলাইনে অর্ডার করুন সাশ্রয়ী মূল্যে।",
  contactEmail: "store.grihanova@gmail.com",
  contactPhone: "+8801708356800",
  contactAddress: "Dhaka, Bangladesh",
  socials: [
    { icon: "Facebook", href: "https://www.facebook.com/grihanova.bd", enabled: true },
    { icon: "Instagram", href: "https://instagram.com", enabled: true },
    { icon: "Youtube", href: "https://youtube.com", enabled: true },
    { icon: "WhatsApp", href: "https://wa.me/8801708356800", enabled: true },
  ],
  quickLinks: {
    title: "দ্রুত লিংক",
    links: [
      { label: "রিটার্ন ও রিফান্ড", href: "/return-refund" },
      { label: "প্রাইভেসি পলিসি", href: "/privacy-policy" },
      { label: "শর্তাবলী", href: "/terms-of-service" },
      { label: "আমাদের সম্পর্কে", href: "/about" },
    ],
  },
  usefulLinks: {
    title: "উপকারী লিংক",
    links: [
      { label: "কেন আমাদের সাথে কিনবেন", href: "/why-buy-from-us" },
      { label: "পেমেন্ট মেথড", href: "/payment-methods" },
      { label: "আফটার সেলস সাপোর্ট", href: "/after-sales-support" },
      { label: "সাধারণ প্রশ্ন", href: "/faq" },
    ],
  },
  copyright: "Copyright © {year} www.grihanova.com",
};

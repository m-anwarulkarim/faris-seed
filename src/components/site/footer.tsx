import { Link } from "react-router-dom";
import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from "lucide-react";
const logoAsset = { url: "/favicon.png" };

import { products } from "@/data/products";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-primary-deep text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-white shadow-soft">
                <img src={logoAsset.url} alt="" className="size-full object-contain p-1" />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight">FARIS SEED</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-primary-foreground/70">
              বাংলাদেশের কৃষক ও ছাদ-বাগানীদের জন্য উচ্চ germination rate-এর প্রিমিয়াম বীজ। সারা দেশে
              ক্যাশ অন ডেলিভারি।
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-primary-foreground/60">
              কুইক লিংক
            </h3>
            <Link to="/" className="text-sm text-primary-foreground/80 hover:text-accent">
              হোম
            </Link>
            <Link to={`/#products`} className="text-sm text-primary-foreground/80 hover:text-accent">
              সব প্রোডাক্ট
            </Link>
            <Link to="/about" className="text-sm text-primary-foreground/80 hover:text-accent">
              আমাদের সম্পর্কে
            </Link>
            <Link to="/contact" className="text-sm text-primary-foreground/80 hover:text-accent">
              যোগাযোগ
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-primary-foreground/60">
              জনপ্রিয় বীজ
            </h3>
            {products.slice(0, 4).map((p) => (
              <Link to={`/product/${p.slug}`}                key={p.slug}
                className="text-sm text-primary-foreground/80 hover:text-accent"
              >
                {p.name}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-primary-foreground/60">
              যোগাযোগ
            </h3>
            <a
              href="tel:+8801897492635"
              className="flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-accent"
            >
              <Phone className="size-4 shrink-0" /> +8801897492635
            </a>
            <a
              href="mailto:shopfaris01@gmail.com"
              className="flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-accent"
            >
              <Mail className="size-4 shrink-0" /> shopfaris01@gmail.com
            </a>
            <p className="flex items-start gap-2 text-sm text-primary-foreground/80">
              <MapPin className="mt-0.5 size-4 shrink-0" /> House#69/A,Road#3,Mohammadia Housing,Mohammadpur,Dhaka
            </p>
            <div className="mt-2 flex items-center gap-2">
              {[
                { Icon: Facebook, label: "Facebook" },
                { Icon: Instagram, label: "Instagram" },
                { Icon: Youtube, label: "YouTube" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="grid size-9 place-items-center rounded-xl bg-primary-foreground/10 text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-primary-foreground/15 pt-6 text-xs text-primary-foreground/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} FARIS SEED. সর্বস্বত্ব সংরক্ষিত।</p>

          <div className="flex items-center justify-center gap-1.5 font-medium">

            <span>Developed by</span>
            <a
              href="https://wa.me/8801560007231?text=Hello%20HAQPLUS%20IT"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 font-bold text-accent shadow-sm transition-all duration-300 hover:scale-105 hover:bg-emerald-500 hover:text-white"
            >
              <span className="relative z-10 flex items-center gap-1">
                HAQPLUS IT
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">🚀</span>
              </span>
            </a>
          </div>

          <p className="text-center sm:text-right">Cash on Delivery সারা বাংলাদেশে</p>
        </div>
      </div>
    </footer>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, ShoppingCart, User, X } from "lucide-react";
const logoAsset = { url: "/favicon.png" };

import { Button } from "@/components/pub/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cartQuantity, useCart } from "@/data/cart";
import { bn } from "@/lib/format";

const navLinks: { label: string; to: string }[] = [
  { label: "হোম", to: "/" },
  { label: "প্রোডাক্ট", to: "/#products" },
  { label: "আমাদের সম্পর্কে", to: "/about" },
  { label: "যোগাযোগ", to: "/contact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const count = cartQuantity(useCart());

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-soft">
            <img src={logoAsset.url} alt="FARIS SEED" className="size-full object-contain p-1" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-extrabold leading-tight tracking-tight">
              FARIS SEED
            </span>
            <span className="block truncate text-[11px] font-medium text-muted-foreground">
              Premium Seed Store
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="rounded-full px-4 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-secondary hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <Link to="/cart"
            aria-label="কার্ট"
            className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground shadow-soft transition-colors hover:text-primary"
          >
            <ShoppingCart className="size-5" />
            {count > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 font-display text-[10px] font-bold text-accent-foreground">
                {bn(count)}
              </span>
            ) : null}
          </Link>


          <Link to="/account"
            aria-label="অ্যাকাউন্ট"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground shadow-soft transition-colors hover:text-primary"
          >
            <User className="size-5" />
          </Link>

          <Button asChild variant="cta" size="sm" className="hidden sm:inline-flex">
            <Link to={`/#products`}>
              অর্ডার করুন
            </Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="মেনু খুলুন"
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground shadow-soft lg:hidden"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 [&>button]:hidden">
              <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border p-4">
                <SheetTitle className="flex items-center gap-2.5 text-left">
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-soft">
                    <img
                      src={logoAsset.url}
                      alt="FARIS SEED"
                      className="size-full object-contain p-1"
                    />
                  </span>
                  <span className="font-display text-base font-extrabold">FARIS SEED</span>
                </SheetTitle>
                <SheetClose asChild>
                  <button
                    type="button"
                    aria-label="মেনু বন্ধ করুন"
                    className="grid size-9 place-items-center rounded-xl border border-border bg-card"
                  >
                    <X className="size-4" />
                  </button>
                </SheetClose>
              </SheetHeader>

              <nav className="flex flex-col gap-1 p-4">
                {navLinks.map((l) => (
                  <Link
                    key={l.label}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-foreground/80 transition-colors hover:bg-secondary hover:text-primary"
                  >
                    {l.label}
                  </Link>
                ))}
                <Link to="/cart"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-foreground/80 transition-colors hover:bg-secondary hover:text-primary"
                >
                  কার্ট
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-primary">
                    {bn(count)}
                  </span>
                </Link>
                <Button asChild variant="cta" className="mt-3">
                  <Link to={`/#products`} onClick={() => setOpen(false)}>
                    অর্ডার করুন
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
const logoAsset = { url: "/favicon.png" };

import { Button } from "@/components/pub/button";
import { cn } from "@/lib/utils";
import { bn } from "@/lib/format";


export function LandingTopBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-soft border border-border/50">
            <img src={logoAsset.url} alt="" className="size-full object-contain p-1" />
          </span>
          <span className="font-display text-base font-extrabold leading-none tracking-tight">
            FARIS SEED
          </span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft /> হোমে ফিরুন
          </Link>
        </Button>
      </div>
    </header>
  );
}

export function StickyOrderBar({ price, oldPrice, hidden }: { price: number; oldPrice?: number; hidden?: boolean }) {
  return (
    <div className={cn(
      "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 shadow-lift backdrop-blur-md lg:hidden",
      hidden && "hidden"
    )}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex flex-col leading-tight">
          <span className="font-display text-lg font-bold text-primary">৳ {bn(price)}</span>
          {oldPrice ? (
            <span className="text-xs text-muted-foreground line-through">৳ {bn(oldPrice)}</span>
          ) : null}
        </div>
        <Button asChild variant="cta" className="flex-1 max-w-56">
          <a href="#order">এখনই অর্ডার করুন</a>
        </Button>
      </div>
    </div>
  );
}


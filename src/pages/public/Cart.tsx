import { Link } from "react-router-dom";
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { Button } from "@/components/pub/button";
import { Card, CardContent } from "@/components/pub/card";
import { Section, SectionHeading } from "@/components/pub/section";
import {
  cartDeliveryCharge,
  cartSubtotal,
  removeFromCart,
  setCartQuantity,
  useCart,
} from "@/data/cart";
import { bn } from "@/lib/format";


function CartPage() {
  const items = useCart();
  const subtotal = cartSubtotal(items);
  const delivery = cartDeliveryCharge(items);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Section spacing="lg" width="wide">
          <SectionHeading eyebrow="কার্ট" title="আপনার কার্ট" description="পরিমাণ ঠিক করে চেকআউটে যান।" />

          {items.length === 0 ? (
            <Card variant="flat" className="mt-8">
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
                  <ShoppingCart className="size-7" />
                </span>
                <h2 className="font-display text-xl font-bold">কার্ট খালি</h2>
                <p className="text-sm text-muted-foreground">
                  পছন্দের বীজ কার্টে যুক্ত করে একসাথে অর্ডার করুন।
                </p>
                <Button asChild variant="cta">
                  <Link to={`/#products`}>
                    প্রোডাক্ট দেখুন
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="flex flex-col gap-4">
                {items.map((i) => (
                  <Card key={i.slug} variant="flat">
                    <CardContent className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                      <img
                        src={i.image}
                        alt={i.name}
                        className="size-20 shrink-0 rounded-xl object-cover sm:size-24"
                      />
                      <div className="min-w-0 flex-1">
                        <Link to={`/product/${i.slug}`}
                          className="font-display text-sm font-bold hover:text-primary sm:text-base"
                        >
                          {i.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                          ৳ {bn(i.price)} / প্যাক
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
                            <button
                              type="button"
                              aria-label="পরিমাণ কমান"
                              onClick={() => setCartQuantity(i.slug, i.quantity - 1)}
                              className="grid size-7 place-items-center rounded-lg transition-colors hover:bg-secondary"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="min-w-8 text-center font-display text-sm font-bold">
                              {bn(i.quantity)}
                            </span>
                            <button
                              type="button"
                              aria-label="পরিমাণ বাড়ান"
                              onClick={() => setCartQuantity(i.slug, i.quantity + 1)}
                              className="grid size-7 place-items-center rounded-lg transition-colors hover:bg-secondary"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(i.slug)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" /> সরান
                          </button>
                        </div>
                      </div>
                      <span className="font-display text-base font-extrabold text-primary sm:text-lg">
                        ৳ {bn(i.price * i.quantity)}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card variant="panel" className="lg:sticky lg:top-24 lg:self-start">
                <CardContent className="flex flex-col gap-3 p-5">
                  <h2 className="font-display text-lg font-bold">সারসংক্ষেপ</h2>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">পণ্যর দাম</span>
                    <span className="font-semibold">{bn(subtotal)} ৳</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                    <span className="font-semibold text-primary">
                      {delivery === 0 ? "ফ্রি" : `${bn(delivery)} ৳`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="font-semibold">সর্বমোট</span>
                    <span className="font-display text-xl font-bold text-primary">
                      {bn(subtotal + delivery)} ৳
                    </span>
                  </div>
                  <Button asChild variant="cta" size="lg" className="mt-1">
                    <Link to="/checkout">
                      চেকআউট করুন <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/#products`}>
                      আরও প্রোডাক্ট দেখুন
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </Section>
      </main>
      <Footer />
    </div>
  );
}

export default CartPage;

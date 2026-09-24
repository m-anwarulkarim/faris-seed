import { Link } from "react-router-dom";
import { Check, Download, FileText, Package } from "lucide-react";
import { useEffect, useState } from "react";

import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { Button } from "@/components/pub/button";
import { Card, CardContent } from "@/components/pub/card";
import { Section } from "@/components/pub/section";
import { bn } from "@/lib/format";
import { openInvoice, type CustomerInvoice } from "@/lib/customerInvoice";
import { trackPurchase } from "@/components/TrackingScripts";
import { ThankYouUpsell } from "@/components/ThankYouUpsell";

function ThankYouPage() {
  const [order, setOrder] = useState<CustomerInvoice | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("last_order_invoice");
      if (!raw) return;
      const parsed = JSON.parse(raw) as CustomerInvoice;
      setOrder(parsed);
      trackPurchase(
        parsed.invoice_no,
        Number(parsed.total_amount),
        "BDT",
        parsed.phone ?? undefined,
        parsed.customer_name ?? undefined,
      );
    } catch (e) {
      console.error("Failed to read last order", e);
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Section spacing="lg" width="narrow">
          <Card variant="panel" className="overflow-hidden border-2 border-primary/20">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary animate-in zoom-in duration-500">
                <Check className="size-10 stroke-[3]" />
              </div>

              <div className="flex flex-col gap-2">
                <h1 className="font-display text-3xl font-black text-primary sm:text-4xl">
                  অর্ডার সফল হয়েছে!
                </h1>
                <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                  আপনার মূল্যবান অর্ডারের জন্য ধন্যবাদ। আমাদের প্রতিনিধি ২৪ ঘণ্টার মধ্যে কল করে আপনার অর্ডারটি নিশ্চিত করবেন।
                </p>
              </div>

              {order && (
                <div className="mt-6 w-full rounded-2xl border border-border/60 bg-secondary/40 p-4 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      <p className="text-sm font-bold">ইনভয়েস নং: {order.invoice_no}</p>
                    </div>
                    <p className="text-sm font-bold text-primary">
                      ৳{bn(Number(order.total_amount))}
                    </p>
                  </div>

                  <div className="mt-3 space-y-2">
                    {order.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Package className="size-3.5 shrink-0 text-primary/60" />
                        <span className="truncate font-medium text-foreground">{it.product_name}</span>
                        <span>× {bn(it.quantity)}</span>
                        <span className="ml-auto">৳{bn(it.unit_price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    className="mt-4 h-11 w-full gap-2 rounded-xl bg-background hover:bg-primary hover:text-primary-foreground"
                    onClick={() => openInvoice(order)}
                  >
                    <Download className="size-4" /> ইনভয়েস দেখুন ও ডাউনলোড করুন
                  </Button>
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    আপনার অ্যাকাউন্টে লগইন করলে সব অর্ডারের ইনভয়েস যেকোনো সময় পাওয়া যাবে।
                  </p>
                 </div>
              )}

              <ThankYouUpsell
                orderId={order?.order_id ?? null}
                onAdded={(offer) =>
                  setOrder((prev) => {
                    if (!prev) return prev;
                    const next: CustomerInvoice = {
                      ...prev,
                      total_amount: Number(prev.total_amount) + offer.price,
                      items: [
                        ...prev.items,
                        { product_name: offer.name, quantity: 1, unit_price: offer.price },
                      ],
                    };
                    try {
                      localStorage.setItem("last_order_invoice", JSON.stringify(next));
                    } catch {
                      /* storage unavailable */
                    }
                    return next;
                  })
                }
              />


              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                <Button asChild variant="cta" className="h-12 w-full rounded-2xl shadow-lift">
                  <Link to={`/#products`}>আরও শপিং করুন</Link>
                </Button>
                <Button asChild variant="outline" className="h-12 w-full rounded-2xl">
                  <Link to="/account">আমার অর্ডার দেখুন</Link>
                </Button>
              </div>

              <p className="mt-4 text-xs text-muted-foreground italic">
                প্রয়োজনে কল করুন: <span className="font-bold text-foreground">+8801897492635</span>
              </p>
            </CardContent>
          </Card>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

export default ThankYouPage;

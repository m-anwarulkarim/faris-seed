import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Download, Loader2, ShieldCheck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { Button } from "@/components/pub/button";
import { Card, CardContent } from "@/components/pub/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section, SectionHeading } from "@/components/pub/section";
import { Textarea } from "@/components/ui/textarea";
import { cartDeliveryCharge, cartSubtotal, clearCart, useCart } from "@/data/cart";
import { placeOrder } from "@/lib/placeOrder";
import { bn } from "@/lib/format";


function CheckoutPage() {
  const items = useCart();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    altPhone: "",
    address: "",
    note: "",
  });

  const subtotal = cartSubtotal(items);
  const delivery = cartDeliveryCharge(items);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("কার্ট খালি — আগে প্রোডাক্ট যুক্ত করুন।");
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(form.phone.replace(/[\s-]/g, ""))) {
      toast.error("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন 01712345678)");
      return;
    }
    setSubmitting(true);

    try {
      await placeOrder({
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        altPhone: form.altPhone.trim() || null,
        note: form.note.trim() || null,
        deliveryCharge: delivery,
        items: items.map((item) => ({
          productName: item.name,
          productImage: item.image || null,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      });
      clearCart();
      toast.success("অর্ডার কনফার্ম হয়েছে! আমরা শীঘ্রই কল করব।");
      navigate("/thank-you");
    } catch (error) {
      toast.error("অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Section spacing="lg" width="wide">
          <SectionHeading
            eyebrow="চেকআউট"
            title="ক্যাশ অন ডেলিভারিতে অর্ডার"
            description="নিচের তথ্য দিয়ে কার্টের সব প্রোডাক্ট একসাথে অর্ডার করুন।"
          />

          {items.length === 0 ? (
            <Card variant="flat" className="mt-8">
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
                  <ShoppingCart className="size-7" />
                </span>
                <h2 className="font-display text-xl font-bold">কার্ট খালি</h2>
                <Button asChild variant="cta">
                  <Link to={`/#products`}>
                    প্রোডাক্ট দেখুন
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-8 flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px]">
              <Card variant="panel">
                <CardContent className="p-5 sm:p-7">
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="customerName">আপনার নাম *</Label>
                      <Input
                        id="customerName"
                        required
                        autoComplete="name"
                        placeholder="যেমন: রফিকুল ইসলাম"
                        value={form.customerName}
                        onChange={(e) => update("customerName", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="phone">মোবাইল নম্বর *</Label>
                        <Input
                          id="phone"
                          required
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          placeholder="01XXXXXXXXX"
                          value={form.phone}
                          onChange={(e) => update("phone", e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="altPhone">বিকল্প মোবাইল নম্বর (ঐচ্ছিক)</Label>
                        <Input
                          id="altPhone"
                          type="tel"
                          inputMode="numeric"
                          placeholder="01XXXXXXXXX"
                          value={form.altPhone}
                          onChange={(e) => update("altPhone", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="address">সম্পূর্ণ ঠিকানা *</Label>
                      <Textarea
                        id="address"
                        required
                        rows={3}
                        placeholder="গ্রাম/বাসা, রোড, থানা, জেলা"
                        value={form.address}
                        onChange={(e) => update("address", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="note">অতিরিক্ত নোট (ঐচ্ছিক)</Label>
                      <Input
                        id="note"
                        placeholder="ডেলিভারি সম্পর্কিত কোনো নির্দেশনা"
                        value={form.note}
                        onChange={(e) => update("note", e.target.value)}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="cta"
                      size="lg"
                      disabled={submitting}
                      className="w-full whitespace-normal px-4 text-center text-sm leading-snug sm:text-base"
                    >
                      {submitting ? <Loader2 className="animate-spin" /> : null}
                      অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)
                    </Button>
                    <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="size-4 text-primary" />
                      পণ্য হাতে পেয়ে টাকা পরিশোধ করুন — কোনো অগ্রিম পেমেন্ট নেই
                    </p>
                  </form>
                </CardContent>
              </Card>

              <Card variant="flat" className="lg:sticky lg:top-24 lg:self-start">
                <CardContent className="flex flex-col gap-3 p-5">
                  <h2 className="font-display text-lg font-bold">অর্ডার সারসংক্ষেপ</h2>
                  {items.map((i) => (
                    <div key={i.slug} className="flex items-center gap-3">
                      <img src={i.image} alt={i.name} className="size-12 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{i.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {bn(i.quantity)} × ৳ {bn(i.price)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold">৳ {bn(i.price * i.quantity)}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-sm">
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
                  <Button asChild variant="outline" size="sm">
                    <Link to="/cart">কার্ট এডিট করুন</Link>
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

export default CheckoutPage;

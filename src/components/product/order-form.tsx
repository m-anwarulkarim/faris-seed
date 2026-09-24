import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/pub/button";
import { Card, CardContent } from "@/components/pub/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { placeOrder } from "@/lib/placeOrder";
import type { Product } from "@/data/products";
import { bn } from "@/lib/format";
import { getPackOffer, getPackOffers } from "@/lib/pack-offers";


export function OrderForm({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ customerName: "", phone: "", altPhone: "", address: "", note: "" });
  const navigate = useNavigate();

  const offers = getPackOffers(product.price);
  const selectedOffer = getPackOffer(product.price, quantity);
  const unitPrice = Math.round((selectedOffer.price / quantity) * 100) / 100;
  const deliveryCharge = quantity > 1 ? 0 : 50;
  const total = selectedOffer.price + deliveryCharge;



  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
        deliveryCharge,
        items: [
          {
            productName: product.name,
            productImage: product.image || null,
            quantity,
            unitPrice,
          },
        ],
      });
      toast.success("অর্ডার কনফার্ম হয়েছে! আমরা শীঘ্রই কল করব।");
      navigate("/thank-you");
    } catch {
      toast.error("অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setSubmitting(false);
    }
  }



  return (
    <Card variant="panel" id="order">
      <CardContent className="p-5 sm:p-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>প্যাকেজ নির্বাচন করুন</Label>
            <div className="grid grid-cols-3 gap-2">
              {offers.map((o) => {
                const selected = o.quantity === quantity;
                return (
                  <button
                    key={o.quantity}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setQuantity(o.quantity)}
                    className={`relative mt-2 flex flex-col items-center gap-1 rounded-2xl px-2 py-3.5 text-center transition-all ${
                      selected ? "scale-[1.04] shadow-lg" : "hover:-translate-y-0.5 hover:shadow-md"
                    }`}
                    style={
                      selected
                        ? {
                            border: "2px solid #ffb300",
                            background: "linear-gradient(180deg,#fffaf0,#fff2cf)",
                            boxShadow: "0 10px 26px -10px rgba(255,179,0,0.65)",
                          }
                        : { border: "1px solid #dcefe2", background: "#fff" }
                    }
                  >
                    {o.badge ? (
                      <span
                        className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                        style={{
                          background: selected
                            ? "linear-gradient(90deg,#ffc107,#ffb300)"
                            : "linear-gradient(90deg,#25a04f,#14682f)",
                          color: selected ? "#0d3d1c" : "#fff",
                        }}
                      >
                        {o.badge}
                      </span>
                    ) : null}
                    <span className="text-xs font-bold" style={{ color: selected ? "#a76a00" : "#1b7a3e" }}>
                      {o.label}
                    </span>
                    <span
                      className="font-display text-lg font-extrabold leading-none"
                      style={{ color: selected ? "#b45309" : "#14682f" }}
                    >
                      {bn(o.price)} ৳
                    </span>
                    {o.saving > 0 ? (
                      <span className="text-[11px] text-neutral-400 line-through">
                        {bn(o.regularPrice)} ৳
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-500">প্রতি প্যাক</span>
                    )}
                    {selected ? (
                      <Check className="absolute right-1.5 top-1.5 size-3.5" style={{ color: "#b45309" }} />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {selectedOffer.saving > 0 ? (
              <p className="text-xs font-medium text-primary">
                আপনি সেভ করছেন {bn(selectedOffer.saving)} ৳ + ডেলিভারি ফ্রি
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                ২ প্যাক নিলে ডেলিভারি চার্জ একদম ফ্রি।
              </p>
            )}
          </div>

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

          <div className="flex flex-col gap-2 rounded-xl bg-secondary px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">পণ্যর দাম</span>
              <span className="font-semibold">{bn(selectedOffer.price)} ৳</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
              <span className="font-semibold text-primary">
                {deliveryCharge === 0 ? "ফ্রি" : `${bn(deliveryCharge)} ৳`}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
              <span className="font-semibold text-secondary-foreground">সর্বমোট</span>
              <span className="font-display text-xl font-bold text-primary">{bn(total)} ৳</span>
            </div>
          </div>

          <Button
            type="submit"
            variant="cta"
            size="lg"
            disabled={submitting}
            className="cta-pulse w-full whitespace-normal px-4 text-center text-sm leading-snug sm:text-base"
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            অর্ডার কনফার্ম করুন
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            পণ্য হাতে পেয়ে টাকা পরিশোধ করুন — কোনো অগ্রিম পেমেন্ট নেই
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

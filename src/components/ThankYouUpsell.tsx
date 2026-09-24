import { useEffect, useState } from "react";
import { Loader2, Plus, Check } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/pub/button";
import { bn } from "@/lib/format";
import { addOfferToOrder, loadThankYouOffers, type ThankYouOffer } from "@/lib/thankYouOffers";

interface Props {
  orderId?: string | null;
  onAdded?: (offer: ThankYouOffer) => void;
}

export function ThankYouUpsell({ orderId, onAdded }: Props) {
  const [offers, setOffers] = useState<ThankYouOffer[]>([]);
  const [selected, setSelected] = useState<ThankYouOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  useEffect(() => {
    loadThankYouOffers().then((list) => setOffers(list.filter((o) => o.active)));
  }, []);

  if (!orderId || offers.length === 0) return null;

  async function confirm() {
    if (!selected || !orderId) return;
    setBusy(true);
    try {
      const res = await addOfferToOrder(orderId, selected.id, 1);
      if (!res.ok) {
        const msg =
          res.error === "too_late" || res.error === "order_locked"
            ? "এই অর্ডারে আর পণ্য যোগ করা যাবে না। নতুন অর্ডার করুন।"
            : "যোগ করা যায়নি, আবার চেষ্টা করুন।";
        toast.error(msg);
      } else {
        setAdded((a) => [...a, selected.id]);
        onAdded?.(selected);
        toast.success(`${selected.name} আপনার অর্ডারে যোগ হয়েছে!`);
      }
    } catch {
      toast.error("যোগ করা যায়নি, আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
      setSelected(null);
    }
  }

  return (
    <div className="mt-6 w-full rounded-2xl border border-primary/20 bg-background p-4 text-left">
      <div className="mb-1 text-center">
        <h2 className="font-display text-lg font-extrabold text-primary">
          স্পেশাল অফার — একই অর্ডারে যোগ করুন
        </h2>
        <p className="text-xs text-muted-foreground">
          নতুন করে অর্ডার করতে হবে না, শুধু "+" চাপুন — একই ডেলিভারিতে চলে আসবে।
        </p>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {offers.map((o) => {
          const isAdded = added.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              disabled={isAdded}
              onClick={() => setSelected(o)}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-center transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-70"
            >
              <div className="aspect-square w-full overflow-hidden bg-secondary">
                <img
                  src={o.image || "/placeholder.svg"}
                  alt={o.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-0.5 p-1.5">
                <span className="line-clamp-2 text-[10px] font-semibold leading-tight">{o.name}</span>
                <span className="text-[11px] font-extrabold text-primary">৳{bn(o.price)}</span>
                {o.oldPrice ? (
                  <span className="text-[9px] text-muted-foreground line-through">৳{bn(o.oldPrice)}</span>
                ) : null}
              </div>
              <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                {isAdded ? <Check className="size-3" /> : <Plus className="size-3" />}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>অর্ডারে যোগ করবেন?</DialogTitle>
            <DialogDescription>
              এই পণ্যটি আপনার এখনকার অর্ডারের সাথেই যোগ হবে — আলাদা ডেলিভারি চার্জ লাগবে না।
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <img
                src={selected.image || "/placeholder.svg"}
                alt={selected.name}
                className="size-16 rounded-lg object-cover"
              />
              <div>
                <p className="text-sm font-bold">{selected.name}</p>
                <p className="text-sm font-extrabold text-primary">
                  ৳{bn(selected.price)}{" "}
                  {selected.oldPrice ? (
                    <span className="text-xs font-normal text-muted-foreground line-through">
                      ৳{bn(selected.oldPrice)}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>
              না, থাক
            </Button>
            <Button variant="cta" onClick={confirm} disabled={busy}>
              {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              হ্যাঁ, যোগ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

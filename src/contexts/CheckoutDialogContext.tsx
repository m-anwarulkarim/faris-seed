import { createContext, useContext, useEffect, useState, lazy, Suspense, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X } from "lucide-react";

// Prefetch Checkout chunk eagerly so the dialog opens instantly
const checkoutImport = () => import("@/pages/Checkout");
const Checkout = lazy(checkoutImport);
if (typeof window !== "undefined") {
  const prefetch = () => { checkoutImport(); };
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(prefetch, { timeout: 2000 });
  } else {
    setTimeout(prefetch, 1200);
  }
}

export interface CheckoutVariantPayload {
  productId: string;
  productName: string;
  productImage: string | null;
  price: number;
  oldPrice: number | null;
  label: string;
  variants: string[];
  selected: string;
}

interface CheckoutDialogContextValue {
  open: (variant?: Omit<CheckoutVariantPayload, "selected"> & { selected?: string }) => void;
  close: () => void;
  isOpen: boolean;
  variantPayload: CheckoutVariantPayload | null;
  setVariantSelected: (variant: string) => void;
}

const CheckoutDialogContext = createContext<CheckoutDialogContextValue>({
  open: () => {},
  close: () => {},
  isOpen: false,
  variantPayload: null,
  setVariantSelected: () => {},
});

export function CheckoutDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [variantPayload, setVariantPayload] = useState<CheckoutVariantPayload | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-close on any route change (back, order-confirmed nav, etc.)
  useEffect(() => {
    setIsOpen(false);
    setVariantPayload(null);
  }, [location.pathname]);

  // Legacy /checkout URL → open dialog over home
  useEffect(() => {
    if (location.pathname === "/checkout") {
      navigate("/", { replace: true });
      setTimeout(() => setIsOpen(true), 0);
    }
  }, [location.pathname, navigate]);

  const open = useCallback((variant?: Omit<CheckoutVariantPayload, "selected"> & { selected?: string }) => {
    if (variant) {
      setVariantPayload({ ...variant, selected: variant.selected || variant.variants[0] });
    } else {
      setVariantPayload(null);
    }
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setVariantPayload(null);
  }, []);
  const setVariantSelected = useCallback((variant: string) => {
    setVariantPayload((prev) => (prev ? { ...prev, selected: variant } : prev));
  }, []);

  return (
    <CheckoutDialogContext.Provider value={{ open, close, isOpen, variantPayload, setVariantSelected }}>
      {children}
      <Dialog open={isOpen} onOpenChange={(v) => { if (!v) close(); else setIsOpen(true); }}>
        <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] sm:w-[92vw] p-0 gap-0 max-h-[88vh] top-[6vh] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] overflow-hidden rounded-2xl sm:rounded-2xl flex flex-col [&>button.absolute]:hidden">
          <DialogHeader className="sticky top-0 z-20 bg-background border-b px-4 py-3 text-left space-y-0 shrink-0 flex flex-row items-center justify-between gap-2">
            <DialogTitle className="text-sm font-bold flex-1">অর্ডার করতে আপনার তথ্য দিন</DialogTitle>
            <DialogDescription className="sr-only">আপনার অর্ডারের তথ্য দিন</DialogDescription>
            <button
              type="button"
              onClick={close}
              aria-label="বন্ধ করুন"
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {isOpen && (
              <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">লোড হচ্ছে...</div>}>
                <Checkout />
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </CheckoutDialogContext.Provider>
  );
}

export const useCheckoutDialog = () => useContext(CheckoutDialogContext);

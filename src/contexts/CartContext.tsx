// 🔒 DO_NOT_MODIFY: Cart state integrity, persistence, tracking events — full file locked. Modify only with explicit user permission.
// User-approved 2026-05-02: added `unlockThreshold` for free-gift category + auto-remove when cart subtotal drops below threshold.
// User-approved 2026-05-12: admin sessions bypass the free-gift unlock threshold entirely (admin can add/keep any free item regardless of cart subtotal).

const isAdminSession = (): boolean => {
  try { return typeof window !== "undefined" && !!localStorage.getItem("admin_session"); } catch { return false; }
};
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trackAddToCart } from "@/components/TrackingScripts";
import { trackEvent } from "@/hooks/useAnalyticsTracker";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface CartItemTag {
  name: string;
  icon: string;
  color: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string;
  quantity: number;
  shortDescription?: string | null;
  tags?: CartItemTag[];
  /** If set, this item is a free gift and only stays in cart while
   *  the paid-subtotal (excluding free gifts) >= unlockThreshold. */
  unlockThreshold?: number | null;
  /** Pre-order flag — carried from product so checkout can enforce advance. */
  isPreorder?: boolean;
  /** Required advance (BDT) per unit. Total advance = preorderAdvance * quantity. */
  preorderAdvance?: number;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CART_STORAGE_KEY = "cart-items";

function loadCartFromStorage(): CartItem[] {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCartFromStorage);
  const [isOpen, setIsOpen] = useState(false);
  

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const [removedFreeNames, setRemovedFreeNames] = useState<string[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);

  // Auto-enforce free-gift unlock thresholds.
  // If user lowers paid subtotal below a free item's threshold, drop the free item.
  useEffect(() => {
    if (isAdminSession()) return; // Admin bypass: never auto-remove free gifts
    const paidSubtotal = items
      .filter((i) => !i.unlockThreshold)
      .reduce((sum, i) => sum + i.price * i.quantity, 0);

    const toRemove = items.filter(
      (i) => i.unlockThreshold && paidSubtotal < i.unlockThreshold
    );

    if (toRemove.length > 0) {
      setItems((prev) => prev.filter((i) => !toRemove.find((r) => r.id === i.id)));
      const names = toRemove.map((r) => r.name);
      setRemovedFreeNames(names);
      setPopupOpen(true);
      // Auto-close the side cart so the popup is clearly visible (not hidden behind cart drawer).
      setIsOpen(false);
      document.body.style.overflow = "";
    }
  }, [items]);

  const openCart = () => {
    setIsOpen(true);
    document.body.style.overflow = "hidden";
  };
  const closeCart = () => {
    setIsOpen(false);
    document.body.style.overflow = "";
  };


  const addItem = (newItem: Omit<CartItem, "quantity">) => {
    const adminBypass = isAdminSession();
    // Free-gift gating: must meet threshold from paid items in cart (admin bypass)
    if (newItem.unlockThreshold && newItem.unlockThreshold > 0) {
      if (!adminBypass) {
        const paidSubtotal = items
          .filter((i) => !i.unlockThreshold)
          .reduce((sum, i) => sum + i.price * i.quantity, 0);
        if (paidSubtotal < newItem.unlockThreshold) {
          toast.error(
            `এই ফ্রি উপহার পেতে আরও ৳${newItem.unlockThreshold - paidSubtotal} টাকার পণ্য কার্টে যুক্ত করুন।`,
            { duration: 4000 }
          );
          return;
        }
      }
      // Free gifts are always quantity 1, never duplicate
      setItems((prev) => {
        if (prev.find((i) => i.id === newItem.id)) return prev;
        return [...prev, { ...newItem, quantity: 1 }];
      });
      toast.success(`🎁 ${newItem.name} ফ্রি উপহার হিসেবে কার্টে যুক্ত হয়েছে!`, { duration: 3000 });
      return;
    }

    setItems((prev) => {
      const existing = prev.find((i) => i.id === newItem.id);
      if (existing) {
        return prev.map((i) =>
          i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...newItem, quantity: 1 }];
    });
    // Fire AddToCart tracking event
    trackAddToCart(newItem.id, newItem.price);
    trackEvent("add_to_cart", { productId: newItem.id, productName: newItem.name });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    // Free gifts are locked at quantity 1
    const target = items.find((i) => i.id === id);
    if (target?.unlockThreshold && quantity > 1) {
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        openCart,
        closeCart,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
      <AlertDialog open={popupOpen} onOpenChange={setPopupOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>🎁 ফ্রি উপহার সরিয়ে নেওয়া হলো</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-foreground">
              <span className="block">আপনি কার্ট থেকে আইটেম সরিয়েছেন। তাই আপনার ফ্রি আইটেমগুলো স্বয়ংক্রিয়ভাবে সরে গিয়েছে।</span>
              {removedFreeNames.length > 0 && (
                <span className="block text-sm font-medium text-primary">
                  সরানো হয়েছে: {removedFreeNames.join(", ")}
                </span>
              )}
              <span className="block">পুনরায় ফ্রি আইটেমগুলো নিতে চাইলে অবশ্যই নির্ধারিত পরিমাণ কার্টে যুক্ত করুন এবং ফ্রি আইটেম নিয়ে অর্ডার করুন।</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setPopupOpen(false)}>ঠিক আছে</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}

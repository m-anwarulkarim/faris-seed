// 🔒 DO_NOT_MODIFY: Checkout & order placement flow (cooldown, dedup, place_order RPC, cashback, address parsing) — full file locked. Modify only with explicit user permission.
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ShoppingBag, ArrowLeft, Minus, Plus, Trash2, Wallet, Ticket, User, Phone, MapPin, StickyNote, PhoneCall, Banknote, Smartphone } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { getDeliveryCharge, getMinOrderAmount } from "@/lib/delivery";
import { DELIVERY_CONFIG_EVENT, getDhakaConfig, getSavedDeliveryArea, loadDeliveryTiers, loadDhakaConfig, loadTiersEnabled, setSavedDeliveryArea } from "@/lib/deliveryTiers";
import { upsertVisitorProfileFromOrder } from "@/lib/visitorTracking";
import { notifyWatchedActivity } from "@/lib/watchedAlert";
import { getCustomerSession, setCustomerSession } from "@/components/CustomerLogin";
import { getUserType, getUserTypeLabel } from "@/hooks/useUserType";
import { trackInitiateCheckout } from "@/components/TrackingScripts";
import { trackEvent } from "@/hooks/useAnalyticsTracker";
import { productAlt } from "@/lib/seoAlt";
import { formatBDPhone } from "@/lib/format";
import { useCheckoutDialog } from "@/contexts/CheckoutDialogContext";
import CheckoutRelatedProducts from "@/components/CheckoutRelatedProducts";
import { Zap } from "lucide-react";

const VISITOR_ID_KEY = "visitor-id";
const VISITOR_FINGERPRINT_KEY = "visitor-fingerprint";

const DELIVERY_INFO_KEY = "checkout-delivery-info";

function loadDeliveryInfo() {
  try {
    const stored = localStorage.getItem(DELIVERY_INFO_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export default function Checkout() {
  const navigate = useNavigate();
  const { items, totalPrice, updateQuantity, removeItem, addItem } = useCart();
  const { variantPayload, setVariantSelected } = useCheckoutDialog();

  const oldTotalPrice = items.reduce(
    (sum, i) => sum + (i.oldPrice || i.price) * i.quantity,
    0
  );
  const [loading, setLoading] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [useCredit, setUseCredit] = useState(false);
  const [creditSliderValue, setCreditSliderValue] = useState(0);
  const [visitorProfileId, setVisitorProfileId] = useState<string | null>(null);
  const [cashbackMap, setCashbackMap] = useState<Record<string, number>>({});
  const initiateCheckoutTrackedRef = useRef(false);

  

  const customerSession = getCustomerSession();
  const saved = loadDeliveryInfo();
  const [name, setName] = useState(saved.name || "");
  const [phone, setPhone] = useState(formatBDPhone(saved.phone || ""));
  const [address, setAddress] = useState(saved.address || "");
  const [showAltPhone, setShowAltPhone] = useState(!!saved.altPhone);
  const [altPhone, setAltPhone] = useState(formatBDPhone(saved.altPhone || ""));
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "bkash">("cod");
  const [bkashEnabled, setBkashEnabled] = useState(false);
  const [bkashDiscountPercent, setBkashDiscountPercent] = useState<number>(2);

  useEffect(() => {
    (supabase as any)
      .rpc("is_bkash_enabled")
      .then(({ data }: any) => {
        const enabled = !!data;
        setBkashEnabled(enabled);
        if (!enabled) setPaymentMethod("cod");
      });
    (supabase as any)
      .from("bkash_settings")
      .select("discount_percent")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data && data.discount_percent != null) setBkashDiscountPercent(Number(data.discount_percent));
      });
  }, []);


  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string; code: string; discount_type: string; discount_value: number;
    max_discount_amount: number | null; min_order_amount: number;
  } | null>(null);

  // Auto-fill from logged-in profile (overrides cached delivery info)
  useEffect(() => {
    if (!customerSession?.profile_id) return;
    supabase.from("visitor_profiles")
      .select("name, phone, address, alt_phone")
      .eq("id", customerSession.profile_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.name) setName(data.name);
        if (data.phone) setPhone(data.phone);
        if (data.address) setAddress(data.address);
        if (data.alt_phone) {
          setAltPhone(data.alt_phone);
          setShowAltPhone(true);
        }
      });
  }, []);

  // Credit system removed — only keep visitor_profile_id lookup
  useEffect(() => {
    const profileId = customerSession?.profile_id;
    const visitorId = localStorage.getItem(VISITOR_ID_KEY);

    if (profileId) {
      supabase.from("visitor_profiles").select("id").eq("id", profileId).maybeSingle()
        .then(({ data }) => {
          if (data) setVisitorProfileId(data.id);
        });
    } else if (visitorId) {
      supabase.from("visitor_profiles").select("id").eq("visitor_id", visitorId).maybeSingle()
        .then(({ data }) => {
          if (data) setVisitorProfileId(data.id);
        });
    }
  }, [customerSession?.profile_id]);

  // Items in cart that still need a size/variant chosen (no "::" suffix yet)
  type PendingVariantItem = {
    productId: string;
    productName: string;
    productImage: string | null;
    price: number;
    oldPrice: number | null;
    label: string;
    variants: string[];
  };
  const [pendingVariantItems, setPendingVariantItems] = useState<PendingVariantItem[]>([]);
  const [sharedVariant, setSharedVariant] = useState<string>("");
  useEffect(() => {
    const variantItems = items.filter((i) => !i.unlockThreshold);
    if (variantItems.length === 0) { setPendingVariantItems([]); return; }
    const baseIds = Array.from(new Set(variantItems.map((i) => i.id.split("::")[0])));
    supabase.from("products").select("id, name, product_image, regular_price, offer_price, variants, variant_label").in("id", baseIds)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map(data.map((p: any) => [p.id, p]));
        const infos: PendingVariantItem[] = [];
        const seen = new Set<string>();
        for (const it of variantItems) {
          const baseId = it.id.split("::")[0];
          if (seen.has(baseId)) continue;
          const p: any = map.get(baseId);
          if (!p || !Array.isArray(p.variants) || p.variants.length === 0) continue;
          seen.add(baseId);
          const productPrice = Number(p.offer_price || p.regular_price || it.price);
          const productOldPrice = p.offer_price && p.regular_price && Number(p.regular_price) > Number(p.offer_price)
            ? Number(p.regular_price)
            : it.oldPrice;
          infos.push({
            productId: baseId,
            productName: p.name,
            productImage: p.product_image,
            price: productPrice,
            oldPrice: productOldPrice,
            label: p.variant_label || "সাইজ",
            variants: p.variants,
          });
        }
        setPendingVariantItems(infos);
      });
  }, [items.map((i) => i.id).join("|")]);

  // Fetch product cash_back for instant same-order discount
  useEffect(() => {
    const paidItems = items.filter((i) => !i.unlockThreshold);
    const baseIds = Array.from(new Set(paidItems.map((i) => i.id.split("::")[0])))
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    if (baseIds.length === 0) { setCashbackMap({}); return; }
    supabase.from("products").select("id, cash_back").in("id", baseIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        for (const p of data as any[]) {
          map[p.id] = Number(p.cash_back) || 0;
        }
        setCashbackMap(map);
      });
  }, [items.map((i) => i.id).join("|")]);


  // Union of variant options across all pending items (single shared selector)
  const sharedVariantLabel = pendingVariantItems[0]?.label || "সাইজ";
  const sharedVariantOptions = Array.from(
    new Set(pendingVariantItems.flatMap((p) => p.variants))
  );



  // Fire InitiateCheckout once when cart data is available
  useEffect(() => {
    if (!initiateCheckoutTrackedRef.current && items.length > 0) {
      initiateCheckoutTrackedRef.current = true;
      trackInitiateCheckout(totalPrice, items.reduce((s, i) => s + i.quantity, 0));
      trackEvent("checkout_start", { metadata: { itemCount: items.length, total: totalPrice } as any });
    }
  }, [items, totalPrice]);

  // Persist delivery info
  useEffect(() => {
    localStorage.setItem(DELIVERY_INFO_KEY, JSON.stringify({
      name, phone, address, altPhone: showAltPhone ? altPhone : "",
    }));
  }, [name, phone, address, altPhone, showAltPhone]);

  // Re-render when admin updates delivery config in realtime so charges stay current.
  const [, setDeliveryConfigVersion] = useState(0);
  useEffect(() => {
    Promise.all([loadDeliveryTiers(), loadDhakaConfig(), loadTiersEnabled()])
      .finally(() => setDeliveryConfigVersion((v) => v + 1));
    const handler = () => setDeliveryConfigVersion((v) => v + 1);
    window.addEventListener(DELIVERY_CONFIG_EVENT, handler);
    return () => window.removeEventListener(DELIVERY_CONFIG_EVENT, handler);
  }, []);

  const userType = getUserType();
  const dhakaCfg = getDhakaConfig();
  const [deliveryArea, setDeliveryAreaState] = useState<"inside" | "outside">(
    () => (getSavedDeliveryArea() ?? "outside")
  );
  const chooseArea = (a: "inside" | "outside") => {
    setDeliveryAreaState(a);
    setSavedDeliveryArea(a);
  };
  const deliveryCharge = getDeliveryCharge(totalPrice, userType, dhakaCfg.enabled ? deliveryArea : null);
  const isFreeDelivery = deliveryCharge === 0;
  const minOrder = getMinOrderAmount(userType);
  const isBelowMinOrder = minOrder > 0 && totalPrice < minOrder;
  // Calculate coupon discount
  const couponDiscount = appliedCoupon
    ? appliedCoupon.discount_type === "fixed"
      ? Math.min(appliedCoupon.discount_value, totalPrice)
      : (() => {
          const pct = totalPrice * (appliedCoupon.discount_value / 100);
          return appliedCoupon.max_discount_amount ? Math.min(pct, appliedCoupon.max_discount_amount) : pct;
        })()
    : 0;

  // 🔒 CREDIT LOGIC — LOCKED
  // Coupon and credit are mutually exclusive
  const isLoggedIn = !!customerSession?.profile_id;
  const hasCoupon = !!appliedCoupon;
  const maxCreditUsable = Math.min(creditBalance, totalPrice + deliveryCharge);
  // Guest auto-credit discount removed by owner request
  const autoCreditDiscount = 0;
  const creditApplied = hasCoupon ? 0
    : isLoggedIn
      ? (useCredit ? Math.min(creditSliderValue, maxCreditUsable) : 0)
      : 0;
  const isCreditActive = isLoggedIn && useCredit && creditApplied > 0;
  // bKash payment 2% discount on subtotal
  const bkashDiscount = paymentMethod === "bkash" ? Math.round(totalPrice * (bkashDiscountPercent / 100)) : 0;
  // Instant cashback discount (same-order): sum of products.cash_back × quantity
  const cashbackDiscount = items.reduce((sum, it) => {
    if (it.unlockThreshold) return sum;
    const baseId = it.id.split("::")[0];
    const cb = cashbackMap[baseId] || 0;
    return sum + cb * it.quantity;
  }, 0);
  const grandTotal = Math.max(0, totalPrice + deliveryCharge - couponDiscount - creditApplied - bkashDiscount - cashbackDiscount);

  // Pre-order detection: any item flagged as preorder triggers advance-only bKash payment.
  const preorderItems = items.filter((i: any) => i.isPreorder);
  const hasPreorder = preorderItems.length > 0;
  const requiredAdvance = preorderItems.reduce(
    (sum, i: any) => sum + (Number(i.preorderAdvance) || 0) * i.quantity,
    0
  );
  // Force bKash when there's a pre-order item (advance must be paid online).
  useEffect(() => {
    if (hasPreorder && bkashEnabled && paymentMethod !== "bkash") {
      setPaymentMethod("bkash");
    }
  }, [hasPreorder, bkashEnabled]);



  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return toast.error("কুপন কোড লিখুন");
    setCouponLoading(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return toast.error("কুপন কোড সঠিক নয়");
      if (data.expires_at && new Date(data.expires_at) < new Date()) return toast.error("কুপনের মেয়াদ শেষ");
      if (data.starts_at && new Date(data.starts_at) > new Date()) return toast.error("কুপন এখনো শুরু হয়নি");
      if (data.usage_limit && data.used_count >= data.usage_limit) return toast.error("কুপনের ব্যবহার সীমা শেষ");
      if (data.min_order_amount > 0 && totalPrice < data.min_order_amount) return toast.error(`এই কুপনে সর্বনিম্ন অর্ডার ৳${data.min_order_amount}`);

      setAppliedCoupon({
        id: data.id, code: data.code, discount_type: data.discount_type,
        discount_value: data.discount_value, max_discount_amount: data.max_discount_amount,
        min_order_amount: data.min_order_amount,
      });
      // Reset credit when coupon applied
      setUseCredit(false);
      setCreditSliderValue(0);
      toast.success(`কুপন "${data.code}" যোগ হয়েছে!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCouponLoading(false);
    }
  };

  const isValidPhone = (p: string) => /^01\d{9}$/.test(p);

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    toast.info("কুপন সরানো হয়েছে");
  };


  // Save incomplete order (cooldown or any failure)
  const saveIncompleteOrder = async (reason: string) => {
    const currentVisitorId = localStorage.getItem(VISITOR_ID_KEY) || null;
    const cartSnapshot = items.map(i => ({
      id: i.id, name: i.name, image: i.image, price: i.price, oldPrice: i.oldPrice, quantity: i.quantity,
    }));

    try {
      // Check if same phone+visitor already has an incomplete record
      let query = supabase.from("incomplete_orders").select("id, attempt_count");
      if (currentVisitorId) {
        query = query.or(`phone.eq.${phone.trim()},visitor_id.eq.${currentVisitorId}`);
      } else {
        query = query.eq("phone", phone.trim());
      }
      const { data: existing } = await query.limit(1).maybeSingle();

      if (existing) {
        // Increment attempt count
        await supabase.from("incomplete_orders").update({
          attempt_count: existing.attempt_count + 1,
          reason,
          cart_snapshot: cartSnapshot,
          customer_name: name.trim() || null,
          address: address.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        // Insert new
        await supabase.from("incomplete_orders").insert({
          customer_name: name.trim() || null,
          phone: phone.trim() || "unknown",
          address: address.trim() || null,
          visitor_id: currentVisitorId,
          reason,
          cart_snapshot: cartSnapshot,
        });
      }
    } catch {
      // Silent fail — don't block the user experience
    }
  };

  const submitRef = useRef(false);
  const SUBMIT_LOCK_KEY = "checkout_submit_lock";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitRef.current) return;

    // Cross-tab lock: prevent multiple tabs from submitting simultaneously
    const lockTime = localStorage.getItem(SUBMIT_LOCK_KEY);
    if (lockTime && Date.now() - Number(lockTime) < 30000) {
      toast.error("অর্ডার প্রসেস হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন");
      return;
    }
    localStorage.setItem(SUBMIT_LOCK_KEY, String(Date.now()));
    submitRef.current = true;

    if (!name.trim()) { submitRef.current = false; return toast.error("নাম লিখুন"); }
    if (!isValidPhone(phone)) { submitRef.current = false; return toast.error("সঠিক ১১ ডিজিট ফোন নম্বর দিন (01...)"); }
    if (!address.trim()) { submitRef.current = false; return toast.error("ডেলিভারি ঠিকানা লিখুন"); }
    if (showAltPhone && altPhone && !isValidPhone(altPhone)) { submitRef.current = false; return toast.error("বিকল্প নম্বরটি সঠিক নয়"); }
    if (items.length === 0) { submitRef.current = false; return toast.error("কার্ট খালি"); }
    if (totalPrice < 50) { submitRef.current = false; return toast.error("সর্বনিম্ন ৫০ টাকার অর্ডার করতে হবে"); }
    if (isBelowMinOrder) { submitRef.current = false; return toast.error(`${getUserTypeLabel(userType)} কাস্টমারের সর্বনিম্ন অর্ডার ৳${minOrder}`); }
    if (hasPreorder && !bkashEnabled) { submitRef.current = false; return toast.error("প্রি-অর্ডারের অগ্রিম পরিশোধের জন্য bKash পেমেন্ট চালু করুন।"); }
    if (hasPreorder && paymentMethod !== "bkash") { submitRef.current = false; return toast.error("প্রি-অর্ডারের জন্য bKash পেমেন্ট বাধ্যতামূলক।"); }
    if (hasPreorder && requiredAdvance <= 0) { submitRef.current = false; return toast.error("প্রি-অর্ডারের অগ্রিম পরিমাণ সঠিক নয়।"); }

    setLoading(true);
    try {
      // ─── Create new order (normal flow) ───
      // Create order
      const currentVisitorId = localStorage.getItem(VISITOR_ID_KEY) || null;
      
      // Validate visitor_profile_id exists before passing to avoid FK constraint errors
      let validProfileId = customerSession?.profile_id || visitorProfileId || null;
      if (validProfileId) {
        const { data: profileCheck } = await supabase
          .from("visitor_profiles")
          .select("id")
          .eq("id", validProfileId)
          .maybeSingle();
        if (!profileCheck) validProfileId = null;
      }
      
      // Validate visitor_id exists
      let validVisitorId = currentVisitorId;
      if (validVisitorId) {
        const { data: visitorCheck } = await supabase
          .from("visitors")
          .select("id")
          .eq("id", validVisitorId)
          .maybeSingle();
        if (!visitorCheck) {
          localStorage.removeItem(VISITOR_ID_KEY);
          localStorage.removeItem(VISITOR_FINGERPRINT_KEY);
          validVisitorId = null;
        }
      }
      
      const totalDiscount = creditApplied + couponDiscount + bkashDiscount + cashbackDiscount;
      const { data: orderRows, error: orderErr } = await supabase
        .rpc("place_order", {
          p_customer_name: name.trim(),
          p_phone: phone.trim(),
          p_address: address.trim(),
          p_alt_phone: showAltPhone && altPhone.trim() ? altPhone.trim() : null,
          p_note: showNote && note.trim() ? note.trim() : null,
          p_total_amount: grandTotal,
          p_discount: totalDiscount,
          p_delivery_charge: deliveryCharge,
          p_visitor_profile_id: validProfileId,
          p_visitor_id: validVisitorId,
          p_traffic_source: sessionStorage.getItem("traffic-source") || "direct",
        });

      if (orderErr || !orderRows || orderRows.length === 0) throw orderErr || new Error("Order creation failed");
      const order = orderRows[0];

      // Mark order as pre-order: status='pre' lands it in PreOrders page, advance stores
      // the required deposit, is_preorder_order=true for quick filtering.
      if (hasPreorder) {
        await supabase
          .from("orders")
          .update({
            status: "pre",
            advance: requiredAdvance,
            is_preorder_order: true,
          })
          .eq("id", order.id)
          .then(() => {});
      }


      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const orderItems = items.map((item) => {
        const rawId = String(item.id).split("::")[0];
        return {
          order_id: order.id,
          product_id: UUID_RE.test(rawId) ? rawId : null,
          product_name: item.name,
          product_image: item.image || null,
          quantity: item.quantity,
          unit_price: item.price,
        };
      });


      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Credit deduction removed


      // Update coupon usage atomically
      if (appliedCoupon && couponDiscount > 0) {
        await supabase.rpc("increment_coupon_usage", {
          p_coupon_id: appliedCoupon.id,
          p_discount_amount: couponDiscount,
        }).then(() => {});
      }

      const profileResult = await upsertVisitorProfileFromOrder({
        name,
        phone,
        address,
        altPhone: showAltPhone ? altPhone : null,
      }).catch(() => null);

      // If order was placed without profile_id, link it now
      if (profileResult && !customerSession?.profile_id && !visitorProfileId) {
        await supabase.functions.invoke("customer-auth", {
          body: { action: "link_order_profile", order_id: order.id, profile_id: profileResult.id },
        }).catch(() => null);
      }

      // Auto-login after order ONLY if not already logged in
      if (profileResult && !customerSession?.profile_id) {
        setCustomerSession({
          phone: profileResult.phone,
          profile_id: profileResult.id,
          name: profileResult.name,
          phone_verified: false,
        });
      }

      // Fetch customer_facing_id from DB
      let customerFacingId = order.order_id;
      try {
        const { data: facingData } = await supabase
          .from("orders")
          .select("customer_facing_id")
          .eq("id", order.id)
          .maybeSingle();
        if (facingData?.customer_facing_id) {
          customerFacingId = facingData.customer_facing_id;
        }
      } catch {}

      // Save order details for receipt before clearing cart
      sessionStorage.setItem("last-order-details", JSON.stringify({
        orderId: order.order_id,
        dbOrderId: order.id,
        customerFacingId,
        customerName: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        altPhone: (showAltPhone && altPhone?.trim()) ? altPhone.trim() : "",
        items: items.map(i => ({
          name: i.name,
          image: i.image || null,
          quantity: i.quantity,
          price: i.price,
          oldPrice: i.oldPrice || null,
        })),
        subtotal: totalPrice,
        oldTotal: oldTotalPrice,
        deliveryCharge,
        grandTotal,
      }));

      // Clean up incomplete orders for this phone
      await supabase.from("incomplete_orders").delete().eq("phone", phone.trim()).then(() => {});
      trackEvent("order_placed", { metadata: { orderId: order.order_id } as any });
      notifyWatchedActivity({
        action: "order_placed",
        phone: phone.trim(),
        extra: `${order.order_id} ৳${grandTotal}`,
      });
      if (paymentMethod === "bkash") {
        // Directly initiate bKash payment and redirect (break out of any iframe)
        try {
          const callback = `${window.location.origin}/payment/bkash/callback`;
          // For pre-orders, customer pays ONLY the required advance via bKash; the rest is COD on delivery.
          const bkashAmount = hasPreorder ? requiredAdvance : Number(grandTotal);
          const { data: payData, error: payErr } = await supabase.functions.invoke("bkash-pgw/create", {
            body: { order_id: order.id, amount: bkashAmount, callback_url: callback },
          });
          if (payErr || !payData?.bkashURL) {
            toast.error(payData?.error || payErr?.message || "bKash পেমেন্ট শুরু করা যায়নি");
            navigate(`/pay/bkash/${order.order_id}`);
          } else {
            try { (window.top || window).location.href = payData.bkashURL; }
            catch { window.location.href = payData.bkashURL; }
          }
        } catch (e: any) {
          toast.error(e?.message || "bKash পেমেন্ট শুরু করা যায়নি");
          navigate(`/pay/bkash/${order.order_id}`);
        }
      } else {
        navigate(`/order-confirmed/${order.order_id}`);
      }

    } catch (err: any) {
      const msg = err?.message || "";
      const cooldownMatch = msg.match(/ORDER_COOLDOWN:(\d+)/);
      if (cooldownMatch) {
        const mins = parseInt(cooldownMatch[1], 10);
        const hours = Math.floor(mins / 60);
        const rem = mins % 60;
        const human = hours > 0
          ? `${hours} ঘণ্টা${rem > 0 ? ` ${rem} মিনিট` : ""}`
          : `${mins} মিনিট`;
        toast.error(
          `আপনি সম্প্রতি একটি অর্ডার করেছেন। পরবর্তী অর্ডারের জন্য আরও ${human} অপেক্ষা করুন।`,
          { duration: 8000 }
        );
      } else if (msg.includes("REPEAT_ORDER_BLOCKED")) {
        toast.error(
          "আপনি ইতোমধ্যে অর্ডার করেছেন। আপনাকে যদি call দেওয়া না হয়ে থাকে তাহলে call দেওয়া হবে, বিস্তারিত কথা বলে নিতে পারবেন। আর যদি call দেওয়া হয়ে থাকে তাহলে আপনার অর্ডার confirm করে পাঠানো হয়েছে।",
          { duration: 8000 }
        );
      } else if (msg.includes("ACCESS_DENIED")) {
        toast.error("আপনার অ্যাক্সেস বন্ধ করা হয়েছে");
      } else {
        await saveIncompleteOrder(`অর্ডার ব্যর্থ: ${msg}`);
        toast.error(`অর্ডার ব্যর্থ: ${msg}`);
      }
    } finally {
      setLoading(false);
      submitRef.current = false;
      localStorage.removeItem(SUBMIT_LOCK_KEY);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">কার্ট খালি</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> শপিংয়ে ফিরুন
          </Button>
        </div>
      </div>
    );
  }

  const productDiscount = oldTotalPrice - totalPrice;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="relative">
      <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
        <form id="checkout-form" onSubmit={handleSubmit} className="space-y-3">

          <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
            <button
              type="button"
              onClick={() => {
                document.getElementById("checkout-special-offers")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100 px-3 py-2 text-amber-800 hover:from-amber-100 hover:to-amber-200 transition"
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <ShoppingBag className="w-4 h-4" />
                আপনার বিশেষ অফার
              </span>
              <span className="text-xs font-semibold bg-amber-600 text-white px-2 py-1 rounded-lg">দেখুন →</span>
            </button>

            {/* Single shared size/variant selector for all cart items that still need one */}
            {pendingVariantItems.length > 0 && (
              <div className="rounded-xl border-2 border-red-200 bg-red-50/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">
                    {sharedVariantLabel} সিলেক্ট করুন <span className="text-destructive">*</span>
                  </h3>
                  {sharedVariant && (
                    <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200">
                      {sharedVariant}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {sharedVariantOptions.map((v) => {
                    const selected = sharedVariant === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          // Apply this size to every pending item that supports it
                          pendingVariantItems.forEach((pi) => {
                            const chosen = pi.variants.includes(v) ? v : pi.variants[0];
                            const newId = `${pi.productId}::${chosen}`;
                            // Find all current cart items belonging to this base product (tagged or not)
                            const matching = items.filter((it) => it.id.split("::")[0] === pi.productId);
                            const qty = matching.reduce((s, it) => s + (it.quantity || 1), 0) || 1;
                            matching.forEach((it) => removeItem(it.id));
                            for (let i = 0; i < qty; i++) {
                              addItem({
                                id: newId,
                                name: `${pi.productName} (${chosen})`,
                                price: pi.price,
                                oldPrice: pi.oldPrice,
                                image: pi.productImage || "/placeholder.svg",
                                shortDescription: null,
                              });
                            }
                          });
                          setSharedVariant(v);
                          setVariantSelected(v);
                        }}
                        className={`px-1 py-2 rounded-xl border text-center text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap truncate ${selected ? "border-red-500 bg-red-500 text-white shadow" : "border-border bg-card hover:border-red-400 hover:bg-red-50"}`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}



            


            <div className="space-y-2">
              <Label htmlFor="name">আপনার নাম *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="name" placeholder="আপনার নাম লিখুন" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required className="pl-9" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">ফোন নম্বর * (১১ ডিজিট)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="phone" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(formatBDPhone(e.target.value))} maxLength={11} required className="pl-9" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">ডেলিভারি ঠিকানা *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Textarea id="address" placeholder="হোম ডেলিভারির ঠিকানা দিন" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} rows={3} required className="pl-9" />
              </div>
            </div>


          </div>

          {/* Pre-order advance banner */}
          {hasPreorder && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 rounded-2xl p-3 flex items-start gap-2">
              <Zap className="w-4 h-4 text-amber-700 dark:text-amber-300 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <p className="font-bold mb-0.5">এই অর্ডারে প্রি-অর্ডার পণ্য রয়েছে।</p>
                <p>
                  অগ্রিম <span className="font-bold">৳{requiredAdvance}</span> bKash-এ পরিশোধ করতে হবে।
                  বাকি <span className="font-bold">৳{Math.max(0, grandTotal - requiredAdvance)}</span> ডেলিভারির সময় (COD) পরিশোধ করবেন।
                </p>
              </div>
            </div>
          )}

          {/* Order Overview */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" /> অর্ডার সারসংক্ষেপ
            </h2>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/40">
                  <img src={item.image} alt={productAlt(item.name)} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.oldPrice && <span className="line-through mr-1">৳{item.oldPrice}</span>}
                      ৳{item.price} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 hover:bg-muted text-muted-foreground">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-semibold w-6 text-center border-x border-border">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 hover:bg-muted text-muted-foreground">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button type="button" onClick={() => removeItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 space-y-1.5 text-sm">
              {productDiscount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>নিয়মিত মূল্য</span>
                  <span className="line-through">৳{oldTotalPrice}</span>
                </div>
              )}
              {productDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>পণ্য ডিসকাউন্ট</span>
                  <span>−৳{productDiscount}</span>
                </div>
              )}
              <div className="flex justify-between text-foreground">
                <span>সাবটোটাল</span>
                <span className="font-semibold">৳{totalPrice}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ডেলিভারি {userType !== "regular" ? `(${getUserTypeLabel(userType)})` : ""}</span>
                <div className="flex items-center gap-1.5">
                  <span className={isFreeDelivery ? "text-green-600 font-semibold" : ""}>
                    {isFreeDelivery ? "ফ্রি" : `৳${deliveryCharge}`}
                  </span>
                </div>
              </div>
              {isBelowMinOrder && (
                <div className="text-xs text-destructive font-medium bg-destructive/10 rounded-lg px-3 py-2">
                  ⚠ {getUserTypeLabel(userType)} কাস্টমারের সর্বনিম্ন অর্ডার ৳{minOrder}। আরও ৳{minOrder - totalPrice} এর পণ্য যোগ করুন।
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1"><Ticket className="w-3.5 h-3.5" /> কুপন ছাড় ({appliedCoupon?.code})</span>
                  <span>−৳{couponDiscount.toFixed(0)}</span>
                </div>
              )}
              {cashbackDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">🎁 ক্যাশব্যাক ছাড়</span>
                  <span>−৳{cashbackDiscount}</span>
                </div>
              )}
              {bkashDiscount > 0 && (
                <div className="flex justify-between text-pink-600">
                  <span>bKash পেমেন্ট ছাড় (২%)</span>
                  <span>−৳{bkashDiscount}</span>
                </div>
              )}
              {/* 🔒 CREDIT SECTION — LOCKED (hidden when coupon applied or in buy-now variant popup) */}
              {!variantPayload && !hasCoupon && isLoggedIn && creditBalance > 0 && (
                <div className="space-y-2 py-2 px-3 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="credit-toggle"
                      checked={useCredit}
                      onCheckedChange={(v) => {
                        setUseCredit(!!v);
                        if (v) {
                          setCreditSliderValue(Math.floor(Math.min(creditBalance, maxCreditUsable)));
                          // Remove coupon when credit is used
                          removeCoupon();
                          setShowCoupon(false);
                        } else {
                          setCreditSliderValue(0);
                        }
                      }}
                    />
                    <Label htmlFor="credit-toggle" className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Wallet className="w-4 h-4 text-accent" />
                      ক্রেডিট ব্যবহার করুন
                      <span className="text-xs text-muted-foreground">(৳{Math.floor(creditBalance)} আছে)</span>
                    </Label>
                  </div>
                  {useCredit && maxCreditUsable > 0 && (
                    <div className="space-y-1.5 pl-6">
                      <Slider
                        value={[creditSliderValue]}
                        onValueChange={([v]) => setCreditSliderValue(Math.floor(v))}
                        min={0}
                        max={Math.floor(maxCreditUsable)}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>৳0</span>
                        <span className="font-semibold text-primary">৳{creditSliderValue} ব্যবহার হবে</span>
                        <span>৳{Math.floor(maxCreditUsable)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!variantPayload && isLoggedIn && creditApplied > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> ক্রেডিট ছাড়</span>
                  <span>−৳{creditApplied.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-foreground pt-1.5 border-t border-border">
                <span>সর্বমোট</span><span className="text-primary text-lg">৳{grandTotal}</span>
              </div>
            </div>
          </div>
          {/* Delivery location selector — placed above payment method */}
          {dhakaCfg.enabled && (
            <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
              <p className="text-sm font-semibold text-foreground">ডেলিভারি লোকেশন *</p>
              <div className="grid gap-2 grid-cols-2">
                {[
                  { value: "inside" as const, label: "ঢাকার মধ্যে", charge: dhakaCfg.inside },
                  { value: "outside" as const, label: "ঢাকার বাইরে", charge: dhakaCfg.outside },
                ].map((opt) => {
                  const selected = deliveryArea === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => chooseArea(opt.value)}
                      className={`relative px-3 py-2.5 rounded-xl border text-sm font-medium transition flex items-center gap-3 ${
                        selected
                          ? "border-red-500 bg-red-50/60 ring-1 ring-red-500"
                          : "border-border bg-background hover:border-muted-foreground"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selected ? "border-red-500" : "border-muted-foreground"
                        }`}
                      >
                        {selected && <span className="w-2 h-2 rounded-full bg-red-500" />}
                      </span>
                      <span className="flex-1 flex items-center justify-center gap-2">
                        <span className="text-foreground">{opt.label}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm">
                          ৳{opt.charge}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Payment method selector — placed after totals */}
          <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
            <p className="text-sm font-semibold text-foreground">পেমেন্ট মেথড বেছে নিন</p>
            <div className={`grid gap-2 ${bkashEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
              <button
                type="button"
                disabled={hasPreorder}
                onClick={() => {
                  if (hasPreorder) { toast.error("প্রি-অর্ডারের জন্য bKash পেমেন্ট বাধ্যতামূলক।"); return; }
                  setPaymentMethod("cod");
                  import("@/lib/metaEvents").then(({ trackAddPaymentInfo }) => trackAddPaymentInfo("cod", totalPrice, "BDT"));
                }}
                className={`relative px-3 py-2.5 rounded-xl border text-sm font-medium transition flex items-center gap-3 ${
                  hasPreorder
                    ? "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                    : paymentMethod === "cod"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background hover:border-muted-foreground"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    paymentMethod === "cod" ? "border-primary" : "border-muted-foreground"
                  }`}
                >
                  {paymentMethod === "cod" && <span className="w-2 h-2 rounded-full bg-primary" />}
                </span>
                <span className="flex-1 flex items-center justify-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-6 rounded bg-primary/10 text-primary">
                    <Banknote className="w-4 h-4" />
                  </span>
                  <span className="text-foreground">COD</span>
                </span>
              </button>

              {bkashEnabled && (
                <button
                  type="button"
                  onClick={() => { setPaymentMethod("bkash"); import("@/lib/metaEvents").then(({ trackAddPaymentInfo }) => trackAddPaymentInfo("bkash", totalPrice, "BDT")); }}
                  className={`relative px-3 py-2.5 rounded-xl border text-sm font-medium transition flex items-center gap-3 ${
                    paymentMethod === "bkash"
                      ? "border-pink-500 bg-pink-50/60 ring-1 ring-pink-500"
                      : "border-border bg-background hover:border-muted-foreground"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      paymentMethod === "bkash" ? "border-pink-500" : "border-muted-foreground"
                    }`}
                  >
                    {paymentMethod === "bkash" && <span className="w-2 h-2 rounded-full bg-pink-500" />}
                  </span>
                  <span className="flex-1 flex items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-pink-200">
                      <span className="text-pink-600 font-extrabold tracking-tight text-[15px] leading-none">bKash</span>
                      
                    </span>
                    {bkashDiscountPercent > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-pink-500 text-white text-[10px] font-bold leading-none shadow-sm">
                        {bkashDiscountPercent}% ছাড়
                      </span>
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Related products with offers */}
          {/* Related products with offers moved below sticky button */}
        </form>
      </div>

      {/* Sticky Submit Button — sticks while form is visible, unsticks after wrapper ends */}
      <div className="sticky bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-50">
        <div className="max-w-3xl mx-auto">
          <Button
            type="submit"
            form="checkout-form"
            disabled={loading || isBelowMinOrder}
            className={`w-full h-12 text-base font-bold rounded-xl ${
              paymentMethod === "bkash"
                ? "bg-pink-600 hover:bg-pink-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {hasPreorder
              ? `অগ্রিম ৳${requiredAdvance} bKash-এ পরিশোধ করুন`
              : `অর্ডার কনফার্ম করুন — ৳${grandTotal}`}
          </Button>
        </div>
      </div>
      </div>

      {/* Related products appear below the sticky button area */}
      <div id="checkout-special-offers" className="max-w-3xl mx-auto px-4 pb-6 pt-2 scroll-mt-20">
        <CheckoutRelatedProducts />
      </div>

    </div>
  );
}


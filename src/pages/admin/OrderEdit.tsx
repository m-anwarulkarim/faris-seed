import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { districts, getThanas } from "@/data/bangladeshLocations";
import { parseAddressLocally, englishToBanglaDistrict } from "@/lib/localAddressParser";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDeliveryCharge } from "@/lib/delivery";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOrderEditLock } from "@/hooks/useOrderEditLock";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { parseUserAgent } from "@/lib/uaParser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Package, Plus, Minus, Trash2, Search, Save,
  Clock, PhoneOff, ThumbsUp, PhoneCall, Pause, CalendarClock,
  CheckCircle2, XCircle, User, ArrowLeft, ShoppingBag, MapPin,
  Printer, ClipboardCheck, Truck, PackageCheck, PackageMinus,
  RotateCcw, Undo2, HelpCircle, Globe, Fingerprint, Monitor, Timer, Shield, AlertTriangle, Ban, ShieldCheck,
  Phone, MessageSquare, Send, LayoutGrid, Tag as TagIcon, ChevronDown, StickyNote, Sparkles, AlertCircle,
  Settings, PanelRightClose, PanelRightOpen, Smartphone, Link2, Info,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, Check } from "lucide-react";
import { FraudResultCard } from "@/components/admin/FraudCheckerDialog";
import { SourceBadge } from "@/components/admin/SourceBadge";
import { PhoneVerifiedBadge } from "@/components/PhoneVerifiedBadge";
import { Progress } from "@/components/ui/progress";
import CreditHistoryDialog from "@/components/CreditHistoryDialog";
import { CourierEntrySettingsPopover } from "./order-edit/components/CourierEntrySettings";

import { ProfileRow } from "./order-edit/components/ProfileRow";
import { PricingRow } from "./order-edit/components/PricingRow";
import {
  WEB_STATUS_OPTIONS,
  CONFIRMED_STATUS_OPTIONS,
  CONFIRMED_STATUS_VALUES,
  ALL_STATUS_OPTIONS,
  getStatusInfo,
} from "./order-edit/constants";
import type { OrderItem } from "./order-edit/types";


export default function OrderEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isNew = !id;

  // Order edit lock
  const { isLocked, lockHolder, showWarning, wasKicked, dismissWarning, forceAcquire, acquireLock } = useOrderEditLock(id);

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [creditHistoryOpen, setCreditHistoryOpen] = useState(false);

  // Customer form state
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [address, setAddress] = useState("");
  const [originalAddress, setOriginalAddress] = useState("");
  const [addressLocked, setAddressLocked] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [aiParseSource, setAiParseSource] = useState<"address" | "ip" | "local" | "">("");
  const [parseConfidence, setParseConfidence] = useState<{ score: number; level: "high" | "medium" | "low"; details: string } | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<{ district: string; thana: string; area: string } | null>(null);
  const [district, setDistrict] = useState("");
  const [thana, setThana] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [showNotePopover, setShowNotePopover] = useState(false);
  const [note, setNote] = useState("");
  const [printNote, setPrintNote] = useState(false);
  const [status, setStatus] = useState("confirmed");
  const [savedStatus, setSavedStatus] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [pickerMode, setPickerMode] = useState<"search" | "category" | "tag">("search");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [deliveryChargeOverride, setDeliveryChargeOverride] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState("");
  const [productDetailId, setProductDetailId] = useState<string | null>(null);
  const [banConfirmVisitor, setBanConfirmVisitor] = useState<{ id: string; currentlyAllowed: boolean } | null>(null);
  const [preDateValue, setPreDateValue] = useState("");
  const [showSmsComposer, setShowSmsComposer] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [showAltSmsComposer, setShowAltSmsComposer] = useState(false);

  const clearIncompleteByPhone = useCallback(async (rawPhone: string) => {
    const normalizedPhone = rawPhone.trim();
    if (!normalizedPhone) return;

    const { error } = await supabase
      .from("incomplete_orders")
      .delete()
      .eq("phone", normalizedPhone);

    if (error) {
      console.error("Failed to clear incomplete order:", error);
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["incomplete-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["incomplete-phones-for-tags"] }),
      queryClient.invalidateQueries({ queryKey: ["web-orders"] }),
    ]);
  }, [queryClient]);
  const [showAltPhoneField, setShowAltPhoneField] = useState(false);
  const [altSmsText, setAltSmsText] = useState("");
  const [sendingAltSms, setSendingAltSms] = useState(false);
  const [customOrderId, setCustomOrderId] = useState("");
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [editingInvoiceValue, setEditingInvoiceValue] = useState("");
  const [showAllPhoneOrders, setShowAllPhoneOrders] = useState(false);
  const [prevCustomerData, setPrevCustomerData] = useState<{ name: string | null; address: string | null; alt_phone: string | null; district: string | null; thana: string | null } | null>(null);

  // Lookup previous customer data by phone
  useEffect(() => {
    const trimmedPhone = phone.trim();
    if (trimmedPhone.length < 11) { setPrevCustomerData(null); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("visitor_profiles")
        .select("name, address, alt_phone, district, thana")
        .eq("phone", trimmedPhone)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data && (data.name || data.address)) {
        setPrevCustomerData(data);
      } else {
        setPrevCustomerData(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [phone]);

  // Fetch full product detail for popup
  const { data: productDetail, isLoading: productDetailLoading } = useQuery({
    queryKey: ["product-detail-popup", productDetailId],
    enabled: !!productDetailId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productDetailId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch order data if editing (by order_id like AB100)
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["order-edit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("order_id", id).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch visitor internal notes (admin_notes from visitors table)
  const { data: visitorInternalNote } = useQuery({
    queryKey: ["visitor-internal-note", order?.visitor_id],
    enabled: !!order?.visitor_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitors")
        .select("admin_notes")
        .eq("id", order!.visitor_id!)
        .maybeSingle();
      if (error) throw error;
      return data?.admin_notes || null;
    },
  });

  const { data: orderItems } = useQuery({
    queryKey: ["order-edit-items", order?.id],
    enabled: !!order?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("*, products(product_image)").eq("order_id", order!.id);
      if (error) throw error;
      return (data || []).map((i: any) => ({
        ...i,
        product_image: i.product_image || i.products?.product_image || null,
      }));
    },
  });

  // Fill form when order loads
  useEffect(() => {
    if (order) {
      setCustomerName(order.customer_name || "");
      setPhone(order.phone || "");
      setAltPhone(order.alt_phone || "");
      setShowAltPhoneField(!!(order.alt_phone));
      setAddress(order.address || "");
      setOriginalAddress(order.address || "");
      setDistrict((order as any).district || "");
      setThana((order as any).thana || "");
      setDeliveryArea((order as any).delivery_area || "");
      // Lock address if district/thana already filled
      if ((order as any).district || (order as any).thana) {
        setAddressLocked(true);
      }
      setNote(order.note || "");
      setPrintNote((order as any).print_note || false);
      setSavedStatus(order.status);
      setDiscount(Number((order as any).discount) || 0);
      setAdvance(Number((order as any).advance) || 0);
      const dc = (order as any).delivery_charge;
      setDeliveryChargeOverride(dc != null ? Number(dc) : null);
      // Load pre_date if exists
      if ((order as any).pre_date) {
        setPreDateValue((order as any).pre_date);
      }
      // If order is in confirmed pipeline, keep its status; otherwise default to "confirmed"
      if (CONFIRMED_STATUS_VALUES.includes(order.status)) {
        setStatus(order.status);
      } else {
        setStatus(order.status === "pre" ? "pre" : "confirmed");
      }
    }
  }, [order]);

  // Saved-flash indicator (Facebook-style top toast — silent auto-save UX)
  const [savedFlash, setSavedFlash] = useState(false);
  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }, []);

  const FIVE_MIN = 5 * 1000; // (renamed-only) — user requested 5 SECONDS for all auto-saves
  const FIVE_SEC = 5 * 1000;

  // Auto-save customer NAME (5 min)
  const nameInitRef = useRef(false);
  useEffect(() => {
    if (!order || isNew) return;
    if (!nameInitRef.current) { nameInitRef.current = true; return; }
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ customer_name: customerName.trim() } as any).eq("id", order.id);
      flashSaved();
    }, FIVE_MIN);
    return () => clearTimeout(timer);
  }, [customerName, order?.id]);

  // Auto-save PHONE (5 min)
  const phoneInitRef = useRef(false);
  useEffect(() => {
    if (!order || isNew) return;
    if (!phoneInitRef.current) { phoneInitRef.current = true; return; }
    const trimmed = phone.trim();
    if (trimmed.length > 0 && trimmed.length < 11) return;
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ phone: trimmed } as any).eq("id", order.id);
      flashSaved();
    }, FIVE_MIN);
    return () => clearTimeout(timer);
  }, [phone, order?.id]);

  // Auto-save ADDRESS (5 min)
  const addressInitRef = useRef(false);
  useEffect(() => {
    if (!order || isNew) return;
    if (!addressInitRef.current) { addressInitRef.current = true; return; }
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ address: address.trim() } as any).eq("id", order.id);
      flashSaved();
    }, FIVE_MIN);
    return () => clearTimeout(timer);
  }, [address, order?.id]);

  // Auto-save NOTE (5 min)
  const noteInitRef = useRef(false);
  useEffect(() => {
    if (!order || isNew) return;
    if (!noteInitRef.current) { noteInitRef.current = true; return; }
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ note: note.trim() || null } as any).eq("id", order.id);
      flashSaved();
    }, FIVE_MIN);
    return () => clearTimeout(timer);
  }, [note, order?.id]);

  // Auto-save altPhone (5 min)
  const altPhoneInitRef = useRef(false);
  useEffect(() => {
    if (!order || isNew) return;
    if (!altPhoneInitRef.current) { altPhoneInitRef.current = true; return; }
    const trimmed = altPhone.trim();
    if (trimmed.length > 0 && trimmed.length < 11) return;
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ alt_phone: trimmed || null } as any).eq("id", order.id);
      flashSaved();
    }, FIVE_MIN);
    return () => clearTimeout(timer);
  }, [altPhone, order?.id]);

  // Auto-save district (5 min — location)
  const districtInitRef = useRef(false);
  useEffect(() => {
    if (!order || isNew) return;
    if (!districtInitRef.current) { districtInitRef.current = true; return; }
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ district: district || null } as any).eq("id", order.id);
      flashSaved();
    }, FIVE_MIN);
    return () => clearTimeout(timer);
  }, [district, order?.id]);

  // Auto-save thana (5 min — location)
  const thanaInitRef = useRef(false);
  useEffect(() => {
    if (!order || isNew) return;
    if (!thanaInitRef.current) { thanaInitRef.current = true; return; }
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ thana: thana || null } as any).eq("id", order.id);
      flashSaved();
    }, FIVE_MIN);
    return () => clearTimeout(timer);
  }, [thana, order?.id]);

  // Auto-save deliveryArea (5 min — location)
  const deliveryAreaInitRef = useRef(false);
  useEffect(() => {
    if (!order || isNew) return;
    if (!deliveryAreaInitRef.current) { deliveryAreaInitRef.current = true; return; }
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ delivery_area: deliveryArea.trim() || null } as any).eq("id", order.id);
      flashSaved();
    }, FIVE_MIN);
    return () => clearTimeout(timer);
  }, [deliveryArea, order?.id]);

  // Auto-save ITEMS / discount / advance / delivery override (5 sec — product changes)
  const itemsInitRef = useRef(false);
  useEffect(() => {
    if (!order || isNew) return;
    if (!itemsInitRef.current) { itemsInitRef.current = true; return; }
    const timer = setTimeout(async () => {
      try {
        await supabase.from("order_items").delete().eq("order_id", order.id);
        if (items.length > 0) {
          await supabase.from("order_items").insert(
            items.map((i) => ({
              order_id: order.id,
              product_id: i.product_id,
              product_name: i.product_name,
              product_image: i.product_image,
              unit_price: i.unit_price,
              quantity: i.quantity,
            }))
          );
        }
        await supabase.from("orders").update({
          total_amount: totalAmount,
          discount,
          advance,
          delivery_charge: deliveryChargeOverride,
        } as any).eq("id", order.id);
        queryClient.invalidateQueries({ queryKey: ["order-edit-items", id] });
        flashSaved();
      } catch (e) { console.error("Auto-save items:", e); }
    }, FIVE_SEC);
    return () => clearTimeout(timer);
  }, [items, discount, advance, deliveryChargeOverride, order?.id]);

  // Apply parsed result (local or AI)
  const applyParsedAddress = useCallback(async (result: { district: string; thana: string; area: string; source?: string }) => {
    setDistrict(result.district);
    setThana(result.thana || "");
    setDeliveryArea(result.area || "");
    setAiParseSource((result.source as any) || "local");
    const parts = [result.district, result.thana, result.area].filter(Boolean);
    if (parts.length > 0) {
      setAddress(parts.join(", "));
      setAddressLocked(true);
    }
    if (order && !isNew) {
      await supabase.from("orders").update({
        district: result.district || null,
        thana: result.thana || null,
        delivery_area: result.area || null,
        address: parts.join(", "),
      } as any).eq("id", order.id);
    }
  }, [order, isNew]);

  // AI parsing removed — local parser only. Fallback shows manual entry hint.
  const parseAddressWithAI = useCallback(async (_addressText: string, _ipCity?: string) => {
    toast.warning(t("ঠিকানা থেকে জেলা/থানা বের করা যায়নি — ম্যানুয়ালি সিলেক্ট করুন", "Could not auto-detect district/thana — please select manually"));
  }, [t]);


  // Auto-parse address on order load: try local first, then AI
  const autoParseRef = useRef(false);
  useEffect(() => {
    if (!order || isNew || autoParseRef.current) return;
    autoParseRef.current = true;
    const hasDistrict = (order as any).district;
    const hasThana = (order as any).thana;
    if (!hasDistrict && !hasThana && order.address) {
      // Try local parser first
      const localResult = parseAddressLocally(order.address);
      if (localResult && localResult.district) {
        setParseConfidence({ score: localResult.confidenceScore, level: localResult.confidence, details: localResult.matchDetails });
        if (localResult.confidence === "high") {
          // High confidence: auto-apply
          applyParsedAddress({ ...localResult, source: "local" });
          toast.success(t("✅ ঠিকানা পার্স হয়েছে", "✅ Address parsed"));
        } else {
          // Medium/Low confidence: show suggestion, don't auto-apply
          setPendingSuggestion({ district: localResult.district, thana: localResult.thana, area: localResult.area });
          toast.warning(
            t(
              `⚠️ ঠিকানা অনুমান: ${localResult.district}${localResult.thana ? `, ${localResult.thana}` : ""} (${localResult.confidenceScore}%) — যাচাই করুন`,
              `⚠️ Address guess: ${localResult.district}${localResult.thana ? `, ${localResult.thana}` : ""} (${localResult.confidenceScore}%) — please verify`
            ),
            { duration: 8000 }
          );
        }
      } else {
        // Local failed, use AI
        parseAddressWithAI(order.address);
      }
    }
  }, [order]);

  // Auto-update address when district/thana/area change (user-driven changes only)
  const fieldsUserChangedRef = useRef(false);
  useEffect(() => {
    if (!fieldsUserChangedRef.current) return;
    const parts = [district, thana, deliveryArea].filter(Boolean);
    if (parts.length > 0) {
      setAddress(parts.join(", "));
      setAddressLocked(true);
    }
  }, [district, thana, deliveryArea]);


  const isConfirmedPipeline = order && CONFIRMED_STATUS_VALUES.includes(order.status);
  const activeStatusOptions = isConfirmedPipeline ? CONFIRMED_STATUS_OPTIONS : WEB_STATUS_OPTIONS;

  useEffect(() => {
    if (orderItems) {
      setItems(orderItems.map((i) => ({
        id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        product_image: i.product_image,
        unit_price: Number(i.unit_price),
        quantity: Number(i.quantity),
      })));
    }
  }, [orderItems]);

  // Fetch categories and tags for picker
  const { data: pickerCategories } = useQuery({
    queryKey: ["picker-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name").order("position");
      return data?.map((c) => c.name) || [];
    },
  });
  const { data: pickerTags } = useQuery({
    queryKey: ["picker-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("tags").select("name").order("name");
      return data?.map((t) => t.name) || [];
    },
  });

  // Fetch products for picker
  const { data: products } = useQuery({
    queryKey: ["products-picker", pickerMode, productSearch, selectedCategory, selectedTag],
    queryFn: async () => {
      let query = supabase.from("products").select("id, name, product_image, regular_price, offer_price, stock, sku, category, tag, unlock_threshold").order("position").limit(50);
      if (pickerMode === "search" && productSearch) {
        query = query.or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`);
      } else if (pickerMode === "category" && selectedCategory) {
        query = query.eq("category", selectedCategory);
      } else if (pickerMode === "tag" && selectedTag) {
        query = query.eq("tag", selectedTag);
      } else {
        // Default: show "সেরা পণ্য" tagged products
        query = query.ilike("tag", "%সেরা পণ্য%");
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch customer profile by phone
  const { data: customerProfile } = useQuery({
    queryKey: ["customer-profile", phone],
    enabled: phone.length >= 11,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitor_profiles")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all orders by this phone number
  const { data: phoneOrders } = useQuery({
    queryKey: ["phone-orders", phone],
    enabled: phone.length >= 11,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_id, status, total_amount, created_at, customer_name")
        .eq("phone", phone)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch visitor data linked to this order (via visitor_id or via visitor_profile_id -> visitor_id)
  const { data: visitorData } = useQuery({
    queryKey: ["order-visitor-data", id, order?.visitor_id, order?.visitor_profile_id],
    enabled: !!order,
    queryFn: async () => {
      // Try direct visitor_id first
      let visitorId = (order as any)?.visitor_id;
      
      // Fallback: get visitor_id from visitor_profile
      if (!visitorId && order?.visitor_profile_id) {
        const { data: profile } = await supabase
          .from("visitor_profiles")
          .select("visitor_id")
          .eq("id", order.visitor_profile_id)
          .maybeSingle();
        visitorId = profile?.visitor_id;
      }

      if (!visitorId) return null;

      const { data: visitor } = await supabase
        .from("visitors")
        .select("*")
        .eq("id", visitorId)
        .maybeSingle();
      return visitor;
    },
  });

  // Fetch admin creator name if order was created by admin
  const { data: creatorAdmin } = useQuery({
    queryKey: ["order-creator-admin", id, (order as any)?.created_by_admin_id],
    enabled: !!(order as any)?.created_by_admin_id,
    queryFn: async () => {
      const adminId = (order as any).created_by_admin_id;
      const { data, error } = await supabase.functions.invoke("manage-admin", {
        body: { action: "lookup", user_id: adminId },
      });
      if (error) return { name: null };
      return { name: data?.name || null };
    },
  });

  // IP Geolocation lookup
  const { data: ipGeoData } = useQuery({
    queryKey: ["ip-geo", visitorData?.ip_addresses],
    enabled: !!visitorData?.ip_addresses?.length,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const ips = visitorData!.ip_addresses as string[];
      // ip-api.com supports batch lookup (POST) for up to 100 IPs
      const res = await fetch("http://ip-api.com/batch?fields=query,city,regionName,country,status", {
        method: "POST",
        body: JSON.stringify(ips.map(ip => ({ query: ip }))),
      });
      if (!res.ok) return {};
      const results = await res.json() as Array<{ query: string; city?: string; regionName?: string; country?: string; status: string }>;
      const map: Record<string, string> = {};
      for (const r of results) {
        if (r.status === "success" && r.city) {
          map[r.query] = `${r.city}, ${r.country}`;
        }
      }
      return map;
    },
  });

  // Fetch customer order history: profile-linked + all phone-matched
  const { data: customerOrders } = useQuery({
    queryKey: ["customer-orders", phone, order?.visitor_profile_id],
    enabled: phone.length >= 11,
    queryFn: async () => {
      const { data: phoneOrders, error } = await supabase
        .from("orders")
        .select("id, order_id, total_amount, status, created_at, visitor_profile_id")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      let allOrders = phoneOrders || [];

      // Also fetch profile-linked orders if profile exists
      const profileId = order?.visitor_profile_id;
      if (profileId) {
        const { data: profileOrders } = await supabase
          .from("orders")
          .select("id, order_id, total_amount, status, created_at, visitor_profile_id")
          .eq("visitor_profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(20);
        
        if (profileOrders) {
          const seenIds = new Set(allOrders.map(o => o.id));
          for (const o of profileOrders) {
            if (!seenIds.has(o.id)) {
              allOrders.push(o);
            }
          }
        }
      }

      allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return allOrders.slice(0, 15);
    },
  });

  // Duplicate order detection (48h window)
  const { data: duplicateWarnings } = useQuery({
    queryKey: ["duplicate-check", id, phone, order?.visitor_id],
    enabled: !!order && !!id,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const warnings: { type: string; orders: any[] }[] = [];

      // Check same phone within 48h
      if (phone.length >= 11) {
        const { data: phoneMatches } = await supabase
          .from("orders")
          .select("id, order_id, status, created_at, customer_name")
          .eq("phone", phone)
          .eq("is_deleted", false)
          .gte("created_at", cutoff)
          .neq("id", id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (phoneMatches && phoneMatches.length > 0) {
          warnings.push({ type: "phone", orders: phoneMatches });
        }
      }

      // Check same visitor_id within 48h
      if (order?.visitor_id) {
        const { data: visitorMatches } = await supabase
          .from("orders")
          .select("id, order_id, status, created_at, customer_name, phone")
          .eq("visitor_id", order.visitor_id)
          .eq("is_deleted", false)
          .gte("created_at", cutoff)
          .neq("id", id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (visitorMatches && visitorMatches.length > 0) {
          // Deduplicate with phone matches
          const phoneIds = new Set(warnings[0]?.orders.map((o: any) => o.id) || []);
          const uniqueVisitorOrders = visitorMatches.filter((o: any) => !phoneIds.has(o.id));
          if (uniqueVisitorOrders.length > 0) {
            warnings.push({ type: "device", orders: uniqueVisitorOrders });
          }
        }
      }

      return warnings.length > 0 ? warnings : null;
    },
  });

  const [fraudRefreshing, setFraudRefreshing] = useState(false);

  const handleFraudForceRefresh = useCallback(async () => {
    if (!phone || phone.length < 11 || fraudRefreshing) return;
    setFraudRefreshing(true);
    try {
      const fcRes = await supabase.functions.invoke("fraud-checker", { body: { action: "force_check", phone } });
      console.log("[FraudCheck] forceRefresh response:", JSON.stringify(fcRes.data));
      if (fcRes.data?.success && fcRes.data?.data) {
        queryClient.setQueryData(["fraud-check", phone], fcRes.data.data);
      }
      toast.success(t("ফ্রড ডেটা রিফ্রেশ হয়েছে", "Fraud data refreshed"));
    } catch {
      toast.error(t("রিফ্রেশ ব্যর্থ", "Refresh failed"));
    } finally {
      setFraudRefreshing(false);
    }
  }, [phone, fraudRefreshing, queryClient, t]);

  const { data: fraudData, isLoading: fraudLoading } = useQuery({
    queryKey: ["fraud-check", phone],
    enabled: phone.length >= 11,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fraud-checker", {
        body: { action: "check", phone },
      });
      console.log("[FraudCheck] raw response:", JSON.stringify(data));
      if (error) return null;
      // If stale, trigger background refresh
      if (data?.stale) {
        supabase.functions.invoke("fraud-checker", {
          body: { action: "force_check", phone },
        }).then(({ data: fresh }) => {
          console.log("[FraudCheck] force_check response:", JSON.stringify(fresh));
          if (fresh?.success && fresh?.data) {
            queryClient.setQueryData(["fraud-check", phone], fresh.data);
          }
        });
      }
      return data?.data || null;
    },
    staleTime: 30 * 60 * 1000,
  });


  // Fetch status history for timeline
  const { data: statusHistory } = useQuery({
    queryKey: ["order-status-history", order?.id],
    enabled: !!order?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", order!.id)
        .order("changed_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [showAllHistory, setShowAllHistory] = useState(false);

  const subtotal = useMemo(() =>
    items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0), [items]);

  const autoDeliveryCharge = getDeliveryCharge(subtotal - discount);
  const deliveryCharge = deliveryChargeOverride !== null ? deliveryChargeOverride : autoDeliveryCharge;
  const totalAmount = subtotal - discount - advance + deliveryCharge;

  const addProduct = (product: any) => {
    const isFreeGift = Number(product.unlock_threshold || 0) > 0;
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      setItems(items.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems([...items, {
        product_id: product.id,
        product_name: product.name,
        product_image: product.product_image,
        unit_price: isFreeGift ? 0 : product.offer_price || product.regular_price,
        quantity: 1,
      }]);
    }
  };

  const updateItemQty = (productId: string, delta: number) => {
    setItems(items.map((i) => {
      if (i.product_id !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty > 0 ? { ...i, quantity: newQty } : i;
    }));
  };

  const setItemQty = (productId: string, qty: number) => {
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    setItems(items.map((i) => i.product_id === productId ? { ...i, quantity: Math.floor(qty) } : i));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.product_id !== productId));
  };

  const handleSave = async (newStatus?: string, goBack = false) => {
    // Determine final status: Save button (no newStatus, goBack=false) keeps DB status unchanged
    const finalStatus = newStatus || (goBack ? status : savedStatus) || savedStatus || status;

    // Confirm requires name, phone, and address (district/thana/area optional)
    if (finalStatus === "confirmed") {
      if (!customerName.trim() || !phone.trim() || !address.trim()) {
        toast.error(t("কনফার্মের জন্য নাম, ফোন ও সম্পূর্ণ ঠিকানা আবশ্যক", "Name, phone & full address required for confirm"));
        return;
      }
    } else {
      if (!phone.trim()) {
        toast.error(t("ফোন নম্বর আবশ্যক", "Phone number is required"));
        return;
      }
    }

    if (items.length === 0) {
      toast.error(t("কমপক্ষে একটি পণ্য যোগ করুন", "Add at least one product"));
      return;
    }

    setSaving(true);

    try {
      if (isNew) {
        const { data: session } = await supabase.auth.getSession();
        const currentAdminId = session?.session?.user?.id || null;

        // Let DB sequence auto-generate order_id via default: 'AB' || nextval('order_number_seq')
        const insertData: any = {
          customer_name: customerName.trim(),
          phone: phone.trim(),
          alt_phone: altPhone.trim() || null,
          address: address.trim(),
          district: district || null,
          thana: thana || null,
          delivery_area: deliveryArea.trim() || null,
           note: note.trim() || null,
           print_note: printNote,
          status: finalStatus,
          total_amount: totalAmount,
          discount,
          advance,
          delivery_charge: deliveryChargeOverride,
          created_by_admin_id: currentAdminId,
          ...(finalStatus === "pre" && preDateValue ? { pre_date: preDateValue } : {}),
        };
        if (customOrderId.trim()) {
          insertData.order_id = customOrderId.trim();
        }
        const { data: newOrder, error } = await supabase.from("orders").insert(insertData).select().single();
        if (error) throw error;

        // Insert items
        const { error: itemsErr } = await supabase.from("order_items").insert(
          items.map((i) => ({
            order_id: newOrder.id,
            product_id: i.product_id,
            product_name: i.product_name,
            product_image: i.product_image,
            unit_price: i.unit_price,
            quantity: i.quantity,
          }))
        );
        if (itemsErr) throw itemsErr;

        await clearIncompleteByPhone(phone);

        // Log initial status history
        const { data: sess } = await supabase.auth.getSession();
        const creatorId = sess?.session?.user?.id || null;
        let creatorName: string | null = null;
        if (creatorId) {
          try {
            const { data: ad } = await supabase.functions.invoke("manage-admin", { body: { action: "lookup", user_id: creatorId } });
            creatorName = ad?.name || sess?.session?.user?.email || null;
          } catch { creatorName = sess?.session?.user?.email || null; }
        }
        await supabase.from("order_status_history").insert({
          order_id: newOrder.id,
          status: finalStatus,
          changed_by: creatorId,
          changed_by_name: creatorName,
        } as any);

        toast.success(t("অর্ডার তৈরি হয়েছে", "Order created"));
        // Fire SMS notification for new order
        supabase.functions.invoke("order-status-notify", {
          body: { order_id: newOrder.id, new_status: finalStatus },
        }).catch(console.error);
        if (goBack) {
          navigate(-1);
          return;
        }
        navigate(`/admin/orders/edit/${newOrder.order_id}`, { replace: true });
      } else {
        // Update order
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.from("orders").update({
          customer_name: customerName.trim(),
          phone: phone.trim(),
          alt_phone: altPhone.trim() || null,
          address: address.trim(),
          district: district || null,
          thana: thana || null,
          delivery_area: deliveryArea.trim() || null,
           note: note.trim() || null,
           print_note: printNote,
          status: finalStatus,
          total_amount: totalAmount,
          discount,
          advance,
          delivery_charge: deliveryChargeOverride,
          last_status_changed_by: session?.user?.id || null,
          ...(finalStatus === "pre" && preDateValue ? { pre_date: preDateValue } : {}),
        } as any).eq("id", order!.id);
        if (error) throw error;

        // Delete old items and re-insert
        await supabase.from("order_items").delete().eq("order_id", order!.id);
        const { error: itemsErr } = await supabase.from("order_items").insert(
          items.map((i) => ({
            order_id: order!.id,
            product_id: i.product_id,
            product_name: i.product_name,
            product_image: i.product_image,
            unit_price: i.unit_price,
            quantity: i.quantity,
          }))
        );
        if (itemsErr) throw itemsErr;

        await clearIncompleteByPhone(phone);

        toast.success(t("অর্ডার আপডেট হয়েছে", "Order updated"));
        // Fire notification if status changed
        if (finalStatus !== savedStatus) {
          // Log status history
          const { data: session2 } = await supabase.auth.getSession();
          const adminId = session2?.session?.user?.id || null;
          let adminName: string | null = null;
          if (adminId) {
            try {
              const { data: adminData } = await supabase.functions.invoke("manage-admin", {
                body: { action: "lookup", user_id: adminId },
              });
              adminName = adminData?.name || session2?.session?.user?.email || null;
            } catch { adminName = session2?.session?.user?.email || null; }
          }
          await supabase.from("order_status_history").insert({
            order_id: order!.id,
            status: finalStatus,
            changed_by: adminId,
            changed_by_name: adminName,
          } as any);
          queryClient.invalidateQueries({ queryKey: ["order-status-history", order!.id] });

          supabase.functions.invoke("order-status-notify", {
            body: { order_id: order!.id, new_status: finalStatus, old_status: savedStatus },
          }).catch(console.error);
        }
      }

      // Auto-create customer profile when order is confirmed
      if (finalStatus === "confirmed") {
        try {
          const trimmedPhone = phone.trim();
          const { data: existingProfile } = await supabase
            .from("visitor_profiles")
            .select("id")
            .eq("phone", trimmedPhone)
            .maybeSingle();

          if (!existingProfile) {
            const { data: newVisitor, error: visitorErr } = await supabase
              .from("visitors")
              .insert({ fingerprint: `order-${trimmedPhone}-${Date.now()}` })
              .select("id")
              .single();
            if (visitorErr) throw visitorErr;

            await supabase.from("visitor_profiles").insert({
              visitor_id: newVisitor.id,
              phone: trimmedPhone,
              name: customerName.trim(),
              address: address.trim(),
              alt_phone: altPhone.trim() || null,
            });
          } else {
            // Update existing profile with latest order info
            await supabase.from("visitor_profiles").update({
              name: customerName.trim(),
              address: address.trim(),
              alt_phone: altPhone.trim() || null,
            }).eq("id", existingProfile.id);
          }
        } catch (profileErr) {
          console.error("Auto-create customer profile error:", profileErr);
        }
      }

      setStatus(finalStatus);
      setSavedStatus(finalStatus);
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-edit", id] });
      queryClient.invalidateQueries({ queryKey: ["order-edit-items", id] });

      if (goBack) {
        navigate(-1);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusInfo = getStatusInfo(status);
  const StatusIcon = statusInfo.icon;

  if (!isNew && orderLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lockInitials = lockHolder?.user_name
    ? lockHolder.user_name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : lockHolder?.user_email?.[0]?.toUpperCase() || "?";

  return (
    <div className="space-y-4">
      {/* Facebook-style auto-save indicator (silent, top-center) */}
      <div
        className={`fixed top-2 left-1/2 -translate-x-1/2 z-[60] pointer-events-none transition-all duration-300 ${savedFlash ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
      >
        <div className="px-3 py-1 rounded-full bg-foreground/85 text-background text-xs font-medium shadow-lg">
          {t("সেভ হয়েছে", "Saved")}
        </div>
      </div>
      {/* Lock warning dialog: someone else is editing */}
      <AlertDialog open={showWarning && !wasKicked}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              {t("অর্ডার লক করা আছে", "Order is Locked")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Avatar className="h-10 w-10 bg-amber-100 text-amber-700">
                  {lockHolder?.user_photo && <AvatarImage src={lockHolder.user_photo} alt={lockHolder.user_name || ""} />}
                  <AvatarFallback className="bg-amber-100 text-amber-700 font-bold">
                    {lockInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{lockHolder?.user_name || lockHolder?.user_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("এই অর্ডার এডিট করছেন", "is currently editing this order")}
                  </p>
                </div>
              </div>
              <p className="text-sm">
                {t(
                  "আপনি চাইলে ফিরে যেতে পারেন অথবা জোর করে এডিট নিতে পারেন। জোর করে নিলে আগের ব্যক্তি স্বয়ংক্রিয়ভাবে বের হয়ে যাবেন।",
                  "You can go back or force take over editing. If you force take over, the previous editor will be kicked out automatically."
                )}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { dismissWarning(); navigate(-1); }}>
              {t("ফিরে যান", "Go Back")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={forceAcquire} className="bg-amber-600 hover:bg-amber-700">
              {t("জোর করে এডিট নিন", "Force Take Over")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kicked out dialog */}
      <AlertDialog open={wasKicked}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t("আপনাকে বের করা হয়েছে", "You've Been Kicked Out")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Avatar className="h-10 w-10 bg-red-100 text-red-700">
                  {lockHolder?.user_photo && <AvatarImage src={lockHolder.user_photo} alt={lockHolder.user_name || ""} />}
                  <AvatarFallback className="bg-red-100 text-red-700 font-bold">{lockInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{lockHolder?.user_name || lockHolder?.user_email}</p>
                  <p className="text-xs text-muted-foreground">{t("এই অর্ডারের এডিট নিয়ে নিয়েছেন", "has taken over editing this order")}</p>
                </div>
              </div>
              <p className="text-sm text-destructive font-medium">
                {t("আপনার পরিবর্তন সেভ নাও হতে পারে। অনুগ্রহ করে ফিরে যান।", "Your changes may not be saved. Please go back.")}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => navigate(-1)}>
              {t("ফিরে যান", "Go Back")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Active lock indicator in header */}
      {!isNew && lockHolder && !isLocked && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-400">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          {t("আপনি এই অর্ডার এডিট করছেন", "You are editing this order")}
        </div>
      )}
      {/* Print/Entry warnings */}
      {!isNew && order && (order as any).is_printed && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          <Printer className="w-4 h-4 flex-shrink-0" />
          <span>{t("⚠️ এই অর্ডারটি ইতিমধ্যে প্রিন্ট করা হয়েছে — পরিবর্তন করলে পুনরায় প্রিন্ট করতে হবে", "⚠️ This order is already printed — changes will require re-printing")}</span>
        </div>
      )}
      {!isNew && order && (order as any).is_courier_entered && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <Truck className="w-4 h-4 flex-shrink-0" />
          <span>{t("🚚 এই অর্ডারটি কুরিয়ারে এন্ট্রি করা হয়েছে — পরিবর্তন করলে কুরিয়ারেও আপডেট করতে হবে", "🚚 This order is entered in courier — changes will require courier update")}</span>
        </div>
      )}
      {/* Status History Timeline */}
      {!isNew && statusHistory && statusHistory.length > 0 && (() => {
        const displayItems = showAllHistory ? statusHistory : statusHistory.slice(-4);
        const hiddenCount = statusHistory.length - 4;
        const formatDuration = (ms: number) => {
          const mins = Math.floor(ms / 60000);
          if (mins < 60) return `${mins}m`;
          const hrs = Math.floor(mins / 60);
          if (hrs < 24) return `${hrs}h ${mins % 60}m`;
          const days = Math.floor(hrs / 24);
          return `${days}d ${hrs % 24}h`;
        };
        const getStatusLabel = (s: string) => {
          const found = ALL_STATUS_OPTIONS.find(o => o.value === s);
          return found ? t(found.labelBn, found.label) : s;
        };
        return (
          <div className="px-3 py-2.5 bg-muted/40 border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{t("স্ট্যাটাস হিস্ট্রি", "Status History")}</span>
              {hiddenCount > 0 && !showAllHistory && (
                <button onClick={() => setShowAllHistory(true)} className="text-[10px] text-primary hover:underline ml-auto">
                  & More {hiddenCount}
                </button>
              )}
              {showAllHistory && hiddenCount > 0 && (
                <button onClick={() => setShowAllHistory(false)} className="text-[10px] text-primary hover:underline ml-auto">
                  {t("কম দেখুন", "Show less")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {displayItems.map((h: any, i: number) => {
                const prevTime = i > 0 ? new Date(displayItems[i - 1].changed_at).getTime() : null;
                const currTime = new Date(h.changed_at).getTime();
                const duration = prevTime ? formatDuration(currTime - prevTime) : null;
                return (
                  <div key={h.id} className="flex items-center gap-1">
                    {duration && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {duration}
                      </span>
                    )}
                    {(duration || i > 0) && <span className="text-muted-foreground text-[10px]">→</span>}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary cursor-default">
                            {getStatusLabel(h.status)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs space-y-0.5">
                          <p>{format(new Date(h.changed_at), "dd/MM/yyyy hh:mm a")}</p>
                          {h.changed_by_name && <p className="text-muted-foreground">{h.changed_by_name}</p>}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-display font-bold text-foreground">
          {isNew ? (
            <span className="flex items-center gap-2">
              {t("নতুন অর্ডার", "New Order")}
              <Input
                value={customOrderId}
                onChange={(e) => setCustomOrderId(e.target.value)}
                placeholder={t("ইনভয়েস (ঐচ্ছিক)", "Invoice (optional)")}
                className="h-7 w-32 text-xs font-mono inline-block"
              />
            </span>
          ) : editingInvoice ? (
            <span className="flex items-center gap-2">
              {t("অর্ডার", "Order")}:
              <Input
                autoFocus
                value={editingInvoiceValue}
                onChange={(e) => setEditingInvoiceValue(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && editingInvoiceValue.trim() && order) {
                    const newVal = editingInvoiceValue.trim();
                    const { error } = await supabase.from("orders").update({ order_id: newVal, customer_facing_id: newVal } as any).eq("id", order.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success(t("ইনভয়েস আপডেট হয়েছে", "Invoice updated"));
                    queryClient.invalidateQueries({ queryKey: ["order-edit", id] });
                    navigate(`/admin/orders/edit/${editingInvoiceValue.trim()}`, { replace: true });
                    setEditingInvoice(false);
                  }
                  if (e.key === "Escape") setEditingInvoice(false);
                }}
                onBlur={() => setEditingInvoice(false)}
                className="h-7 w-32 text-sm font-mono"
              />
            </span>
          ) : (
            <span
              onDoubleClick={() => {
                setEditingInvoiceValue(order?.customer_facing_id || order?.order_id || "");
                setEditingInvoice(true);
              }}
              className="cursor-pointer"
              title={t("ডাবল ক্লিক করে ইনভয়েস এডিট করুন", "Double click to edit invoice")}
            >
              {`${t("অর্ডার", "Order")}: ${order?.customer_facing_id || order?.order_id}`}
            </span>
          )}
        </h1>
        {!isNew && order && (() => {
          const si = getStatusInfo(order.status);
          const SI = si.icon;
          return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${si.color}`}>
              <SI className="w-3 h-3" />
              {si.label}
            </span>
          );
        })()}
      </div>

      <div className={cn("grid grid-cols-1 gap-4", sidebarCollapsed ? "lg:grid-cols-1" : "lg:grid-cols-[1fr_280px]")}>
        {/* Main content */}
        <div className="space-y-4">
          {/* Area 1: Customer Data */}
           <Card className="border-border/70 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60 bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><span className="inline-block w-1 h-4 rounded-full bg-primary" />{t("কাস্টমার তথ্য", "Customer Info")}</CardTitle>
                <div className="flex items-center gap-1.5">
                  {note.trim() && (
                    <span className="text-[11px] text-muted-foreground max-w-[200px] truncate">{note.length > 50 ? note.slice(0, 50) + '…' : note}</span>
                  )}
                  <Popover open={showNotePopover} onOpenChange={setShowNotePopover}>
                    <PopoverTrigger asChild>
                      <button type="button" className={`flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-muted transition-colors ${note.trim() || visitorInternalNote ? 'bg-primary/15 ring-1 ring-primary/30 text-primary' : 'text-muted-foreground'}`} title={t("নোট", "Note")}>
                        {note.trim() || visitorInternalNote ? (
                          <StickyNote className="w-3.5 h-3.5" />
                        ) : (
                          <>{t("নোট", "Add Note")} <Plus className="w-3.5 h-3.5" /></>
                        )}
                        {visitorInternalNote && <span className="text-[10px] text-amber-600">📌</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-3 space-y-3" align="end">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">{t("কাস্টমার নোট", "Customer Note")}</Label>
                        <button type="button" onClick={() => setShowNotePopover(false)} className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                       <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("ঐচ্ছিক নোট", "Optional note")} className="min-h-[80px] resize-none" />
                      {note.trim() && (
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={printNote} onChange={(e) => {
                            setPrintNote(e.target.checked);
                            if (order && !isNew) {
                              supabase.from("orders").update({ print_note: e.target.checked } as any).eq("id", order.id).then(() => {});
                            }
                          }} className="rounded border-gray-300" />
                          <span className="text-xs text-muted-foreground">{printNote ? "✅" : "☐"} {t("ইনভয়েসে নোট প্রিন্ট হবে", "Print note on invoice")}</span>
                        </label>
                      )}
                      {/* Internal Note (from visitor) - admin only */}
                      {visitorInternalNote && (
                        <div className="pt-2 border-t border-border">
                          <Label className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            📌 {t("ইন্টারনাল নোট", "Internal Note")}
                          </Label>
                          <p className="text-xs mt-1 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded px-2 py-1.5 whitespace-pre-wrap">
                            {visitorInternalNote}
                          </p>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1 h-4 leading-none">{t("নাম", "Name")} *</Label>
                  <div className="relative">
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t("কাস্টমারের নাম", "Customer name")} className="h-9" />
                    {prevCustomerData && !customerName.trim() && !address.trim() && (
                      <button
                        type="button"
                        title={`${prevCustomerData.name || ""} — আগের ডেটা ফিল করুন`}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 transition-colors"
                        onClick={() => {
                          if (prevCustomerData.name) setCustomerName(prevCustomerData.name);
                          if (prevCustomerData.alt_phone && !altPhone.trim()) {
                            setAltPhone(prevCustomerData.alt_phone);
                            setShowAltPhoneField(true);
                          }
                          // Fill address and parse for district/thana/area
                          if (prevCustomerData.address) {
                            setAddress(prevCustomerData.address);
                            setOriginalAddress(prevCustomerData.address);
                            // If profile has district/thana, use directly
                            if (prevCustomerData.district) {
                              setDistrict(prevCustomerData.district);
                              setThana(prevCustomerData.thana || "");
                              // Try to extract area from address
                              const localResult = parseAddressLocally(prevCustomerData.address);
                              setDeliveryArea(localResult?.area || "");
                              const parts = [prevCustomerData.district, prevCustomerData.thana, localResult?.area].filter(Boolean);
                              setAddress(parts.join(", "));
                              setAddressLocked(true);
                            } else {
                              // Parse address locally then AI fallback
                              const localResult = parseAddressLocally(prevCustomerData.address);
                              if (localResult && localResult.district) {
                                setParseConfidence({ score: localResult.confidenceScore, level: localResult.confidence, details: localResult.matchDetails });
                                if (localResult.confidence === "high") {
                                  applyParsedAddress({ ...localResult, source: "local" });
                                } else {
                                  setPendingSuggestion({ district: localResult.district, thana: localResult.thana, area: localResult.area });
                                }
                              } else {
                                parseAddressWithAI(prevCustomerData.address);
                              }
                            }
                          }
                          toast.success("আগের ডেটা ফিল করা হয়েছে");
                        }}
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1 h-4 leading-none">{t("ফোন", "Phone")} * <PhoneVerifiedBadge verified={customerProfile?.phone_verified === true} size={13} /></Label>
                  <div className="flex items-center gap-1">
                    <div className="relative flex-1">
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-9 pr-24" />
                      {phone.length >= 11 && (
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                          <button type="button" onClick={() => window.open(`tel:${phone}`, '_self')} className="p-1 rounded hover:bg-muted transition-colors" title={t("কল করুন", "Call")}>
                            <Phone className="w-4 h-4 text-green-600" />
                          </button>
                          <button type="button" onClick={() => window.open(`https://wa.me/88${phone.replace(/^0/, '')}`, '_blank')} className="p-1 rounded hover:bg-muted transition-colors" title="WhatsApp">
                            <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-500 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </button>
                          <button type="button" onClick={() => setShowSmsComposer(!showSmsComposer)} className={`p-1 rounded hover:bg-muted transition-colors ${showSmsComposer ? 'bg-primary/10' : ''}`} title={t("এসএমএস পাঠান", "Send SMS")}>
                            <MessageSquare className="w-4 h-4 text-blue-600" />
                          </button>
                        </div>
                      )}
                    </div>
                    <Popover open={showAltPhoneField} onOpenChange={setShowAltPhoneField}>
                      <PopoverTrigger asChild>
                        <button type="button" className={`p-1.5 rounded border border-border hover:bg-muted transition-colors flex-shrink-0 ${altPhone.length >= 11 ? 'bg-primary/15 ring-1 ring-primary/30' : ''}`} title={t("এক্সট্রা নম্বর", "Extra number")}>
                          <Plus className={`w-4 h-4 ${altPhone.length >= 11 ? 'text-primary' : 'text-muted-foreground'}`} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3 space-y-2" align="end">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">{t("এক্সট্রা নম্বর", "Extra number")}</Label>
                          <button type="button" onClick={() => setShowAltPhoneField(false)} className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title={t("বন্ধ করুন", "Close")}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="relative">
                          <Input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-9 pr-20" />
                          {altPhone.length >= 11 && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                              <button type="button" onClick={() => window.open(`tel:${altPhone}`, '_self')} className="p-1 rounded hover:bg-muted transition-colors" title={t("কল করুন", "Call")}><Phone className="w-3.5 h-3.5 text-green-600" /></button>
                              <button type="button" onClick={() => window.open(`https://wa.me/88${altPhone.replace(/^0/, '')}`, '_blank')} className="p-1 rounded hover:bg-muted transition-colors" title="WhatsApp"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-500 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button>
                              <button type="button" onClick={() => setShowAltSmsComposer(!showAltSmsComposer)} className={`p-1 rounded hover:bg-muted transition-colors ${showAltSmsComposer ? 'bg-primary/10' : ''}`} title={t("এসএমএস পাঠান", "Send SMS")}><MessageSquare className="w-3.5 h-3.5 text-blue-600" /></button>
                            </div>
                          )}
                        </div>
                        {showAltSmsComposer && altPhone.length >= 11 && (
                          <div className="space-y-1.5 p-2 rounded-lg border border-border bg-muted/30">
                            <Textarea value={altSmsText} onChange={(e) => setAltSmsText(e.target.value)} placeholder={t("মেসেজ লিখুন...", "Type message...")} className="min-h-[60px] resize-none text-xs" />
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">{altSmsText.length} {t("অক্ষর", "chars")} · {Math.ceil(altSmsText.length / 160) || 0} SMS</span>
                              <Button size="sm" className="h-7 text-xs gap-1" disabled={!altSmsText.trim() || sendingAltSms} onClick={async () => {
                                setSendingAltSms(true);
                                try {
                                   const { data, error } = await supabase.functions.invoke("sms-api", { body: { action: "send_sms", number: altPhone, message: altSmsText, reason: "manual" } });
                                   if (error) throw error;
                                   if (!data?.success) throw new Error(data?.result?.msg || "SMS পাঠাতে ব্যর্থ");
                                  toast.success(t("এসএমএস পাঠানো হয়েছে", "SMS sent"));
                                  setAltSmsText(""); setShowAltSmsComposer(false);
                                } catch (err: any) { toast.error(err.message || "SMS failed"); } finally { setSendingAltSms(false); }
                              }}>
                                {sendingAltSms ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                {t("পাঠান", "Send")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  {showSmsComposer && phone.length >= 11 && (
                    <div className="mt-1.5 space-y-1.5 p-2 rounded-lg border border-border bg-muted/30">
                      <Textarea
                        value={smsText}
                        onChange={(e) => setSmsText(e.target.value)}
                        placeholder={t("মেসেজ লিখুন...", "Type message...")}
                        className="min-h-[60px] resize-none text-xs"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {smsText.length} {t("অক্ষর", "chars")} · {Math.ceil(smsText.length / 160) || 0} SMS
                        </span>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={!smsText.trim() || sendingSms}
                          onClick={async () => {
                            setSendingSms(true);
                            try {
                              const { data, error } = await supabase.functions.invoke("sms-api", {
                                body: { action: "send_sms", number: phone, message: smsText, reason: "manual" },
                              });
                              if (error) throw error;
                              if (!data?.success) throw new Error(data?.result?.msg || "SMS পাঠাতে ব্যর্থ");
                              toast.success(t("এসএমএস পাঠানো হয়েছে", "SMS sent"));
                              setSmsText("");
                              setShowSmsComposer(false);
                            } catch (err: any) {
                              toast.error(err.message || "SMS failed");
                            } finally {
                              setSendingSms(false);
                            }
                          }}
                        >
                          {sendingSms ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          {t("পাঠান", "Send")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Label className="text-xs">{t("ঠিকানা", "Address")} *</Label>
                    {originalAddress && originalAddress !== address && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={originalAddress}>
                        ({originalAddress})
                      </span>
                    )}
                    {aiParseSource === "ip" && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-yellow-400 text-yellow-600 gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" />IP
                      </Badge>
                    )}
                    {parseConfidence && !pendingSuggestion && (
                      <Badge variant="outline" className={cn("text-[9px] h-4 px-1 gap-0.5",
                        parseConfidence.level === "high" ? "border-green-400 text-green-600" :
                        parseConfidence.level === "medium" ? "border-yellow-400 text-yellow-600" :
                        "border-red-400 text-red-600"
                      )}>
                        {parseConfidence.score}%
                      </Badge>
                    )}
                  </div>
                  {/* Pending suggestion banner for low/medium confidence */}
                  {pendingSuggestion && (
                    <div className="mb-1.5 p-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                          {t("অনুমান — যাচাই করুন", "Suggestion — please verify")}
                          {parseConfidence && <span className="ml-1 opacity-70">({parseConfidence.score}%)</span>}
                        </span>
                      </div>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-1.5">
                        {pendingSuggestion.district}{pendingSuggestion.thana ? `, ${pendingSuggestion.thana}` : ""}
                        {pendingSuggestion.area ? `, ${pendingSuggestion.area}` : ""}
                      </p>
                      {parseConfidence?.details && (
                        <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mb-1.5 opacity-70">{parseConfidence.details}</p>
                      )}
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 border-green-400 text-green-700 hover:bg-green-50"
                          onClick={() => {
                            applyParsedAddress({ ...pendingSuggestion, source: "local" });
                            setPendingSuggestion(null);
                            toast.success(t("✅ ঠিকানা প্রয়োগ করা হয়েছে", "✅ Address applied"));
                          }}
                        >
                          <Check className="w-3 h-3 mr-0.5" />
                          {t("ঠিক আছে", "Apply")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 border-red-400 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setPendingSuggestion(null);
                            setParseConfidence(null);
                          }}
                        >
                          <X className="w-3 h-3 mr-0.5" />
                          {t("ম্যানুয়াল করবো", "Manual")}
                        </Button>


                      </div>
                    </div>
                  )}
                  <div className="relative">
                    <Textarea
                      value={address}
                      onChange={(e) => { fieldsUserChangedRef.current = true; setAddress(e.target.value); }}
                      placeholder={t("সম্পূর্ণ ঠিকানা", "Full address")}
                      className="w-full min-h-[40px] pr-9 text-sm resize-y"
                    />


                  </div>

                </div>
                {/* District, Thana, Delivery Area - single row */}
                <div className="col-span-1 sm:col-span-2 grid grid-cols-[1fr_1fr_1.5fr] gap-2">
                  <div>
                    <Label className="text-xs">{t("জেলা", "District")}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className={cn("h-9 w-full justify-between text-sm font-normal", !district && "text-muted-foreground")}>
                          {district || t("জেলা", "District")}
                          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command filter={(value, search) => {
                          const s = search.toLowerCase();
                          // Match Bengali text
                          if (value.toLowerCase().includes(s)) return 1;
                          // Match Banglish via transliteration
                          for (const [eng, bn] of Object.entries(englishToBanglaDistrict)) {
                            if (bn === value && eng.includes(s)) return 1;
                          }
                          return 0;
                        }}>
                          <CommandInput placeholder={t("জেলা খুঁজুন...", "Search district...")} className="h-8 text-sm" />
                          <CommandList>
                            <CommandEmpty>{t("পাওয়া যায়নি", "Not found")}</CommandEmpty>
                            {districts.map((d) => (
                              <CommandItem key={d} value={d} onSelect={() => { fieldsUserChangedRef.current = true; setDistrict(d); setThana(""); }}>
                                {d}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs">{t("থানা", "Thana")}</Label>
                    <Select value={thana} onValueChange={(v) => { fieldsUserChangedRef.current = true; setThana(v); }} disabled={!district}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={t("থানা", "Thana")} />
                      </SelectTrigger>
                      <SelectContent>
                        {getThanas(district).map((th) => (
                          <SelectItem key={th} value={th}>{th}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t("এরিয়া", "Area")}</Label>
                    <Input value={deliveryArea} onChange={(e) => { fieldsUserChangedRef.current = true; setDeliveryArea(e.target.value); }} placeholder={t("এলাকা", "Area")} className="h-9" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Area 2+3: Order Items & Product Picker side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Area 2: Ordered Items */}
            <Card className="border-border/70 shadow-sm overflow-hidden">
              <CardHeader className="pb-2 border-b border-border/60 bg-muted/30">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="inline-block w-1 h-4 rounded-full bg-primary" />{t("অর্ডারকৃত পণ্য", "Ordered Items")}</span>
                  <span className="text-xs text-muted-foreground font-normal">{items.length} {t("আইটেম", "items")} · {items.reduce((s, i) => s + i.quantity, 0)} {t("পিস", "pcs")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-auto max-h-[400px] overflow-auto">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Package className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm">{t("কোনো পণ্য যোগ হয়নি", "No products added")}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {items.map((item) => (
                        <div key={item.product_id} className="flex items-center gap-3 p-3 group">
                          {item.product_image ? (
                            <img src={item.product_image} alt="" className="w-14 h-14 rounded-lg border border-border object-cover flex-shrink-0 cursor-pointer" onDoubleClick={() => setProductDetailId(item.product_id)} />
                          ) : (
                            <div className="w-14 h-14 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0 cursor-pointer" onDoubleClick={() => setProductDetailId(item.product_id)}>
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 mr-auto">
                            <p className="text-sm font-medium line-clamp-2 leading-tight">{item.product_name}</p>
                            {editingPriceId === item.product_id ? (
                              <Input
                                type="number"
                                autoFocus
                                className="h-5 w-20 text-[11px] px-1 py-0 border-primary"
                                value={editingPriceValue}
                                onChange={(e) => setEditingPriceValue(e.target.value)}
                                onBlur={() => {
                                  const val = parseFloat(editingPriceValue);
                                  if (!isNaN(val) && val >= 0) {
                                    setItems(items.map(i => i.product_id === item.product_id ? { ...i, unit_price: val } : i));
                                  }
                                  setEditingPriceId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") setEditingPriceId(null);
                                }}
                              />
                            ) : (
                              <p
                                className="text-[11px] text-muted-foreground cursor-pointer hover:text-primary hover:underline transition-colors"
                                onDoubleClick={() => {
                                  setEditingPriceId(item.product_id);
                                  setEditingPriceValue(String(item.unit_price));
                                }}
                                title={t("ডাবল ক্লিক করে দাম পরিবর্তন করুন", "Double-click to edit price")}
                              >
                                ৳{item.unit_price}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center bg-muted/60 rounded-full border border-border">
                            <button
                              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                              onClick={() => updateItemQty(item.product_id, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => setItemQty(item.product_id, parseInt(e.target.value, 10))}
                              onFocus={(e) => e.target.select()}
                              className="text-xs font-bold w-9 text-center bg-transparent outline-none focus:ring-1 focus:ring-primary rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={() => updateItemQty(item.product_id, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-xs font-bold text-primary w-14 text-right">৳{item.unit_price * item.quantity}</span>
                          <button
                            className="h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                            onClick={() => removeItem(item.product_id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Area 3: Product Picker */}
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mt-1">
                  {/* Search - expands when active, icon when collapsed */}
                  {pickerMode === "search" ? (
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder={t("পণ্য খুঁজুন...", "Search products...")}
                        className="pl-8 h-8 text-xs"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setPickerMode("search"); setSelectedCategory(null); setSelectedTag(null); }}
                      className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
                      title={t("সার্চ", "Search")}
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Category - dropdown when active, icon when collapsed */}
                  {pickerMode === "category" ? (
                    <Select open={catDropdownOpen} onOpenChange={setCatDropdownOpen} value={selectedCategory || ""} onValueChange={(v) => { setSelectedCategory(v || null); setCatDropdownOpen(false); }}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <div className="flex items-center gap-1.5">
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <SelectValue placeholder={t("ক্যাটাগরি বাছুন", "Select category")} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {pickerCategories?.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <button
                      onClick={() => { setPickerMode("category"); setProductSearch(""); setSelectedTag(null); setTagDropdownOpen(false); setTimeout(() => setCatDropdownOpen(true), 100); }}
                      className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
                      title={t("ক্যাটাগরি", "Category")}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Tag - dropdown when active, icon when collapsed */}
                  {pickerMode === "tag" ? (
                    <Select open={tagDropdownOpen} onOpenChange={setTagDropdownOpen} value={selectedTag || ""} onValueChange={(v) => { setSelectedTag(v || null); setTagDropdownOpen(false); }}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <div className="flex items-center gap-1.5">
                          <TagIcon className="w-3.5 h-3.5" />
                          <SelectValue placeholder={t("ট্যাগ বাছুন", "Select tag")} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {pickerTags?.map((tag) => (
                          <SelectItem key={tag} value={tag} className="text-xs">{tag}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <button
                      onClick={() => { setPickerMode("tag"); setProductSearch(""); setSelectedCategory(null); setCatDropdownOpen(false); setTimeout(() => setTagDropdownOpen(true), 100); }}
                      className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
                      title={t("ট্যাগ", "Tag")}
                    >
                      <TagIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[420px]">
                  <div className="divide-y divide-border">
                    {products?.map((product) => {
                      const price = product.offer_price || product.regular_price;
                      const inOrder = items.some((i) => i.product_id === product.id);
                      const orderQty = items.find((i) => i.product_id === product.id)?.quantity || 0;
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${inOrder ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                          onClick={() => addProduct(product)}
                        >
                          {product.product_image ? (
                            <img src={product.product_image} alt="" className="w-12 h-12 rounded-lg border border-border object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0">
                              <Package className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium line-clamp-1">{product.name}</p>
                            <p className="text-[11px] text-muted-foreground">৳{price} · {product.stock} in stock</p>
                          </div>
                          {inOrder ? (
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
                              ✓ {orderQty}
                            </span>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary flex-shrink-0">
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Bottom bar: Pricing + Actions - Sticky */}
          <Card className="sticky bottom-0 z-10 shadow-lg border-t bg-card/80 backdrop-blur-md">
            <CardContent className="p-4 space-y-3">
              {/* Pricing Summary */}
              <div className="grid grid-cols-5 divide-x divide-border text-center">
                <PricingRow label={t("সাবটোটাল", "Subtotal")} value={subtotal} />
                <PricingRow
                  label={t("ডিসকাউন্ট", "Discount")}
                  value={discount}
                  negative
                  fieldKey="discount"
                  editingField={editingField}
                  editingFieldValue={editingFieldValue}
                  setEditingField={setEditingField}
                  setEditingFieldValue={setEditingFieldValue}
                  onSave={(val) => setDiscount(val)}
                />
                <PricingRow
                  label={t("অগ্রিম", "Advance")}
                  value={advance}
                  negative
                  fieldKey="advance"
                  editingField={editingField}
                  editingFieldValue={editingFieldValue}
                  setEditingField={setEditingField}
                  setEditingFieldValue={setEditingFieldValue}
                  onSave={(val) => setAdvance(val)}
                />
                <PricingRow
                  label={t("ডেলিভারি", "Delivery")}
                  value={deliveryCharge}
                  fieldKey="delivery"
                  editingField={editingField}
                  editingFieldValue={editingFieldValue}
                  setEditingField={setEditingField}
                  setEditingFieldValue={setEditingFieldValue}
                  onSave={(val) => setDeliveryChargeOverride(val)}
                />
                <div className="flex flex-col items-center justify-center py-2">
                  <span className="text-[10px] text-muted-foreground leading-none">{t("মোট", "Total")}</span>
                  <span className="text-xl font-bold text-primary mt-0.5">৳{totalAmount}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3">
                <Select value={status} onValueChange={(val) => {
                  if (val === "pre") {
                    setStatus("pre");
                    setPreDateValue("");
                    return;
                  }
                  setStatus(val);
                }}>
                  <SelectTrigger className={`w-14 h-11 text-xs font-semibold border-2 rounded-xl ${statusInfo.color} [&>span]:hidden`}>
                    <StatusIcon className="w-5 h-5" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeStatusOptions.map((s) => {
                      const SIcon = s.icon;
                      return (
                        <SelectItem key={s.value} value={s.value}>
                          <div className="flex items-center gap-2">
                            <SIcon className="w-3.5 h-3.5" />
                            {t(s.labelBn, s.label)}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {status === "pre" ? (
                  <div className="flex items-center h-11 rounded-xl border-2 overflow-hidden shadow-sm bg-violet-100 border-violet-200">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="h-full px-4 flex items-center gap-2 text-sm font-semibold text-violet-800 hover:bg-violet-200 transition-colors border-r border-violet-300">
                          <CalendarClock className="w-4 h-4" />
                          {preDateValue
                            ? format(new Date(preDateValue + "T00:00:00"), "d MMMM")
                            : t("তারিখ", "Date")}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center">
                        <Calendar
                          mode="single"
                          selected={preDateValue ? new Date(preDateValue + "T00:00:00") : undefined}
                          onSelect={(date) => {
                            if (date) {
                              setPreDateValue(format(date, "yyyy-MM-dd"));
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <button
                      className="h-full px-6 flex items-center gap-2 text-sm font-bold text-violet-800 hover:bg-violet-200 transition-colors"
                      disabled={saving}
                      onClick={async () => {
                        if (!preDateValue) {
                          toast.error(t("আগে তারিখ সিলেক্ট করুন", "Please select a date first"));
                          return;
                        }
                        if (!isNew && order) {
                          await supabase.from("orders").update({ pre_date: preDateValue } as any).eq("id", order.id);
                        }
                        handleSave("pre", true);
                      }}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-5 h-5" />}
                      Pre
                    </button>
                  </div>
                ) : (
                  <Button
                    className={`h-11 w-56 text-sm font-bold gap-2 rounded-xl border-2 shadow-sm ${statusInfo.color} hover:opacity-90 hover:shadow-md transition-all`}
                    variant="outline"
                    disabled={saving}
                    onClick={() => handleSave(status, true)}
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <StatusIcon className="w-5 h-5" />}
                    {t(statusInfo.labelBn, statusInfo.label)}
                  </Button>
                )}

                {/* Manual Save button removed — auto-save handles all field changes silently */}

                <CourierEntrySettingsPopover order={order} />

                {/* Delete button for cancelled orders */}
                {!isNew && (savedStatus === "cancelled" || savedStatus === "order_cancelled") && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-11 w-11 rounded-xl border-2 flex-shrink-0"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        // Soft-delete only — DO NOT touch status. Status must remain unchanged when deleting.
                        await supabase.from("orders").update({
                          is_deleted: true,
                        } as any).eq("id", order!.id);
                        toast.success(t("অর্ডার ডিলিট হয়েছে", "Order deleted"));
                        queryClient.invalidateQueries({ queryKey: ["web-orders"] });
                        queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
                        queryClient.invalidateQueries({ queryKey: ["deleted-orders"] });
                        navigate(-1);
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    title={t("ডিলিট", "Delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Area 6: Fraud Check + Customer Profile Sidebar */}
        {sidebarCollapsed ? (
          <div className="fixed right-3 top-20 z-30 hidden lg:block">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full shadow-lg border-border bg-background"
              onClick={() => setSidebarCollapsed(false)}
              title={t("প্রোফাইল সাইডবার খুলুন", "Open profile sidebar")}
            >
              <PanelRightOpen className="w-4 h-4" />
            </Button>
          </div>
        ) : null}
        <div className={cn("space-y-3", sidebarCollapsed && "hidden lg:hidden")}>
          {/* Fraud Check Card - Above Profile */}
          {phone && phone.length >= 11 && (fraudData || fraudLoading) && (
            <Card className="h-fit">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {t("ফ্রড চেক", "Fraud Check")}
                  </span>
                  <button
                    onClick={handleFraudForceRefresh}
                    disabled={fraudRefreshing}
                    className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                    title={t("রিচেক করুন", "Recheck")}
                  >
                    <RotateCcw className={cn("w-3.5 h-3.5 text-muted-foreground", fraudRefreshing && "animate-spin")} />
                  </button>
                </div>
                {fraudLoading && !fraudData && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground ml-1">{t("ফ্রড চেক হচ্ছে...", "Checking fraud...")}</span>
                  </div>
                )}
                {fraudData && <FraudResultCard data={fraudData} compact />}
              </CardContent>
            </Card>
          )}

          {/* Phone Order History */}
          {phoneOrders && phoneOrders.length > 0 && (
            <Card className="h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {t("অর্ডার হিস্ট্রি", "Order History")} <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{phoneOrders.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {phoneOrders.slice(0, showAllPhoneOrders ? undefined : 3).map((o: any) => {
                  const si = getStatusInfo(o.status);
                  return (
                    <div
                      key={o.id}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border cursor-pointer transition-colors ${o.order_id === id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"}`}
                      onClick={() => navigate(`/admin/orders/edit/${o.order_id}`)}
                    >
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono font-bold">{o.order_id}</span>
                        <Badge className={`text-[9px] px-1.5 py-0 ${si.color}`}>{si.labelBn || si.label}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        ৳{o.total_amount} · {format(new Date(o.created_at), "dd/MM")}
                      </div>
                    </div>
                  );
                })}
                {phoneOrders.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPhoneOrders(!showAllPhoneOrders)}
                    className="w-full flex items-center justify-center gap-1 text-[10px] text-primary hover:text-primary/80 py-1 transition-colors"
                  >
                    {showAllPhoneOrders ? t("কম দেখুন", "Show less") : t(`আরও ${phoneOrders.length - 3}টি দেখুন`, `Show ${phoneOrders.length - 3} more`)}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showAllPhoneOrders ? "rotate-180" : ""}`} />
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Admin Creator Badge */}
          {!isNew && (order as any)?.created_by_admin_id && (
            <Card className="h-fit">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2 text-xs">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Created by <span className="font-semibold text-foreground">{creatorAdmin?.name || "Admin"}</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duplicate Order Warning */}
          {duplicateWarnings && duplicateWarnings.length > 0 && (
            <Card className="h-fit border-amber-300 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                  {t("⚠️ ডুপ্লিকেট অর্ডার সতর্কতা", "⚠️ Duplicate Order Warning")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {duplicateWarnings.map((warning: any, wi: number) => (
                  <div key={wi}>
                    <p className="text-[10px] font-semibold text-amber-800 mb-1.5">
                      {warning.type === "phone"
                        ? t("একই ফোন নম্বর থেকে ৪৮ ঘণ্টায়:", "Same phone in 48h:")
                        : t("একই ডিভাইস থেকে ৪৮ ঘণ্টায়:", "Same device in 48h:")}
                    </p>
                    {warning.orders.map((o: any) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between bg-white/80 rounded-lg px-2.5 py-1.5 mb-1 border border-amber-200 cursor-pointer hover:bg-amber-100/50 transition-colors"
                        onClick={() => navigate(`/admin/orders/${o.id}`)}
                      >
                        <div className="text-[10px]">
                          <span className="font-mono font-bold text-amber-900">{o.order_id}</span>
                          <span className="text-muted-foreground ml-1.5">{o.customer_name}</span>
                          {warning.type === "device" && o.phone && (
                            <span className="text-muted-foreground ml-1">({o.phone})</span>
                          )}
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {format(new Date(o.created_at), "dd/MM HH:mm")}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Visitor/Device Data Card - Always show when order exists */}
          {!isNew && (
            <Card className="h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" />
                  {t("ডিভাইস ও ভিজিটর তথ্য", "Device & Visitor Info")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {visitorData ? (
                  <div className="space-y-2 text-xs">
                    {/* Traffic Source */}
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{t("সোর্স", "Source")}</span>
                      <SourceBadge source={(visitorData as any).traffic_source || (order as any)?.traffic_source} createdByAdminId={(order as any)?.created_by_admin_id} className="ml-auto" />
                    </div>
                    <div className="flex items-start gap-2">
                      <Fingerprint className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">{t("ফিঙ্গারপ্রিন্ট", "Fingerprint")}</span>
                        <p className="font-mono text-[10px] font-medium break-all">{visitorData.fingerprint}</p>
                      </div>
                    </div>
                    {visitorData.ip_addresses && visitorData.ip_addresses.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-muted-foreground">{t("আইপি এড্রেস", "IP Addresses")}</span>
                          <div className="space-y-1 mt-0.5">
                            {visitorData.ip_addresses.map((ip: string, i: number) => (
                              <div key={i} className="flex items-center justify-between gap-1">
                                <span className="font-mono text-[10px] font-medium">{ip}</span>
                                {ipGeoData?.[ip] && (
                                  <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    📍 {ipGeoData[ip]}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Rich device / browser / app context */}
                    {(visitorData as any).user_agent && (() => {
                      const parsed = parseUserAgent((visitorData as any).user_agent);
                      if (!parsed) return null;
                      return (
                        <div className="space-y-1.5 pt-1 border-t border-border/60">
                          {/* Device type + model */}
                          <div className="flex items-start gap-2">
                            <Smartphone className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-muted-foreground">{t("ডিভাইস", "Device")}</span>
                              <p className="font-medium text-[11px] truncate">
                                {parsed.deviceModel || parsed.deviceType}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                              {parsed.deviceType}
                            </Badge>
                          </div>
                          {/* OS */}
                          {parsed.os && (
                            <div className="flex items-center gap-2">
                              <Monitor className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground">{t("OS", "OS")}</span>
                              <span className="font-medium ml-auto text-[11px]">{parsed.os}</span>
                            </div>
                          )}
                          {/* Browser */}
                          {parsed.browser && (
                            <div className="flex items-center gap-2">
                              <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground">{t("ব্রাউজার", "Browser")}</span>
                              <span className="font-medium ml-auto text-[11px]">{parsed.browser}</span>
                            </div>
                          )}
                          {/* In-app webview */}
                          {parsed.inApp && (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                              <span className="text-muted-foreground">{t("ইন-অ্যাপ", "In-App")}</span>
                              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-200">
                                {parsed.inApp}
                              </Badge>
                            </div>
                          )}
                          {/* Full UA in tooltip / collapsible */}
                          <details className="group">
                            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              {t("পূর্ণ User-Agent", "Full User-Agent")}
                            </summary>
                            <p className="mt-1 font-mono text-[9px] text-muted-foreground bg-muted/40 p-1.5 rounded break-all leading-tight">
                              {parsed.raw}
                            </p>
                          </details>
                        </div>
                      );
                    })()}
                    {/* Referrer */}
                    {(visitorData as any).referrer_url && (
                      <div className="flex items-start gap-2 pt-1 border-t border-border/60">
                        <Link2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-muted-foreground">{t("রেফারার", "Referrer")}</span>
                          <p className="font-medium text-[10px] break-all">{(visitorData as any).referrer_url}</p>
                        </div>
                      </div>
                    )}
                    {/* UTM */}
                    {((visitorData as any).utm_source || (visitorData as any).utm_medium || (visitorData as any).utm_campaign) && (
                      <div className="grid grid-cols-3 gap-1 pt-1">
                        {(visitorData as any).utm_source && (
                          <div className="bg-muted/40 rounded p-1 text-center" title="utm_source">
                            <p className="text-[8px] text-muted-foreground uppercase">src</p>
                            <p className="text-[10px] font-medium truncate">{(visitorData as any).utm_source}</p>
                          </div>
                        )}
                        {(visitorData as any).utm_medium && (
                          <div className="bg-muted/40 rounded p-1 text-center" title="utm_medium">
                            <p className="text-[8px] text-muted-foreground uppercase">med</p>
                            <p className="text-[10px] font-medium truncate">{(visitorData as any).utm_medium}</p>
                          </div>
                        )}
                        {(visitorData as any).utm_campaign && (
                          <div className="bg-muted/40 rounded p-1 text-center" title="utm_campaign">
                            <p className="text-[8px] text-muted-foreground uppercase">camp</p>
                            <p className="text-[10px] font-medium truncate">{(visitorData as any).utm_campaign}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-foreground">{visitorData.total_visit_count || 0}</p>
                        <p className="text-[9px] text-muted-foreground">{t("মোট ভিজিট", "Total Visits")}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-foreground">
                          {visitorData.total_active_time_seconds > 3600
                            ? `${Math.round(visitorData.total_active_time_seconds / 3600)}h`
                            : visitorData.total_active_time_seconds > 60
                            ? `${Math.round(visitorData.total_active_time_seconds / 60)}m`
                            : `${visitorData.total_active_time_seconds}s`}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{t("মোট সময়", "Active Time")}</p>
                      </div>
                    </div>
                    {(visitorData as any).avg_page_load_ms != null && (
                      <div className="flex items-center gap-2">
                        <Timer className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">{t("গড় লোড টাইম", "Avg Load")}</span>
                        <span className="font-medium ml-auto">{((visitorData as any).avg_page_load_ms / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-muted-foreground">{t("প্রথম ভিজিট", "First Visit")}</span>
                      <span className="font-medium ml-auto">{format(new Date(visitorData.first_visit_at), 'dd/MM/yyyy')}</span>
                    </div>
                    {/* Ban/Unban Button */}
                    <div className="pt-2 border-t border-border">
                      <Button
                        variant={visitorData.access_allowed !== false ? "destructive" : "outline"}
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setBanConfirmVisitor({ id: visitorData.id, currentlyAllowed: visitorData.access_allowed !== false })}
                      >
                        {visitorData.access_allowed !== false ? (
                          <><Ban className="w-3.5 h-3.5 mr-1.5" />{t("ব্যান করুন", "Ban")}</>
                        ) : (
                          <><ShieldCheck className="w-3.5 h-3.5 mr-1.5" />{t("আনব্যান করুন", "Unban")}</>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                    <Monitor className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-[10px]">{t("ভিজিটর ডাটা পাওয়া যায়নি", "No visitor data found")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Customer Profile Card */}
          <Card className="h-fit">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">{t("কাস্টমার প্রোফাইল", "Customer Profile")}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground hidden lg:inline-flex"
                onClick={() => setSidebarCollapsed(true)}
                title={t("মিনিমাইজ", "Minimize")}
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {!phone || phone.length < 11 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <User className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-xs text-center">{t("ফোন নম্বর দিলে প্রোফাইল দেখা যাবে", "Enter phone to see profile")}</p>
                </div>
              ) : !customerProfile ? (
                <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                  <User className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-xs">{t("প্রোফাইল পাওয়া যায়নি", "No profile found")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Profile photo */}
                <div className="flex flex-col items-center">
                  {customerProfile.profile_picture ? (
                    <img src={customerProfile.profile_picture} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  {customerProfile.name && (
                    <p className="font-semibold text-sm mt-2">{customerProfile.name}</p>
                  )}
                  {customerProfile.user_type && (
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {customerProfile.user_type}
                    </span>
                  )}
                </div>

                {/* Quick stats */}
                {customerOrders && customerOrders.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-foreground">{customerOrders.length}</p>
                      <p className="text-[10px] text-muted-foreground">{t("অর্ডার", "Orders")}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-primary">৳{customerOrders.reduce((s, o) => s + o.total_amount, 0)}</p>
                      <p className="text-[10px] text-muted-foreground">{t("মোট", "Total")}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-green-600">{customerOrders.filter(o => o.status === 'confirmed').length}</p>
                      <p className="text-[10px] text-muted-foreground">{t("কনফার্ম", "Confirmed")}</p>
                    </div>
                  </div>
                )}

                {/* Profile data */}
                <div className="space-y-2 text-xs">
                  <ProfileRow label={t("ফোন", "Phone")} value={customerProfile.phone} />
                  {customerProfile.alt_phone && <ProfileRow label={t("বিকল্প", "Alt")} value={customerProfile.alt_phone} />}
                  {customerProfile.district && <ProfileRow label={t("জেলা", "District")} value={customerProfile.district} />}
                  {customerProfile.thana && <ProfileRow label={t("থানা", "Thana")} value={customerProfile.thana} />}
                  {customerProfile.address && <ProfileRow label={t("ঠিকানা", "Address")} value={customerProfile.address} />}
                  {customerProfile.gender && <ProfileRow label={t("লিঙ্গ", "Gender")} value={customerProfile.gender} />}
                  {/* Credit display removed */}
                </div>

                {/* Recent orders */}
                {customerOrders && customerOrders.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground">{t("সাম্প্রতিক অর্ডার", "Recent Orders")}</p>
                    <div className="space-y-1.5">
                      {customerOrders.slice(0, 5).map((o) => {
                        const si = getStatusInfo(o.status);
                        const SIcon = si.icon;
                        const isLocked = ['delivered', 'rtn_received', 'partial_delivered'].includes(o.status);
                        const isCurrent = o.order_id === id;
                        return (
                          <div
                            key={o.id}
                            className={`flex items-center gap-2 p-2 rounded-lg text-[11px] transition-colors ${isCurrent ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'} ${isLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}`}
                            onClick={() => {
                              if (isCurrent || isLocked) return;
                              navigate(`/admin/orders/edit/${o.order_id}`);
                            }}
                            title={isLocked ? t('এই অর্ডার এডিট করা যাবে না', 'This order cannot be edited') : ''}
                          >
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 ${si.color}`}>
                              <SIcon className="w-3 h-3" />
                            </span>
                            <span className="font-bold">{o.order_id}</span>
                            <span className="text-muted-foreground ml-auto">৳{o.total_amount}</span>
                            <span className="text-muted-foreground text-[10px]">{format(new Date(o.created_at), 'dd/MM')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
      {/* Product Detail Popup */}
      <Dialog open={!!productDetailId} onOpenChange={(open) => { if (!open) setProductDetailId(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{productDetail?.name || t("পণ্যের বিবরণ", "Product Details")}</DialogTitle>
            <DialogDescription className="sr-only">Product detail popup</DialogDescription>
          </DialogHeader>
          {productDetailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : productDetail ? (
            <div className="space-y-4">
              {/* Image */}
              {productDetail.product_image && (
                <img src={productDetail.product_image} alt={productDetail.name} className="w-full max-h-60 object-contain rounded-lg border border-border bg-muted" />
              )}

              {/* Name & Short Description */}
              <div>
                <h3 className="font-semibold text-foreground">{productDetail.name}</h3>
                {productDetail.short_description && (
                  <p className="text-sm text-muted-foreground mt-1">{productDetail.short_description}</p>
                )}
              </div>

              {/* Stock */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t("স্টক", "Stock")}:</span>
                <span className={`text-sm font-bold ${productDetail.stock > 0 ? "text-green-600" : "text-destructive"}`}>
                  {productDetail.stock}
                </span>
              </div>

              {/* All Prices */}
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("মূল্য তালিকা", "Price List")}</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">{t("রেগুলার", "Regular")}</span>
                  <span className="font-medium text-right">৳{productDetail.regular_price}</span>

                  {productDetail.offer_price != null && (
                    <>
                      <span className="text-muted-foreground">{t("অফার", "Offer")}</span>
                      <span className="font-medium text-right text-primary">৳{productDetail.offer_price}</span>
                    </>
                  )}
                  {productDetail.buying_price != null && (
                    <>
                      <span className="text-muted-foreground">{t("ক্রয়মূল্য", "Buying")}</span>
                      <span className="font-medium text-right">৳{productDetail.buying_price}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Full Description */}
              {productDetail.full_description && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("বিবরণ", "Description")}</h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{productDetail.full_description}</p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Ban Confirmation Dialog */}
      <AlertDialog open={!!banConfirmVisitor} onOpenChange={() => setBanConfirmVisitor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {banConfirmVisitor?.currentlyAllowed ? <Ban className="w-5 h-5 text-destructive" /> : <ShieldCheck className="w-5 h-5 text-green-600" />}
              {banConfirmVisitor?.currentlyAllowed ? t("ব্যান নিশ্চিত করুন", "Confirm Ban") : t("আনব্যান নিশ্চিত করুন", "Confirm Unban")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {banConfirmVisitor?.currentlyAllowed
                ? t("এই ইউজারকে ব্যান করলে সে আর সাইটে প্রবেশ বা অর্ডার করতে পারবে না। আপনি কি নিশ্চিত?", "Banning this user will block site access and ordering. Are you sure?")
                : t("আনব্যান করলে এই ইউজার আবার সাইটে প্রবেশ ও অর্ডার করতে পারবে।", "Unbanning will restore site access and ordering.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("বাতিল", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={banConfirmVisitor?.currentlyAllowed ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={async () => {
                if (!banConfirmVisitor) return;
                const newVal = !banConfirmVisitor.currentlyAllowed;
                const { error } = await supabase.from("visitors").update({ access_allowed: newVal }).eq("id", banConfirmVisitor.id);
                if (error) { toast.error(error.message); return; }
                toast.success(newVal ? t("আনব্যান করা হয়েছে", "Unbanned") : t("ব্যান করা হয়েছে", "Banned"));
                queryClient.invalidateQueries({ queryKey: ["order"] });
                setBanConfirmVisitor(null);
              }}
            >
              {banConfirmVisitor?.currentlyAllowed ? t("ব্যান করুন", "Ban") : t("আনব্যান করুন", "Unban")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {customerProfile && (
        <CreditHistoryDialog
          open={creditHistoryOpen}
          onOpenChange={setCreditHistoryOpen}
          profileId={customerProfile.id}
          creditBalance={0}
          adminView
        />
      )}

    </div>
  );
}


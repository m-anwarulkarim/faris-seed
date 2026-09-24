import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadPageBuilderFonts } from "@/lib/lazyFonts";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { getCurrentAdminAccess } from "@/lib/adminAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { MediaPickerDialog } from "@/components/admin/MediaPickerDialog";
import { MemoizedBlockRenderer, buildStyleObj, type Block } from "@/pages/CustomPageView";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, DragOverlay, useDraggable, useDroppable, type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Eye, EyeOff, Save, Type, Image as ImageIcon,
  MousePointerClick, ShoppingBag, Video, Minus, Star, LayoutTemplate, Sparkles,
  MoveUp, MoveDown, Package, PanelLeftClose, PanelRightClose, X,
  Loader2, Upload, Paintbrush, Monitor, Smartphone, Undo2, Redo2, Columns,
  Clock, MessageSquareQuote, HelpCircle, Grid3X3, Images, Megaphone, TrendingUp,
  Space, Code, TableProperties, CreditCard, Mail, MapPin, Copy, Search,
  Palette, PenTool, Move, Square, Ruler, Wand2, Settings2, ChevronDown, GripHorizontal, RotateCcw,
  List, Clipboard,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import defaultAppleImg from "@/assets/default-apple.webp";
import {
  FeaturesEditor, TestimonialEditor, FaqEditor, GalleryEditor,
  ImageSliderEditor, SocialProofEditor, ComparisonEditor, PricingEditor,
} from "./page-editor/editors";

const BLOCK_TYPES = [
  { type: "hero", label: "হিরো ব্যানার", icon: Sparkles, desc: "বড় ব্যাকগ্রাউন্ড + শিরোনাম" },
  { type: "heading", label: "হেডিং", icon: Type, desc: "H1-H4 শিরোনাম" },
  { type: "paragraph", label: "প্যারাগ্রাফ", icon: Type, desc: "সাধারণ টেক্সট/প্যারাগ্রাফ" },
  { type: "text", label: "টেক্সট (হেডিং+বডি)", icon: Type, desc: "হেডিং + প্যারাগ্রাফ একসাথে" },
  { type: "image", label: "ছবি", icon: ImageIcon, desc: "ফুল/হাফ উইডথ ছবি" },
  { type: "button", label: "বাটন", icon: MousePointerClick, desc: "CTA বাটন + লিংক" },
  { type: "product", label: "প্রোডাক্ট", icon: ShoppingBag, desc: "প্রোডাক্ট কার্ড" },
  { type: "video", label: "ভিডিও", icon: Video, desc: "YouTube/Facebook" },
  { type: "features", label: "ফিচার গ্রিড", icon: Star, desc: "ইমোজি + টেক্সট গ্রিড" },
  { type: "divider", label: "ডিভাইডার", icon: Minus, desc: "হরাইজন্টাল লাইন" },
  { type: "countdown", label: "কাউন্টডাউন", icon: Clock, desc: "টাইমার / অফার শেষ" },
  { type: "testimonial", label: "রিভিউ/টেস্টিমোনিয়াল", icon: MessageSquareQuote, desc: "গ্রাহক মতামত" },
  { type: "faq", label: "FAQ", icon: HelpCircle, desc: "প্রশ্ন-উত্তর অ্যাকর্ডিয়ন" },
  { type: "product-grid", label: "প্রোডাক্ট গ্রিড", icon: Grid3X3, desc: "একাধিক পণ্য গ্রিড" },
  { type: "gallery", label: "ইমেজ গ্যালারি", icon: Images, desc: "মাল্টি-ইমেজ গ্রিড" },
  { type: "banner", label: "ব্যানার/অ্যানাউন্সমেন্ট", icon: Megaphone, desc: "টপ ব্যানার বার" },
  { type: "social-proof", label: "সোশ্যাল প্রুফ", icon: TrendingUp, desc: "সংখ্যা কাউন্টার" },
  { type: "spacer", label: "স্পেসার", icon: Space, desc: "ফাঁকা জায়গা" },
  { type: "html", label: "HTML/কোড", icon: Code, desc: "কাস্টম HTML embed" },
  { type: "comparison", label: "তুলনা টেবিল", icon: TableProperties, desc: "ফিচার তুলনা" },
  { type: "pricing", label: "প্রাইসিং টেবিল", icon: CreditCard, desc: "প্ল্যান/মূল্য তালিকা" },
  { type: "contact-form", label: "কন্ট্যাক্ট ফর্ম", icon: Mail, desc: "যোগাযোগ ফর্ম" },
  { type: "map", label: "ম্যাপ", icon: MapPin, desc: "Google Maps embed" },
  { type: "columns", label: "মাল্টি-কলাম", icon: Columns, desc: "পাশাপাশি ২-৪ কলাম" },
  { type: "flex-container", label: "ফ্লেক্স কন্টেইনার", icon: LayoutTemplate, desc: "নেস্টেড ফ্লেক্সবক্স লেআউট" },
  { type: "grid-container", label: "গ্রিড কন্টেইনার", icon: Grid3X3, desc: "নেস্টেড গ্রিড লেআউট" },
  { type: "image-slider", label: "ইমেজ স্লাইডার", icon: Images, desc: "অটো স্লাইডিং ইমেজ ক্যারোসেল" },
  { type: "checkout-form", label: "চেকআউট ফর্ম", icon: ShoppingBag, desc: "সরাসরি অর্ডার ফর্ম" },
] as const;

type SavedTemplate = { name: string; blocks: Block[] };
const TEMPLATES_KEY = "page-builder-templates";
function loadTemplates(): SavedTemplate[] {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"); } catch { return []; }
}
function persistTemplates(t: SavedTemplate[]) { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)); }

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

/* ====== Draggable Palette Item ====== */
function PaletteItem({ bt, onClick }: { bt: typeof BLOCK_TYPES[number]; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${bt.type}`,
    data: { fromPalette: true, blockType: bt.type },
  });
  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-accent/50 transition-colors group",
        isDragging && "opacity-40"
      )}
    >
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0" onClick={(e) => e.stopPropagation()}>
        <GripHorizontal className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      </span>
      <bt.icon className="w-4 h-4 text-primary shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{bt.label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{bt.desc}</p>
      </div>
    </button>
  );
}

/* ====== Sortable Outline Item ====== */
function SortableOutlineItem({ block, idx, isSelected, onSelect, onDelete, onDuplicate, onToggleHidden }: {
  block: Block; idx: number; isSelected: boolean; onSelect: () => void;
  onDelete: () => void; onDuplicate: () => void; onToggleHidden: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const bt = BLOCK_TYPES.find(b => b.type === block.type);
  const isHidden = !!block.data?._hidden;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            "flex items-center gap-1 px-1.5 py-1.5 rounded text-[10px] transition-colors",
            isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/50 text-foreground"
          )}
        >
          <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0" onClick={(e) => e.stopPropagation()}>
            <GripVertical className="w-3 h-3 text-muted-foreground/50" />
          </span>
          <button onClick={onSelect} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
            <span className="text-[8px] text-muted-foreground w-3 text-right shrink-0">{idx + 1}</span>
            {bt ? <bt.icon className="w-3 h-3 shrink-0" /> : null}
            <span className="truncate flex-1">
              {block.data.title || block.data.heading || block.data.text || bt?.label || block.type}
            </span>
            {isHidden && <EyeOff className="w-3 h-3 text-amber-500 shrink-0" />}
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        <ContextMenuItem onClick={onDuplicate} className="text-xs gap-2">
          <Copy className="w-3.5 h-3.5" /> ডুপ্লিকেট
        </ContextMenuItem>
        <ContextMenuItem onClick={onToggleHidden} className="text-xs gap-2">
          {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {isHidden ? "দেখাও" : "লুকাও"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete} className="text-xs gap-2 text-destructive focus:text-destructive">
          <Trash2 className="w-3.5 h-3.5" /> ডিলিট
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
/* ====== Sortable Block Wrapper ====== */
function SortableBlock({ block, index, totalBlocks, isSelected, onSelect, onMoveUp, onMoveDown, onDuplicate, onRemove, onToggleHidden }: {
  block: Block; index: number; totalBlocks: number; isSelected: boolean;
  onSelect: () => void; onMoveUp: () => void; onMoveDown: () => void; onDuplicate: () => void; onRemove: () => void; onToggleHidden: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined };
  const isHidden = !!block.data?._hidden;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "relative transition-all cursor-pointer group",
        isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-border",
        isHidden && "opacity-40"
      )}
    >
      {/* Hover toolbar */}
      <div className={cn(
        "absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-card/90 backdrop-blur rounded-md border border-border shadow-sm px-1 py-0.5 transition-opacity",
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <Badge variant="secondary" className="text-[8px] px-1 py-0 mr-1">
          {BLOCK_TYPES.find((bt) => bt.type === block.type)?.label || block.type}
        </Badge>
        {isHidden && <Badge variant="outline" className="text-[7px] px-1 py-0 mr-0.5 text-amber-600 border-amber-400">লুকানো</Badge>}
        {/* Drag handle */}
        <button {...attributes} {...listeners} className="h-5 w-5 flex items-center justify-center hover:bg-accent rounded cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
          <GripVertical className="w-2.5 h-2.5 text-muted-foreground" />
        </button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0}>
          <MoveUp className="w-2.5 h-2.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={index === totalBlocks - 1}>
          <MoveDown className="w-2.5 h-2.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onToggleHidden(); }} title={isHidden ? "দেখাও" : "লুকাও"}>
          {isHidden ? <EyeOff className="w-2.5 h-2.5 text-amber-600" /> : <Eye className="w-2.5 h-2.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
          <Copy className="w-2.5 h-2.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Trash2 className="w-2.5 h-2.5" />
        </Button>
      </div>

      {/* Live rendered block — pointer-events disabled to prevent navigation/clicks */}
      <div className="pointer-events-none">
        <MemoizedBlockRenderer block={block} />
      </div>
    </div>
  );
}

export default function PageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { addItem, items: cartItems, removeItem } = useCart();
  const isNew = !id;

  // Load page-builder fonts lazily
  useEffect(() => { loadPageBuilderFonts(); }, []);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [blocks, setBlocksRaw] = useState<Block[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [landingProducts, setLandingProducts] = useState<{ productId: string; autoCart: boolean }[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [customCss, setCustomCss] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [previewMode, setPreviewMode] = useState<"pc" | "mobile">("pc");
  const [paletteSearch, setPaletteSearch] = useState("");
  const [activeDragType, setActiveDragType] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>(loadTemplates);
  const [copiedBlock, setCopiedBlock] = useState<Block | null>(null);
  // AI builder removed

  // Undo/Redo history with debounce
  const historyRef = useRef<Block[][]>([[]]);
  const historyIdxRef = useRef(0);
  const skipHistoryRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setBlocks = useCallback((updater: Block[] | ((prev: Block[]) => Block[])) => {
    setBlocksRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!skipHistoryRef.current) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
          historyRef.current.push(JSON.parse(JSON.stringify(next)));
          historyIdxRef.current = historyRef.current.length - 1;
        }, 300);
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    skipHistoryRef.current = true;
    setBlocksRaw(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])));
    skipHistoryRef.current = false;
    toast.info("আনডু হয়েছে");
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    skipHistoryRef.current = true;
    setBlocksRaw(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])));
    skipHistoryRef.current = false;
    toast.info("রিডু হয়েছে");
  }, []);

  // Keyboard shortcuts for undo/redo + copy/paste/delete
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }

      // Copy block
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedBlockId) {
        const block = blocks.find(b => b.id === selectedBlockId);
        if (block) { setCopiedBlock(JSON.parse(JSON.stringify(block))); toast.success("ব্লক কপি হয়েছে"); }
      }
      // Paste block
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && copiedBlock) {
        e.preventDefault();
        const newBlock = { ...copiedBlock, id: generateId() };
        if (selectedBlockId) {
          const idx = blocks.findIndex(b => b.id === selectedBlockId);
          setBlocks(prev => { const n = [...prev]; n.splice(idx + 1, 0, newBlock); return n; });
        } else {
          setBlocks(prev => [...prev, newBlock]);
        }
        setSelectedBlockId(newBlock.id);
        toast.success("ব্লক পেস্ট হয়েছে");
      }
      // Delete block
      if (e.key === "Delete" && selectedBlockId) {
        removeBlock(selectedBlockId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, selectedBlockId, copiedBlock, blocks, setBlocks]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.fromPalette) {
      setActiveDragType(data.blockType);
    } else {
      setActiveDragType(null);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragType(null);

    if (active.data.current?.fromPalette) {
      // Palette → Canvas drop
      const blockType = active.data.current.blockType as Block["type"];
      const newBlock: Block = { id: generateId(), type: blockType, data: getDefaultData(blockType) };
      if (over) {
        const overIdx = blocks.findIndex((b) => b.id === over.id);
        if (overIdx >= 0) {
          setBlocks((prev) => { const next = [...prev]; next.splice(overIdx + 1, 0, newBlock); return next; });
        } else if (over.id === "canvas-drop-zone") {
          setBlocks((prev) => [...prev, newBlock]);
        } else {
          setBlocks((prev) => [...prev, newBlock]);
        }
      } else {
        setBlocks((prev) => [...prev, newBlock]);
      }
      setSelectedBlockId(newBlock.id);
      toast.success(`${BLOCK_TYPES.find(bt => bt.type === blockType)?.label || blockType} যোগ হয়েছে`);
      return;
    }

    // Existing block reorder
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const oldIdx = prev.findIndex((b) => b.id === active.id);
        const newIdx = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, [setBlocks, blocks]);
  // Auth check
  useEffect(() => {
    getCurrentAdminAccess().then((result) => {
      if (result.status !== "authorized") {
        navigate("/ecomah");
      } else {
        setAuthChecked(true);
      }
    });
  }, []);

  // Fetch page if editing
  useEffect(() => {
    if (!authChecked) return;
    if (isNew) { setLoading(false); return; }
    supabase.from("custom_pages").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) { navigate("/e/website/pages"); return; }
      setTitle(data.title);
      setSlug(data.slug);
      setIsPublished(data.is_published);
      try {
        const parsed = JSON.parse(data.content || "[]");
        if (Array.isArray(parsed)) {
          setBlocks(parsed);
        } else if (parsed && typeof parsed === "object") {
          setBlocks(Array.isArray(parsed.blocks) ? parsed.blocks : []);
          setLandingProducts(Array.isArray(parsed.landingProducts) ? parsed.landingProducts : []);
          if (parsed.customCss) setCustomCss(parsed.customCss);
        }
      } catch {
        setBlocks([]);
      }
      setLoading(false);
    });
  }, [id, authChecked]);

  // Fetch products
  useEffect(() => {
    if (!authChecked) return;
    supabase.from("products").select("id, name, product_image, regular_price, offer_price").eq("is_hidden", false).order("position").limit(100)
      .then(({ data }) => setProducts(data || []));
  }, [authChecked]);

  // Sync landing products to cart for preview
  useEffect(() => {
    if (!products.length || !landingProducts.length) return;
    const lpIds = new Set(landingProducts.map(lp => lp.productId));
    // Remove cart items that are no longer in landing products
    cartItems.forEach(ci => {
      if (!lpIds.has(ci.id)) removeItem(ci.id);
    });
    // Add missing landing products to cart
    landingProducts.forEach(lp => {
      const prod = products.find(p => p.id === lp.productId);
      if (prod && !cartItems.find(ci => ci.id === prod.id)) {
        const isFreeGift = !!(prod as any).unlock_threshold && (prod as any).unlock_threshold > 0;
        addItem({
          id: prod.id,
          name: prod.name,
          price: isFreeGift ? 0 : (prod.offer_price || prod.regular_price || 0),
          oldPrice: isFreeGift ? null : (prod.offer_price ? prod.regular_price : null),
          image: prod.product_image || "",
          unlockThreshold: isFreeGift ? (prod as any).unlock_threshold : null,
        });
      }
    });
  }, [landingProducts, products]);

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || null;

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) {
      toast.error("টাইটেল ও স্লাগ আবশ্যক");
      return;
    }
    setSaving(true);
    const finalSlug = slug.startsWith("/") ? slug : `/${slug}`;
    const content = JSON.stringify({ blocks, landingProducts, customCss: customCss || undefined });

    if (isNew) {
      const { error } = await supabase.from("custom_pages").insert({ title, slug: finalSlug, content, is_published: isPublished });
      if (error) toast.error(error.message);
      else { toast.success("পেজ তৈরি হয়েছে!"); navigate("/e/website/pages"); }
    } else {
      const { error } = await supabase.from("custom_pages").update({ title, slug: finalSlug, content, is_published: isPublished, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) toast.error(error.message);
      else toast.success("পেজ আপডেট হয়েছে!");
    }
    setSaving(false);
  };

  const addBlock = (type: Block["type"]) => {
    const newBlock: Block = { id: generateId(), type, data: getDefaultData(type) };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (blockId: string, data: Record<string, any>) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, data } : b)));
  };

  const removeBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const duplicateBlock = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const newBlock = { ...block, id: generateId(), data: { ...block.data } };
    const idx = blocks.findIndex(b => b.id === blockId);
    const newBlocks = [...blocks];
    newBlocks.splice(idx + 1, 0, newBlock);
    setBlocks(newBlocks);
    setSelectedBlockId(newBlock.id);
    toast.success("ব্লক ডুপ্লিকেট হয়েছে");
  };

  const toggleBlockHidden = (blockId: string) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, data: { ...b.data, _hidden: !b.data._hidden } } : b));
  };

  const insertBlockAt = (index: number) => {
    // Insert a text block at the given position
    const newBlock: Block = { id: generateId(), type: "text", data: getDefaultData("text") };
    setBlocks(prev => { const n = [...prev]; n.splice(index, 0, newBlock); return n; });
    setSelectedBlockId(newBlock.id);
  };

  const applyTemplate = (template: SavedTemplate) => {
    setBlocks(template.blocks.map((b) => ({ ...b, id: generateId() })));
    toast.success(`"${template.name}" টেমপ্লেট প্রয়োগ হয়েছে`);
  };

  const saveAsTemplate = () => {
    if (blocks.length === 0) return;
    const name = prompt("টেমপ্লেটের নাম দিন:");
    if (!name?.trim()) return;
    const updated = [...savedTemplates, { name: name.trim(), blocks: JSON.parse(JSON.stringify(blocks)) }];
    setSavedTemplates(updated);
    persistTemplates(updated);
    toast.success("টেমপ্লেট সেভ হয়েছে");
  };

  const deleteTemplate = (index: number) => {
    const updated = savedTemplates.filter((_, i) => i !== index);
    setSavedTemplates(updated);
    persistTemplates(updated);
    toast.success("টেমপ্লেট ডিলিট হয়েছে");
  };

  // handleAiBuild removed


  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ===== Top Toolbar ===== */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/e/website/pages")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (isNew) setSlug(`/${e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`);
            }}
            placeholder="পেজ টাইটেল"
            className="h-8 text-sm font-medium max-w-[200px]"
          />
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="/slug"
            className="h-8 text-xs max-w-[160px] text-muted-foreground hidden sm:block"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLeftOpen(!leftOpen)} title="ব্লক প্যালেট">
            <PanelLeftClose className={cn("w-4 h-4", !leftOpen && "opacity-40")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRightOpen(!rightOpen)} title="প্রোপার্টিজ">
            <PanelRightClose className={cn("w-4 h-4", !rightOpen && "opacity-40")} />
          </Button>

          <div className="flex items-center gap-1 mr-1">
            <Button variant={previewMode === "pc" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setPreviewMode("pc")} title="PC Preview">
              <Monitor className="w-4 h-4" />
            </Button>
            <Button variant={previewMode === "mobile" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setPreviewMode("mobile")} title="Mobile Preview">
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-0.5 mr-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} title="আনডু (Ctrl+Z)" disabled={historyIdxRef.current <= 0}>
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} title="রিডু (Ctrl+Y)" disabled={historyIdxRef.current >= historyRef.current.length - 1}>
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px h-5 bg-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground hidden sm:inline">প্রকাশিত</span>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} className="scale-90" />
          </div>

          {slug && isPublished && (
            <a href={slug} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button>
            </a>
          )}

          <Button onClick={handleSave} disabled={saving} size="sm" className="h-8 gap-1 text-xs">
            <Save className="w-3.5 h-3.5" /> {saving ? "..." : "সেভ"}
          </Button>
        </div>
      </div>

      {/* AI Prompt Panel removed */}

      {/* ===== Main 3-Panel Layout ===== */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL — Block Palette + Outline */}
        {leftOpen && (
          <div className="w-[220px] border-r border-border bg-card shrink-0 flex flex-col overflow-hidden">
            <Tabs defaultValue="palette" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="shrink-0 w-full rounded-none border-b border-border h-8 bg-transparent p-0">
                <TabsTrigger value="palette" className="flex-1 h-8 rounded-none text-[10px] data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <Plus className="w-3 h-3 mr-1" /> যোগ করুন
                </TabsTrigger>
                <TabsTrigger value="outline" className="flex-1 h-8 rounded-none text-[10px] data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <List className="w-3 h-3 mr-1" /> আউটলাইন {blocks.length > 0 && <span className="ml-1 text-[8px]">({blocks.length})</span>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="palette" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                <div className="px-2 py-1.5 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input
                      value={paletteSearch}
                      onChange={(e) => setPaletteSearch(e.target.value)}
                      placeholder="ব্লক খুঁজুন..."
                      className="h-7 text-[10px] pl-6 pr-2"
                    />
                    {paletteSearch && (
                      <button onClick={() => setPaletteSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 pt-0 space-y-1">
                    {BLOCK_TYPES.filter(bt => {
                      if (!paletteSearch.trim()) return true;
                      const q = paletteSearch.toLowerCase();
                      return bt.label.toLowerCase().includes(q) || bt.desc.toLowerCase().includes(q) || bt.type.toLowerCase().includes(q);
                    }).map((bt) => (
                      <PaletteItem key={bt.type} bt={bt} onClick={() => addBlock(bt.type as Block["type"])} />
                    ))}
                    {paletteSearch.trim() && BLOCK_TYPES.filter(bt => {
                      const q = paletteSearch.toLowerCase();
                      return bt.label.toLowerCase().includes(q) || bt.desc.toLowerCase().includes(q) || bt.type.toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-4">কোনো ব্লক পাওয়া যায়নি</p>
                    )}
                  </div>
                  {!paletteSearch.trim() && (
                    <div className="px-3 py-2 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">টেমপ্লেট</p>
                        {blocks.length > 0 && (
                          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] gap-1" onClick={saveAsTemplate}>
                            <Save className="w-3 h-3" /> সেভ
                          </Button>
                        )}
                      </div>
                      {savedTemplates.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-3">কোনো সেভ করা টেমপ্লেট নেই</p>
                      ) : (
                        <div className="space-y-1">
                          {savedTemplates.map((tmpl, i) => (
                            <div key={i} className="group flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors">
                              <button
                                onClick={() => applyTemplate(tmpl)}
                                className="flex-1 flex items-center gap-2 text-left min-w-0"
                              >
                                <LayoutTemplate className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <p className="text-[10px] font-medium text-foreground truncate">{tmpl.name}</p>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteTemplate(i); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="outline" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                <ScrollArea className="flex-1">
                  <div className="p-1.5 space-y-0.5">
                    {blocks.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-3">কোনো ব্লক নেই</p>
                    )}
                    <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                      {blocks.map((block, idx) => (
                        <SortableOutlineItem
                          key={block.id}
                          block={block}
                          idx={idx}
                          isSelected={selectedBlockId === block.id}
                          onSelect={() => setSelectedBlockId(block.id)}
                          onDelete={() => removeBlock(block.id)}
                          onDuplicate={() => duplicateBlock(block.id)}
                          onToggleHidden={() => toggleBlockHidden(block.id)}
                        />
                      ))}
                    </SortableContext>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* CENTER — Live Preview Canvas */}
        <div className="flex-1 overflow-auto bg-muted/30">
          <div className={cn(
            "mx-auto transition-all duration-300",
            previewMode === "mobile"
              ? "max-w-[375px] my-4 border border-border rounded-2xl shadow-xl bg-background overflow-hidden"
              : "w-full"
          )}>
            {/* Mobile frame top bar */}
            {previewMode === "mobile" && (
              <div className="h-6 bg-muted flex items-center justify-center">
                <div className="w-16 h-1 rounded-full bg-border" />
              </div>
            )}

            {/* Page-level style wrapper */}
            <div style={(() => {
              try {
                const s = JSON.parse(customCss || "{}");
                return buildStyleObj(s);
              } catch { return {}; }
            })()}>
              {blocks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <LayoutTemplate className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">কোনো ব্লক নেই</p>
                  <p className="text-[10px] text-muted-foreground">বাম পাশ থেকে ব্লক যোগ করুন বা টেমপ্লেট ব্যবহার করুন</p>
                </div>
              )}

              <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {/* + button before first block */}
                  <div className="group/insert relative h-0">
                    <button
                      onClick={() => insertBlockAt(0)}
                      className="absolute left-1/2 -translate-x-1/2 -top-2 z-20 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover/insert:opacity-100 hover:!opacity-100 transition-opacity shadow-md"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {blocks.map((block, index) => (
                    <React.Fragment key={block.id}>
                      <SortableBlock
                        block={block}
                        index={index}
                        totalBlocks={blocks.length}
                        isSelected={selectedBlockId === block.id}
                        onSelect={() => setSelectedBlockId(block.id)}
                        onMoveUp={() => moveBlock(index, "up")}
                        onMoveDown={() => moveBlock(index, "down")}
                        onDuplicate={() => duplicateBlock(block.id)}
                        onRemove={() => removeBlock(block.id)}
                        onToggleHidden={() => toggleBlockHidden(block.id)}
                      />
                      {/* + button between blocks */}
                      <div className="group/insert relative h-0">
                        <button
                          onClick={() => insertBlockAt(index + 1)}
                          className="absolute left-1/2 -translate-x-1/2 -top-2 z-20 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover/insert:opacity-100 hover:!opacity-100 transition-opacity shadow-md"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </React.Fragment>
                  ))}
                </SortableContext>
            </div>

            {/* Mobile frame bottom bar */}
            {previewMode === "mobile" && (
              <div className="h-5 bg-muted flex items-center justify-center">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Properties */}
        {rightOpen && (
          <div className="w-[280px] border-l border-border bg-card shrink-0 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              {selectedBlock ? (
                <div className="p-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      {BLOCK_TYPES.find(bt => bt.type === selectedBlock.type)?.label} সেটিংস
                    </p>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedBlockId(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <BlockEditor
                    block={selectedBlock}
                    onUpdate={(data) => updateBlock(selectedBlock.id, data)}
                    products={products}
                  />

                  {/* Block-level visual style */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Paintbrush className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">ব্লক স্টাইল</p>
                    </div>
                    <StyleControls
                      style={selectedBlock.data._style || {}}
                      onChange={(s) => updateBlock(selectedBlock.id, { ...selectedBlock.data, _style: s })}
                      blockType={selectedBlock.type}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 space-y-4">
                  <p className="text-xs text-muted-foreground text-center py-4">ব্লক সিলেক্ট করুন সেটিংস দেখতে</p>

                  {/* Landing Page Products */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-foreground">ল্যান্ডিং প্রোডাক্ট</p>
                      <span className="text-[9px] text-muted-foreground ml-auto">{landingProducts.length}টি</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Auto Cart চালু করলে ভিজিটর পেজে ঢুকলেই কার্টে যোগ হবে।</p>

                    {landingProducts.map((lp, idx) => {
                      const prod = products.find(p => p.id === lp.productId);
                      return (
                        <div key={lp.productId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                          {prod?.product_image && <img src={prod.product_image} className="w-7 h-7 rounded object-cover" alt="" />}
                          <span className="text-[10px] font-medium text-foreground flex-1 truncate">{prod?.name || "?"}</span>
                          <div className="flex items-center gap-1">
                            <Checkbox
                              checked={lp.autoCart}
                              onCheckedChange={(checked) => {
                                const updated = [...landingProducts];
                                updated[idx] = { ...updated[idx], autoCart: !!checked };
                                setLandingProducts(updated);
                              }}
                            />
                            <span className="text-[9px] text-muted-foreground">AC</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setLandingProducts(prev => prev.filter((_, i) => i !== idx))}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}

                    <Select value="" onValueChange={(productId) => {
                      if (!landingProducts.find(lp => lp.productId === productId)) {
                        setLandingProducts(prev => [...prev, { productId, autoCart: true }]);
                      }
                    }}>
                      <SelectTrigger className="h-8 text-[10px]">
                        <SelectValue placeholder="+ প্রোডাক্ট যোগ" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.filter(p => !landingProducts.find(lp => lp.productId === p.id)).map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Page-level visual style */}
                  <div className="space-y-2 border-t border-border pt-4">
                    <div className="flex items-center gap-1.5">
                      <Paintbrush className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">পেজ স্টাইল</p>
                    </div>
                    <StyleControls
                      style={(() => { try { return JSON.parse(customCss || "{}"); } catch { return {}; } })()}
                      onChange={(s) => setCustomCss(JSON.stringify(s))}
                    />
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

        {/* DragOverlay for palette items */}
        <DragOverlay dropAnimation={null}>
          {activeDragType && (() => {
            const bt = BLOCK_TYPES.find(b => b.type === activeDragType);
            if (!bt) return null;
            return (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-primary shadow-lg text-xs font-medium">
                <bt.icon className="w-4 h-4 text-primary" />
                {bt.label}
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ====== Visual Style Controls ====== */
const TEXT_BLOCKS = new Set(["heading", "paragraph", "text", "hero", "button", "banner", "testimonial", "faq", "pricing", "countdown", "social-proof", "comparison", "contact-form", "checkout-form"]);
const MEDIA_BLOCKS = new Set(["image", "gallery", "image-slider", "video"]);
const STRUCTURE_BLOCKS = new Set(["divider", "spacer"]);
const CONTAINER_BLOCKS = new Set(["flex-container", "grid-container", "columns"]);

function StyleControls({ style, onChange, blockType }: { style: Record<string, any>; onChange: (s: Record<string, any>) => void; blockType?: string }) {
  const set = (key: string, value: any) => onChange({ ...style, [key]: value });
  const reset = (key: string) => { const next = { ...style }; delete next[key]; onChange(next); };
  const has = (...keys: string[]) => keys.some(k => style[k] !== undefined && style[k] !== "" && style[k] !== "default");

  const bt = blockType || "";
  const showTypo = !bt || TEXT_BLOCKS.has(bt);
  const showObjectFit = !bt || MEDIA_BLOCKS.has(bt);
  const showListStyle = !bt || bt === "text" || bt === "paragraph";
  const showEffects = !STRUCTURE_BLOCKS.has(bt);

  const defaultOpen = CONTAINER_BLOCKS.has(bt) ? "layout" : "colors";
  const [openSection, setOpenSection] = useState<string | null>(defaultOpen);

  const toggle = (id: string) => setOpenSection(prev => prev === id ? null : id);

   const resetSection = (keys: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    const next = { ...style };
    keys.forEach(k => delete next[k]);
    onChange(next);
  };

  const SectionHeader = ({ id, icon: Icon, label, keys }: { id: string; icon: React.ComponentType<any>; label: string; keys: string[] }) => {
    const active = has(...keys);
    return (
      <button
        onClick={() => toggle(id)}
        className="flex items-center w-full gap-2 px-2 py-2 text-[11px] font-medium text-foreground hover:bg-accent/50 rounded-md transition-colors"
      >
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
        {active && (
          <span
            onClick={(e) => resetSection(keys, e)}
            className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors shrink-0"
            title="সব রিসেট"
          >
            <RotateCcw className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${openSection === id ? "rotate-180" : ""}`} />
      </button>
    );
  };

  const ResetBtn = ({ k }: { k: string }) => has(k) ? (
    <button onClick={() => reset(k)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0" title="রিসেট">
      <X className="w-3 h-3" />
    </button>
  ) : null;

  return (
    <div className="space-y-0.5">
      {/* 🎨 Colors */}
      <SectionHeader id="colors" icon={Palette} label="রং ও ব্যাকগ্রাউন্ড" keys={["color", "backgroundColor", "background"]} />
      {openSection === "colors" && (
        <div className="px-2 pb-2 space-y-2">
          {/* Quick Color Presets */}
          <div>
            <label className="text-[9px] text-muted-foreground mb-1 block">কুইক কালার</label>
            <div className="flex gap-1 flex-wrap">
              {["#000000", "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280"].map(c => (
                <button
                  key={c}
                  onClick={() => set("color", c)}
                  className={cn("w-5 h-5 rounded-full border border-border hover:scale-125 transition-transform", style.color === c && "ring-2 ring-primary ring-offset-1")}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <div><label className="text-[9px] text-muted-foreground mb-1 block">টেক্সট কালার</label><ColorField value={style.color} placeholder="#000000" onChange={(value) => set("color", value)} resetButton={<ResetBtn k="color" />} /></div>
          <div>
            <label className="text-[9px] text-muted-foreground mb-1 block">BG কুইক</label>
            <div className="flex gap-1 flex-wrap mb-1">
              {["#ffffff", "#f8fafc", "#f1f5f9", "#fef2f2", "#fff7ed", "#fefce8", "#f0fdf4", "#eff6ff", "#faf5ff", "#1e293b"].map(c => (
                <button
                  key={c}
                  onClick={() => set("backgroundColor", c)}
                  className={cn("w-5 h-5 rounded-full border border-border hover:scale-125 transition-transform", style.backgroundColor === c && "ring-2 ring-primary ring-offset-1")}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <div><label className="text-[9px] text-muted-foreground mb-1 block">ব্যাকগ্রাউন্ড</label><ColorField value={style.backgroundColor} placeholder="#ffffff" onChange={(value) => set("backgroundColor", value)} resetButton={<ResetBtn k="backgroundColor" />} /></div>
          <div>
            <div className="flex items-center justify-between"><label className="text-[9px] text-muted-foreground">গ্র্যাডিয়েন্ট</label><ResetBtn k="background" /></div>
            <Input value={style.background || ""} onChange={(e) => set("background", e.target.value)} placeholder="linear-gradient(135deg, #667eea, #764ba2)" className="h-7 text-[10px] mt-1" />
          </div>
        </div>
      )}

      {/* ✏️ Typography */}
      {showTypo && <SectionHeader id="typo" icon={Type} label="টাইপোগ্রাফি" keys={["fontFamily", "fontSize", "fontWeight", "textAlign", "textDecoration", "textTransform", "letterSpacing", "lineHeight"]} />}
      {showTypo && openSection === "typo" && (
        <div className="px-2 pb-2 space-y-2">
          {/* Font Family */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-muted-foreground w-12 shrink-0">ফন্ট</label>
            <Select value={style.fontFamily || "default"} onValueChange={(v) => set("fontFamily", v === "default" ? undefined : v)}>
              <SelectTrigger className="h-7 text-[10px] flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">ডিফল্ট</SelectItem>
                <SelectItem value="'Noto Sans Bengali', sans-serif"><span style={{ fontFamily: "'Noto Sans Bengali'" }}>নোটো সান্স বাংলা</span></SelectItem>
                <SelectItem value="'Hind Siliguri', sans-serif"><span style={{ fontFamily: "'Hind Siliguri'" }}>হিন্দ সিলিগুড়ি</span></SelectItem>
                <SelectItem value="'Baloo Da 2', cursive"><span style={{ fontFamily: "'Baloo Da 2'" }}>বালু দা ২</span></SelectItem>
                <SelectItem value="'Galada', cursive"><span style={{ fontFamily: "'Galada'" }}>গালাদা</span></SelectItem>
                <SelectItem value="'Tiro Bangla', serif"><span style={{ fontFamily: "'Tiro Bangla'" }}>তীর বাংলা</span></SelectItem>
                <SelectItem value="'Anek Bangla', sans-serif"><span style={{ fontFamily: "'Anek Bangla'" }}>অনেক বাংলা</span></SelectItem>
                <SelectItem value="'Noto Serif Bengali', serif"><span style={{ fontFamily: "'Noto Serif Bengali'" }}>নোটো সেরিফ</span></SelectItem>
                <SelectItem value="'Inter', sans-serif">Inter</SelectItem>
                <SelectItem value="'Poppins', sans-serif">Poppins</SelectItem>
                <SelectItem value="'Roboto', sans-serif">Roboto</SelectItem>
                <SelectItem value="Georgia, serif">Georgia</SelectItem>
                <SelectItem value="monospace">Monospace</SelectItem>
              </SelectContent>
            </Select>
            <ResetBtn k="fontFamily" />
          </div>

          {/* Font Size — preset buttons */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[9px] text-muted-foreground">সাইজ</label>
              <span className="text-[9px] text-muted-foreground">{style.fontSize || "ডিফল্ট"}</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {[{ l: "XS", v: "12px" }, { l: "S", v: "14px" }, { l: "M", v: "16px" }, { l: "L", v: "20px" }, { l: "XL", v: "24px" }, { l: "2XL", v: "32px" }, { l: "3XL", v: "40px" }].map(s => (
                <Button key={s.v} variant={style.fontSize === s.v ? "default" : "outline"} size="sm" className="h-6 px-2 text-[9px]" onClick={() => set("fontSize", style.fontSize === s.v ? undefined : s.v)}>{s.l}</Button>
              ))}
              <ResetBtn k="fontSize" />
            </div>
          </div>

          {/* Font Weight */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-muted-foreground w-12 shrink-0">ওয়েট</label>
            <div className="flex gap-1 flex-1 flex-wrap">
              {[{ l: "Light", v: "300" }, { l: "Normal", v: "400" }, { l: "Medium", v: "500" }, { l: "Bold", v: "700" }].map(w => (
                <Button key={w.v} variant={style.fontWeight === w.v ? "default" : "outline"} size="sm" className="h-6 px-2 text-[9px]" onClick={() => set("fontWeight", style.fontWeight === w.v ? undefined : w.v)}>{w.l}</Button>
              ))}
            </div>
            <ResetBtn k="fontWeight" />
          </div>

          {/* Text Align */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-muted-foreground w-12 shrink-0">এলাইন</label>
            <div className="flex gap-1">
              {[{ l: "☰", v: "left" }, { l: "☰", v: "center", cls: "text-center" }, { l: "☰", v: "right", cls: "text-right" }, { l: "☰", v: "justify" }].map((a, i) => (
                <Button key={a.v} variant={style.textAlign === a.v ? "default" : "outline"} size="icon" className="h-6 w-6 text-[9px]" onClick={() => set("textAlign", style.textAlign === a.v ? undefined : a.v)}>
                  {a.v === "left" ? "⬅" : a.v === "center" ? "⬌" : a.v === "right" ? "➡" : "⬔"}
                </Button>
              ))}
            </div>
            <ResetBtn k="textAlign" />
          </div>

          {/* Decoration & Transform */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-muted-foreground">ডেকোরেশন</label>
              <Select value={style.textDecoration || "default"} onValueChange={(v) => set("textDecoration", v === "default" ? undefined : v)}>
                <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">ডিফল্ট</SelectItem>
                  <SelectItem value="underline">Underline</SelectItem>
                  <SelectItem value="line-through">Line Through</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground">ট্রান্সফর্ম</label>
              <Select value={style.textTransform || "default"} onValueChange={(v) => set("textTransform", v === "default" ? undefined : v)}>
                <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">ডিফল্ট</SelectItem>
                  <SelectItem value="uppercase">UPPERCASE</SelectItem>
                  <SelectItem value="lowercase">lowercase</SelectItem>
                  <SelectItem value="capitalize">Capitalize</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Letter Spacing & Line Height */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-muted-foreground">Letter Spacing</label>
              <Input value={style.letterSpacing || ""} onChange={(e) => set("letterSpacing", e.target.value)} placeholder="0.5px" className="h-6 text-[9px]" />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground">Line Height</label>
              <Input value={style.lineHeight || ""} onChange={(e) => set("lineHeight", e.target.value)} placeholder="1.5" className="h-6 text-[9px]" />
            </div>
          </div>
        </div>
      )}

      {/* 📐 Spacing — Box Model */}
      <SectionHeader id="spacing" icon={Move} label="স্পেসিং" keys={["padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft"]} />
      {openSection === "spacing" && (
        <div className="px-2 pb-2 space-y-2">
          {/* Box Model Diagram */}
          <div className="relative border border-dashed border-muted-foreground/30 rounded-md p-1">
            <p className="text-[8px] text-muted-foreground text-center mb-0.5">margin</p>
            <div className="grid grid-cols-3 items-center gap-0.5 mb-0.5">
              <div />
              <Input value={style.marginTop || ""} onChange={(e) => set("marginTop", e.target.value)} placeholder="0" className="h-5 text-[8px] text-center px-0.5" />
              <div />
            </div>
            <div className="grid grid-cols-3 items-center gap-0.5">
              <Input value={style.marginLeft || ""} onChange={(e) => set("marginLeft", e.target.value)} placeholder="0" className="h-5 text-[8px] text-center px-0.5" />
              <div className="border border-dashed border-primary/40 rounded p-1">
                <p className="text-[8px] text-primary text-center mb-0.5">padding</p>
                <div className="grid grid-cols-3 items-center gap-0.5 mb-0.5">
                  <div />
                  <Input value={style.paddingTop || ""} onChange={(e) => set("paddingTop", e.target.value)} placeholder="0" className="h-5 text-[8px] text-center px-0.5" />
                  <div />
                </div>
                <div className="grid grid-cols-3 items-center gap-0.5">
                  <Input value={style.paddingLeft || ""} onChange={(e) => set("paddingLeft", e.target.value)} placeholder="0" className="h-5 text-[8px] text-center px-0.5" />
                  <div className="bg-muted rounded text-center py-1"><span className="text-[7px] text-muted-foreground">content</span></div>
                  <Input value={style.paddingRight || ""} onChange={(e) => set("paddingRight", e.target.value)} placeholder="0" className="h-5 text-[8px] text-center px-0.5" />
                </div>
                <div className="grid grid-cols-3 items-center gap-0.5 mt-0.5">
                  <div />
                  <Input value={style.paddingBottom || ""} onChange={(e) => set("paddingBottom", e.target.value)} placeholder="0" className="h-5 text-[8px] text-center px-0.5" />
                  <div />
                </div>
              </div>
              <Input value={style.marginRight || ""} onChange={(e) => set("marginRight", e.target.value)} placeholder="0" className="h-5 text-[8px] text-center px-0.5" />
            </div>
            <div className="grid grid-cols-3 items-center gap-0.5 mt-0.5">
              <div />
              <Input value={style.marginBottom || ""} onChange={(e) => set("marginBottom", e.target.value)} placeholder="0" className="h-5 text-[8px] text-center px-0.5" />
              <div />
            </div>
          </div>

          {/* Quick padding/margin sliders */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-muted-foreground">প্যাডিং (সব)</label>
              <span className="text-[9px] text-muted-foreground">{style.padding || 0}px</span>
            </div>
            <Slider value={[style.padding || 0]} onValueChange={([v]) => set("padding", v)} min={0} max={100} step={2} className="w-full" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-muted-foreground">মার্জিন (সব)</label>
              <span className="text-[9px] text-muted-foreground">{style.margin || 0}px</span>
            </div>
            <Slider value={[style.margin || 0]} onValueChange={([v]) => set("margin", v)} min={0} max={100} step={2} className="w-full" />
          </div>
        </div>
      )}

      {/* 🔲 Border & Shadow */}
      <SectionHeader id="border" icon={Square} label="বর্ডার ও শ্যাডো" keys={["border", "borderColor", "borderRadius", "boxShadow", "outline"]} />
      {openSection === "border" && (
        <div className="px-2 pb-2 space-y-2">
          <div>
            <label className="text-[9px] text-muted-foreground">বর্ডার</label>
            <Input value={style.border || ""} onChange={(e) => set("border", e.target.value)} placeholder="1px solid #ccc" className="h-7 text-[10px]" />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground mb-1 block">বর্ডার কালার</label>
            <ColorField value={style.borderColor} placeholder="#cccccc" onChange={(value) => set("borderColor", value)} resetButton={<ResetBtn k="borderColor" />} />
          </div>
          {/* Border Radius — presets */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[9px] text-muted-foreground">রেডিয়াস</label>
              <span className="text-[9px] text-muted-foreground">{style.borderRadius || 0}px</span>
            </div>
            <div className="flex gap-1 mb-1">
              {[{ l: "None", v: 0 }, { l: "Sm", v: 4 }, { l: "Md", v: 8 }, { l: "Lg", v: 16 }, { l: "Full", v: 9999 }].map(r => (
                <Button key={r.v} variant={style.borderRadius === r.v ? "default" : "outline"} size="sm" className="h-6 px-2 text-[9px] flex-1" onClick={() => set("borderRadius", r.v)}>{r.l}</Button>
              ))}
            </div>
            <Slider value={[style.borderRadius || 0]} onValueChange={([v]) => set("borderRadius", v)} min={0} max={50} step={2} className="w-full" />
          </div>
          {/* Shadow presets */}
          <div>
            <label className="text-[9px] text-muted-foreground mb-1 block">শ্যাডো</label>
            <div className="flex gap-1 mb-1 flex-wrap">
              {[{ l: "None", v: "" }, { l: "Sm", v: "0 1px 3px rgba(0,0,0,0.12)" }, { l: "Md", v: "0 4px 12px rgba(0,0,0,0.15)" }, { l: "Lg", v: "0 10px 30px rgba(0,0,0,0.2)" }].map(s => (
                <Button key={s.l} variant={style.boxShadow === s.v ? "default" : "outline"} size="sm" className="h-6 px-2 text-[9px]" onClick={() => set("boxShadow", s.v || undefined)}>{s.l}</Button>
              ))}
            </div>
            <Input value={style.boxShadow || ""} onChange={(e) => set("boxShadow", e.target.value)} placeholder="0 4px 12px rgba(0,0,0,0.15)" className="h-7 text-[10px]" />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground">আউটলাইন</label>
            <Input value={style.outline || ""} onChange={(e) => set("outline", e.target.value)} placeholder="2px solid blue" className="h-7 text-[10px]" />
          </div>
        </div>
      )}

      {/* 📏 Size & Layout */}
      <SectionHeader id="layout" icon={Ruler} label="সাইজ ও লেআউট" keys={["width", "height", "minWidth", "maxWidth", "display", "gap", "overflow"]} />
      {openSection === "layout" && (
        <div className="px-2 pb-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <div><label className="text-[9px] text-muted-foreground">উইডথ</label><Input value={style.width || ""} onChange={(e) => set("width", e.target.value)} placeholder="100%" className="h-6 text-[9px]" /></div>
            <div><label className="text-[9px] text-muted-foreground">হাইট</label><Input value={style.height || ""} onChange={(e) => set("height", e.target.value)} placeholder="auto" className="h-6 text-[9px]" /></div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div><label className="text-[9px] text-muted-foreground">Min W</label><Input value={style.minWidth || ""} onChange={(e) => set("minWidth", e.target.value)} className="h-6 text-[9px]" /></div>
            <div><label className="text-[9px] text-muted-foreground">Max W</label><Input value={style.maxWidth || ""} onChange={(e) => set("maxWidth", e.target.value)} className="h-6 text-[9px]" /></div>
          </div>

          {/* Display */}
          <div>
            <label className="text-[9px] text-muted-foreground mb-1 block">ডিসপ্লে</label>
            <div className="flex gap-1 flex-wrap">
              {[{ l: "Block", v: "block" }, { l: "Flex", v: "flex" }, { l: "Grid", v: "grid" }, { l: "Inline", v: "inline-block" }, { l: "None", v: "none" }].map(d => (
                <Button key={d.v} variant={style.display === d.v ? "default" : "outline"} size="sm" className="h-6 px-2 text-[9px]" onClick={() => set("display", style.display === d.v ? undefined : d.v)}>{d.l}</Button>
              ))}
            </div>
          </div>

          {/* Flex controls */}
          {style.display === "flex" && (
            <div className="space-y-1.5 pl-2 border-l-2 border-primary/30">
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[8px] text-muted-foreground">Direction</label>
                  <Select value={style.flexDirection || "default"} onValueChange={(v) => set("flexDirection", v === "default" ? undefined : v)}>
                    <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Row</SelectItem>
                      <SelectItem value="column">Column</SelectItem>
                      <SelectItem value="row-reverse">Row Rev</SelectItem>
                      <SelectItem value="column-reverse">Col Rev</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground">Wrap</label>
                  <Select value={style.flexWrap || "default"} onValueChange={(v) => set("flexWrap", v === "default" ? undefined : v)}>
                    <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">No Wrap</SelectItem>
                      <SelectItem value="wrap">Wrap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[8px] text-muted-foreground">Justify</label>
                  <Select value={style.justifyContent || "default"} onValueChange={(v) => set("justifyContent", v === "default" ? undefined : v)}>
                    <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Start</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="space-between">Between</SelectItem>
                      <SelectItem value="space-around">Around</SelectItem>
                      <SelectItem value="flex-end">End</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground">Align</label>
                  <Select value={style.alignItems || "default"} onValueChange={(v) => set("alignItems", v === "default" ? undefined : v)}>
                    <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Stretch</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="flex-start">Start</SelectItem>
                      <SelectItem value="flex-end">End</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><label className="text-[8px] text-muted-foreground">Gap</label><Input value={style.gap || ""} onChange={(e) => set("gap", e.target.value)} placeholder="8px" className="h-6 text-[9px]" /></div>
            </div>
          )}

          {/* Grid controls */}
          {style.display === "grid" && (
            <div className="space-y-1.5 pl-2 border-l-2 border-primary/30">
              <div><label className="text-[8px] text-muted-foreground">Columns</label><Input value={style.gridTemplateColumns || ""} onChange={(e) => set("gridTemplateColumns", e.target.value)} placeholder="1fr 1fr 1fr" className="h-6 text-[9px]" /></div>
              <div><label className="text-[8px] text-muted-foreground">Rows</label><Input value={style.gridTemplateRows || ""} onChange={(e) => set("gridTemplateRows", e.target.value)} placeholder="auto" className="h-6 text-[9px]" /></div>
              <div className="grid grid-cols-2 gap-1.5">
                <div><label className="text-[8px] text-muted-foreground">Gap</label><Input value={style.gap || ""} onChange={(e) => set("gap", e.target.value)} placeholder="8px" className="h-6 text-[9px]" /></div>
                <div>
                  <label className="text-[8px] text-muted-foreground">Justify</label>
                  <Select value={style.justifyContent || "default"} onValueChange={(v) => set("justifyContent", v === "default" ? undefined : v)}>
                    <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Start</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="space-between">Between</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Overflow */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-muted-foreground w-14 shrink-0">Overflow</label>
            <Select value={style.overflow || "default"} onValueChange={(v) => set("overflow", v === "default" ? undefined : v)}>
              <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">ডিফল্ট</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="visible">Visible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 🎬 Effects */}
      {showEffects && <SectionHeader id="effects" icon={Wand2} label="ইফেক্ট" keys={["opacity", "transform", "transition", "filter", "backdropFilter"]} />}
      {showEffects && openSection === "effects" && (
        <div className="px-2 pb-2 space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-muted-foreground">অপাসিটি</label>
              <span className="text-[9px] text-muted-foreground">{style.opacity ?? 100}%</span>
            </div>
            <Slider value={[style.opacity ?? 100]} onValueChange={([v]) => set("opacity", v)} min={0} max={100} step={5} className="w-full" />
          </div>
          <div><label className="text-[9px] text-muted-foreground">ট্রান্সফর্ম</label><Input value={style.transform || ""} onChange={(e) => set("transform", e.target.value)} placeholder="rotate(5deg) scale(1.1)" className="h-7 text-[10px]" /></div>
          <div><label className="text-[9px] text-muted-foreground">ট্রানজিশন</label><Input value={style.transition || ""} onChange={(e) => set("transition", e.target.value)} placeholder="all 0.3s ease" className="h-7 text-[10px]" /></div>
          <div><label className="text-[9px] text-muted-foreground">ফিল্টার</label><Input value={style.filter || ""} onChange={(e) => set("filter", e.target.value)} placeholder="blur(2px) grayscale(50%)" className="h-7 text-[10px]" /></div>
          <div><label className="text-[9px] text-muted-foreground">ব্যাকড্রপ ফিল্টার</label><Input value={style.backdropFilter || ""} onChange={(e) => set("backdropFilter", e.target.value)} placeholder="blur(10px)" className="h-7 text-[10px]" /></div>
        </div>
      )}

      {/* ⚙️ Advanced */}
      <SectionHeader id="advanced" icon={Settings2} label="অ্যাডভান্সড" keys={["position", "zIndex", "cursor", "aspectRatio", "objectFit", "wordBreak", "whiteSpace", "listStyle", "_rawCss"]} />
      {openSection === "advanced" && (
        <div className="px-2 pb-2 space-y-2">
          {/* Position */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-muted-foreground w-14 shrink-0">পজিশন</label>
            <Select value={style.position || "default"} onValueChange={(v) => set("position", v === "default" ? undefined : v)}>
              <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">ডিফল্ট</SelectItem>
                <SelectItem value="relative">Relative</SelectItem>
                <SelectItem value="absolute">Absolute</SelectItem>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="sticky">Sticky</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(style.position === "relative" || style.position === "absolute" || style.position === "fixed" || style.position === "sticky") && (
            <div className="grid grid-cols-4 gap-1 pl-2 border-l-2 border-primary/30">
              {(["top", "right", "bottom", "left"] as const).map(k => (
                <div key={k}><label className="text-[7px] text-muted-foreground capitalize">{k}</label><Input value={style[k] || ""} onChange={(e) => set(k, e.target.value)} placeholder="auto" className="h-5 text-[8px] px-0.5" /></div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-muted-foreground w-14 shrink-0">Z-Index</label>
            <Input value={style.zIndex || ""} onChange={(e) => set("zIndex", e.target.value)} placeholder="auto" className="h-6 text-[9px] flex-1" />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-muted-foreground w-14 shrink-0">কার্সর</label>
            <Select value={style.cursor || "default"} onValueChange={(v) => set("cursor", v === "default" ? undefined : v)}>
              <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="pointer">Pointer</SelectItem>
                <SelectItem value="not-allowed">Not Allowed</SelectItem>
                <SelectItem value="grab">Grab</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showObjectFit && (
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-muted-foreground">Object Fit</label>
              <Select value={style.objectFit || "default"} onValueChange={(v) => set("objectFit", v === "default" ? undefined : v)}>
                <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">ডিফল্ট</SelectItem>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="contain">Contain</SelectItem>
                  <SelectItem value="fill">Fill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground">Aspect Ratio</label>
              <Select value={style.aspectRatio || "default"} onValueChange={(v) => set("aspectRatio", v === "default" ? undefined : v)}>
                <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Auto</SelectItem>
                  <SelectItem value="1/1">1:1</SelectItem>
                  <SelectItem value="16/9">16:9</SelectItem>
                  <SelectItem value="4/3">4:3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          )}

          {showTypo && (
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-muted-foreground">Word Break</label>
              <Select value={style.wordBreak || "default"} onValueChange={(v) => set("wordBreak", v === "default" ? undefined : v)}>
                <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Normal</SelectItem>
                  <SelectItem value="break-all">Break All</SelectItem>
                  <SelectItem value="break-word">Break Word</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground">White Space</label>
              <Select value={style.whiteSpace || "default"} onValueChange={(v) => set("whiteSpace", v === "default" ? undefined : v)}>
                <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Normal</SelectItem>
                  <SelectItem value="nowrap">No Wrap</SelectItem>
                  <SelectItem value="pre-wrap">Pre Wrap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          )}

          {showListStyle && (
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-muted-foreground">লিস্ট স্টাইল</label>
              <Select value={style.listStyle || "default"} onValueChange={(v) => set("listStyle", v === "default" ? undefined : v)}>
                <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">ডিফল্ট</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="disc">Disc</SelectItem>
                  <SelectItem value="decimal">Decimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          )}

          {/* Raw CSS */}
          <div>
            <label className="text-[9px] text-muted-foreground">কাস্টম CSS (raw)</label>
            <Textarea
              value={style._rawCss || ""}
              onChange={(e) => set("_rawCss", e.target.value)}
              placeholder="any-property: value;&#10;another: value;"
              rows={3}
              className="font-mono text-[9px] text-muted-foreground mt-1"
            />
            <p className="text-[8px] text-muted-foreground mt-0.5">প্রতি লাইনে property: value; লিখুন</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====== Image Picker Button ====== */
function ImagePickerField({ value, onChange, label }: { value: string; onChange: (url: string) => void; label: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-muted-foreground">{label}</label>
      {value ? (
        <div className="relative group">
          <img src={value} alt="" className="w-full h-20 object-cover rounded-lg border border-border" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setPickerOpen(true)}>
              <Upload className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => onChange("")}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full h-14 border-dashed gap-2 text-xs" onClick={() => setPickerOpen(true)}>
          <Upload className="w-4 h-4" /> ছবি আপলোড/সিলেক্ট
        </Button>
      )}
      <MediaPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(url) => { onChange(url); setPickerOpen(false); }} />
    </div>
  );
}

const stopColorPickerPropagation = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};

/* ====== Inline Color Picker (stable, no remount on change) ====== */
function InlineColorPicker({ value, fallback, onChange: onColorChange, className: cls }: { value: string | undefined; fallback: string; onChange: (v: string) => void; className?: string }) {
  const [local, setLocal] = useState(value || fallback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocal(value || fallback); }, [value, fallback]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <input
      type="color"
      value={local}
      onPointerDown={stopColorPickerPropagation}
      onMouseDown={stopColorPickerPropagation}
      onClick={stopColorPickerPropagation}
      onTouchStart={stopColorPickerPropagation}
      onInput={(e) => {
        const v = (e.target as HTMLInputElement).value;
        setLocal(v);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => onColorChange(v), 150);
      }}
      onChange={(e) => {
        const nextValue = e.target.value;
        setLocal(nextValue);
        onColorChange(nextValue);
      }}
      className={cls || "w-8 h-8 rounded border border-border cursor-pointer p-0.5"}
    />
  );
}

function ColorField({ value, placeholder, onChange, resetButton }: { value?: string; placeholder: string; onChange: (v: string) => void; resetButton?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5" onPointerDown={stopColorPickerPropagation} onMouseDown={stopColorPickerPropagation} onClick={stopColorPickerPropagation}>
      <InlineColorPicker value={value} fallback={placeholder} onChange={onChange} className="w-7 h-7 rounded border border-border cursor-pointer p-0.5 shrink-0" />
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-7 text-[10px] flex-1" />
      {resetButton}
    </div>
  );
}

/* ====== Block Editor (right panel forms) ====== */
function BlockEditor({ block, onUpdate, products }: { block: Block; onUpdate: (data: Record<string, any>) => void; products: any[] }) {
  const d = block.data;
  const set = (key: string, value: any) => onUpdate({ ...d, [key]: value });

  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-2">
          <Input value={d.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="শিরোনাম" className="h-8 text-xs" />
          <Input value={d.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} placeholder="সাব-টাইটেল" className="h-8 text-xs" />
          <ImagePickerField value={d.bgImage || ""} onChange={(url) => set("bgImage", url)} label="ব্যাকগ্রাউন্ড ছবি" />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground shrink-0">BG কালার</label>
            <InlineColorPicker
              value={d.bgColor}
              fallback="#2d6a4f"
              onChange={(v) => set("bgColor", v)}
            />
            <Input value={d.bgColor || ""} onChange={(e) => set("bgColor", e.target.value)} placeholder="কালার/গ্র্যাডিয়েন্ট" className="h-7 text-[10px] flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={d.buttonText || ""} onChange={(e) => set("buttonText", e.target.value)} placeholder="বাটন টেক্সট" className="h-8 text-xs" />
            <Input value={d.buttonLink || ""} onChange={(e) => set("buttonLink", e.target.value)} placeholder="বাটন লিংক" className="h-8 text-xs" />
          </div>
        </div>
      );
    case "text":
      return (
        <div className="space-y-2">
          <Input value={d.heading || ""} onChange={(e) => set("heading", e.target.value)} placeholder="হেডিং" className="h-8 text-xs" />
          <Textarea value={d.body || ""} onChange={(e) => set("body", e.target.value)} rows={4} placeholder="টেক্সট লিখুন..." className="text-xs" />
        </div>
      );
    case "heading":
      return (
        <div className="space-y-2">
          <Input value={d.text || ""} onChange={(e) => set("text", e.target.value)} placeholder="শিরোনাম লিখুন" className="h-8 text-xs" />
          <Select value={String(d.level || 2)} onValueChange={(v) => set("level", parseInt(v))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="লেভেল" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">H1 — সবচেয়ে বড়</SelectItem>
              <SelectItem value="2">H2 — বড়</SelectItem>
              <SelectItem value="3">H3 — মাঝারি</SelectItem>
              <SelectItem value="4">H4 — ছোট</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case "paragraph":
      return (
        <div className="space-y-2">
          <Textarea value={d.text || ""} onChange={(e) => set("text", e.target.value)} rows={5} placeholder="আপনার টেক্সট এখানে লিখুন..." className="text-xs" />
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          <ImagePickerField value={d.src || ""} onChange={(url) => set("src", url)} label="ছবি" />
          <Input value={d.alt || ""} onChange={(e) => set("alt", e.target.value)} placeholder="Alt টেক্সট" className="h-8 text-xs" />
          <Input value={d.caption || ""} onChange={(e) => set("caption", e.target.value)} placeholder="ক্যাপশন" className="h-8 text-xs" />
          <div className="flex items-center gap-2">
            <Switch checked={d.fullWidth || false} onCheckedChange={(v) => set("fullWidth", v)} />
            <span className="text-[10px] text-muted-foreground">ফুল উইডথ</span>
          </div>
        </div>
      );
    case "button":
      return (
        <div className="space-y-2">
          <Input value={d.text || ""} onChange={(e) => set("text", e.target.value)} placeholder="বাটন টেক্সট" className="h-8 text-xs" />
          <Input value={d.link || ""} onChange={(e) => set("link", e.target.value)} placeholder="লিংক" className="h-8 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={d.icon || "none"} onValueChange={(v) => set("icon", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="আইকন" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">নেই</SelectItem>
                <SelectItem value="cart">🛒 কার্ট</SelectItem>
                <SelectItem value="link">🔗 লিংক</SelectItem>
              </SelectContent>
            </Select>
            <Select value={d.variant || "default"} onValueChange={(v) => set("variant", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="স্টাইল" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">প্রাইমারি</SelectItem>
                <SelectItem value="outline">আউটলাইন</SelectItem>
                <SelectItem value="secondary">সেকেন্ডারি</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    case "product":
      return (
        <Select value={d.productId || ""} onValueChange={(v) => set("productId", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="প্রোডাক্ট বেছে নিন" /></SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "video":
      return (
        <div className="space-y-2">
          <Input value={d.heading || ""} onChange={(e) => set("heading", e.target.value)} placeholder="ভিডিও হেডিং" className="h-8 text-xs" />
          <Input value={d.url || ""} onChange={(e) => set("url", e.target.value)} placeholder="YouTube/Facebook URL" className="h-8 text-xs" />
        </div>
      );
    case "features":
      return <FeaturesEditor data={d} onUpdate={onUpdate} />;
    case "divider":
      return <p className="text-[10px] text-muted-foreground">হরাইজন্টাল ডিভাইডার</p>;
    case "countdown":
      return (
        <div className="space-y-2">
          <Input value={d.heading || ""} onChange={(e) => set("heading", e.target.value)} placeholder="হেডিং" className="h-8 text-xs" />
          <div>
            <label className="text-[10px] text-muted-foreground">শেষ তারিখ/সময়</label>
            <Input type="datetime-local" value={d.endDate || ""} onChange={(e) => set("endDate", e.target.value)} className="h-8 text-xs" />
          </div>
          <Input value={d.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} placeholder="সাব-টাইটেল" className="h-8 text-xs" />
        </div>
      );
    case "testimonial":
      return <TestimonialEditor data={d} onUpdate={onUpdate} />;
    case "faq":
      return <FaqEditor data={d} onUpdate={onUpdate} />;
    case "product-grid":
      return (
        <div className="space-y-2">
          <Input value={d.heading || ""} onChange={(e) => set("heading", e.target.value)} placeholder="সেকশন হেডিং" className="h-8 text-xs" />
          <div>
            <label className="text-[10px] text-muted-foreground">ক্যাটাগরি (ফিল্টার)</label>
            <Input value={d.category || ""} onChange={(e) => set("category", e.target.value)} placeholder="সব দেখান (ফাঁকা)" className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">পণ্য সংখ্যা</label>
              <Input type="number" value={d.limit || 6} onChange={(e) => set("limit", parseInt(e.target.value) || 6)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">কলাম</label>
              <Select value={String(d.cols || 2)} onValueChange={(v) => set("cols", parseInt(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">২ কলাম</SelectItem>
                  <SelectItem value="3">৩ কলাম</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );
    case "gallery":
      return <GalleryEditor data={d} onUpdate={onUpdate} ImagePickerField={ImagePickerField} />;
    case "banner":
      return (
        <div className="space-y-2">
          <Input value={d.text || ""} onChange={(e) => set("text", e.target.value)} placeholder="ব্যানার টেক্সট" className="h-8 text-xs" />
          <Input value={d.emoji || ""} onChange={(e) => set("emoji", e.target.value)} placeholder="ইমোজি (অপশনাল)" className="h-8 text-xs" />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground shrink-0">BG</label>
            <InlineColorPicker value={d.bgColor} fallback="#3b82f6" onChange={(v) => set("bgColor", v)} />
            <Input value={d.bgColor || ""} onChange={(e) => set("bgColor", e.target.value)} className="h-7 text-[10px] flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={d.buttonText || ""} onChange={(e) => set("buttonText", e.target.value)} placeholder="বাটন টেক্সট" className="h-8 text-xs" />
            <Input value={d.buttonLink || ""} onChange={(e) => set("buttonLink", e.target.value)} placeholder="লিংক" className="h-8 text-xs" />
          </div>
        </div>
      );
    case "social-proof":
      return <SocialProofEditor data={d} onUpdate={onUpdate} />;
    case "spacer":
      return (
        <div>
          <label className="text-[10px] text-muted-foreground">উচ্চতা</label>
          <Input value={d.height || "40px"} onChange={(e) => set("height", e.target.value)} placeholder="40px" className="h-8 text-xs" />
        </div>
      );
    case "html":
      return (
        <div>
          <label className="text-[10px] text-muted-foreground">HTML কোড</label>
          <Textarea value={d.code || ""} onChange={(e) => set("code", e.target.value)} rows={6} placeholder="<div>...</div>" className="font-mono text-[10px]" />
        </div>
      );
    case "comparison":
      return <ComparisonEditor data={d} onUpdate={onUpdate} />;
    case "pricing":
      return <PricingEditor data={d} onUpdate={onUpdate} />;
    case "contact-form":
      return (
        <div className="space-y-2">
          <Input value={d.heading || ""} onChange={(e) => set("heading", e.target.value)} placeholder="হেডিং" className="h-8 text-xs" />
          <Input value={d.namePlaceholder || ""} onChange={(e) => set("namePlaceholder", e.target.value)} placeholder="নাম ফিল্ড placeholder" className="h-8 text-xs" />
          <Input value={d.phonePlaceholder || ""} onChange={(e) => set("phonePlaceholder", e.target.value)} placeholder="ফোন ফিল্ড placeholder" className="h-8 text-xs" />
          <Input value={d.buttonText || ""} onChange={(e) => set("buttonText", e.target.value)} placeholder="বাটন টেক্সট" className="h-8 text-xs" />
        </div>
      );
    case "map":
      return (
        <div>
          <label className="text-[10px] text-muted-foreground">Google Maps Embed URL</label>
          <Input value={d.embedUrl || ""} onChange={(e) => set("embedUrl", e.target.value)} placeholder="https://www.google.com/maps/embed?..." className="h-8 text-xs" />
        </div>
      );
    case "columns": {
      const items: any[] = d.items || [];
      const setItem = (i: number, key: string, val: string) => {
        const n = [...items]; n[i] = { ...n[i], [key]: val }; onUpdate({ ...d, items: n });
      };
      return (
        <div className="space-y-2">
          <Input value={d.heading || ""} onChange={(e) => set("heading", e.target.value)} placeholder="হেডিং (ঐচ্ছিক)" className="h-8 text-xs" />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground w-16 shrink-0">কলাম সংখ্যা</label>
            <Select value={String(d.cols || 2)} onValueChange={(v) => set("cols", parseInt(v))}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">২ কলাম</SelectItem>
                <SelectItem value="3">৩ কলাম</SelectItem>
                <SelectItem value="4">৪ কলাম</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {items.map((item, i) => (
            <div key={i} className="space-y-1 p-2 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground">কলাম {i + 1}</span>
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => {
                    const n = items.filter((_, idx) => idx !== i); onUpdate({ ...d, items: n });
                  }}><Trash2 className="w-2.5 h-2.5" /></Button>
                )}
              </div>
              <Input value={item.heading || ""} onChange={(e) => setItem(i, "heading", e.target.value)} placeholder="শিরোনাম" className="h-7 text-[10px]" />
              <Textarea value={item.body || ""} onChange={(e) => setItem(i, "body", e.target.value)} placeholder="বিবরণ" className="text-[10px] min-h-[50px]" />
              <Input value={item.image || ""} onChange={(e) => setItem(i, "image", e.target.value)} placeholder="ছবি URL (ঐচ্ছিক)" className="h-7 text-[10px]" />
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={() => {
            onUpdate({ ...d, items: [...items, { heading: `কলাম ${items.length + 1}`, body: "এখানে টেক্সট লিখুন" }] });
          }}><Plus className="w-3 h-3" /> কলাম যোগ করুন</Button>
        </div>
      );
    }
    case "flex-container":
    case "grid-container":
      return <ContainerEditor block={block} onUpdate={onUpdate} products={products} />;
    case "image-slider":
      return <ImageSliderEditor data={d} onUpdate={onUpdate} ImagePickerField={ImagePickerField} />;
    case "checkout-form":
      return (
        <div className="space-y-3">
          <Input value={d.heading || ""} onChange={(e) => set("heading", e.target.value)} placeholder="হেডিং" className="h-8 text-xs" />
          <p className="text-[9px] font-semibold text-muted-foreground uppercase pt-1">ফিল্ড সেটিংস</p>
          {/* Name field */}
          <div className="p-2 bg-muted/50 rounded-lg border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium">নাম ফিল্ড</span>
              <div className="flex items-center gap-1"><Switch checked={d.showName !== false} onCheckedChange={(v) => set("showName", v)} className="scale-75" /><span className="text-[9px] text-muted-foreground">{d.showName !== false ? "চালু" : "বন্ধ"}</span></div>
            </div>
            {d.showName !== false && (
              <>
                <Input value={d.nameLabel || ""} onChange={(e) => set("nameLabel", e.target.value)} placeholder="লেবেল: আপনার নাম" className="h-7 text-[10px]" />
                <Input value={d.namePlaceholder || ""} onChange={(e) => set("namePlaceholder", e.target.value)} placeholder="Placeholder: নাম লিখুন" className="h-7 text-[10px]" />
              </>
            )}
          </div>
          {/* Phone field — always on */}
          <div className="p-2 bg-muted/50 rounded-lg border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium">ফোন ফিল্ড</span>
              <Badge variant="secondary" className="text-[8px]">আবশ্যক</Badge>
            </div>
            <Input value={d.phoneLabel || ""} onChange={(e) => set("phoneLabel", e.target.value)} placeholder="লেবেল: ফোন নম্বর" className="h-7 text-[10px]" />
            <Input value={d.phonePlaceholder || ""} onChange={(e) => set("phonePlaceholder", e.target.value)} placeholder="Placeholder: 01XXXXXXXXX" className="h-7 text-[10px]" />
          </div>
          {/* Address field */}
          <div className="p-2 bg-muted/50 rounded-lg border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium">ঠিকানা ফিল্ড</span>
              <div className="flex items-center gap-1"><Switch checked={d.showAddress !== false} onCheckedChange={(v) => set("showAddress", v)} className="scale-75" /><span className="text-[9px] text-muted-foreground">{d.showAddress !== false ? "চালু" : "বন্ধ"}</span></div>
            </div>
            {d.showAddress !== false && (
              <>
                <Input value={d.addressLabel || ""} onChange={(e) => set("addressLabel", e.target.value)} placeholder="লেবেল: ঠিকানা" className="h-7 text-[10px]" />
                <Input value={d.addressPlaceholder || ""} onChange={(e) => set("addressPlaceholder", e.target.value)} placeholder="Placeholder: সম্পূর্ণ ঠিকানা" className="h-7 text-[10px]" />
              </>
            )}
          </div>
          {/* Note field */}
          <div className="p-2 bg-muted/50 rounded-lg border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium">নোট ফিল্ড</span>
              <div className="flex items-center gap-1"><Switch checked={d.showNote || false} onCheckedChange={(v) => set("showNote", v)} className="scale-75" /><span className="text-[9px] text-muted-foreground">{d.showNote ? "চালু" : "বন্ধ"}</span></div>
            </div>
            {d.showNote && (
              <>
                <Input value={d.noteLabel || ""} onChange={(e) => set("noteLabel", e.target.value)} placeholder="লেবেল: নোট" className="h-7 text-[10px]" />
                <Input value={d.notePlaceholder || ""} onChange={(e) => set("notePlaceholder", e.target.value)} placeholder="Placeholder: বিশেষ কোনো তথ্য" className="h-7 text-[10px]" />
              </>
            )}
          </div>
          {/* Order Overview */}
          <p className="text-[9px] font-semibold text-muted-foreground uppercase pt-1">অর্ডার ওভারভিউ</p>
          <div className="p-2 bg-muted/50 rounded-lg border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium">অর্ডার সামারি দেখাও</span>
              <div className="flex items-center gap-1"><Switch checked={d.showOverview !== false} onCheckedChange={(v) => set("showOverview", v)} className="scale-75" /><span className="text-[9px] text-muted-foreground">{d.showOverview !== false ? "চালু" : "বন্ধ"}</span></div>
            </div>
            {d.showOverview !== false && (
              <>
                <Input value={d.overviewTitle || ""} onChange={(e) => set("overviewTitle", e.target.value)} placeholder="হেডিং: অর্ডার সামারি" className="h-7 text-[10px]" />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-medium">পণ্যের ছবি দেখাও</span>
                  <div className="flex items-center gap-1"><Switch checked={d.overviewShowImage || false} onCheckedChange={(v) => set("overviewShowImage", v)} className="scale-75" /><span className="text-[9px] text-muted-foreground">{d.overviewShowImage ? "চালু" : "বন্ধ"}</span></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium">পরিমাণ +/- বাটন</span>
                  <div className="flex items-center gap-1"><Switch checked={d.overviewAllowQty || false} onCheckedChange={(v) => set("overviewAllowQty", v)} className="scale-75" /><span className="text-[9px] text-muted-foreground">{d.overviewAllowQty ? "চালু" : "বন্ধ"}</span></div>
                </div>
              </>
            )}
          </div>
          {/* Delivery Charge */}
          <p className="text-[9px] font-semibold text-muted-foreground uppercase pt-1">ডেলিভারি চার্জ</p>
          <div className="p-2 bg-muted/50 rounded-lg border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium">ডেলিভারি চার্জ দেখাও</span>
              <div className="flex items-center gap-1"><Switch checked={d.showDelivery || false} onCheckedChange={(v) => set("showDelivery", v)} className="scale-75" /><span className="text-[9px] text-muted-foreground">{d.showDelivery ? "চালু" : "বন্ধ"}</span></div>
            </div>
            {d.showDelivery && (
              <>
                <p className="text-[9px] text-muted-foreground">পরিমাণ অনুযায়ী চার্জ:</p>
                {(d.deliveryRules || []).map((rule: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input type="number" value={rule.qty} onChange={(e) => { const rules = [...(d.deliveryRules || [])]; rules[idx] = { ...rules[idx], qty: Number(e.target.value) }; set("deliveryRules", rules); }} placeholder="পরিমাণ" className="h-7 text-[10px] w-16" />
                    <span className="text-[9px] text-muted-foreground">পণ্য →</span>
                    <Input type="number" value={rule.charge} onChange={(e) => { const rules = [...(d.deliveryRules || [])]; rules[idx] = { ...rules[idx], charge: Number(e.target.value) }; set("deliveryRules", rules); }} placeholder="চার্জ" className="h-7 text-[10px] w-16" />
                    <span className="text-[9px] text-muted-foreground">৳</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { const rules = (d.deliveryRules || []).filter((_: any, i: number) => i !== idx); set("deliveryRules", rules); }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="gap-1 h-6 text-[10px] w-full" onClick={() => set("deliveryRules", [...(d.deliveryRules || []), { qty: (d.deliveryRules || []).length + 1, charge: 100 }])}>
                  <Plus className="w-3 h-3" /> রো যোগ করুন
                </Button>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">ফ্রি ডেলিভারি (৳ এর উপরে):</span>
                  <Input type="number" value={d.freeDeliveryAbove || ""} onChange={(e) => set("freeDeliveryAbove", e.target.value ? Number(e.target.value) : null)} placeholder="যেমন: 600" className="h-7 text-[10px] flex-1" />
                </div>
              </>
            )}
          </div>
          <p className="text-[9px] font-semibold text-muted-foreground uppercase pt-1">বাটন</p>
          <Input value={d.buttonText || ""} onChange={(e) => set("buttonText", e.target.value)} placeholder="অর্ডার কনফার্ম করুন" className="h-8 text-xs" />
        </div>
      );
    default:
      return null;
  }
}



/* ====== Container Editor (flex/grid) ====== */
function ContainerEditor({ block, onUpdate, products }: { block: Block; onUpdate: (data: Record<string, any>) => void; products: any[] }) {
  const d = block.data;
  const children: Block[] = d.children || [];
  const isFlex = block.type === "flex-container";
  const set = (key: string, value: any) => onUpdate({ ...d, [key]: value });

  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const editingChild = editingChildId ? children.find(c => c.id === editingChildId) : null;

  const addChild = (type: Block["type"]) => {
    const newChild: Block = { id: generateId(), type, data: getDefaultData(type) };
    onUpdate({ ...d, children: [...children, newChild] });
  };

  const updateChild = (childId: string, childData: Record<string, any>) => {
    onUpdate({ ...d, children: children.map(c => c.id === childId ? { ...c, data: childData } : c) });
  };

  const removeChild = (childId: string) => {
    onUpdate({ ...d, children: children.filter(c => c.id !== childId) });
    if (editingChildId === childId) setEditingChildId(null);
  };

  const moveChild = (idx: number, dir: "up" | "down") => {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= children.length) return;
    const n = [...children];
    [n[idx], n[target]] = [n[target], n[idx]];
    onUpdate({ ...d, children: n });
  };

  // If editing a child, show its settings
  if (editingChild) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 w-full" onClick={() => setEditingChildId(null)}>
          <ArrowLeft className="w-3 h-3" /> কন্টেইনারে ফিরুন
        </Button>
        <Badge variant="secondary" className="text-[10px]">
          {BLOCK_TYPES.find(bt => bt.type === editingChild.type)?.label || editingChild.type}
        </Badge>
        <BlockEditor
          block={editingChild}
          onUpdate={(data) => updateChild(editingChild.id, data)}
          products={products}
        />
        {/* Child block style */}
        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground">চাইল্ড ব্লক স্টাইল</p>
          <StyleControls
            style={editingChild.data._style || {}}
            onChange={(s) => updateChild(editingChild.id, { ...editingChild.data, _style: s })}
            blockType={editingChild.type}
          />
        </div>
      </div>
    );
  }

  // Non-container block types for adding children
  const childBlockTypes = BLOCK_TYPES.filter(bt => bt.type !== "flex-container" && bt.type !== "grid-container");

  return (
    <div className="space-y-3">
      {/* Layout Controls */}
      <p className="text-[10px] font-semibold text-muted-foreground uppercase">লেআউট সেটিংস</p>
      {isFlex ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Direction</label>
              <Select value={d.direction || "row"} onValueChange={(v) => set("direction", v)}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="row">Row →</SelectItem>
                  <SelectItem value="column">Column ↓</SelectItem>
                  <SelectItem value="row-reverse">Row ←</SelectItem>
                  <SelectItem value="column-reverse">Column ↑</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Wrap</label>
              <Select value={d.wrap || "wrap"} onValueChange={(v) => set("wrap", v)}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nowrap">No Wrap</SelectItem>
                  <SelectItem value="wrap">Wrap</SelectItem>
                  <SelectItem value="wrap-reverse">Wrap Reverse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Justify</label>
              <Select value={d.justify || "flex-start"} onValueChange={(v) => set("justify", v)}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flex-start">Start</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="flex-end">End</SelectItem>
                  <SelectItem value="space-between">Space Between</SelectItem>
                  <SelectItem value="space-around">Space Around</SelectItem>
                  <SelectItem value="space-evenly">Space Evenly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Align</label>
              <Select value={d.align || "stretch"} onValueChange={(v) => set("align", v)}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stretch">Stretch</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="flex-start">Start</SelectItem>
                  <SelectItem value="flex-end">End</SelectItem>
                  <SelectItem value="baseline">Baseline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground">কলাম সংখ্যা</label>
            <Select value={String(d.gridCols || 2)} onValueChange={(v) => set("gridCols", parseInt(v))}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">১ কলাম</SelectItem>
                <SelectItem value="2">২ কলাম</SelectItem>
                <SelectItem value="3">৩ কলাম</SelectItem>
                <SelectItem value="4">৪ কলাম</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Gap */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground">গ্যাপ</label>
          <span className="text-[10px] text-muted-foreground">{d.gap || 12}px</span>
        </div>
        <Slider value={[d.gap || 12]} onValueChange={([v]) => set("gap", v)} min={0} max={60} step={4} className="w-full" />
      </div>

      {/* Children list */}
      <div className="pt-2 border-t border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">চাইল্ড ব্লক ({children.length}টি)</p>
        <div className="space-y-1">
          {children.map((child, idx) => (
            <div key={child.id} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-muted/50 border border-border">
              <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">
                {BLOCK_TYPES.find(bt => bt.type === child.type)?.label || child.type}
              </Badge>
              <span className="text-[9px] text-muted-foreground flex-1 truncate">
                {child.data.heading || child.data.title || child.data.text || child.data.body?.slice(0, 20) || "—"}
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingChildId(child.id)} title="এডিট">
                <Paintbrush className="w-2.5 h-2.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveChild(idx, "up")} disabled={idx === 0}>
                <MoveUp className="w-2.5 h-2.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveChild(idx, "down")} disabled={idx === children.length - 1}>
                <MoveDown className="w-2.5 h-2.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeChild(child.id)}>
                <Trash2 className="w-2.5 h-2.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Add child block */}
      <Select value="" onValueChange={(type) => addChild(type as Block["type"])}>
        <SelectTrigger className="h-8 text-[10px]">
          <SelectValue placeholder="+ চাইল্ড ব্লক যোগ করুন" />
        </SelectTrigger>
        <SelectContent>
          {childBlockTypes.map((bt) => (
            <SelectItem key={bt.type} value={bt.type}>
              <span className="flex items-center gap-1.5">
                <bt.icon className="w-3 h-3" /> {bt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function getDefaultData(type: Block["type"]): Record<string, any> {
  switch (type) {
    case "hero": return { title: "আপনার শিরোনাম লিখুন", subtitle: "এখানে বিস্তারিত বর্ণনা লিখুন", bgColor: "linear-gradient(135deg, hsl(142 40% 35%), hsl(142 50% 25%))" };
    case "text": return { heading: "শিরোনাম", body: "এখানে আপনার লেখা যোগ করুন। এই টেক্সট পরিবর্তন করে আপনার নিজের কন্টেন্ট দিন।" };
    case "heading": return { text: "আপনার শিরোনাম", level: 2 };
    case "paragraph": return { text: "এখানে আপনার প্যারাগ্রাফ লিখুন। এই টেক্সটটি পরিবর্তন করে আপনার নিজের কন্টেন্ট দিন।" };
    case "image": return { src: defaultAppleImg, alt: "ছবির বিবরণ" };
    case "button": return { text: "অর্ডার করুন", link: "/checkout", icon: "cart", variant: "default" };
    case "product": return { productId: "" };
    case "video": return { url: "" };
    case "features": return { heading: "আমাদের বৈশিষ্ট্য", items: [{ emoji: "🚀", title: "দ্রুত ডেলিভারি" }, { emoji: "🛡️", title: "গুণগত মান নিশ্চিত" }, { emoji: "💰", title: "সাশ্রয়ী মূল্য" }] };
    case "divider": return {};
    case "countdown": return { heading: "অফার শেষ হচ্ছে!", endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], subtitle: "তাড়াতাড়ি অর্ডার করুন!" };
    case "testimonial": return { heading: "গ্রাহকদের মতামত", items: [{ name: "রহিম উদ্দিন", text: "দারুণ পণ্য! খুবই সন্তুষ্ট। সবাইকে রেকমেন্ড করছি।", rating: 5 }, { name: "করিম সাহেব", text: "দ্রুত ডেলিভারি পেয়েছি, ধন্যবাদ!", rating: 4 }] };
    case "faq": return { heading: "সচরাচর জিজ্ঞাসা", items: [{ question: "ডেলিভারি কতদিনে হয়?", answer: "সাধারণত ২-৩ কর্মদিবসের মধ্যে ডেলিভারি দেওয়া হয়।" }, { question: "রিটার্ন পলিসি কী?", answer: "পণ্য পাওয়ার ৭ দিনের মধ্যে রিটার্ন করতে পারবেন।" }] };
    case "product-grid": return { heading: "আমাদের পণ্যসমূহ", category: "", limit: 6, cols: 2 };
    case "gallery": return { heading: "ফটো গ্যালারি", images: ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg", "/placeholder.svg"], cols: 2 };
    case "banner": return { text: "🔥 বিশেষ অফার চলছে! সীমিত সময়ের জন্য ৩০% ছাড়!", bgColor: "hsl(var(--primary))", textColor: "#ffffff", emoji: "" };
    case "social-proof": return { items: [{ value: "500+", label: "সন্তুষ্ট গ্রাহক" }, { value: "1000+", label: "অর্ডার ডেলিভারি" }, { value: "50+", label: "পণ্য" }] };
    case "spacer": return { height: "40px" };
    case "html": return { code: "<div style='padding:20px; text-align:center; background:#f0f0f0; border-radius:8px;'><p>আপনার কাস্টম HTML কোড এখানে লিখুন</p></div>" };
    case "comparison": return { heading: "তুলনা করুন", columns: ["আমরা", "অন্যরা"], rows: [{ feature: "গুণগত মান", values: ["✅", "❌"] }, { feature: "দাম", values: ["সাশ্রয়ী", "ব্যয়বহুল"] }, { feature: "ডেলিভারি", values: ["দ্রুত", "ধীর"] }] };
    case "pricing": return { heading: "মূল্য তালিকা", plans: [{ name: "বেসিক", price: "৫০০", features: ["ফিচার ১", "ফিচার ২"], buttonText: "অর্ডার করুন" }, { name: "প্রিমিয়াম", price: "১০০০", features: ["ফিচার ১", "ফিচার ২", "ফিচার ৩"], buttonText: "অর্ডার করুন", highlighted: true }] };
    case "contact-form": return { heading: "যোগাযোগ করুন", buttonText: "পাঠান" };
    case "map": return { embedUrl: "" };
    case "columns": return { cols: 2, items: [{ heading: "কলাম ১", body: "এখানে টেক্সট লিখুন" }, { heading: "কলাম ২", body: "এখানে টেক্সট লিখুন" }] };
    case "flex-container": return {
      direction: "row", gap: 12, justify: "flex-start", align: "center", wrap: "wrap",
      children: [
        { id: generateId(), type: "text", data: { heading: "আইটেম ১", body: "ফ্লেক্স কন্টেইনারের ভেতরে" } },
        { id: generateId(), type: "button", data: { text: "বাটন", link: "#", variant: "default" } },
      ],
    };
    case "grid-container": return {
      gridCols: 2, gap: 12,
      children: [
        { id: generateId(), type: "text", data: { heading: "সেল ১", body: "গ্রিড কন্টেইনারের ভেতরে" } },
        { id: generateId(), type: "image", data: { src: "/placeholder.svg", alt: "ছবি" } },
      ],
    };
    case "image-slider": return {
      heading: "",
      images: [
        { src: defaultAppleImg, alt: "স্লাইড ১", link: "" },
        { src: defaultAppleImg, alt: "স্লাইড ২", link: "" },
        { src: defaultAppleImg, alt: "স্লাইড ৩", link: "" },
      ],
      interval: 3,
      aspectRatio: "16/9",
      showArrows: true,
      showDots: true,
    };
    case "checkout-form": return {
      heading: "অর্ডার করতে ফর্মটি পূরণ করুন",
      showName: true, nameLabel: "আপনার নাম", namePlaceholder: "নাম লিখুন",
      phoneLabel: "ফোন নম্বর", phonePlaceholder: "01XXXXXXXXX",
      showAddress: true, addressLabel: "ঠিকানা", addressPlaceholder: "সম্পূর্ণ ঠিকানা লিখুন",
      showNote: false, noteLabel: "নোট", notePlaceholder: "বিশেষ কোনো তথ্য থাকলে লিখুন",
      showOverview: true, overviewTitle: "অর্ডার সামারি", overviewShowImage: true, overviewAllowQty: false,
      showDelivery: true, deliveryRules: [{ qty: 1, charge: 120 }, { qty: 2, charge: 100 }, { qty: 3, charge: 70 }], freeDeliveryAbove: 600,
      buttonText: "অর্ডার কনফার্ম করুন",
    };
    default: return {};
  }
}

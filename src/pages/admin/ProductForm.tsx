import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useLanguage } from "@/contexts/LanguageContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Upload, X, Loader2, Check, FolderOpen, Copy, EyeOff, Eye } from "lucide-react";
import { MediaPickerDialog } from "@/components/admin/MediaPickerDialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseVideoEmbed } from "@/lib/socialVideoEmbed";

const productSchema = z.object({
  name: z.string().min(1, "পণ্যের নাম আবশ্যক"),
  sku: z.string().optional(),
  slug: z.string().optional(),
  category: z.string().optional(),
  short_description: z.string().optional(),
  regular_price: z.coerce.number().min(0, "মূল্য ০ বা তার বেশি হতে হবে"),
  offer_price: z.coerce.number().optional().nullable(),
  buying_price: z.coerce.number().optional().nullable(),
  
  cash_back: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  stock_status_override: z.enum(["auto","in_stock","low_stock","out_of_stock"]).default("auto"),
  is_preorder: z.boolean().default(false),
  preorder_advance: z.coerce.number().min(0).default(0),
  preorder_note: z.string().optional().nullable(),
  position: z.coerce.number().int().min(0).default(0),
  full_description: z.string().optional(),
  variant_label: z.string().optional(),
  variants_text: z.string().optional(),
  video_url: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || v.trim() === "") return true;
        const t = v.trim();
        // Accept direct uploaded video files (mp4/webm/mov/m4v)
        if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(t)) return true;
        return parseVideoEmbed(t) !== null;
      },
      { message: "শুধুমাত্র YouTube/Facebook লিংক অথবা আপলোডকৃত ভিডিও ফাইল দিন" },
    ),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const isEdit = !!id;
  const backUrl = `/e/products${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [imageGallery, setImageGallery] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mainImagePickerOpen, setMainImagePickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [relatedOfferIds, setRelatedOfferIds] = useState<string[]>([]);
  const [relatedOfferDiscounts, setRelatedOfferDiscounts] = useState<Record<string, { type: "flat" | "percent"; value: number }>>({});
  const [offerPickerSearch, setOfferPickerSearch] = useState("");

  const { data: allProducts = [] } = useQuery({
    queryKey: ["all-products-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, product_image, regular_price, offer_price")
        .eq("is_hidden", false)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: availableTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: availableCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      slug: "",
      category: "",
      short_description: "",
      regular_price: 0,
      offer_price: null,
      buying_price: null,
      
      cash_back: 0,
      stock: 0,
      stock_status_override: "auto",
      is_preorder: false,
      preorder_advance: 0,
      preorder_note: "",
      full_description: "",
      variant_label: "",
      variants_text: "",
      video_url: "",
    },
  });

  // Slugify: lowercase, Bangla/English/digits kept, spaces & punctuation → '-'
  const slugify = (input: string) =>
    (input || "")
      .toLowerCase()
      .trim()
      // Keep letters, marks (Bangla vowel signs/halant), and numbers
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

  // Auto-fill slug from name ONLY for new products (no existing slug).
  // In edit mode, never overwrite the saved slug — admin's custom URL must be preserved.
  const nameWatch = form.watch("name");
  useEffect(() => {
    if (isEdit) return; // never auto-rewrite an existing product's slug
    const currentSlug = form.getValues("slug") || "";
    const dirty = form.getFieldState("slug").isDirty;
    if (!dirty && !currentSlug) {
      form.setValue("slug", slugify(nameWatch || ""), { shouldDirty: false });
    }
  }, [nameWatch, isEdit]);

  useEffect(() => {
    if (isEdit) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id!)
      .single();

    if (error) {
      toast.error("পণ্য লোড করতে সমস্যা হয়েছে");
      return;
    }

    if (data) {
      form.reset({
        name: data.name,
        sku: data.sku,
        slug: data.slug || "",
        category: data.category || "",
        short_description: data.short_description || "",
        regular_price: data.regular_price,
        offer_price: data.offer_price,
        buying_price: data.buying_price,
        
        cash_back: (data as any).cash_back ?? 0,
        stock: data.stock,
        stock_status_override: ((data as any).stock_status_override as any) || "auto",
        is_preorder: !!(data as any).is_preorder,
        preorder_advance: Number((data as any).preorder_advance ?? 0),
        preorder_note: (data as any).preorder_note || "",
        position: data.position || 0,
        full_description: data.full_description || "",
        variant_label: (data as any).variant_label || "",
        variants_text: Array.isArray((data as any).variants) ? (data as any).variants.join("\n") : "",
        video_url: (data as any).video_url || "",
      });
      setProductImage(data.product_image);
      setImageGallery(data.image_gallery || []);
      setIsHidden((data as any).is_hidden || false);
      setRelatedOfferIds(Array.isArray((data as any).related_offer_product_ids) ? (data as any).related_offer_product_ids : []);
      const rawDiscounts = (data as any).related_offer_discounts;
      setRelatedOfferDiscounts(rawDiscounts && typeof rawDiscounts === "object" ? rawDiscounts : {});
      // Parse comma-separated tags
      if (data.tag) {
        setSelectedTags(data.tag.split(",").map((t: string) => t.trim()).filter(Boolean));
      }
      // Multi-category: prefer array column, fall back to single
      const cats = Array.isArray((data as any).categories) ? (data as any).categories.filter(Boolean) : [];
      setSelectedCategories(cats.length ? cats : (data.category ? [data.category] : []));
    }
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    let fileToUpload = file;
    if (file.type.startsWith("image/")) {
      const { addWatermarkToImage } = await import("@/lib/watermark");
      fileToUpload = await addWatermarkToImage(file);
    }
    const fileExt = fileToUpload.name.split(".").pop() || "webp";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(fileName, fileToUpload);

    if (error) {
      toast.error("ছবি আপলোড করতে সমস্যা হয়েছে");
      return null;
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    const url = await uploadImage(file);
    if (url) setProductImage(url);
    setImageLoading(false);
  };

  const handleGalleryImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setImageLoading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadImage(file);
      if (url) urls.push(url);
    }
    setImageGallery((prev) => [...prev, ...urls]);
    setImageLoading(false);
  };

  const removeGalleryImage = (index: number) => {
    setImageGallery((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: ProductFormValues) => {
    // Validate offer price
    if (values.offer_price && values.offer_price > values.regular_price) {
      toast.error("অফার মূল্য রেগুলার মূল্যের চেয়ে বেশি হতে পারে না");
      return;
    }

    // Auto-remove offer price if same as regular
    let finalOfferPrice = values.offer_price || null;
    if (finalOfferPrice && finalOfferPrice === values.regular_price) {
      finalOfferPrice = null;
    }

    setLoading(true);

    const slugValue = (values.slug?.trim() || slugify(values.name)) || null;

    const productData: any = {
      name: values.name,
      sku: (values.sku?.trim()) || `SKU-${Date.now().toString(36).toUpperCase()}`,
      slug: slugValue,
      category: selectedCategories[0] || values.category || null,
      categories: selectedCategories.length > 0 ? selectedCategories : (values.category ? [values.category] : []),
      tag: selectedTags.length > 0 ? selectedTags.join(", ") : null,
      short_description: values.short_description || null,
      regular_price: values.regular_price,
      offer_price: finalOfferPrice,
      buying_price: values.buying_price || null,
      stock: values.stock,
      stock_status_override: values.stock_status_override,
      is_preorder: !!values.is_preorder,
      preorder_advance: values.is_preorder ? Number(values.preorder_advance || 0) : 0,
      preorder_note: values.is_preorder ? (values.preorder_note?.trim() || null) : null,
      position: values.position,
      full_description: values.full_description || null,
      variant_label: values.variant_label?.trim() || null,
      variants: values.variants_text?.trim()
        ? values.variants_text.split("\n").map((s) => s.trim()).filter(Boolean)
        : null,
      video_url: values.video_url?.trim() || null,
      cash_back: values.cash_back || 0,
      product_image: productImage,
      image_gallery: imageGallery.length > 0 ? imageGallery : null,
      is_hidden: isHidden,
      related_offer_product_ids: relatedOfferIds.length > 0 ? relatedOfferIds : null,
      related_offer_discounts: (() => {
        const filtered: Record<string, { type: "flat" | "percent"; value: number }> = {};
        relatedOfferIds.forEach((pid) => {
          const d = relatedOfferDiscounts[pid];
          if (d && d.value > 0) filtered[pid] = { type: d.type === "percent" ? "percent" : "flat", value: Number(d.value) };
        });
        return Object.keys(filtered).length > 0 ? filtered : null;
      })(),
    };


    let error;

    if (isEdit) {
      const { error: updateError, data: updated } = await supabase
        .from("products")
        .update(productData)
        .eq("id", id!)
        .select();
      error = updateError;
      if (!updateError && (!updated || updated.length === 0)) {
        setLoading(false);
        toast.error("আপডেট করা যায়নি। আপনি লগইন আছেন কিনা নিশ্চিত করুন।");
        return;
      }
    } else {
      ({ error } = await supabase.from("products").insert([productData]));
    }

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Invalidate every cache that touches products/categories so admin & customer views update instantly.
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = String(q.queryKey?.[0] ?? "");
        return /product|categor|shop|home|inventory|tag-products|related|flash|ghost|top-|review/i.test(k);
      },
    });
    try {
      localStorage.removeItem("cached-categories-v5");
      // Clear any cached product lists keyed in localStorage
      Object.keys(localStorage).forEach((k) => {
        if (/^cached-(products|categories|shop|home)/i.test(k)) localStorage.removeItem(k);
      });
    } catch {}

    toast.success(isEdit ? "পণ্য আপডেট হয়েছে" : "পণ্য তৈরি হয়েছে");
    navigate(backUrl);
  };

  const handleDuplicate = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      toast.error("পণ্য লোড করতে সমস্যা হয়েছে");
      return;
    }
    const { id: _id, created_at, updated_at, slug, sku, ...rest } = data;
    const newSku = sku + "-copy-" + Date.now().toString(36).slice(-4);
    const { data: newProduct, error: insertErr } = await supabase
      .from("products")
      .insert([{ ...rest, sku: newSku, slug: null, name: data.name + " (কপি)" }])
      .select()
      .single();
    if (insertErr) {
      toast.error(insertErr.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    toast.success("পণ্য ডুপ্লিকেট হয়েছে!");
    navigate(`/e/products/edit/${newProduct.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(backUrl)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          {isEdit && (
            <>
              <div className="flex items-center gap-2">
                {isHidden ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-primary" />}
                <Switch checked={isHidden} onCheckedChange={setIsHidden} />
                <span className="text-xs text-muted-foreground">{isHidden ? t("লুকানো", "Hidden") : t("দৃশ্যমান", "Visible")}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-1.5" />
                {t("ডুপ্লিকেট", "Duplicate")}
              </Button>
            </>
          )}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("মৌলিক তথ্য", "Basic Info")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                   <FormLabel>{t("পণ্যের নাম", "Product Name")} *</FormLabel>
                  <FormControl><Input placeholder={t("পণ্যের নাম লিখুন", "Enter product name")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sku" render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl><Input placeholder={t("ফাঁকা রাখলে অটো তৈরি হবে", "Auto-generated if empty")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="slug" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>{t("স্লাগ (URL)", "Slug (URL)")}</FormLabel>
                  <FormControl><Input placeholder={t("যেমন: product-slug-name (ফাঁকা রাখলে অটো তৈরি হবে)", "e.g. product-slug-name (auto-generated if empty)")} {...field} /></FormControl>
                  <p className="text-xs text-muted-foreground mt-1">{t("নাম থেকে অটো তৈরি হয়। প্রয়োজনে এডিট করুন। URL: /product/your-slug", "Auto-generated from name. Edit if needed. URL: /product/your-slug")}</p>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={() => (
                <FormItem className="md:col-span-2">
                   <FormLabel>{t("ক্যাটাগরি (একাধিক বাছাই করা যাবে)", "Categories (multi-select)")}</FormLabel>
                  <div className="flex flex-wrap gap-2 p-3 border border-border rounded-lg min-h-[48px]">
                    {availableCategories.map((cat) => {
                      const isSelected = selectedCategories.includes(cat.name);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() =>
                            setSelectedCategories((prev) =>
                              isSelected ? prev.filter((n) => n !== cat.name) : [...prev, cat.name]
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            isSelected
                              ? "bg-secondary text-secondary-foreground border-secondary"
                              : "bg-muted text-muted-foreground border-border hover:border-secondary/50"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {cat.name}
                        </button>
                      );
                    })}
                    {availableCategories.length === 0 && (
                      <span className="text-xs text-muted-foreground">{t("কোনো ক্যাটাগরি পাওয়া যায়নি।", "No categories found.")}</span>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              {/* Dynamic Tag Selector */}
              <div className="md:col-span-2 space-y-2">
                <Label>{t("ট্যাগ সমূহ", "Tags")}</Label>
                <div className="flex flex-wrap gap-2 p-3 border border-border rounded-lg min-h-[48px]">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.name);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        {tag.name}
                      </button>
                    );
                  })}
                  {availableTags.length === 0 && (
                    <span className="text-xs text-muted-foreground">{t("কোনো ট্যাগ পাওয়া যায়নি। প্রথমে ট্যাগ তৈরি করুন।", "No tags found. Create tags first.")}</span>
                  )}
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button type="button" onClick={() => toggleTag(tag)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <FormField control={form.control} name="short_description" render={({ field }) => (
                <FormItem className="md:col-span-2">
                   <FormLabel>{t("সংক্ষিপ্ত বিবরণ", "Short Description")}</FormLabel>
                  <FormControl><Textarea placeholder={t("পণ্যের সংক্ষিপ্ত বিবরণ", "Short product description")} rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="variant_label" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ভ্যারিয়েন্ট লেবেল (যেমন: সাইজ, কালার)", "Variant Label")}</FormLabel>
                  <FormControl><Input placeholder="সাইজ" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="variants_text" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ভ্যারিয়েন্ট অপশন (প্রতি লাইনে একটি)", "Variant Options (one per line)")}</FormLabel>
                  <FormControl><Textarea placeholder={"M\nL\nXL\nXXL"} rows={4} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("ছবি", "Images")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("প্রোডাক্ট ইমেজ", "Product Image")} *</Label>
                <div className="mt-2 flex items-center gap-4">
                  {productImage ? (
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                      <img src={productImage} alt="Product" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setProductImage(null)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMainImagePickerOpen(true)}
                      className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                    >
                      <FolderOpen className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">{t("ছবি নির্বাচন", "Select Image")}</span>
                    </button>
                  )}
                </div>
                <MediaPickerDialog
                  open={mainImagePickerOpen}
                  onOpenChange={setMainImagePickerOpen}
                  onSelect={(url) => setProductImage(url)}
                  titleContext={nameWatch}
                />
              </div>

              <div>
                <Label>{t("ইমেজ গ্যালারি (ঐচ্ছিক)", "Image Gallery (Optional)")}</Label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {imageGallery.map((url, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                      <img src={url} alt={`Gallery ${i}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(i)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setGalleryPickerOpen(true)}
                    className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                  >
                    <FolderOpen className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">{t("যোগ করুন", "Add")}</span>
                  </button>
                </div>
                <MediaPickerDialog
                  open={galleryPickerOpen}
                  onOpenChange={setGalleryPickerOpen}
                  multiple
                  onSelect={(url) => setImageGallery((prev) => [...prev, url])}
                  onSelectMultiple={(urls) => setImageGallery((prev) => [...prev, ...urls])}
                  titleContext={nameWatch}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("মূল্য", "Pricing")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="regular_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("নিয়মিত মূল্য", "Regular Price")} *</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="০" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="offer_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("অফার মূল্য", "Offer Price")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="ঐচ্ছিক" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="buying_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ক্রয় মূল্য", "Buying Price")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="ঐচ্ছিক" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cash_back" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ক্যাশব্যাক", "Cashback")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="০" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stock" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("স্টক", "Stock")} *</FormLabel>
                  <FormControl><Input type="number" placeholder="০" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stock_status_override" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>{t("স্টক স্ট্যাটাস (ম্যানুয়াল)", "Stock Status (Manual)")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "auto"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="auto">{t("অটো (স্টক অনুযায়ী)", "Auto (based on stock)")}</SelectItem>
                      <SelectItem value="in_stock">✓ {t("স্টক আছে", "In stock")}</SelectItem>
                      <SelectItem value="low_stock">⚠ {t("খুবই কম স্টক", "Very low stock")}</SelectItem>
                      <SelectItem value="out_of_stock">✗ {t("স্টক নাই", "Out of stock")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="position" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("পজিশন নম্বর", "Position Number")}</FormLabel>
                  <FormControl><Input type="number" placeholder="০" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Pre-Order Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("প্রি-অর্ডার সেটিংস", "Pre-Order Settings")}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "চালু করলে এই পণ্যে 'অর্ডার করুন' এর জায়গায় 'প্রি-অর্ডার' দেখাবে এবং চেকআউটে অগ্রিম পেমেন্ট বাধ্যতামূলক হবে।",
                  "If enabled, this product will show 'Pre-Order' instead of 'Order Now', and an advance payment will be required at checkout."
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="is_preorder" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel className="text-sm font-medium">{t("প্রি-অর্ডার হিসেবে দেখাও", "Show as Pre-Order")}</FormLabel>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t("সাইটের সব জায়গায় অর্ডার বাটন প্রি-অর্ডারে পরিবর্তন হবে।", "Order button changes to Pre-Order site-wide.")}</p>
                  </div>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="preorder_advance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("অগ্রিম টাকা (প্রতি ইউনিট) *", "Advance (per unit) *")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min={0}
                        placeholder="৳ 0"
                        disabled={!form.watch("is_preorder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="preorder_note" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("নোট (ঐচ্ছিক)", "Note (optional)")}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t("যেমন: ১০-১৫ দিনে ডেলিভারি", "e.g. delivery in 10-15 days")}
                        disabled={!form.watch("is_preorder")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>


          {/* Related Offer Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("অর্ডার পপআপে অফার পণ্য (ঐচ্ছিক)", "Offer Products in Order Popup (Optional)")}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "এই পণ্য অর্ডার করার সময় পপআপের 'এই অফারগুলোও দেখুন' সেকশনে কোন পণ্যগুলো দেখানো হবে নির্বাচন করুন। কিছু নির্বাচন না করলে অটো অফার পণ্য দেখানো হবে।",
                  "Choose which products appear in the 'এই অফারগুলোও দেখুন' section of the order popup. If none selected, auto offer products are shown."
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {relatedOfferIds.length > 0 && (
                <div className="space-y-2">
                  {relatedOfferIds.map((pid) => {
                    const p = allProducts.find((x: any) => x.id === pid);
                    const d = relatedOfferDiscounts[pid] || { type: "flat" as const, value: 0 };
                    const basePrice = p ? (p.offer_price || p.regular_price) : 0;
                    const effective = d.type === "percent"
                      ? Math.max(1, Math.round(basePrice * (1 - (d.value || 0) / 100)))
                      : Math.max(1, basePrice - (d.value || 0));
                    return (
                      <div key={pid} className="flex items-center gap-2 p-2 border border-border rounded-lg bg-muted/30">
                        {p?.product_image && <img src={p.product_image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{(p as any)?.name || pid.slice(0, 6) + "…"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {t("মূল", "Base")}: ৳{basePrice}
                            {d.value > 0 && <> → <span className="text-primary font-semibold">৳{effective}</span></>}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={d.value || ""}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setRelatedOfferDiscounts((prev) => ({ ...prev, [pid]: { type: prev[pid]?.type || "flat", value: v } }));
                          }}
                          className="w-20 h-8 text-xs"
                        />
                        <select
                          value={d.type}
                          onChange={(e) => {
                            const newType = e.target.value === "percent" ? "percent" : "flat";
                            setRelatedOfferDiscounts((prev) => ({ ...prev, [pid]: { type: newType, value: prev[pid]?.value || 0 } }));
                          }}
                          className="h-8 text-xs border border-input rounded bg-background px-1"
                        >
                          <option value="flat">৳</option>
                          <option value="percent">%</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setRelatedOfferIds((prev) => prev.filter((x) => x !== pid));
                            setRelatedOfferDiscounts((prev) => { const n = { ...prev }; delete n[pid]; return n; });
                          }}
                          className="p-1 hover:text-destructive"
                          aria-label="remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Input
                placeholder={t("পণ্য খুঁজুন...", "Search products...")}
                value={offerPickerSearch}
                onChange={(e) => setOfferPickerSearch(e.target.value)}
              />
              <div className="max-h-72 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {allProducts
                  .filter((p: any) => p.id !== id)
                  .filter((p: any) => {
                    const q = offerPickerSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (p.name || "").toLowerCase().includes(q);
                  })
                  .slice(0, 50)
                  .map((p: any) => {
                    const selected = relatedOfferIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setRelatedOfferIds((prev) =>
                            selected ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                          );
                          if (selected) {
                            setRelatedOfferDiscounts((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
                          }
                        }}
                        className={`w-full flex items-center gap-3 p-2 text-left hover:bg-muted transition ${
                          selected ? "bg-primary/5" : ""
                        }`}
                      >
                        <img
                          src={p.product_image || "/placeholder.svg"}
                          alt=""
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ৳{p.offer_price || p.regular_price}
                            {p.offer_price && p.offer_price < p.regular_price && (
                              <span className="line-through ml-1">৳{p.regular_price}</span>
                            )}
                          </p>
                        </div>
                        {selected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                {allProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3 text-center">
                    {t("কোনো পণ্য পাওয়া যায়নি", "No products found")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Full Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("বিস্তারিত বিবরণ (ঐচ্ছিক)", "Full Description (Optional)")}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="full_description" render={({ field }) => (
                <FormItem>
                  <FormControl><Textarea placeholder={t("পণ্যের বিস্তারিত বিবরণ লিখুন...", "Write detailed product description...")} rows={8} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Video URL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("পণ্যের ভিডিও (ঐচ্ছিক)", "Product Video (Optional)")}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="video_url" render={({ field }) => {
                const currentVal = (field.value || "").trim();
                const isUploaded = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(currentVal);
                const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const allowed = ["video/mp4", "video/webm", "video/quicktime"];
                  if (!allowed.includes(file.type)) {
                    toast.error("শুধু MP4 / WebM / MOV ফাইল আপলোড করা যাবে");
                    return;
                  }
                  if (file.size > 100 * 1024 * 1024) {
                    toast.error("ভিডিও সর্বোচ্চ 100MB হতে পারে");
                    return;
                  }
                  try {
                    setVideoUploading(true);
                    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
                    const safe = (form.getValues("sku") || "faris-seed-product")
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, "-")
                      .replace(/-+/g, "-")
                      .slice(0, 40) || "faris-seed-product";
                    const path = `${safe}/${Date.now()}-faris-seed-${safe}.${ext}`;
                    const { error: upErr } = await supabase.storage
                      .from("product-videos")
                      .upload(path, file, { contentType: file.type, upsert: false });
                    if (upErr) throw upErr;
                    const { data } = supabase.storage.from("product-videos").getPublicUrl(path);
                    field.onChange(data.publicUrl);
                    toast.success("ভিডিও আপলোড সম্পন্ন");
                  } catch (err: any) {
                    toast.error(err?.message || "আপলোড ব্যর্থ");
                  } finally {
                    setVideoUploading(false);
                    e.target.value = "";
                  }
                };
                return (
                  <FormItem>
                    <FormLabel>{t("ভিডিও লিংক বা ফাইল আপলোড", "Video URL or upload")}</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://youtube.com/watch?v=... অথবা ফাইল আপলোড করুন"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-secondary text-secondary-foreground text-sm cursor-pointer hover:bg-secondary/80">
                        {videoUploading ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> {t("আপলোড হচ্ছে...", "Uploading...")}</>
                        ) : (
                          <><Upload className="h-4 w-4" /> {t("ভিডিও ফাইল আপলোড", "Upload video file")}</>
                        )}
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          disabled={videoUploading}
                          onChange={handleUpload}
                        />
                      </label>
                      {currentVal && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => field.onChange("")}
                        >
                          <X className="h-4 w-4 mr-1" /> {t("সরান", "Clear")}
                        </Button>
                      )}
                      {isUploaded && (
                        <Badge variant="secondary">{t("আপলোডকৃত ফাইল", "Uploaded file")}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t(
                        "YouTube/Facebook লিংক দিন অথবা MP4/WebM/MOV ফাইল আপলোড করুন (সর্বোচ্চ ১০০MB)। সেট করলে পণ্যের ছবির উপরে লাল প্লে আইকন দেখা যাবে।",
                        "Paste a YouTube/Facebook link or upload an MP4/WebM/MOV file (max 100MB). When set, a red play icon appears on the product image.",
                      )}
                    </p>
                    <FormMessage />
                  </FormItem>
                );
              }} />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(backUrl)}>
              {t("বাতিল", "Cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? t("আপডেট করুন", "Update") : t("পণ্য তৈরি করুন", "Create Product")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
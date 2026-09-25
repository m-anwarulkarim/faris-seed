import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText, Home, ShoppingBag, User, Info, CreditCard, Sprout, Gift,
  Plus, Pencil, Trash2, ExternalLink, Lock, Globe, Eye, EyeOff,
  Grid3X3, Heart, MessageCircle, Settings, HelpCircle, Shield, ScrollText,
  Star, Tag,
} from "lucide-react";
import { toast } from "sonner";

interface BuiltInPage {
  titleBn: string;
  titleEn: string;
  slug: string;
  icon: React.ElementType;
  descBn: string;
  descEn: string;
}

const builtInPages: BuiltInPage[] = [
  { titleBn: "হোম", titleEn: "Home", slug: "/", icon: Home, descBn: "মূল পেজ", descEn: "Landing page" },
  { titleBn: "শপ", titleEn: "Shop", slug: "/products", icon: ShoppingBag, descBn: "সকল পণ্য", descEn: "All products" },
  { titleBn: "ক্যাটাগরি", titleEn: "Categories", slug: "/categories", icon: Grid3X3, descBn: "পণ্যের ক্যাটাগরি", descEn: "Product categories" },
  { titleBn: "প্রফাইল", titleEn: "Profile", slug: "/profile", icon: User, descBn: "ব্যবহারকারীর প্রফাইল", descEn: "User profile" },
  { titleBn: "আমাদের সম্পর্কে", titleEn: "About Us", slug: "/contact", icon: Info, descBn: "যোগাযোগ ও তথ্য", descEn: "Contact & info" },
  { titleBn: "চেকআউট", titleEn: "Checkout", slug: "/checkout", icon: CreditCard, descBn: "অর্ডার সম্পন্ন করুন", descEn: "Complete order" },
  { titleBn: "কৃষি সেবা", titleEn: "Services", slug: "/services", icon: Sprout, descBn: "কৃষি সেবা সমূহ", descEn: "Agriculture services" },
  { titleBn: "অফার", titleEn: "Offers", slug: "/offers", icon: Gift, descBn: "বিশেষ অফার সমূহ", descEn: "Special offers" },
  { titleBn: "উইশলিস্ট", titleEn: "Wishlist", slug: "/wishlist", icon: Heart, descBn: "পছন্দের তালিকা", descEn: "Saved favorites" },
  { titleBn: "মেসেজ", titleEn: "Messages", slug: "/messages", icon: MessageCircle, descBn: "ব্যক্তিগত মেসেজ", descEn: "Direct messages" },
  { titleBn: "সেটিংস", titleEn: "Settings", slug: "/settings", icon: Settings, descBn: "অ্যাকাউন্ট সেটিংস", descEn: "Account settings" },
  { titleBn: "সাহায্য", titleEn: "Help", slug: "/help", icon: HelpCircle, descBn: "সাহায্য ও সাপোর্ট", descEn: "Help & support" },
  { titleBn: "রিভিউ দিন", titleEn: "Add Review", slug: "/add-review", icon: Star, descBn: "পণ্যের রিভিউ দিন", descEn: "Write a product review" },
  
  { titleBn: "প্রাইভেসি পলিসি", titleEn: "Privacy Policy", slug: "/privacy-policy", icon: Shield, descBn: "গোপনীয়তা নীতি", descEn: "Privacy policy" },
  { titleBn: "শর্তাবলী", titleEn: "Terms of Service", slug: "/terms-of-service", icon: ScrollText, descBn: "ব্যবহারের শর্তাবলী", descEn: "Terms of service" },
];

interface CustomPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  is_published: boolean;
  created_at: string;
}

export default function PagesManagement() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [dynamicPages, setDynamicPages] = useState<BuiltInPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchCustomPages = async () => {
    const { data, error } = await supabase
      .from("custom_pages")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setCustomPages(data as CustomPage[]);
    setLoading(false);
  };

  const fetchDynamicPages = async () => {
    const [catRes, tagRes] = await Promise.all([
      supabase.from("categories").select("name, display_name").order("position"),
      supabase.from("tags").select("name").order("created_at"),
    ]);
    const pages: BuiltInPage[] = [];
    if (catRes.data) {
      for (const cat of catRes.data) {
        const slug = `/products/${encodeURIComponent(cat.name)}`;
        pages.push({
          titleBn: cat.display_name || cat.name,
          titleEn: cat.display_name || cat.name,
          slug,
          icon: Grid3X3,
          descBn: `ক্যাটাগরি পেজ`,
          descEn: `Category page`,
        });
      }
    }
    if (tagRes.data) {
      for (const tag of tagRes.data) {
        pages.push({
          titleBn: tag.name,
          titleEn: tag.name,
          slug: `/tag/${encodeURIComponent(tag.name)}`,
          icon: Tag,
          descBn: `ট্যাগ পেজ`,
          descEn: `Tag page`,
        });
      }
    }
    setDynamicPages(pages);
  };

  useEffect(() => { fetchCustomPages(); fetchDynamicPages(); }, []);




  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("custom_pages").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else toast.success(t("পেজ ডিলিট হয়েছে", "Page deleted"));
    setDeleteId(null);
    fetchCustomPages();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={() => navigate("/admin/website/pages/new")} className="gap-2">
          <Plus className="w-4 h-4" /> {t("নতুন পেজ", "New Page")}
        </Button>
      </div>

      {/* Custom Pages - on top */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" /> {t("কাস্টম পেজ", "Custom Pages")}
          <Badge variant="secondary">{customPages.length}</Badge>
        </h2>

        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">{t("লোড হচ্ছে...", "Loading...")}</div>
        ) : customPages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t("কোনো কাস্টম পেজ নেই", "No custom pages yet")}</p>
              <Button variant="outline" className="mt-3 gap-2" onClick={() => navigate("/admin/website/pages/new")}>
                <Plus className="w-4 h-4" /> {t("প্রথম পেজ তৈরি করুন", "Create your first page")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {customPages.map((page) => (
              <Card key={page.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{page.title}</p>
                    <p className="text-xs text-muted-foreground">{page.slug}</p>
                  </div>
                  <Badge variant={page.is_published ? "default" : "secondary"} className="text-[10px] gap-1 shrink-0">
                    {page.is_published ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                    {page.is_published ? t("প্রকাশিত", "Published") : t("ড্রাফট", "Draft")}
                  </Badge>
                  <div className="flex gap-1.5 shrink-0">
                    <a href={`/p/${page.slug.startsWith("/") ? page.slug.slice(1) : page.slug}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                        <ExternalLink className="w-3 h-3" /> {t("ভিজিট", "Visit")}
                      </Button>
                    </a>
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => navigate(`/admin/website/pages/edit/${page.id}`)}>
                      <Pencil className="w-3 h-3" /> {t("এডিট", "Edit")}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(page.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Built-in Pages - below */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" /> {t("বিল্ট-ইন পেজ", "Built-in Pages")}
          <Badge variant="secondary">{builtInPages.length}</Badge>
        </h2>
        <div className="space-y-2">
          {builtInPages.map((page) => (
            <Card key={page.slug} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <page.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{t(page.titleBn, page.titleEn)}</p>
                  <p className="text-xs text-muted-foreground">{page.slug} — {t(page.descBn, page.descEn)}</p>
                </div>
                <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                  <Lock className="w-2.5 h-2.5" /> {t("স্থায়ী", "Fixed")}
                </Badge>
                <a href={page.slug} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1 text-xs h-7 shrink-0">
                    <ExternalLink className="w-3 h-3" /> {t("ভিজিট", "Visit")}
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dynamic Pages (Categories & Tags) */}
      {dynamicPages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Grid3X3 className="w-4 h-4 text-muted-foreground" /> {t("ক্যাটাগরি ও ট্যাগ পেজ", "Category & Tag Pages")}
            <Badge variant="secondary">{dynamicPages.length}</Badge>
          </h2>
          <div className="space-y-2">
            {dynamicPages.map((page) => (
              <Card key={page.slug} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-accent/50 flex items-center justify-center shrink-0">
                    <page.icon className="w-4.5 h-4.5 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{t(page.titleBn, page.titleEn)}</p>
                    <p className="text-xs text-muted-foreground truncate">{decodeURIComponent(page.slug)} — {t(page.descBn, page.descEn)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                    {t("ডায়নামিক", "Dynamic")}
                  </Badge>
                  <a href={page.slug} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 shrink-0">
                      <ExternalLink className="w-3 h-3" /> {t("ভিজিট", "Visit")}
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("পেজ ডিলিট করবেন?", "Delete this page?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("এই পেজটি স্থায়ীভাবে মুছে ফেলা হবে।", "This page will be permanently deleted.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("বাতিল", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("ডিলিট", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

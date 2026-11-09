import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink, FileDown, FileCode2, Check, AlertTriangle, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const SITE_URL = typeof window !== "undefined" && window.location.origin.includes("localhost")
  ? "https://farisshop.com"
  : (typeof window !== "undefined" ? window.location.origin : "https://farisshop.com");

const XML_URL = `${SITE_URL}/facebook-catalog.xml`;
const CSV_URL = `${SITE_URL}/facebook-catalog.csv`;

export default function FacebookCatalog() {
  const [copied, setCopied] = useState<string | null>(null);

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["facebook-catalog-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, short_description, full_description, product_image, regular_price, offer_price, stock, category, sku, is_hidden")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    toast.success("লিঙ্ক কপি হয়েছে");
    setTimeout(() => setCopied(null), 1500);
  };

  const downloadLiveCsv = () => {
    if (!products || products.length === 0) {
      toast.error("কোনো প্রোডাক্ট পাওয়া যায়নি");
      return;
    }

    const headers = [
      "id", "title", "description", "availability", "condition",
      "price", "link", "image_link", "brand", "product_type", "google_product_category",
    ];

    const escapeCsv = (v: any) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = products.map((p) => {
      const price = Number(p.offer_price || p.regular_price || 0);
      const link = `${SITE_URL}/products/${p.slug || p.id}`;
      const image = p.product_image?.startsWith("http")
        ? p.product_image
        : `${SITE_URL}${p.product_image || ""}`;
      const availability = (p.stock ?? 0) > 0 ? "in stock" : "out of stock";
      const description = (p.short_description || p.full_description || p.name || "")
        .replace(/<[^>]+>/g, "")
        .slice(0, 4900);

      const obj: Record<string, string> = {
        id: p.sku || p.id,
        title: (p.name || "Product").slice(0, 150),
        description,
        availability,
        condition: "new",
        price: `${price.toFixed(2)} BDT`,
        link,
        image_link: image,
        brand: "Faris Seed",
        product_type: p.category || "Flower Seeds",
        google_product_category: "Home & Garden > Plants > Seeds",
      };

      return headers.map((h) => escapeCsv(obj[h])).join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `faris-seed-catalog-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("তাজা ক্যাটালগ CSV ডাউনলোড সম্পন্ন হয়েছে!");
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Facebook & Meta Catalog Feed
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Meta Commerce Manager-এ এই ফিড যুক্ত করলে আপনার ফেসবুক ও ইনস্টাগ্রাম শপ/বিজ্ঞাপনে বীজ ও আসল প্রোডাক্ট স্বয়ংক্রিয়ভাবে আপডেট হবে।
        </p>
      </div>

      {/* Alert about old ad data / t-shirt issue */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-amber-800 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            বিজ্ঞাপনে পুরনো/টি-শার্টের ছবি কেন আসছিল এবং কীভাবে ঠিক করবেন?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-950 dark:text-amber-200">
          <p>
            Facebook Advantage+ বা Dynamic Catalog Ads আপনার <strong>Meta Commerce Manager</strong>-এর ক্যাটালগ থেকে প্রোডাক্টের ছবি টানে। অতীতে আপনার মেটা ক্যাটালগে পুরনো কোনো ডেমো বা টি-শার্টের ফাইল আপলোড করা ছিল। 
          </p>
          <div className="bg-white/80 dark:bg-black/30 p-3 rounded-lg border border-amber-200/80 space-y-1.5 text-xs font-medium">
            <p className="font-bold text-amber-900 dark:text-amber-300">এখন যা করতে হবে (২ মিনিট সময় লাগবে):</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li><strong>Meta Commerce Manager</strong> (<a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer" className="text-primary underline">business.facebook.com/commerce</a>)-এ যান।</li>
              <li>আপনার Catalog সিলেক্ট করে বাম পাশের <strong>Catalog &gt; Items</strong>-এ যান। পুরনো টি-শার্ট বা অপ্রয়োজনীয় প্রোডাক্টগুলো সিলেক্ট করে <strong>Delete</strong> করুন।</li>
              <li>এরপর বাম মেনুর <strong>Data Sources &gt; Data feeds</strong>-এ গিয়ে নিচের <strong>Scheduled Feed URL</strong> বসিয়ে দিন অথবা সরাসরি নিচের বাটন দিয়ে <strong>CSV ডাউনলোড</strong> করে আপলোড করুন।</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Feed URLs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* XML Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCode2 className="w-5 h-5 text-primary" /> Scheduled Feed (অটো-আপডেট)
            </CardTitle>
            <CardDescription className="text-xs">
              মেটা কমার্স ম্যানেজার নিজে থেকেই প্রতি ঘণ্টা/দিনে এই লিঙ্ক থেকে ডেটা নিয়ে আপডেট রাখবে।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={XML_URL} className="font-mono text-xs" />
              <Button onClick={() => copy(XML_URL, "xml")} variant="secondary" size="sm">
                {copied === "xml" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={XML_URL} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Meta: <strong>Data Sources &gt; Add Items &gt; Data feed &gt; Set a schedule</strong> এ পেস্ট করুন।
            </p>
          </CardContent>
        </Card>

        {/* CSV Direct Download */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileDown className="w-5 h-5 text-secondary" /> Instant CSV Export (তাত্ক্ষণিক)
            </CardTitle>
            <CardDescription className="text-xs">
              এক ক্লিকে আপনার বর্তমান সব সঠিক প্রোডাক্টের ফাইল ডাউনলোড করে সরাসরি ফেসবুকে দিন।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={downloadLiveCsv} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              <FileDown className="w-4 h-4" />
              তাজা CSV ডাউনলোড করুন ({products?.length || 0} টি প্রোডাক্ট)
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Meta: <strong>Add Items &gt; Data feed &gt; Upload from computer</strong> এ ফাইলটি দিন।
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product Live Preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              ক্যাটালগে অন্তর্ভুক্ত প্রোডাক্টসমূহ ({products?.length || 0})
            </CardTitle>
            <CardDescription className="text-xs">
              এই প্রোডাক্টগুলোই এখন ফেসবুকের ক্যাটালগ ও বিজ্ঞাপনে প্রদর্শিত হবে।
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> রিফ্রেশ
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">লোড হচ্ছে...</p>
          ) : !products || products.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">কোনো প্রোডাক্ট পাওয়া যায়নি</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ছবি</TableHead>
                    <TableHead>নাম ও SKU</TableHead>
                    <TableHead>ক্যাটাগরি</TableHead>
                    <TableHead className="text-right">মূল্য</TableHead>
                    <TableHead className="text-center">স্টক</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const price = Number(p.offer_price || p.regular_price || 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          {p.product_image ? (
                            <img src={p.product_image} alt={p.name} className="w-10 h-10 rounded object-cover border" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                              No Pic
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-xs line-clamp-1">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.sku || p.id.slice(0, 8)}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.category || "Flower Seeds"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs text-primary">
                          ৳{price}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={p.stock > 0 ? "secondary" : "outline"} className="text-[10px]">
                            {p.stock > 0 ? `In Stock (${p.stock})` : "Out of Stock"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

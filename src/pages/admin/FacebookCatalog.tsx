import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink, FileDown, FileCode2, Check } from "lucide-react";
import { toast } from "sonner";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const XML_URL = `https://${PROJECT_ID}.functions.supabase.co/facebook-catalog`;
const CSV_URL = `${XML_URL}?format=csv`;

export default function FacebookCatalog() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    toast.success("কপি হয়েছে");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Facebook Catalog Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Meta Commerce Manager-এ এই URL দিলে আপনার সব প্রোডাক্ট অটো-সিঙ্ক হবে (প্রতি ৩০ মিনিটে ক্যাশ রিফ্রেশ)।
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCode2 className="w-5 h-5 text-primary" /> XML Feed (recommended)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={XML_URL} className="font-mono text-xs" />
            <Button onClick={() => copy(XML_URL, "xml")} variant="secondary" size="sm">
              {copied === "xml" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={XML_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Meta Commerce Manager → Catalog → Data Sources → Scheduled Feed → এই URL পেস্ট করুন।
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileDown className="w-5 h-5 text-secondary" /> CSV Download
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={CSV_URL} className="font-mono text-xs" />
            <Button onClick={() => copy(CSV_URL, "csv")} variant="secondary" size="sm">
              {copied === "csv" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={CSV_URL} target="_blank" rel="noreferrer">
                <FileDown className="w-4 h-4" />
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Manual আপলোডের জন্য — CSV ফাইল ডাউনলোড করে Catalog → Add Items → Upload File-এ দিন।
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Included Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 list-disc pl-5 text-muted-foreground">
            <li>id, title, description, price (BDT), link, image_link</li>
            <li>availability (auto in/out of stock), condition: new</li>
            <li>brand: Griha Nova, product_type (category)</li>
            <li>Hidden products (<code>is_hidden=true</code>) excluded</li>
            <li>Max 5,000 products per feed</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

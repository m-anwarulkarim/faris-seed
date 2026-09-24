import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Bot, Search as SearchIcon, Globe, Megaphone, Cpu, Eye, Activity, Trash2 } from "lucide-react";
import { format, subDays, subMonths } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  search_engine: { label: "সার্চ ইঞ্জিন", icon: SearchIcon, color: "hsl(210, 70%, 50%)" },
  social: { label: "সোশ্যাল মিডিয়া", icon: Megaphone, color: "hsl(330, 70%, 50%)" },
  seo_tool: { label: "SEO টুল", icon: Activity, color: "hsl(30, 70%, 50%)" },
  ai: { label: "AI বট", icon: Cpu, color: "hsl(270, 70%, 50%)" },
  monitoring: { label: "মনিটরিং", icon: Eye, color: "hsl(150, 70%, 40%)" },
  other: { label: "অন্যান্য", icon: Bot, color: "hsl(0, 0%, 50%)" },
};

const PIE_COLORS = Object.values(CATEGORY_LABELS).map(c => c.color);

export default function BotActivity() {
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState("7d");

  const getDateFrom = () => {
    switch (dateRange) {
      case "1d": return subDays(new Date(), 1).toISOString();
      case "7d": return subDays(new Date(), 7).toISOString();
      case "30d": return subDays(new Date(), 30).toISOString();
      case "90d": return subMonths(new Date(), 3).toISOString();
      default: return subDays(new Date(), 7).toISOString();
    }
  };

  const { data: botVisits, isLoading, refetch } = useQuery({
    queryKey: ["bot-activity", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_visits")
        .select("*")
        .gte("created_at", getDateFrom())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const visits = botVisits || [];

  // Summary by bot name
  const botSummary = visits.reduce((acc, v) => {
    const key = v.bot_name;
    if (!acc[key]) acc[key] = { name: key, category: v.bot_category, count: 0, pages: new Set<string>() };
    acc[key].count++;
    if (v.page_path) acc[key].pages.add(v.page_path);
    return acc;
  }, {} as Record<string, { name: string; category: string; count: number; pages: Set<string> }>);

  const botList = Object.values(botSummary)
    .sort((a, b) => b.count - a.count);

  // Category summary for pie chart
  const categorySummary = visits.reduce((acc, v) => {
    acc[v.bot_category] = (acc[v.bot_category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(categorySummary).map(([cat, count]) => ({
    name: CATEGORY_LABELS[cat]?.label || cat,
    value: count,
    category: cat,
  }));

  // Daily trend
  const dailyTrend = visits.reduce((acc, v) => {
    const day = format(new Date(v.created_at), "dd MMM");
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const trendData = Object.entries(dailyTrend)
    .reverse()
    .map(([label, count]) => ({ label, visits: count }));

  // Top pages
  const pageSummary = visits.reduce((acc, v) => {
    const path = v.page_path || "/";
    acc[path] = (acc[path] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topPages = Object.entries(pageSummary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const handleClearOld = async () => {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { error } = await supabase
      .from("bot_visits")
      .delete()
      .lt("created_at", thirtyDaysAgo);
    if (error) toast.error("মুছতে ব্যর্থ");
    else {
      toast.success("৩০ দিনের পুরানো ডেটা মুছে ফেলা হয়েছে");
      refetch();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("বট অ্যাক্টিভিটি", "Bot Activity")}</h2>
          <Badge variant="secondary">{visits.length} {t("ভিজিট", "visits")}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">{t("আজ", "Today")}</SelectItem>
              <SelectItem value="7d">{t("৭ দিন", "7 Days")}</SelectItem>
              <SelectItem value="30d">{t("৩০ দিন", "30 Days")}</SelectItem>
              <SelectItem value="90d">{t("৯০ দিন", "90 Days")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleClearOld}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            {t("পুরানো মুছুন", "Clear Old")}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Bot className="w-3.5 h-3.5" />
              {t("মোট বট ভিজিট", "Total Bot Visits")}
            </div>
            <p className="text-xl font-bold">{visits.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Globe className="w-3.5 h-3.5" />
              {t("ইউনিক বট", "Unique Bots")}
            </div>
            <p className="text-xl font-bold">{botList.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <SearchIcon className="w-3.5 h-3.5" />
              {t("সার্চ ইঞ্জিন", "Search Engines")}
            </div>
            <p className="text-xl font-bold text-blue-600">{categorySummary["search_engine"] || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Cpu className="w-3.5 h-3.5" />
              {t("AI বট", "AI Bots")}
            </div>
            <p className="text-xl font-bold text-purple-600">{categorySummary["ai"] || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Daily Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("দৈনিক বট ভিজিট", "Daily Bot Visits")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t("ভিজিট", "Visits")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("বটের ধরন", "Bot Categories")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[Object.keys(CATEGORY_LABELS).indexOf(pieData[i]?.category)] || PIE_COLORS[5]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bot Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("বট তালিকা", "Bot List")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("বটের নাম", "Bot Name")}</TableHead>
                  <TableHead>{t("ধরন", "Category")}</TableHead>
                  <TableHead className="text-center">{t("ভিজিট", "Visits")}</TableHead>
                  <TableHead className="text-center">{t("ইউনিক পেজ", "Unique Pages")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {botList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {t("কোনো বট ভিজিট নেই", "No bot visits found")}
                    </TableCell>
                  </TableRow>
                ) : (
                  botList.map((bot) => {
                    const catInfo = CATEGORY_LABELS[bot.category] || CATEGORY_LABELS.other;
                    const CatIcon = catInfo.icon;
                    return (
                      <TableRow key={bot.name}>
                        <TableCell className="font-medium">{bot.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs gap-1">
                            <CatIcon className="w-3 h-3" />
                            {catInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{bot.count}</TableCell>
                        <TableCell className="text-center">{bot.pages.size}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Top Pages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("সবচেয়ে বেশি ভিজিট করা পেজ (বট)", "Most Visited Pages (Bots)")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("পেজ", "Page")}</TableHead>
                  <TableHead className="text-right">{t("ভিজিট", "Visits")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPages.map(([path, count]) => (
                  <TableRow key={path}>
                    <TableCell className="font-mono text-sm">{path}</TableCell>
                    <TableCell className="text-right font-semibold">{count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

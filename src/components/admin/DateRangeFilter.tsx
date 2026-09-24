import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, CalendarRange } from "lucide-react";

const DATE_RANGES = [
  { value: "today", labelBn: "আজ", label: "Today" },
  { value: "24h", labelBn: "শেষ ২৪ ঘণ্টা", label: "Last 24 Hours" },
  { value: "72h", labelBn: "শেষ ৭২ ঘণ্টা", label: "Last 72 Hours" },
  { value: "7d", labelBn: "শেষ ৭ দিন", label: "Last 7 Days" },
  { value: "30d", labelBn: "শেষ ৩০ দিন", label: "Last 30 Days" },
  { value: "this_month", labelBn: "এই মাস", label: "This Month" },
  { value: "last_month", labelBn: "গত মাস", label: "Last Month" },
  { value: "lifetime", labelBn: "সব সময়", label: "Lifetime" },
  { value: "custom", labelBn: "কাস্টম রেঞ্জ", label: "Custom Range" },
] as const;

export type DateRangeValue = (typeof DATE_RANGES)[number]["value"];

export interface DateRangeResult {
  from: string | null; // ISO string or YYYY-MM-DD
  to: string | null;
}

export function getDateRangeISO(value: DateRangeValue, customFrom?: string, customTo?: string): string | null {
  if (value === "custom") return customFrom || null;
  const hoursMap: Record<string, number> = { "24h": 24, "72h": 72, "7d": 168, "30d": 720 };
  const hours = hoursMap[value];
  if (hours) return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  if (value === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (value === "this_month") {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }
  if (value === "last_month") {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString();
  }
  return null; // lifetime
}

export function getDateRangeDates(value: DateRangeValue, customFrom?: string, customTo?: string): DateRangeResult {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  if (value === "custom") {
    return { from: customFrom || null, to: customTo || todayStr };
  }
  if (value === "today") {
    return { from: todayStr, to: todayStr };
  }
  if (value === "24h" || value === "72h" || value === "7d" || value === "30d") {
    const hoursMap: Record<string, number> = { "24h": 24, "72h": 72, "7d": 168, "30d": 720 };
    const fromDate = new Date(Date.now() - hoursMap[value] * 60 * 60 * 1000);
    return { from: fromDate.toISOString().split("T")[0], to: todayStr };
  }
  if (value === "this_month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0], to: todayStr };
  }
  if (value === "last_month") {
    const firstLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastLast = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: firstLast.toISOString().split("T")[0], to: lastLast.toISOString().split("T")[0] };
  }
  // lifetime
  return { from: null, to: todayStr };
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  customFrom?: string;
  customTo?: string;
  onCustomChange?: (from: string, to: string) => void;
}

export function DateRangeFilter({ value, onChange, customFrom, customTo, onCustomChange }: DateRangeFilterProps) {
  const { t } = useLanguage();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(customFrom || "");
  const [tempTo, setTempTo] = useState(customTo || "");

  const current = DATE_RANGES.find((r) => r.value === value);

  const handleValueChange = (v: string) => {
    if (v === "custom") {
      setTempFrom(customFrom || "");
      setTempTo(customTo || new Date().toISOString().split("T")[0]);
      setPopoverOpen(true);
      return;
    }
    onChange(v as DateRangeValue);
  };

  const applyCustom = () => {
    if (tempFrom && tempTo) {
      onCustomChange?.(tempFrom, tempTo);
      onChange("custom");
      setPopoverOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[170px] h-9 text-sm gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <SelectValue>{current ? t(current.labelBn, current.label) : ""}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGES.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              <div className="flex items-center gap-2">
                {range.value === "custom" && <CalendarRange className="w-3.5 h-3.5" />}
                {t(range.labelBn, range.label)}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === "custom" && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
              <CalendarRange className="w-3.5 h-3.5" />
              {customFrom} → {customTo}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-3" align="start">
            <div className="flex items-center gap-2">
              <Input type="date" value={tempFrom} onChange={(e) => setTempFrom(e.target.value)} className="w-auto h-8 text-xs" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={tempTo} onChange={(e) => setTempTo(e.target.value)} className="w-auto h-8 text-xs" />
            </div>
            <Button size="sm" className="w-full h-8 text-xs" onClick={applyCustom} disabled={!tempFrom || !tempTo}>
              {t("প্রয়োগ করুন", "Apply")}
            </Button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

import {
  Clock, PhoneOff, ThumbsUp, PhoneCall, Pause, CalendarClock,
  CheckCircle2, XCircle, Package, Printer, ClipboardCheck, Truck,
  PackageCheck, PackageMinus, RotateCcw, Undo2, HelpCircle,
} from "lucide-react";

export const WEB_STATUS_OPTIONS = [
  { value: "pending", label: "Pending", labelBn: "পেন্ডিং", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  { value: "no_response", label: "No Response", labelBn: "নো রেসপন্স", color: "bg-orange-100 text-orange-800 border-orange-200", icon: PhoneOff },
  { value: "good_but_no_response", label: "Good But No Response", labelBn: "গুড বাট নো রেসপন্স", color: "bg-amber-100 text-amber-800 border-amber-200", icon: ThumbsUp },
  { value: "busy", label: "Busy", labelBn: "বিজি", color: "bg-slate-100 text-slate-800 border-slate-200", icon: PhoneCall },
  { value: "hold", label: "Hold", labelBn: "হোল্ড", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Pause },
  { value: "pre", label: "Pre", labelBn: "প্রি", color: "bg-violet-100 text-violet-800 border-violet-200", icon: CalendarClock },
  { value: "confirmed", label: "Confirm", labelBn: "কনফার্ম", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
  { value: "cancelled", label: "Cancel", labelBn: "বাতিল", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
];

export const CONFIRMED_STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed", labelBn: "কনফার্মড", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Package },
  { value: "printed", label: "Printed", labelBn: "প্রিন্টেড", color: "bg-cyan-100 text-cyan-800 border-cyan-200", icon: Printer },
  { value: "entry_done", label: "Entry Done", labelBn: "এন্ট্রি ডান", color: "bg-teal-100 text-teal-800 border-teal-200", icon: ClipboardCheck },
  { value: "shipped", label: "Shipped", labelBn: "শিপড", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Truck },
  { value: "delivered", label: "Delivered", labelBn: "ডেলিভারড", color: "bg-green-100 text-green-800 border-green-200", icon: PackageCheck },
  { value: "partial", label: "Partial", labelBn: "পার্শিয়াল", color: "bg-amber-100 text-amber-800 border-amber-200", icon: PackageMinus },
  { value: "pending_return", label: "Pending Return", labelBn: "পেন্ডিং রিটার্ন", color: "bg-orange-100 text-orange-800 border-orange-200", icon: RotateCcw },
  { value: "return", label: "Return", labelBn: "রিটার্ন", color: "bg-rose-100 text-rose-800 border-rose-200", icon: Undo2 },
  { value: "rtn_received", label: "RTN Received", labelBn: "RTN রিসিভড", color: "bg-lime-100 text-lime-800 border-lime-200", icon: PackageCheck },
  { value: "order_cancelled", label: "Cancel", labelBn: "বাতিল", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  { value: "missing", label: "Missing", labelBn: "মিসিং", color: "bg-gray-100 text-gray-800 border-gray-200", icon: HelpCircle },
];

export const CONFIRMED_STATUS_VALUES = CONFIRMED_STATUS_OPTIONS.map((s) => s.value);

export const ALL_STATUS_OPTIONS = [...WEB_STATUS_OPTIONS, ...CONFIRMED_STATUS_OPTIONS];

export const getStatusInfo = (status: string) =>
  ALL_STATUS_OPTIONS.find((s) => s.value === status) || WEB_STATUS_OPTIONS[0];

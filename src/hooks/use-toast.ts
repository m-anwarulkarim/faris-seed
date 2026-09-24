// Legacy useToast hook — rewired to show a centered popup with OK button instead of a toast.
import * as React from "react";
import { showAlert, dismissAlert, AlertVariant } from "@/lib/alertPopup";

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive" | string;
  [key: string]: any;
};

function nodeToString(n: React.ReactNode): string | undefined {
  if (n == null || typeof n === "boolean") return undefined;
  if (typeof n === "string" || typeof n === "number") return String(n);
  // Best-effort for ReactNode — fall back to empty.
  try {
    if (Array.isArray(n)) return n.map(nodeToString).filter(Boolean).join(" ");
    if (typeof n === "object" && "props" in (n as any)) {
      return nodeToString((n as any).props?.children);
    }
  } catch {
    // ignore
  }
  return undefined;
}

function toast(input: ToastInput | string) {
  const obj: ToastInput = typeof input === "string" ? { title: input } : input || {};
  const variant: AlertVariant = obj.variant === "destructive" ? "error" : "default";
  const title = nodeToString(obj.title);
  const description = nodeToString(obj.description);
  const id = showAlert({ title, description }, undefined, variant);
  return {
    id: String(id),
    dismiss: () => dismissAlert(),
    update: (next: ToastInput) => {
      const v: AlertVariant = next.variant === "destructive" ? "error" : "default";
      showAlert(
        { title: nodeToString(next.title), description: nodeToString(next.description) },
        undefined,
        v
      );
    },
  };
}

function useToast() {
  return {
    toasts: [] as any[],
    toast,
    dismiss: (_id?: string) => dismissAlert(),
  };
}

export { useToast, toast };

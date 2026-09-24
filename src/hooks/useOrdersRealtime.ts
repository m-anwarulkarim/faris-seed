import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Global admin realtime subscription for order activity.
 * - Invalidates every order-related react-query key the moment a row changes
 *   in `orders`, `order_items`, `order_status_history`, or `incomplete_orders`.
 * - Plays a short chime + shows a toast when a brand-new order is inserted
 *   so the admin notices immediately.
 *
 * Mount once (in AdminLayout) — relies on the Realtime publication enabled
 * via migration on these tables.
 */
const ORDER_QUERY_KEYS = [
  "sidebar-counts",
  "sidebar-unread-inbox-count",
  "web-orders",
  "web-orders-counts",
  "confirmed-orders",
  "confirmed-orders-counts-rpc-v1",
  "pre-orders",
  "deleted-orders",
  "courier-orders",
  "overview-orders",
  "overview-recent-orders",
  "my-activity-orders",
  "incomplete-orders",
  "phone-orders",
  "customer-orders",
  "order-items",
  "status-history-map",
  "repeat-counts",
  "double-visitor-ids",
  "incomplete-phones-list",
  "status-counts",
];

function playChime() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  } catch {
    /* ignore */
  }
}

export function useOrdersRealtime() {
  const qc = useQueryClient();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const invalidateAll = () => {
      for (const key of ORDER_QUERY_KEYS) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    };

    const channel = supabase
      .channel("admin-orders-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          invalidateAll();
          if (payload.eventType === "INSERT") {
            const row: any = payload.new;
            if (!row?.id || seenRef.current.has(row.id)) return;
            seenRef.current.add(row.id);
            playChime();
            toast({
              title: "🛒 নতুন অর্ডার এসেছে",
              description: row.customer_facing_id
                ? `অর্ডার #${row.customer_facing_id}`
                : "একটি নতুন অর্ডার ড্যাশবোর্ডে যুক্ত হয়েছে",
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        invalidateAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_status_history" },
        invalidateAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incomplete_orders" },
        invalidateAll
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

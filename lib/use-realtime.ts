"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "./supabase-browser";

type Row = { id: string; created_at?: string };

// Loads initial rows and keeps them live via Supabase Realtime.
export function useRealtime<T extends Row>(
  table: string,
  opts?: { limit?: number; event?: "INSERT" | "UPDATE" | "*"; orderBy?: string }
): T[] {
  const [rows, setRows] = useState<T[]>([]);
  const limit = opts?.limit ?? 100;
  const event = opts?.event ?? "INSERT";
  const orderBy = opts?.orderBy ?? "created_at";

  useEffect(() => {
    const sb = getBrowserClient();
    let active = true;

    sb.from(table)
      .select("*")
      .order(orderBy, { ascending: false })
      .limit(limit)
      .then(({ data }) => {
        if (active && data) setRows(data as T[]);
      });

    const channel = sb
      .channel(`rt-${table}`)
      .on(
        "postgres_changes",
        { event, schema: "public", table },
        (payload) => {
          const rec = payload.new as T;
          setRows((prev) => {
            if (payload.eventType === "UPDATE") {
              const exists = prev.some((r) => r.id === rec.id);
              return exists ? prev.map((r) => (r.id === rec.id ? rec : r)) : [rec, ...prev];
            }
            if (prev.some((r) => r.id === rec.id)) return prev;
            return [rec, ...prev].slice(0, limit);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  return rows;
}

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
    let channel: ReturnType<typeof sb.channel> | null = null;

    (async () => {
      // Realtime respects RLS (our tables only allow `authenticated`). The socket
      // must carry the logged-in user's JWT or postgres_changes deliver nothing —
      // which looks like a "laggy"/stale dashboard. Set it before subscribing.
      const { data: sess } = await sb.auth.getSession();
      if (sess.session?.access_token) sb.realtime.setAuth(sess.session.access_token);

      const { data } = await sb
        .from(table)
        .select("*")
        .order(orderBy, { ascending: false })
        .limit(limit);
      if (!active) return; // cleaned up (e.g. StrictMode remount) before we got here — don't subscribe
      if (data) setRows(data as T[]);

      channel = sb
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
    })();

    return () => {
      active = false;
      if (channel) sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  return rows;
}

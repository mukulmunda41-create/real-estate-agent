"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "./supabase-browser";

export type Stats = {
  kpis: { totalLeads: number; activeConversations: number; siteVisits: number; conversion: number; pipeline: number };
  spark: { leads: number[]; visits: number[]; messages: number[] };
  deltas: { leads: number; visits: number; messages: number };
  funnel: { label: string; count: number }[];
  leadMix: { label: string; count: number }[];
  heat: number[][];
  heatMax: number;
  aiPerformance: { conversion: number; bookings: number; messagesHandled: number; qualifiedRate: number };
};

export function useStats(refreshKey = 0): Stats | null {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await getBrowserClient().auth.getSession();
      const res = await fetch("/api/stats", {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      if (res.ok && active) setStats(await res.json());
    }
    load();
    const t = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [refreshKey]);

  return stats;
}

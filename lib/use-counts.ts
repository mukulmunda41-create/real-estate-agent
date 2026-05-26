"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "./supabase-browser";

export type Counts = { leads: number; visits: number; properties: number; messages: number };

async function count(table: string): Promise<number> {
  const { count } = await getBrowserClient().from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export function useCounts(refreshKey: number = 0): Counts {
  const [counts, setCounts] = useState<Counts>({ leads: 0, visits: 0, properties: 0, messages: 0 });

  useEffect(() => {
    let active = true;
    async function load() {
      const [leads, visits, properties, messages] = await Promise.all([
        count("leads"),
        count("site_visits"),
        count("properties"),
        count("messages"),
      ]);
      if (active) setCounts({ leads, visits, properties, messages });
    }
    load();
    const t = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [refreshKey]);

  return counts;
}

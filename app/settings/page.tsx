"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { getBrowserClient } from "@/lib/supabase-browser";

type Status = { serverConfigured: boolean; connected: boolean; email: string; viaEnv: boolean };

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await getBrowserClient().auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

function SettingsInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/google/status", { headers: await authHeaders() });
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const g = params.get("google");
    if (g === "connected") setMsg("✓ Google Calendar connected");
    else if (g === "error") setMsg("Connection failed — please try again.");
    else if (g === "noref") setMsg("No refresh token returned. Disconnect from your Google account permissions and retry.");
  }, [load, params]);

  async function connect() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/google/connect", { method: "POST", headers: await authHeaders() });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && j.url) window.location.href = j.url;
    else setMsg(`Error: ${j.error || res.status}`);
  }

  async function disconnect() {
    setBusy(true);
    setMsg("");
    await fetch("/api/google/disconnect", { method: "POST", headers: await authHeaders() });
    setBusy(false);
    setMsg("Disconnected.");
    load();
  }

  const connected = status?.connected;

  return (
    <DashboardShell title="Settings">
      <div className="max-w-2xl space-y-5">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-2xl">📅</span>
              <div>
                <h2 className="text-base font-semibold text-slate-100">Google Calendar</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Connect your Google account so every booked site visit is added to your calendar automatically.
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                connected ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-400"
              }`}
            >
              {connected ? "● Connected" : "○ Not connected"}
            </span>
          </div>

          {connected && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              {status?.email ? <>Connected as <span className="text-slate-100">{status.email}</span></> : "Connected."}
              {status?.viaEnv && <span className="ml-2 text-xs text-slate-500">(via server env)</span>}
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            {!connected ? (
              <button
                onClick={connect}
                disabled={busy || !status?.serverConfigured}
                className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy ? "Opening…" : "Connect Google Calendar"}
              </button>
            ) : (
              <>
                <button
                  onClick={connect}
                  disabled={busy}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-emerald-400/50 hover:text-emerald-300 disabled:opacity-50"
                >
                  Reconnect
                </button>
                <button
                  onClick={disconnect}
                  disabled={busy || status?.viaEnv}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 transition-colors hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </>
            )}
            {msg && <span className="text-sm text-emerald-300">{msg}</span>}
          </div>

          {status && !status.serverConfigured && (
            <p className="mt-4 text-xs text-amber-300/80">
              Server is missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Add them in the environment before connecting.
            </p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  );
}

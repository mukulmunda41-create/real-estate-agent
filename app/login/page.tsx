"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await getBrowserClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.replace("/dashboard");
  }

  const input =
    "mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-400/60";

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl glow-green">🤖</div>
          <h1 className="text-2xl font-bold gradient-text">Real Estate Agent</h1>
          <p className="text-xs uppercase tracking-widest text-slate-500">AI Assistant Console</p>
        </div>

        <form onSubmit={onSubmit} className="glass rounded-2xl p-6">
          <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} />
          <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={input} />
          {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? "Authenticating…" : "Sign in →"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useRealtime } from "@/lib/use-realtime";
import { clockTime as time, shortDate as day } from "@/lib/format";

type Message = {
  id: string;
  phone: string;
  role: "user" | "assistant";
  msg_type: "text" | "voice" | "image";
  content: string | null;
  transcript: string | null;
  audio_url: string | null;
  image_urls: string[] | null;
  created_at: string;
};

type Lead = {
  id: string;
  phone: string;
  name: string | null;
  lead_status: string | null;
};

export default function ConversationsPage() {
  // Pull a wide window of messages + leads; both stay live via Realtime.
  const messages = useRealtime<Message>("messages", { event: "*", limit: 1000, orderBy: "created_at" });
  const leads = useRealtime<Lead>("leads", { event: "*", limit: 300, orderBy: "last_interaction_at" });
  const [active, setActive] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const nameByPhone = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) if (l.name) m.set(l.phone, l.name);
    return m;
  }, [leads]);

  // Group messages by phone → one conversation per customer, newest first.
  const conversations = useMemo(() => {
    const byPhone = new Map<string, Message[]>();
    for (const m of messages) {
      const arr = byPhone.get(m.phone) || [];
      arr.push(m);
      byPhone.set(m.phone, arr);
    }
    const list = [...byPhone.entries()].map(([phone, msgs]) => {
      const ordered = [...msgs].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      const last = ordered[ordered.length - 1];
      return {
        phone,
        name: nameByPhone.get(phone) || phone,
        messages: ordered,
        last,
        lastText: last.content || last.transcript || (last.msg_type === "image" ? "📷 Image" : last.msg_type === "voice" ? "🎤 Voice note" : ""),
      };
    });
    return list.sort((a, b) => +new Date(b.last.created_at) - +new Date(a.last.created_at));
  }, [messages, nameByPhone]);

  const filtered = conversations.filter((c) =>
    [c.name, c.phone, c.lastText].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  const current = filtered.find((c) => c.phone === active) || filtered[0] || null;

  return (
    <DashboardShell title="Conversations">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]" style={{ height: "calc(100vh - 8rem)" }}>
        {/* Conversation list */}
        <div className="glass flex flex-col overflow-hidden rounded-xl">
          <div className="border-b border-white/10 p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search conversations…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-400/50"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((c) => {
              const isActive = current?.phone === c.phone;
              return (
                <button
                  key={c.phone}
                  onClick={() => setActive(c.phone)}
                  className={`flex w-full items-center gap-3 border-b border-white/5 px-3 py-3 text-left transition-colors ${
                    isActive ? "bg-white/8" : "hover:bg-white/5"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm">🧑</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-100">{c.name}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">{time(c.last.created_at)}</span>
                    </div>
                    <div className="truncate text-xs text-slate-400">{c.lastText}</div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">No conversations yet.</p>
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="glass flex flex-col overflow-hidden rounded-xl">
          {current ? (
            <>
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/20 text-sm">🧑</span>
                <div>
                  <div className="text-sm font-medium text-slate-100">{current.name}</div>
                  <div className="text-[11px] text-slate-500">{current.phone} · {current.messages.length} messages</div>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {current.messages.map((m, i) => {
                  const isUser = m.role === "user";
                  const prev = current.messages[i - 1];
                  const showDay = !prev || day(prev.created_at) !== day(m.created_at);
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] text-slate-500">{day(m.created_at)}</span>
                        </div>
                      )}
                      <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isUser ? "rounded-tl-sm bg-white/8 text-slate-200" : "rounded-tr-sm bg-gradient-to-br from-violet-500/40 to-blue-500/30 text-white"}`}>
                          {(m.content || m.transcript) && <div className="whitespace-pre-wrap">{m.content || m.transcript}</div>}
                          {m.msg_type === "voice" && m.audio_url && (
                            <div className="mt-1 text-[11px] opacity-70">🎤 voice note</div>
                          )}
                          {m.image_urls && m.image_urls.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {m.image_urls.map((url) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={url} src={url} alt="" className="h-28 w-28 rounded-lg object-cover" />
                              ))}
                            </div>
                          )}
                          <div className="mt-1 text-[9px] opacity-50">
                            {time(m.created_at)}{m.msg_type !== "text" ? ` · ${m.msg_type}` : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a conversation to view the chat.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

"use client";

import { useState } from "react";

// Decorative voice-message player: animated waveform bars + play/pause toggle.
// (Playback of the real audio isn't wired — the dashboard is a monitor view.)
const BARS = [0.4, 0.7, 0.3, 0.9, 0.5, 1, 0.6, 0.35, 0.8, 0.45, 0.95, 0.55, 0.3, 0.75, 0.5, 0.85, 0.4, 0.65, 0.3, 0.9, 0.5, 0.7, 0.35, 0.6];

export default function VoiceWaveform({ duration = "0:06", color = "#a78bfa" }: { duration?: string; color?: string }) {
  const [playing, setPlaying] = useState(true);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5">
      <button
        onClick={() => setPlaying((p) => !p)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
        style={{ background: `linear-gradient(135deg, ${color}, #38bdf8)`, boxShadow: `0 0 14px -2px ${color}` }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={playing ? "wave-bar" : ""}
            style={{
              height: `${Math.round(h * 100)}%`,
              width: 3,
              borderRadius: 2,
              background: i % 2 ? color : "#38bdf8",
              opacity: 0.55 + h * 0.45,
              animationDelay: `${(i % 8) * 0.08}s`,
            }}
          />
        ))}
      </div>
      <span className="shrink-0 font-mono text-[11px] text-slate-400">{duration}</span>
    </div>
  );
}

// Lightweight pure-SVG/CSS charts — no charting library.

export function Sparkline({ values, color = "#a78bfa", w = 120, h = 36 }: { values: number[]; color?: string; w?: number; h?: number }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1 || 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity={0.13} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Donut({ data, size = 150, thickness = 18 }: { data: { label: string; value: number; color: string }[]; size?: number; thickness?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const lens = data.map((d) => (d.value / total) * c);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
        <circle r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
        {data.map((d, i) => (
          <circle
            key={i}
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeDasharray={`${lens[i]} ${c - lens[i]}`}
            strokeDashoffset={-offsets[i]}
            strokeLinecap="butt"
          />
        ))}
      </g>
    </svg>
  );
}

export function Funnel({ steps, color = "#a78bfa" }: { steps: { label: string; count: number }[]; color?: string }) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const w = Math.max(12, (s.count / max) * 100);
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-slate-400">{s.label}</span>
            <div className="h-6 flex-1 rounded bg-white/5">
              <div
                className="flex h-6 items-center justify-end rounded px-2 text-[11px] font-medium text-white"
                style={{ width: `${w}%`, background: `linear-gradient(90deg, ${color}66, ${color})` }}
              >
                {s.count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Heatmap({ matrix, max, rgb = "139,92,246" }: { matrix: number[][]; max: number; rgb?: string }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="space-y-1">
      {matrix.map((row, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="w-6 shrink-0 text-[9px] text-slate-500">{days[i] ?? ""}</span>
          {row.map((v, j) => (
            <div
              key={j}
              className="h-3.5 flex-1 rounded-sm"
              title={`${v}`}
              style={{ background: `rgba(${rgb},${0.06 + 0.94 * (v / max)})` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Gauge({ value, size = 130, color = "#34d399" }: { value: number; size?: number; color?: string }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </g>
    </svg>
  );
}

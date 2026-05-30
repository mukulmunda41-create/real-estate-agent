"use client";

import { useEffect, useRef } from "react";

// Subtle drifting particle field with occasional neural sparks between nearby
// points. Sits behind the reactor core to give ambient "thinking" life.
// Cheap (~30 points), DPR-aware, pauses when the tab is hidden.
export default function ParticleField({ size = 300 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const N = 30;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * size,
      y: Math.random() * size,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.4 + 0.4,
      tw: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let running = true;

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, size, size);

      // spark links between nearby points
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 2600) {
            ctx.strokeStyle = `rgba(125,160,255,${0.06 * (1 - d2 / 2600)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.03;
        if (p.x < 0 || p.x > size) p.vx *= -1;
        if (p.y < 0 || p.y > size) p.vy *= -1;
        const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186,210,255,${a})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    const onVis = () => {
      running = !document.hidden;
      if (running) draw();
      else cancelAnimationFrame(raf);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [size]);

  return <canvas ref={ref} style={{ width: size, height: size }} className="block" aria-hidden />;
}

type Props = { color: string; active: boolean; compact?: boolean };

// CSS-drawn robot face. Eyes blink; mouth animates while the agent is working.
export default function RobotAvatar({ color, active, compact }: Props) {
  const head = compact ? "h-16 w-20" : "h-36 w-44";
  const eye = compact ? "h-3 w-3" : "h-6 w-6";
  const eyeGap = compact ? "gap-3 mb-1.5" : "gap-7 mb-3";
  const mouthW = compact ? "w-0.5" : "w-1";
  const mouthH = compact ? "h-2.5" : "h-4";
  const bolt = compact ? "h-2 w-1" : "h-3 w-1.5";

  return (
    <div className="flex flex-col items-center" style={{ color }}>
      <div className="flex flex-col items-center">
        <div
          className={`${compact ? "h-2 w-2" : "h-3 w-3"} rounded-full ${active ? "antenna-dot" : ""}`}
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        />
        <div className={compact ? "h-2 w-0.5" : "h-4 w-0.5"} style={{ background: color, opacity: 0.6 }} />
      </div>

      <div
        className={`relative flex ${head} flex-col items-center justify-center rounded-2xl border-2 ${active ? "neon-pulse" : ""}`}
        style={{
          borderColor: color,
          background: "rgba(0,0,0,0.45)",
          boxShadow: active ? `0 0 22px ${color}55, inset 0 0 18px ${color}22` : `inset 0 0 12px ${color}18`,
        }}
      >
        <div className={`flex ${eyeGap}`}>
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`robot-eye ${active ? "thinking" : ""} ${eye} rounded-full`}
              style={{ background: color, boxShadow: `0 0 12px ${color}` }}
            />
          ))}
        </div>

        {active ? (
          <div className={`flex ${mouthH} items-center gap-1`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`robot-mouth-bar ${mouthW} rounded-full`}
                style={{ background: color, boxShadow: `0 0 6px ${color}`, animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        ) : (
          <div className={`${compact ? "h-1 w-8" : "h-1.5 w-12"} rounded-full`} style={{ background: color, opacity: 0.7 }} />
        )}

        <div className={`absolute -left-1 top-1/2 ${bolt} rounded`} style={{ background: color, opacity: 0.7 }} />
        <div className={`absolute -right-1 top-1/2 ${bolt} rounded`} style={{ background: color, opacity: 0.7 }} />
      </div>
    </div>
  );
}

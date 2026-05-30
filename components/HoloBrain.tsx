"use client";

// Holographic glowing brain centerpiece (pure SVG, symmetric via mirroring).
// Cyan→violet gradient strokes with bloom, a soft pulse, and energy flowing
// along the gyri. Sits inside the HUD tick ring.
export default function HoloBrain({ size = 260 }: { size?: number }) {
  // Right-half geometry (x >= 130); the left half is a mirror of this group.
  const outline =
    "M130 62 C146 50 168 52 180 66 C194 72 197 90 190 102 C199 111 196 126 184 131 C188 143 176 151 164 149 C158 160 142 162 134 156 L130 156";
  const gyri = [
    "M132 73 C150 70 161 81 156 93",
    "M150 97 C166 93 177 105 168 117",
    "M136 111 C150 109 159 119 150 129",
    "M138 133 C150 131 161 139 154 147",
    "M170 86 C182 90 185 103 176 109",
    "M160 120 C172 122 175 134 165 139",
  ];
  const cerebellum = "M142 151 C154 153 159 167 147 172";
  const fissure = "M130 64 C128 84 132 104 130 124 C128 140 130 150 130 156";
  const stem = "M122 155 C120 168 121 177 126 183 L134 183 C139 177 140 168 138 155 Z";

  const RightHalf = (
    <g>
      <path d={outline} fill="none" stroke="url(#brainGrad)" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      {gyri.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="url(#brainGrad)" strokeWidth={1.4} strokeLinecap="round" opacity={0.95} />
      ))}
      <path d={cerebellum} fill="none" stroke="url(#brainGrad)" strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />
      {/* travelling energy on a couple of folds */}
      <path className="flow-line" d={gyri[1]} fill="none" stroke="#7dd3fc" strokeWidth={1.6} strokeLinecap="round" opacity={0.9} />
      <path className="flow-line-slow" d={gyri[3]} fill="none" stroke="#c4b5fd" strokeWidth={1.6} strokeLinecap="round" opacity={0.9} />
    </g>
  );

  return (
    <svg width={size} height={size} viewBox="0 0 260 260" className="block">
      <defs>
        <linearGradient id="brainGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="35%" stopColor="#60a5fa" />
          <stop offset="70%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <radialGradient id="brainBody" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="rgba(125,211,252,0.32)" />
          <stop offset="55%" stopColor="rgba(99,102,241,0.16)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0)" />
        </radialGradient>
        <filter id="bglow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="bhalo" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* faint volumetric body fill */}
      <g opacity={0.9}>
        <path d={`${outline} Z`} fill="url(#brainBody)" />
        <path d={`${outline} Z`} fill="url(#brainBody)" transform="translate(260,0) scale(-1,1)" />
      </g>

      {/* soft outer halo of the silhouette */}
      <g filter="url(#bhalo)" opacity={0.55} stroke="#60a5fa" fill="none" strokeWidth={3.5}>
        <path d={outline} />
        <path d={outline} transform="translate(260,0) scale(-1,1)" />
      </g>

      {/* the brain, with bloom + gentle pulse */}
      <g filter="url(#bglow)">
        <animate attributeName="opacity" values="0.9;1;0.9" dur="3.4s" repeatCount="indefinite" />
        {RightHalf}
        <g transform="translate(260,0) scale(-1,1)">{RightHalf}</g>
        <path d={fissure} fill="none" stroke="url(#brainGrad)" strokeWidth={1.6} strokeLinecap="round" opacity={0.9} />
        <path d={stem} fill="none" stroke="url(#brainGrad)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

"use client";

// ── SVG Radar Chart ─────────────────────────────────────────────────────────
// A pure-SVG radar/spider chart. No dependencies. Renders a pentagon of axes
// with a filled data polygon and animated appearance.

interface RadarChartProps {
  /** Label → score (0-100) */
  data: Record<string, number>;
  /** Size in px (square) */
  size?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Educazione: "#6366f1",
  Salute: "#10b981",
  Servizi: "#f97316",
  Comunità: "#22c55e",
  Mobilità: "#e879f9",
};

export default function RadarChart({ data, size = 220 }: RadarChartProps) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  const n = labels.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 30; // leave room for labels

  // Angle per axis (starting from top, going clockwise)
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // top

  function polarToXY(angle: number, r: number): [number, number] {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1];

  // Data points
  const dataPoints = values.map((v, i) => {
    const angle = startAngle + i * angleStep;
    const r = (v / 100) * maxR;
    return polarToXY(angle, r);
  });

  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + "Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {rings.map((pct) => {
        const ringPoints = Array.from({ length: n }, (_, i) => {
          const angle = startAngle + i * angleStep;
          return polarToXY(angle, maxR * pct);
        });
        const path =
          ringPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + "Z";
        return (
          <path
            key={pct}
            d={path}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={pct === 1 ? 1.5 : 0.8}
          />
        );
      })}

      {/* Axis lines */}
      {labels.map((_, i) => {
        const angle = startAngle + i * angleStep;
        const [ex, ey] = polarToXY(angle, maxR);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={ex}
            y2={ey}
            stroke="#d1d5db"
            strokeWidth={0.8}
          />
        );
      })}

      {/* Data polygon */}
      <path
        d={dataPath}
        fill="#6366f1"
        fillOpacity={0.2}
        stroke="#6366f1"
        strokeWidth={2}
        className="radar-polygon"
      />

      {/* Data points (dots) */}
      {dataPoints.map(([px, py], i) => (
        <circle
          key={i}
          cx={px}
          cy={py}
          r={3.5}
          fill={CATEGORY_COLORS[labels[i]] ?? "#6366f1"}
          stroke="#fff"
          strokeWidth={1.5}
        />
      ))}

      {/* Labels */}
      {labels.map((label, i) => {
        const angle = startAngle + i * angleStep;
        const labelR = maxR + 18;
        const [lx, ly] = polarToXY(angle, labelR);
        const score = values[i];
        return (
          <text
            key={label}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fontWeight={700}
            fill={CATEGORY_COLORS[label] ?? "#4b5563"}
          >
            {label} ({score})
          </text>
        );
      })}
    </svg>
  );
}

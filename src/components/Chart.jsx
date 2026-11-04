import { fmtDur } from '../lib/stats.js';
import { actColor } from './ui.jsx';

// Stacked bar chart. `series.buckets[].parts` = minutes per activity; `colorOf(activityId)` -> palette index.
export function Chart({ series, colorOf, single }) {
  const W = 340, H = 170, top = 18, bottom = 24, plotH = H - top - bottom;
  const n = series.buckets.length;
  const max = Math.max(30, ...series.buckets.map((b) => b.total));
  const slot = W / n, bw = Math.min(34, slot * 0.6);
  const summary = series.buckets.map((b) => `${b.label}: ${fmtDur(b.total)}`).join('; ');
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Süre grafiği. ${summary}`}>
      <line x1="0" x2={W} y1={top + plotH} y2={top + plotH} class="chart-axis" />
      {series.buckets.map((b, i) => {
        const x = i * slot + (slot - bw) / 2;
        let y = top + plotH;
        const ids = Object.keys(b.parts);
        return (
          <g key={b.start}>
            {ids.map((id) => {
              const h = (b.parts[id] / max) * plotH;
              y -= h;
              return <rect key={id} x={x} y={y} width={bw} height={Math.max(h, 2)} rx={single ? 0 : 0} class="chart-bar" style={`fill:${actColor(colorOf(id))}`} />;
            })}
            {b.total > 0 && n <= 8 && (
              <text x={x + bw / 2} y={y - 5} text-anchor="middle" class="chart-val">{b.total >= 60 ? `${String(Math.round(b.total / 6) / 10).replace('.', ',')} sa` : `${b.total} dk`}</text>
            )}
            <text x={x + bw / 2} y={H - 6} text-anchor="middle" class="chart-lbl">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

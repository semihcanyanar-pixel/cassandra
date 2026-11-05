import { countIn, habitBucket } from '../lib/stats.js';

// Done / not-done views of habits (activities and repeating tasks).
const colorOf = (h) => (h.color == null ? 'var(--muted)' : `var(--act-${h.color})`);

// Rows = habits, columns = the slices of the chosen period. Each circle fills up to how much of the target was done in that slice.
export function HabitGrid({ habits, buckets, mode, today, onPick, compact }) {
  const first = buckets[0].start, last = buckets[buckets.length - 1].end;
  return (
    <div class={`hg ${compact ? 'compact' : ''} ${buckets.length > 7 ? 'dense' : ''}`} style={`--n:${buckets.length}`} role="table" aria-label="Yapılan günler">
      <div class="hg-head" role="row">
        <span />
        {buckets.map((b) => <span key={b.start} role="columnheader" class={mode === 'day' && b.start === today ? 'now' : ''}>{mode === 'week' ? b.label.split(' ')[0] : b.label}</span>)}
      </div>
      {habits.map((h) => {
        const inRange = countIn(h, first, last);
        const sub = mode === 'day' ? `${inRange}/${h.weekly} gün` : h.kind === 'görev' ? 'görev' : null;
        const Tag = onPick ? 'button' : 'div';
        return (
          <Tag key={h.id} class="hg-row" role="row" style={`--c:${colorOf(h)}`} {...(onPick ? { type: 'button', onClick: () => onPick(h.id), 'aria-label': `${h.name}, grafiği aç` } : {})}>
            <span class="hg-name"><span>{h.name}</span>{sub && <small>{sub}</small>}</span>
            {buckets.map((b) => {
              const future = b.start > today;
              const { count, target } = habitBucket(h, b);
              const p = future ? 0 : target == null ? (count > 0 ? 100 : 0) : Math.min(100, (count / target) * 100);
              return (
                <span key={b.start} class={`hg-cell ${future ? 'future' : ''}`} role="cell" aria-label={future ? '' : target == null ? (count ? 'yapıldı' : 'yapılmadı') : `${count} gün`}>
                  <i class="hg-c" style={`--p:${p}%`} />
                  {!compact && target != null && !future && <em>{count}</em>}
                </span>
              );
            })}
          </Tag>
        );
      })}
    </div>
  );
}

// One habit: bars = days done per slice, a tick marks the target of each slice.
export function HabitChart({ habit, buckets, mode, today }) {
  const W = 340, H = 170, top = 18, bottom = 24, plotH = H - top - bottom;
  const n = buckets.length;
  const data = buckets.map((b) => ({ b, ...habitBucket(habit, b), future: b.start > today }));
  const max = mode === 'day' ? 1 : Math.max(1, ...data.map((d) => Math.max(d.count, d.target || 0)));
  const slot = W / n, bw = Math.min(34, slot * 0.6);
  const summary = data.map((d) => `${d.b.label}: ${d.count} gün`).join('; ');
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Yapılan gün grafiği. ${summary}`}>
      <line x1="0" x2={W} y1={top + plotH} y2={top + plotH} class="chart-axis" />
      {data.map((d, i) => {
        const x = i * slot + (slot - bw) / 2;
        const h = (d.count / max) * plotH;
        const ty = d.target ? top + plotH - (d.target / max) * plotH : null;
        return (
          <g key={d.b.start}>
            {d.count > 0 && <rect x={x} y={top + plotH - h} width={bw} height={Math.max(h, 2)} class="chart-bar" style={`fill:${colorOf(habit)}`} />}
            {d.count === 0 && !d.future && <rect x={x} y={top + plotH - 3} width={bw} height="3" class="chart-bar" style="fill:var(--track)" />}
            {ty != null && <line x1={x - 3} x2={x + bw + 3} y1={ty} y2={ty} class="chart-target" />}
            {mode !== 'day' && d.count > 0 && <text x={x + bw / 2} y={top + plotH - h - 5} text-anchor="middle" class="chart-val">{d.count}</text>}
            <text x={x + bw / 2} y={H - 6} text-anchor="middle" class="chart-lbl">{d.b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

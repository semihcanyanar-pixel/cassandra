import { RIDGE, SUMMIT, trailAt, stepFraction, climberAt } from '../lib/climb.js';

const INK = 'var(--text)';
const FLAG = '#E5383B';

function Figure({ pose }) {
  // feet at the origin; a small line figure
  const arms = pose === 'cheer'
    ? 'M0 -17L8 -29M0 -17L-7 -11'
    : pose === 'climb' ? 'M0 -17L7 -22M0 -17L-7 -12' : 'M0 -17L-6 -11M0 -17L6 -11';
  return (
    <g stroke={INK} stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <circle cx="0" cy="-25" r="4.2" fill={INK} />
      <path d="M0 -20V-9M0 -9L-4.5 0M0 -9L4.5 0" />
      <path d={arms} />
      {pose === 'cheer' && (
        <>
          <path d="M8 -29V-66" />
          <path class="cl-cloth" d="M8 -66l17 6-17 7z" fill={FLAG} stroke={INK} stroke-width="1.6" />
        </>
      )}
    </g>
  );
}

// "Tırmanış": the outline of a mountain, one footprint per activity lying on its face (black when done, outline when not), the climber on the last finished one.
// When everything is done the climber stands on the summit and raises the flag. Footprints are ordered done-first so progress reads as a path.
export function Climb({ rows }) {
  const n = rows.length;
  const ordered = [...rows].sort((a, b) => Number(b.done) - Number(a.done));
  const done = ordered.filter((r) => r.done).length;
  const at = climberAt(done, n);
  const all = n > 0 && done >= n;
  return (
    <svg class="climb" viewBox="0 -66 340 184" width="100%" role="img" aria-label={`${n} aktiviteden ${done} tanesi yapıldı`}>
      <path d={RIDGE} fill="none" stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      {ordered.map((r, i) => {
        const p = trailAt(stepFraction(i, n));
        const off = i % 2 ? -4 : -7; // alternate feet, both just above the surface
        return (
          <g key={r.a.id} transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) translate(${off} 0) scale(0.95)`} class={r.done ? 'cl-foot on' : 'cl-foot'}>
            <ellipse cx="0" cy="-5" rx="3.8" ry="5.6" fill={r.done ? INK : 'none'} stroke={INK} stroke-width="1.6" opacity={r.done ? 1 : 0.4} />
            <ellipse cx="0" cy="4.5" rx="3" ry="3.4" fill={r.done ? INK : 'none'} stroke={INK} stroke-width="1.6" opacity={r.done ? 1 : 0.4} />
          </g>
        );
      })}
      {!all && (
        <>
          <path d={`M${SUMMIT[0]} ${SUMMIT[1]}V${SUMMIT[1] - 42}`} stroke={INK} stroke-width="2.6" stroke-linecap="round" />
          <path d={`M${SUMMIT[0]} ${SUMMIT[1] - 42}l16 6-16 7z`} fill={FLAG} stroke={INK} stroke-width="1.6" />
        </>
      )}
      <g class="cl-fig" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
        <Figure pose={at.pose} />
      </g>
      {all && (
        <g class="cl-spark" stroke="var(--act-0)" stroke-width="2.6" stroke-linecap="round" fill="none">
          <path d={`M${SUMMIT[0] + 34} -14l5-5M${SUMMIT[0] + 42} 2h8M${SUMMIT[0] - 30} -12l-5-5M${SUMMIT[0] - 40} 2h-8`} />
        </g>
      )}
    </svg>
  );
}

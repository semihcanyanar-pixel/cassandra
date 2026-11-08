import { useEffect, useRef, useState } from 'preact/hooks';
import { RIDGE, SUMMIT, trailAt, stepFraction, climberAt } from '../lib/climb.js';

const INK = 'var(--text)';
const FLAG = '#E5383B';

// A hiker seen from the side, feet at the origin, facing right: red beanie, backpack, trekking pole.
// pose: 'walk' (standing at the foot), 'climb' (mid step, pole planted ahead), 'cheer' (on the summit, flag held high).
export function Hiker({ pose }) { return <Figure pose={pose} />; }
function Figure({ pose }) {
  const cheer = pose === 'cheer', climb = pose === 'climb';
  const legs = cheer ? 'M-3 -14L-5 -7L-6.5 0M-3 -14L3 -8L5.5 0' : climb ? 'M-3 -14L2.5 -12.5L5 -3.5M-3 -14L-5.5 -7L-7 0' : 'M-3 -14L-3.5 -7L-4.5 0M-3 -14L1 -7L2.5 0';
  return (
    <g stroke-linecap="round" stroke-linejoin="round" fill="none">
      {/* legs and boots */}
      <path d={legs} stroke={INK} stroke-width="3.6" />
      {/* backpack */}
      <rect x="-10.5" y="-28" width="7" height="14" rx="2.6" fill="var(--act-0)" stroke={INK} stroke-width="1.8" />
      {/* torso, leaning into the slope */}
      <path d="M-3 -14L1 -27" stroke={INK} stroke-width="5" />
      {/* head and beanie */}
      <circle cx="2.4" cy="-33" r="4.3" fill={INK} stroke="none" />
      <path d="M-2.2 -34.2A4.7 4.7 0 0 1 7 -34.2Z" fill={FLAG} stroke={INK} stroke-width="1.2" />
      <circle cx="2.4" cy="-39.6" r="1.4" fill={FLAG} stroke={INK} stroke-width="1" />
      {cheer ? (
        <>
          {/* one arm holds the flag up, the other fist is up too */}
          <path d="M1 -25L6 -37M1 -25L-4 -36" stroke={INK} stroke-width="3" />
          <path d="M6 -37V-72" stroke={INK} stroke-width="2.4" />
          <path class="cl-cloth" d="M6 -72l18 6.5-18 7.5z" fill={FLAG} stroke={INK} stroke-width="1.6" />
        </>
      ) : (
        <>
          {/* arm and trekking pole planted ahead */}
          <path d="M1 -25L8 -27" stroke={INK} stroke-width="3" />
          <path d={climb ? 'M8 -29L14 -2' : 'M8 -29L11 -1'} stroke={INK} stroke-width="1.8" />
        </>
      )}
    </g>
  );
}

// A small tent: one per activity. Filled when the activity is done, only an outline when it is still ahead.
function Camp({ done }) {
  return (
    <g>
      <path d="M-8 0L0 -13L8 0Z" fill={done ? INK : 'none'} stroke={INK} stroke-width="1.8" stroke-linejoin="round" opacity={done ? 1 : 0.4} />
      {done && <path d="M-2.4 0L0 -5.5L2.4 0Z" fill="var(--bg)" />}
    </g>
  );
}

// "Tırmanış": the outline of a mountain, a camp per activity on its face, the hiker next to the last finished camp.
// When everything is done the hiker stands on the summit and raises the flag. Camps are ordered done-first so progress reads as a route.
// Sky behind the mountain: a sun that climbs and sinks with the hour, a drifting cloud by day, a moon and stars at night. Thin lines, quiet.
function Sky({ hour }) {
  const day = hour >= 6 && hour < 19;
  if (!day) {
    return (
      <g class="cl-sky" stroke={INK} stroke-width="2" stroke-linecap="round" fill="none" opacity=".55">
        <path d="M48 -52a14 14 0 1 0 14 22a11 11 0 0 1-14-22z" />
        <path d="M92 -48v6M89 -45h6M130 -30v5M127.5 -27.5h5M20 -20v5M17.5 -17.5h5" />
      </g>
    );
  }
  const k = Math.sin(((hour - 6) / 13) * Math.PI); // 0 at the edges of the day, 1 at noon
  const y = -10 - k * 26;
  return (
    <g class="cl-sky" stroke={INK} stroke-width="2" stroke-linecap="round" fill="none" opacity=".55">
      <g transform={`translate(52 ${y.toFixed(1)})`}>
        <circle r="8" />
        <path d="M0 -14v-4M0 14v4M-14 0h-4M14 0h4M-10 -10l-3 -3M10 10l3 3M10 -10l3 -3M-10 10l-3 3" />
      </g>
      <g class="cl-cloud"><path d="M262 -22h38a8 8 0 0 0 -2 -15a12 12 0 0 0 -23 -3a9 9 0 0 0 -13 18z" /></g>
    </g>
  );
}

// A burst of confetti when the last activity of the day gets done (not when the page opens already finished).
function Confetti({ at }) {
  const bits = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + 0.3, r = 38 + (i % 3) * 16;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r - 18, rot: (i * 53) % 360, c: i % 4 };
  });
  return (
    <g transform={`translate(${at[0]} ${at[1] - 30})`} class="cl-confetti">
      {bits.map((b, i) => <rect key={i} x="-2.5" y="-4" width="5" height="8" rx="1.2" fill={`var(--act-${b.c})`} style={`--dx:${b.dx.toFixed(0)}px;--dy:${b.dy.toFixed(0)}px;--rot:${b.rot}deg`} />)}
    </g>
  );
}

export function Climb({ rows }) {
  const n = rows.length;
  const ordered = [...rows].sort((a, b) => Number(b.done) - Number(a.done));
  const done = ordered.filter((r) => r.done).length;
  const at = climberAt(done, n);
  const all = n > 0 && done >= n;
  const [burst, setBurst] = useState(0);
  const was = useRef(all);
  useEffect(() => {
    if (all && !was.current) {
      setBurst((b) => b + 1);
      try { navigator.vibrate?.([30, 50, 70]); } catch { /* not supported (iPhone) */ }
      const t = setTimeout(() => setBurst(0), 2200);
      was.current = all;
      return () => clearTimeout(t);
    }
    was.current = all;
    return undefined;
  }, [all]);
  const hour = new Date().getHours();
  return (
    <svg class="climb" viewBox="0 -76 340 194" width="100%" role="img" aria-label={`${n} aktiviteden ${done} tanesi yapıldı`}>
      <Sky hour={hour} />
      <path d={RIDGE} fill="none" stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      {ordered.map((r, i) => {
        const p = trailAt(stepFraction(i, n));
        return (
          <g key={r.a.id} transform={`translate(${p.x} ${p.y + 2})`} class={r.done ? 'cl-camp on' : 'cl-camp'}>
            <g class={r.done ? 'cl-tent on' : 'cl-tent'}><Camp done={r.done} /></g>
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
        <g key={Math.round(at.x)} class="cl-hop"><Figure pose={at.pose} /></g>
      </g>
      {burst > 0 && <Confetti key={burst} at={SUMMIT} />}
      {all && (
        <g class="cl-spark" stroke="var(--act-0)" stroke-width="2.6" stroke-linecap="round" fill="none">
          <path d={`M${SUMMIT[0] + 36} -20l5-5M${SUMMIT[0] + 44} -4h8M${SUMMIT[0] - 32} -18l-5-5M${SUMMIT[0] - 42} -4h-8`} />
        </g>
      )}
    </svg>
  );
}

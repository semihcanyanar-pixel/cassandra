// Geometry of the "Tırmanış" picture on Bugün: a mountain, a trail up its face, one footprint per activity.
// All numbers are in the SVG's own units (viewBox 0 -66 340 184).
export const RIDGE = 'M6 114L96 60L132 82L214 12L300 92L334 114';
// The trail runs along the left face of the ridge line itself.
export const TRAIL = [[14, 109.2], [96, 60], [132, 82], [214, 12]];
export const SUMMIT = TRAIL[TRAIL.length - 1];

const segs = TRAIL.slice(1).map((p, i) => {
  const [x0, y0] = TRAIL[i];
  return { x0, y0, dx: p[0] - x0, dy: p[1] - y0, len: Math.hypot(p[0] - x0, p[1] - y0) };
});
const TOTAL = segs.reduce((s, g) => s + g.len, 0);

// A point on the trail at fraction f (0 = foot of the mountain, 1 = summit) and the walking angle in degrees (0 = straight up).
export function trailAt(f) {
  if (f >= 1) { const l = segs[segs.length - 1]; return { x: SUMMIT[0], y: SUMMIT[1], angle: (Math.atan2(l.dx, -l.dy) * 180) / Math.PI }; }
  let d = Math.min(1, Math.max(0, f)) * TOTAL;
  for (const g of segs) {
    if (d <= g.len + 1e-9) {
      const k = g.len ? d / g.len : 0;
      return { x: g.x0 + g.dx * k, y: g.y0 + g.dy * k, angle: (Math.atan2(g.dx, -g.dy) * 180) / Math.PI };
    }
    d -= g.len;
  }
  const last = segs[segs.length - 1];
  return { x: SUMMIT[0], y: SUMMIT[1], angle: (Math.atan2(last.dx, -last.dy) * 180) / Math.PI };
}

// Footprints are spread evenly up the trail, a little short of the summit (it stays free for the flag) and away from the ridge corners.
export const stepFraction = (i, n) => ((i + 0.5) / (n + 0.5)) * 0.95;

export const AHEAD = 0.06; // the climber stands this far past the last finished camp
// Where the climber stands: at the foot with nothing done, on the last finished footprint, on the summit when all are done.
export function climberAt(done, n) {
  if (n > 0 && done >= n) return { ...trailAt(1), pose: 'cheer' };
  if (done <= 0) return { ...trailAt(0), pose: 'walk' };
  return { ...trailAt(Math.min(1, stepFraction(done - 1, n) + AHEAD)), pose: 'climb' }; // standing just past the camp he reached
}

export const climbText = (done, n) => (n > 0 && done >= n ? 'Zirvedesin!' : done === 0 ? 'Yola çıkalım' : `zirveye ${n - done} adım kaldı`);

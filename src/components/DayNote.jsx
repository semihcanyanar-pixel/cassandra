import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { dailyNote } from '../lib/dayNote.js';

// "Günün notu": swipeable pages that also turn by themselves every 10 seconds.
//   1. motivation   2. quote   3. a parenting / child development tip   4. the weekly evaluation (Sunday evening and Monday, personal)
// Everything except the weekly page is the same for both of us and changes at midnight.
export function DayNote({ dayPool, weekly, date }) {
  const n = dailyNote(date, dayPool);
  const pages = [
    { key: 'm', label: 'GÜNÜN MOTİVASYONU', body: <div class="dn-text">{n.motivation.t}</div> },
    {
      key: 'q', label: 'GÜNÜN SÖZÜ',
      body: <div class="dn-quote"><span>“{n.quote.t}”</span><span class="dn-by">— {n.quote.by}</span></div>,
    },
    { key: 't', label: 'EBEVEYNLİK', body: <div class="dn-text">{n.tip.t}</div> },
    ...(weekly ? [{
      key: 'w', label: 'HAFTALIK DEĞERLENDİRME',
      body: (
        <>
          <div class="dn-text">{weekly.text}</div>
          {(weekly.tips || []).length > 0 && <ul class="dn-tips">{weekly.tips.map((tp, i) => <li key={i}>{tp}</li>)}</ul>}
        </>
      ),
    }] : []),
  ];

  const box = useRef(null);
  const els = useRef([]);
  const pos = useRef(0); // float position: 1.4 = page 2 is turning towards page 3 (40 % of the way)
  const anim = useRef(0);
  const fin = useRef(0);
  const drag = useRef(null);
  const touched = useRef(0); // last time a finger touched the pages: the auto turning waits after that
  const [page, setPage] = useState(0);
  const count = pages.length;
  const still = useRef(false);
  try { still.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }

  // Paint position t: the page that is leaving tilts around its spine edge and fades while the next one fades in (set straight on the DOM, no re-render).
  const paint = (t) => {
    pos.current = t;
    els.current.forEach((el, i) => {
      if (!el) return;
      const d = t - i;
      let op = 0, rot = 0;
      if (d >= 0 && d < 1) { op = Math.max(0, 1 - d / 0.6); rot = -75 * d; } else if (d < 0 && d > -1) op = Math.max(0, (1 + d - 0.4) / 0.6); // little overlap, so the two texts never mix
      el.style.opacity = String(op);
      el.style.transform = rot ? `rotateY(${rot.toFixed(1)}deg)` : '';
      el.style.visibility = op > 0.01 ? 'visible' : 'hidden';
    });
    const r = Math.round(t);
    setPage((p) => (p === r ? p : r));
  };
  const animateTo = (target, ms = 420) => {
    cancelAnimationFrame(anim.current); clearTimeout(fin.current);
    if (still.current) { paint(target); return; }
    fin.current = setTimeout(() => { cancelAnimationFrame(anim.current); paint(target); }, ms + 120); // frames can stall (hidden tab): always end on the page
    const from = pos.current, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      paint(from + (target - from) * e);
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  useLayoutEffect(() => { paint(Math.min(Math.round(pos.current), count - 1)); }, [count]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { cancelAnimationFrame(anim.current); clearTimeout(fin.current); }, []);

  useEffect(() => {
    if (count < 2 || still.current) return undefined;
    const id = setInterval(() => {
      // no check of drag.current: iOS can drop a pointerup, and a stale drag would stop the turning for good
      if (document.visibilityState !== 'visible' || Date.now() - touched.current < 10000) return;
      const next = (Math.round(pos.current) + 1) % count;
      animateTo(next, next === 0 ? 700 : 420);
    }, 10000);
    return () => clearInterval(id);
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  const down = (e) => { touched.current = Date.now(); cancelAnimationFrame(anim.current); clearTimeout(fin.current); drag.current = { id: e.pointerId, x: e.clientX, t: pos.current, on: false, moved: 0 }; };
  const move = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.on && Math.abs(dx) > 8) { d.on = true; try { box.current.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    if (d.on) { d.moved = dx; paint(Math.max(0, Math.min(count - 1, d.t - dx / (box.current.clientWidth || 300)))); }
  };
  const up = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null; touched.current = Date.now();
    if (!d.on) return;
    const w = box.current.clientWidth || 300;
    const target = Math.abs(d.moved) > w * 0.15 ? d.t + (d.moved < 0 ? 1 : -1) : d.t;
    animateTo(Math.max(0, Math.min(count - 1, Math.round(target))), 320);
  };

  return (
    <section class="dnote book" aria-roledescription="carousel" aria-label="Günün notu">
      <div class="dn-stack" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {pages.map((p, i) => (
          <div class="dn-page" key={p.key} ref={(el) => { els.current[i] = el; }} role="group" aria-label={`${i + 1} / ${count}`} aria-hidden={i !== page}>
            <div class="dn-leaf">
              <div class="dn-label">{p.label}</div>
              {p.body}
            </div>
          </div>
        ))}
      </div>
      {count > 1 && (
        <div class="dn-foot" aria-hidden="true">
          <div class="dn-dots">{pages.map((p, i) => <i key={p.key} class={i === page ? 'on' : ''} />)}</div>
          <span class="dn-num num">{page + 1} / {count}</span>
        </div>
      )}
    </section>
  );
}

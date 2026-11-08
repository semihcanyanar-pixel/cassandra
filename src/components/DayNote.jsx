import { useEffect, useRef, useState } from 'preact/hooks';
import { dailyNote } from '../lib/dayNote.js';

// "Günün notu": swipeable pages that also turn by themselves every 10 seconds.
//   1. motivation sentence + a quote   2. a parenting / child development tip   3. the weekly evaluation (Sunday evening and Monday, personal)
// Everything except the weekly page is the same for both of us and changes at midnight.
export function DayNote({ dayPool, weekly, date }) {
  const n = dailyNote(date, dayPool);
  const pages = [
    {
      key: 'm', label: 'GÜNÜN NOTU',
      body: (
        <>
          <div class="dn-text">{n.motivation.t}</div>
          <div class="dn-quote"><span>“{n.quote.t}”</span><span class="dn-by">— {n.quote.by}</span></div>
        </>
      ),
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

  const track = useRef(null);
  const touched = useRef(0); // last time a finger or the wheel touched the pages: the auto turning waits after that
  const [page, setPage] = useState(0);
  const count = pages.length;

  const width = () => track.current?.clientWidth || 1;
  const current = () => Math.round((track.current?.scrollLeft || 0) / width());
  const goTo = (i) => track.current?.scrollTo({ left: width() * i, behavior: 'smooth' });
  const mark = () => { touched.current = Date.now(); };

  useEffect(() => {
    if (count < 2) return undefined;
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
    if (still) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - touched.current < 10000) return;
      goTo((current() + 1) % count);
    }, 10000);
    return () => clearInterval(id);
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  // Page turning: while scrolling, each page tilts around its spine edge like a leaf being turned (set straight on the DOM, no re-render).
  const leaves = useRef([]);
  const flip = () => {
    const w = width(), x = track.current?.scrollLeft || 0;
    leaves.current.forEach((el, i) => {
      if (!el) return;
      const d = Math.max(-1, Math.min(1, x / w - i)); // 0 = flat, >0 leaving to the left, <0 arriving from the right
      el.style.transformOrigin = d > 0 ? 'right center' : 'left center';
      el.style.transform = d === 0 ? '' : `perspective(700px) rotateY(${(d * 55).toFixed(1)}deg)`;
      el.style.opacity = String(1 - Math.abs(d) * 0.55);
    });
  };

  return (
    <section class="dnote book" aria-roledescription="carousel" aria-label="Günün notu">
      <div class="dn-track" ref={track} onScroll={() => { flip(); const i = current(); if (i !== page) setPage(i); }} onTouchStart={mark} onPointerDown={mark} onWheel={mark}>
        {pages.map((p, i) => (
          <div class="dn-page" key={p.key} role="group" aria-label={`${i + 1} / ${count}`}>
            <div class="dn-leaf" ref={(el) => { leaves.current[i] = el; }}>
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

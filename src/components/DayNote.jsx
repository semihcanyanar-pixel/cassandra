import { useEffect, useRef, useState } from 'preact/hooks';
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

  return (
    <section class="dnote book" aria-roledescription="carousel" aria-label="Günün notu">
      <div class="dn-track" ref={track} onScroll={() => { const i = current(); if (i !== page) setPage(i); }} onTouchStart={mark} onPointerDown={mark} onWheel={mark}>
        {pages.map((p, i) => (
          <div class="dn-page" key={p.key} role="group" aria-label={`${i + 1} / ${count}`}>
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

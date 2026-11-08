import { useEffect, useRef, useState } from 'preact/hooks';
import { dailyNote } from '../lib/dayNote.js';
import { PAPERS } from '../lib/dayFrames.js';

// "Günün notu": pages that also turn by themselves every 10 seconds (swipe, tap the curled corner, or wait).
//   1. motivation   2. quote   3. a parenting / child development tip   4. the weekly evaluation (Sunday evening and Monday, personal)
// Everything except the weekly page is the same for both of us and changes at midnight.
// The change itself is plain CSS (the old page fades, the new one writes itself word by word), so it needs no scripted frames.
const Words = ({ text, from = 0 }) => text.split(' ').map((w, i) => <>{i > 0 && ' '}<span key={i} class="w" style={`--i:${from + i}`}>{w}</span></>);

export function DayNote({ dayPool, weekly, date, frame = 'kitap', paper = 'sari', onPaper }) {
  const n = dailyNote(date, dayPool);
  const pages = [
    { key: 'm', label: 'GÜNÜN MOTİVASYONU', body: <div class="dn-text"><Words text={n.motivation.t} /></div> },
    {
      key: 'q', label: 'GÜNÜN SÖZÜ',
      body: <div class="dn-quote"><span>“<Words text={n.quote.t} />”</span><span class="dn-by w" style={`--i:${n.quote.t.split(' ').length + 1}`}>— {n.quote.by}</span></div>,
    },
    { key: 't', label: 'EBEVEYNLİK', body: <div class="dn-text"><Words text={n.tip.t} /></div> },
    ...(weekly ? [{
      key: 'w', label: 'HAFTALIK DEĞERLENDİRME',
      body: (
        <>
          <div class="dn-text"><Words text={weekly.text} /></div>
          {(weekly.tips || []).length > 0 && <ul class="dn-tips">{weekly.tips.map((tp, i) => <li key={i} class="w" style={`--i:${weekly.text.split(' ').length + 2 + i * 3}`}>{tp}</li>)}</ul>}
        </>
      ),
    }] : []),
  ];

  const [pk, setPk] = useState(paper);
  const pi = Math.max(0, PAPERS.findIndex((p) => p.key === pk));
  const cur0 = PAPERS[pi], next = PAPERS[(pi + 1) % PAPERS.length];
  const nextPaper = () => { touched.current = Date.now(); setPk(next.key); onPaper?.(next.key); };
  const count = pages.length;
  const [page, setPage] = useState(0);
  const cur = Math.min(page, count - 1);
  const touched = useRef(0); // last touch: the auto turning waits 10 s after it
  const touch = useRef(null);
  const go = (to) => { touched.current = Date.now(); setPage(((to % count) + count) % count); };

  useEffect(() => {
    if (count < 2) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - touched.current < 10000) return;
      setPage((p) => (p + 1) % count);
    }, 10000);
    return () => clearInterval(id);
  }, [count]);

  const onStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; touched.current = Date.now(); };
  const onEnd = (e) => {
    const s = touch.current; touch.current = null;
    if (!s || !e.changedTouches[0]) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) go(cur + (dx < 0 ? 1 : -1));
  };

  return (
    <section class={`dnote frame-${frame}${frame === 'not' && cur0.dark ? ' dark' : ''}`} style={frame === 'not' ? `--paper:${cur0.bg}` : undefined} aria-roledescription="carousel" aria-label="Günün notu">
      <span class="dn-tab" aria-hidden="true">{pages[cur].label}</span>
      <div class="dn-stack" onTouchStart={onStart} onTouchEnd={onEnd}>
        {pages.map((p, i) => (
          <div class={i === cur ? 'dn-page on' : 'dn-page'} key={p.key} role="group" aria-label={`${i + 1} / ${count}`} aria-hidden={i !== cur}>
            <div class="dn-leaf">
              <div class="dn-label">{p.label}</div>
              {p.body}
            </div>
          </div>
        ))}
      </div>
      {count > 1 && <span class="dn-stub num" aria-hidden="true"><b>{cur + 1}</b><i>/ {count}</i></span>}
      {count > 1 && <button type="button" class="dn-curl" aria-label="Sonraki sayfa" onClick={() => go(cur + 1)} />}
      {count > 1 && (
        <div class="dn-foot">
          <div class="dn-dots" aria-hidden="true">{pages.map((p, i) => <i key={p.key} class={i === cur ? 'on' : ''} />)}</div>
          {frame === 'not' && <button type="button" class="dn-paper" aria-label={`Kâğıt rengi: ${cur0.name}. ${next.name} yap`} onClick={nextPaper}><i style={`background:${cur0.bg}`} /></button>}
          <span class="dn-num num" aria-hidden="true">{cur + 1} / {count}</span>
        </div>
      )}
    </section>
  );
}

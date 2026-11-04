import { useEffect, useRef } from 'preact/hooks';

// Swipeable selector: drag left/right and the item under the centre becomes selected (scroll-snap). Tapping an item also works.
export function Picker({ items, value, onChange, label, size }) {
  const box = useRef(null);
  const timer = useRef(null);
  const lock = useRef(false);
  const idx = Math.max(0, items.findIndex((x) => x.value === value));

  const centerOn = (i, smooth) => {
    const el = box.current, b = el?.querySelector(`[data-i="${i}"]`);
    if (!el || !b) return;
    lock.current = true;
    el.scrollTo({ left: b.offsetLeft + b.offsetWidth / 2 - el.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
    setTimeout(() => { lock.current = false; }, smooth ? 450 : 50);
  };
  useEffect(() => { centerOn(idx, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { centerOn(idx, true); }, [idx, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    if (lock.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = box.current;
      if (!el || lock.current) return;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0, d = Infinity;
      el.querySelectorAll('[data-i]').forEach((b) => {
        const dist = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid);
        if (dist < d) { d = dist; best = Number(b.dataset.i); }
      });
      if (best !== idx) onChange(items[best].value);
    }, 90);
  };

  return (
    <div class={`picker ${size || ''}`}>
      <div class="picker-track" ref={box} onScroll={onScroll} role="radiogroup" aria-label={label}>
        {items.map((x, i) => (
          <button key={x.value} data-i={i} type="button" role="radio" aria-checked={i === idx} class={i === idx ? 'pk on' : 'pk'} onClick={() => onChange(x.value)}>{x.label}</button>
        ))}
      </div>
      <div class="picker-dots" aria-hidden="true">
        {items.map((x, i) => <i key={x.value} class={i === idx ? 'on' : ''} />)}
      </div>
    </div>
  );
}

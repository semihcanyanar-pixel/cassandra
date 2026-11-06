import { numberLabels, parseInline } from '../lib/notes.js';

// Read-only note lines (note cards and the reading view). `blocks` carry `idx` (position in the whole note) so ticking a round box saves the right line.
export function NoteLines({ blocks, onTick }) {
  const labels = numberLabels(blocks);
  return blocks.map((b, i) => {
    const inner = (
      <>
        {b.k === 'cb' && <i class={b.d ? 'nc on' : 'nc'}>{b.d && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</i>}
        {b.k === 'ul' && <i class="nm">•</i>}
        {b.k === 'ol' && <i class="nm">{labels[i]}</i>}
        <span class={`nt ${b.b ? 'b' : ''} ${b.i ? 'i' : ''} ${b.s || (b.k === 'cb' && b.d) ? 's' : ''}`}>
          {parseInline(b.t).map((r, j) => <span key={j} class={`${r.b ? 'b' : ''} ${r.i ? 'i' : ''} ${r.s ? 's' : ''}`}>{r.text}</span>)}
        </span>
      </>
    );
    const style = `margin-left:${b.l * 12}px`;
    return b.k === 'cb'
      ? <button type="button" class={`nl k-cb nl-tap ${b.a ? `ta-${b.a}` : ''}`} key={i} style={style} role="checkbox" aria-checked={b.d} aria-label={b.t} onClick={() => onTick(b.idx)}>{inner}</button>
      : <span class={`nl k-${b.k} ${b.a ? `ta-${b.a}` : ''}`} key={i} style={style}>{inner}</span>;
  });
}

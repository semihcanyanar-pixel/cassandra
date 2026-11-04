// Segmented control with a sliding indicator: N equal columns, never wraps. Items: [{ value, label, badge? }].
export function Seg({ items, value, onChange, label }) {
  const i = Math.max(0, items.findIndex((x) => x.value === value));
  return (
    <div class="seg" role="radiogroup" aria-label={label} style={`--n:${items.length};--i:${i}`}>
      <span class="seg-ind" aria-hidden="true" />
      {items.map((x) => (
        <button key={x.value} type="button" role="radio" aria-checked={value === x.value} class={value === x.value ? 'seg-b on' : 'seg-b'} onClick={() => onChange(x.value)}>
          {x.label}{x.badge ? <span class="seg-badge">{x.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

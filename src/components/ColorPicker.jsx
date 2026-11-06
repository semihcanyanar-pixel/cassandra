import { actColor, isHex, COLOR_COUNT } from './ui.jsx';

// Palette swatches (the 7 theme colours) plus a rainbow circle that opens the system colour picker for any colour.
// `value` is a palette index or a "#rrggbb" string.
export function ColorPicker({ value, onChange, label = 'Renk' }) {
  const custom = isHex(value);
  return (
    <div class="swatch-row compact" role="radiogroup" aria-label={label}>
      {Array.from({ length: COLOR_COUNT }, (_, i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={i === 6 ? 'Lacivert' : `Renk ${i + 1}`}
          class="swatch" style={`--sw:${actColor(i)}`} onClick={() => onChange(i)}>
          {value === i && <span class="swatch-dot" />}
        </button>
      ))}
      <label class="swatch rainbow" role="radio" aria-checked={custom} aria-label="Özel renk seç">
        {custom && <span class="swatch-dot" style={`background:${value}`} />}
        <input type="color" value={custom ? value : '#7c5cff'} aria-label="Özel renk" onInput={(e) => onChange(e.currentTarget.value)} />
      </label>
    </div>
  );
}

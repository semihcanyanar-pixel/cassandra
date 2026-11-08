import { IconClose } from '../icons.jsx';

export const COLOR_COUNT = 7; // 0-5 theme colours, 6 = navy
// A colour is a palette index (0-6, follows the theme) or a custom "#rrggbb" string picked from the colour space.
export const isHex = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
export const actColor = (c) => (isHex(c) ? c : `var(--act-${Number.isInteger(c) ? c : 0})`);
// The value for `data-c`: 6 means "dark colour, use light text" (mozaik paints whole cards with the colour).
export const inkKey = (c) => {
  if (!isHex(c)) return Number.isInteger(c) ? c : 0;
  const n = parseInt(c.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 140 ? 6 : 0;
};

// Single-choice chip group (radiogroup).
export function Chips({ options, value, onChange, label, size }) {
  return (
    <div class={`chips ${size || ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          class={value === o.value ? 'chip on' : 'chip'} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" class="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <i><b /></i>
    </button>
  );
}

// Full-screen form/page shell with a back/close button and an optional fixed footer.
export function Page({ title, onClose, children, footer, closeIcon, tall }) {
  return (
    <main class={`screen ${footer ? 'has-footer' : ''} ${footer && tall ? 'tall' : ''}`}>
      <div class="row" style="margin-bottom:4px;justify-content:space-between">
        <h1 style="font-size:30px">{title}</h1>
        <button class="iconbtn" aria-label="Kapat" onClick={onClose}>{closeIcon || <IconClose />}</button>
      </div>
      {children}
      {footer && <div class="form-footer">{footer}</div>}
    </main>
  );
}

export function Card({ label, right, children, class: cls, ...rest }) {
  return (
    <div class={`card ${cls || ''}`} {...rest}>
      {(label || right) && (
        <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <span class="label" style="margin:0;padding:0">{label}</span>{right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Progress({ pct, color }) {
  return <div class="bar"><i style={`width:${Math.max(0, Math.min(100, pct))}%;${color ? `background:${color}` : ''}`} /></div>;
}

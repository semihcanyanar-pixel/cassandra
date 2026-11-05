import { IconClose } from '../icons.jsx';

export const COLOR_COUNT = 7; // 0-5 theme colours, 6 = black
export const actColor = (i) => `var(--act-${i ?? 0})`;

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
export function Page({ title, onClose, children, footer, closeIcon }) {
  return (
    <main class={`screen ${footer ? 'has-footer' : ''}`}>
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

import { useRef } from 'preact/hooks';

// A value that pops in when it CHANGES (not on the first render): the span is re-created with the `pop` class so its CSS animation plays once.
export function Pop({ value, class: cls = '', children }) {
  const prev = useRef(value);
  const seen = useRef(false);
  if (prev.current !== value) { seen.current = true; prev.current = value; }
  return <span key={String(value)} class={`${cls} ${seen.current ? 'pop' : ''}`.trim()}>{children}</span>;
}

import { useEffect, useRef } from 'preact/hooks';
import { toHtml, MARKS, NOTE_LIMITS } from '../lib/notes.js';

// One note line as a contenteditable element: bold / italic / strikethrough show directly (no markers).
// The note still stores the line as marker text (**bold**, __italic__, ~~strike~~); this file converts DOM <-> marker text.

const isBold = (n) => n.nodeName === 'B' || n.nodeName === 'STRONG' || /^(bold|[6-9]00)$/.test(n.style?.fontWeight || '');
const isItalic = (n) => n.nodeName === 'I' || n.nodeName === 'EM' || n.style?.fontStyle === 'italic';
const isStrike = (n) => ['S', 'STRIKE', 'DEL'].includes(n.nodeName) || /line-through/.test(n.style?.textDecoration || n.style?.textDecorationLine || '');

// DOM subtree -> marker text. Adjacent runs of the same format are merged by the parser, so simple nesting is enough.
export function serialize(node) {
  let out = '';
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) { out += c.nodeValue.replace(/[\n​]/g, ''); return; }
    if (c.nodeType !== 1 || c.nodeName === 'BR') return;
    let inner = serialize(c);
    if (!inner) return;
    if (isStrike(c)) inner = MARKS.s + inner + MARKS.s;
    if (isItalic(c)) inner = MARKS.i + inner + MARKS.i;
    if (isBold(c)) inner = MARKS.b + inner + MARKS.b;
    out += inner;
  });
  return out;
}

// Caret as a plain-text offset inside `el` (null when the selection is elsewhere).
export function caretOffset(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return null;
  const r = sel.getRangeAt(0).cloneRange();
  r.selectNodeContents(el);
  r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().length;
}
export function placeCaret(el, offset) {
  const sel = window.getSelection();
  const r = document.createRange();
  let left = offset, set = false;
  const walk = (n) => {
    if (set) return;
    if (n.nodeType === 3) {
      if (left <= n.nodeValue.length) { r.setStart(n, left); set = true; } else left -= n.nodeValue.length;
      return;
    }
    n.childNodes.forEach(walk);
  };
  walk(el);
  if (!set) { r.selectNodeContents(el); r.collapse(false); }
  r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r);
}

// Splits the line at the caret: [text before, text after] as marker text, or null if there is no caret in this line.
export function splitAtCaret(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return null;
  const range = sel.getRangeAt(0);
  const tail = range.cloneRange();
  tail.selectNodeContents(el);
  tail.setStart(range.endContainer, range.endOffset);
  const holder = document.createElement('div');
  holder.appendChild(tail.cloneContents());
  const head = range.cloneRange();
  head.selectNodeContents(el);
  head.setEnd(range.startContainer, range.startOffset);
  const headHolder = document.createElement('div');
  headHolder.appendChild(head.cloneContents());
  return [serialize(headHolder), serialize(holder)];
}

export function LineEditor({ value, onValue, onEnter, onPasteLines, onBackspaceStart, onFocus, onRef, className, label, placeholder }) {
  const el = useRef(null);

  // Keep the DOM in sync with the model when it changed from outside (split, merge, load). Typing already matches, so the caret is left alone.
  useEffect(() => {
    if (el.current && serialize(el.current) !== value) el.current.innerHTML = toHtml(value);
  });

  return (
    <div
      ref={(n) => { el.current = n; onRef?.(n); }}
      class={`${className} ${value ? '' : 'empty'}`}
      contentEditable
      role="textbox" aria-multiline="false" aria-label={label} data-ph={placeholder || ''}
      autoCapitalize="sentences" spellcheck={true}
      onFocus={onFocus}
      onInput={(e) => { const v = serialize(e.currentTarget).slice(0, NOTE_LIMITS.line); onValue(v); }}
      onBeforeInput={(e) => {
        if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') { e.preventDefault(); onEnter(el.current); return; }
        if (e.inputType === 'deleteContentBackward') {
          const sel = window.getSelection();
          if (sel && sel.isCollapsed && caretOffset(el.current) === 0) { e.preventDefault(); onBackspaceStart(el.current); }
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const raw = (e.clipboardData?.getData('text/plain') || '').replace(/\r/g, '');
        const parts = raw.split('\n').map((x) => x.trimEnd()).filter((x) => x.trim());
        // several lines pasted: they become separate note lines (the parent splits the current line around the caret)
        if (parts.length > 1 && onPasteLines) { onPasteLines(el.current, parts); return; }
        const t = raw.replace(/\s*\n\s*/g, ' ');
        if (t) document.execCommand('insertText', false, t);
      }}
    />
  );
}

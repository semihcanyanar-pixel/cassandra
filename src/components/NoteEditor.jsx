import { useEffect, useRef } from 'preact/hooks';
import { toHtml, normBlock, MARKS } from '../lib/notes.js';

// The note body as ONE editable field (like iPhone Notes), so selections, copy and paste work across lines.
// Every line is a <div class="ed-line" data-k data-l data-d data-f data-a>; bullets, numbers and circles are drawn with CSS, not part of the text.
// The DOM is the source of truth while typing; after each change it is read back into the note's blocks ({ t, k, d, l, b, i, s, a }, see lib/notes.js).

const LINE = 'ed-line';
const LISTS = ['ul', 'ol', 'cb'];
const FLAG_CMD = { b: 'bold', i: 'italic', s: 'strikeThrough' };
const strip = (t) => t.replace(/[\n​]/g, '');

const isBold = (n) => n.nodeName === 'B' || n.nodeName === 'STRONG' || /^(bold|[6-9]00)$/.test(n.style?.fontWeight || '');
const isItalic = (n) => n.nodeName === 'I' || n.nodeName === 'EM' || n.style?.fontStyle === 'italic';
const isStrike = (n) => ['S', 'STRIKE', 'DEL'].includes(n.nodeName) || /line-through/.test(n.style?.textDecoration || n.style?.textDecorationLine || '');

// DOM subtree -> marker text (**bold**, __italic__, ~~strike~~).
export function serialize(node) {
  let out = '';
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) { out += strip(c.nodeValue); return; }
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

const flagsOf = (b) => (b.b ? 'b' : '') + (b.i ? 'i' : '') + (b.s ? 's' : '');
const lineHtml = (b) => `<div class="${LINE}" data-k="${b.k}" data-l="${b.l || 0}"${b.d ? ' data-d="1"' : ''}${flagsOf(b) ? ` data-f="${flagsOf(b)}"` : ''}${b.a ? ` data-a="${b.a}"` : ''}>${b.t ? toHtml(b.t) : '<br>'}</div>`;
export const blocksHtml = (blocks) => (blocks && blocks.length ? blocks : [normBlock({})]).map(lineHtml).join('');

function readLine(el) {
  const f = el.dataset.f || '';
  return normBlock({ t: serialize(el), k: el.dataset.k, d: el.dataset.d === '1', l: Number(el.dataset.l) || 0, b: f.includes('b'), i: f.includes('i'), s: f.includes('s'), a: el.dataset.a });
}

const newLine = (k = 'p', l = '0', a = '') => {
  const d = document.createElement('div');
  d.className = LINE; d.dataset.k = k; d.dataset.l = l;
  if (a) d.dataset.a = a;
  d.innerHTML = '<br>';
  return d;
};

// Makes the host a clean list of lines again after the browser has edited it (stray text, unmarked divs, missing placeholders). Returns true when it changed something.
function normalize(host) {
  let changed = false;
  let run = null;
  for (const n of [...host.childNodes]) {
    if (n.nodeType === 1 && n.tagName === 'DIV') {
      run = null;
      if (!n.classList.contains(LINE)) { n.classList.add(LINE); changed = true; }
      if (!n.dataset.k) { n.dataset.k = 'p'; changed = true; }
      if (!n.dataset.l) { n.dataset.l = '0'; changed = true; }
    } else if (n.nodeType === 3 && !n.nodeValue.trim() && !run) {
      host.removeChild(n); changed = true;
    } else {
      if (!run) { run = newLine(); run.innerHTML = ''; host.insertBefore(run, n); }
      run.appendChild(n); changed = true;
    }
  }
  if (!host.firstChild) { host.appendChild(newLine()); changed = true; }
  for (const line of host.children) {
    const empty = serialize(line) === '';
    const brs = line.querySelectorAll('br');
    if (empty && !brs.length) { line.appendChild(document.createElement('br')); changed = true; }
    if (!empty && brs.length) { brs.forEach((b) => b.remove()); changed = true; }
  }
  return changed;
}

const lineOf = (host, node) => { let n = node; while (n && n.parentNode !== host) n = n.parentNode; return n && n.nodeType === 1 ? n : null; };
const nodeLine = (host, container, offset) => (container === host ? host.children[Math.min(offset, host.children.length - 1)] : lineOf(host, container));
const atLineStart = (host, container, offset) => {
  if (container === host) return true;
  const line = lineOf(host, container);
  if (!line) return false;
  const r = document.createRange();
  r.selectNodeContents(line); r.setEnd(container, offset);
  return strip(r.toString()) === '';
};

// Lines touched by the selection (or [] when the selection is elsewhere). A range that ends exactly at the start of a line does not include that line.
function selectionLines(host) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!host.contains(r.startContainer) || !host.contains(r.endContainer)) return null;
  const a = nodeLine(host, r.startContainer, r.startOffset);
  let z = nodeLine(host, r.endContainer, r.endOffset);
  if (!a || !z) return null;
  if (!r.collapsed && z !== a && atLineStart(host, r.endContainer, r.endOffset) && z.previousElementSibling) z = z.previousElementSibling;
  const out = [];
  for (let n = a; n; n = n.nextElementSibling) { out.push(n); if (n === z) break; }
  return out.length ? out : [a];
}

const posOf = (host, container, offset) => {
  const line = nodeLine(host, container, offset);
  if (!line) return null;
  const idx = [...host.children].indexOf(line);
  if (container === host) return { line: idx, off: 0 };
  const r = document.createRange();
  r.selectNodeContents(line); r.setEnd(container, offset);
  return { line: idx, off: strip(r.toString()).length };
};
function setPos(host, pos) {
  if (!pos) return;
  const line = host.children[Math.min(pos.line, host.children.length - 1)];
  if (!line) return;
  const r = document.createRange();
  let left = pos.off, placed = false;
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.nodeValue.length;
    if (left <= len) { r.setStart(n, left); placed = true; break; }
    left -= len;
  }
  if (!placed) r.setStart(line, 0);
  r.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(r);
}
const caretNow = (host) => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !host.contains(sel.anchorNode)) return null;
  return posOf(host, sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
};

// value: array of blocks. onChange(blocks) after every edit. onActive(i): index of the first selected line. onHistory({ undo, redo }).
// apiRef.current receives the editing commands used by the toolbar.
export function NoteEditor({ value, onChange, onActive, onHistory, apiRef, placeholder }) {
  const host = useRef(null);
  const emitted = useRef(null); // the blocks array we last produced / rendered: a different `value` means the note was changed from outside
  const hist = useRef({ stack: [], i: -1, kind: '', t: 0 });
  const rendering = useRef(false);
  const composing = useRef(false);
  const lastSel = useRef({ a: 0, z: 0 });
  const cb = useRef({});
  cb.current = { onChange, onActive, onHistory };

  const notify = () => cb.current.onHistory?.({ undo: hist.current.i > 0, redo: hist.current.i < hist.current.stack.length - 1 });
  const markEmpty = (blocks) => { if (host.current) host.current.dataset.empty = blocks.length === 1 && !blocks[0].t && blocks[0].k === 'p' ? '1' : ''; };

  const record = (blocks, kind) => {
    const h = hist.current;
    const json = JSON.stringify(blocks);
    const top = h.stack[h.i];
    if (top && top.json === json) { top.caret = caretNow(host.current); return; }
    const entry = { json, blocks, caret: caretNow(host.current) };
    const now = Date.now();
    if (kind === 'type' && h.kind === 'type' && now - h.t < 900 && h.i === h.stack.length - 1 && h.i > 0) h.stack[h.i] = entry; // one burst of typing = one undo step
    else {
      h.stack = h.stack.slice(0, h.i + 1);
      h.stack.push(entry); h.i = h.stack.length - 1;
      if (h.stack.length > 200) { h.stack.shift(); h.i -= 1; }
    }
    h.kind = kind; h.t = now;
    notify();
  };

  const commit = (kind = 'type') => {
    const el = host.current;
    if (!el || rendering.current) return;
    const p = caretNow(el);
    if (normalize(el) && p) setPos(el, p);
    const blocks = [...el.children].map(readLine);
    emitted.current = blocks;
    markEmpty(blocks);
    record(blocks, kind);
    cb.current.onChange(blocks);
  };

  const applyBlocks = (blocks, caret) => {
    rendering.current = true;
    host.current.innerHTML = blocksHtml(blocks);
    rendering.current = false;
    emitted.current = blocks;
    markEmpty(blocks);
    if (caret) setPos(host.current, caret);
  };

  // The note was replaced from outside (opened, draft restored or discarded): show it and start a fresh undo history.
  useEffect(() => {
    if (!host.current) return;
    if (emitted.current === null || value !== emitted.current) {
      applyBlocks(value, null);
      hist.current = { stack: [{ json: JSON.stringify(value), blocks: value, caret: null }], i: 0, kind: '', t: 0 };
      notify();
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = () => {
      const el = host.current;
      if (!el) return;
      const ls = selectionLines(el);
      if (!ls) return;
      const kids = [...el.children];
      lastSel.current = { a: kids.indexOf(ls[0]), z: kids.indexOf(ls[ls.length - 1]) };
      cb.current.onActive?.(lastSel.current.a);
    };
    document.addEventListener('selectionchange', on);
    return () => document.removeEventListener('selectionchange', on);
  }, []);

  const targetLines = () => {
    const el = host.current;
    const ls = selectionLines(el);
    if (ls) return ls;
    const kids = [...el.children];
    const { a, z } = lastSel.current;
    return kids.slice(Math.min(Math.max(a, 0), kids.length - 1), Math.min(Math.max(z, 0), kids.length - 1) + 1);
  };
  const putCaret = (line, atEnd = false) => {
    const r = document.createRange();
    r.selectNodeContents(line); r.collapse(!atEnd);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
  };

  // Enter: split the line at the caret. Lists continue, an empty list line ends the list, headings are followed by a plain line.
  const doEnter = (silent = false) => {
    const el = host.current;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    if (!sel.isCollapsed) { document.execCommand('delete'); normalize(el); }
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    const line = nodeLine(el, r.startContainer, r.startOffset);
    if (!line) return;
    const k = line.dataset.k;
    const isList = LISTS.includes(k);
    const empty = serialize(line) === '';
    if (isList && empty) { line.dataset.k = 'p'; line.dataset.l = '0'; delete line.dataset.d; putCaret(line); if (!silent) commit('struct'); return; }
    if (!empty && atLineStart(el, r.startContainer, r.startOffset)) { // Enter at the very start: a blank line appears above, the text stays with the caret
      const blank = newLine(isList ? k : 'p', line.dataset.l, line.dataset.a);
      line.before(blank);
      if (!silent) commit('struct');
      return;
    }
    const tail = document.createRange();
    tail.setStart(r.startContainer, r.startOffset); tail.setEnd(line, line.childNodes.length);
    const frag = tail.extractContents();
    const next = newLine(isList ? k : 'p', line.dataset.l, line.dataset.a);
    next.innerHTML = '';
    next.appendChild(frag);
    if (serialize(next) === '') next.innerHTML = '<br>';
    if (serialize(line) === '') line.innerHTML = '<br>';
    line.after(next);
    putCaret(next);
    next.scrollIntoView?.({ block: 'nearest' });
    if (!silent) commit('struct');
  };

  // Backspace at the very start of a line (true = handled): the list marker / indent goes first, then a blank line above is removed or the line joins the one above.
  const doBackspaceStart = () => {
    const el = host.current;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.startContainer) || !atLineStart(el, r.startContainer, r.startOffset)) return false;
    const line = nodeLine(el, r.startContainer, r.startOffset);
    if (!line) return false;
    if (line.dataset.k !== 'p') { line.dataset.k = 'p'; delete line.dataset.d; commit('struct'); return true; }
    const l = Number(line.dataset.l) || 0;
    if (l > 0) { line.dataset.l = String(l - 1); commit('struct'); return true; }
    const prev = line.previousElementSibling;
    if (!prev) return true;
    if (serialize(prev) === '') { prev.remove(); putCaret(line); commit('struct'); return true; } // a blank line above: gone, this line keeps its own look
    prev.querySelectorAll('br').forEach((b) => b.remove());
    line.querySelectorAll('br').forEach((b) => b.remove());
    const join = document.createRange();
    join.selectNodeContents(prev); join.collapse(false);
    while (line.firstChild) prev.appendChild(line.firstChild);
    line.remove();
    sel.removeAllRanges(); sel.addRange(join);
    commit('struct');
    return true;
  };

  const api = {
    undo: () => step(-1),
    redo: () => step(1),
    focus: () => host.current?.focus(),
    setKind: (k) => {
      const ls = targetLines();
      const off = ls.every((l) => l.dataset.k === k);
      ls.forEach((l) => { l.dataset.k = off ? 'p' : k; delete l.dataset.d; });
      commit('struct');
    },
    // With text selected the format applies to the selection; with just a caret it applies to the whole line. Tapping again switches a whole-line format off.
    toggleFlag: (f) => {
      const el = host.current;
      const ls = targetLines();
      const has = ls.every((l) => (l.dataset.f || '').includes(f));
      const sel = window.getSelection();
      const inside = sel && sel.rangeCount && el.contains(sel.anchorNode) && el.contains(sel.focusNode);
      if (!has && inside && !sel.isCollapsed) { document.execCommand(FLAG_CMD[f]); commit('struct'); return; }
      ls.forEach((l) => {
        const cur = l.dataset.f || '';
        const next = has ? cur.replace(f, '') : (cur.includes(f) ? cur : cur + f);
        if (next) l.dataset.f = next; else delete l.dataset.f;
      });
      commit('struct');
    },
    setAlign: (a) => { targetLines().forEach((l) => { if (a) l.dataset.a = a; else delete l.dataset.a; }); commit('struct'); },
    indent: (d) => { targetLines().forEach((l) => { l.dataset.l = String(Math.min(2, Math.max(0, (Number(l.dataset.l) || 0) + d))); }); commit('struct'); },
    move: (d) => {
      const ls = targetLines();
      const first = ls[0], last = ls[ls.length - 1];
      if (d < 0) { const p = first.previousElementSibling; if (!p) return; last.after(p); } else { const n = last.nextElementSibling; if (!n) return; first.before(n); }
      commit('struct');
      first.scrollIntoView?.({ block: 'nearest' });
    },
    removeLines: () => {
      const ls = targetLines();
      const last = ls[ls.length - 1], first = ls[0];
      const next = last.nextElementSibling || first.previousElementSibling;
      ls.forEach((l) => l.remove());
      normalize(host.current);
      putCaret(next || host.current.firstElementChild, false);
      commit('struct');
    },
  };
  apiRef.current = api;

  function step(d) {
    const h = hist.current;
    const j = h.i + d;
    if (j < 0 || j >= h.stack.length) return;
    h.i = j; h.kind = '';
    const e = h.stack[j];
    applyBlocks(e.blocks, e.caret);
    notify();
    cb.current.onChange(e.blocks);
  }

  const onBefore = (e) => {
    const t = e.inputType || '';
    if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); doEnter(); return; }
    if (t === 'historyUndo') { e.preventDefault(); step(-1); return; }
    if (t === 'historyRedo') { e.preventDefault(); step(1); return; }
    if (t.startsWith('delete') && t.endsWith('Backward') && doBackspaceStart()) e.preventDefault();
  };
  const onKey = (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter') { e.preventDefault(); doEnter(); return; }
    if (e.key === 'Backspace' && doBackspaceStart()) { e.preventDefault(); return; }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); step(e.shiftKey ? 1 : -1); return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); step(1); }
  };
  // Pasted text always becomes plain lines; lists continue because every pasted line goes through the same Enter handling.
  const onPaste = (e) => {
    e.preventDefault();
    const raw = (e.clipboardData?.getData('text/plain') || '').replace(/\r/g, '');
    const parts = raw.split('\n').map((x) => x.trimEnd());
    while (parts.length && !parts[0].trim()) parts.shift();
    while (parts.length && !parts[parts.length - 1].trim()) parts.pop();
    if (!parts.length) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) document.execCommand('delete');
    parts.forEach((p, i) => { if (i > 0) doEnter(true); if (p) document.execCommand('insertText', false, p); });
    commit('struct');
  };
  // Tapping the circle of a circle line ticks it.
  const onClick = (e) => {
    const line = lineOf(host.current, e.target);
    if (!line || line.dataset.k !== 'cb') return;
    if (e.clientX - line.getBoundingClientRect().left > 34) return;
    if (line.dataset.d === '1') delete line.dataset.d; else line.dataset.d = '1';
    commit('struct');
  };

  return (
    <div
      ref={host}
      class="ed"
      contentEditable
      role="textbox" aria-multiline="true" aria-label="Not metni"
      style={`--ph:"${placeholder || ''}"`}
      autoCapitalize="sentences" spellcheck={true}
      onInput={() => { if (!composing.current) commit('type'); }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={() => { composing.current = false; commit('type'); }}
      onBeforeInput={onBefore}
      onKeyDown={onKey}
      onPaste={onPaste}
      onClick={onClick}
    />
  );
}

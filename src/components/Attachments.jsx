import { useEffect, useState } from 'preact/hooks';
import { fileUrl, fmtSize, isImage } from '../files.js';
import { IconTrash, IconClose } from '../icons.jsx';

const FileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
);

function Thumb({ file }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let on = true; fileUrl(file.id).then((u) => on && setUrl(u)).catch(() => on && setFailed(true)); return () => { on = false; }; }, [file.id]);
  if (failed) return <span class="att-ph">Açılamadı</span>;
  return url ? <img src={url} alt={file.name} /> : <span class="att-ph">…</span>;
}

// Opens a PDF (or any non-image) from its blob URL.
async function openFile(file) {
  const url = await fileUrl(file.id);
  const w = window.open(url, '_blank');
  if (!w) { const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); } // popup blocked: download instead
}

// Attachment list: image thumbnails (tap = full screen) and PDF rows (tap = open). `onRemove` shows a delete button.
export function Attachments({ files, onRemove, busy }) {
  const [view, setView] = useState(null); // image id being viewed full screen
  const [viewUrl, setViewUrl] = useState(null);
  useEffect(() => { setViewUrl(null); if (view) fileUrl(view.id).then(setViewUrl).catch(() => setView(null)); }, [view]);

  const images = files.filter((f) => isImage(f.type));
  const docs = files.filter((f) => !isImage(f.type));
  return (
    <>
      {images.length > 0 && (
        <div class="att-grid">
          {images.map((f) => (
            <div class="att-img" key={f.id}>
              <button type="button" class="att-open" aria-label={`${f.name} resmini büyüt`} onClick={() => setView(f)}><Thumb file={f} /></button>
              {onRemove && <button type="button" class="att-del" aria-label={`${f.name} ekini kaldır`} onClick={() => onRemove(f)}><IconClose /></button>}
            </div>
          ))}
        </div>
      )}
      {docs.map((f) => (
        <div class="att-doc" key={f.id}>
          <button type="button" class="att-docbtn" onClick={() => openFile(f)} aria-label={`${f.name} dosyasını aç`}>
            <FileIcon />
            <span class="grow"><span class="title-sm" style="display:block;overflow-wrap:anywhere">{f.name}</span><span class="sub">PDF · {fmtSize(f.size)}</span></span>
          </button>
          {onRemove && <button type="button" class="iconbtn plain" aria-label={`${f.name} ekini kaldır`} onClick={() => onRemove(f)}><IconTrash /></button>}
        </div>
      ))}
      {busy && <div class="loadbar" role="progressbar" aria-label="Yükleniyor"><i /></div>}
      {view && (
        <div class="att-viewer" role="dialog" aria-label={view.name} onClick={() => setView(null)}>
          <button type="button" class="att-close" aria-label="Kapat" onClick={() => setView(null)}><IconClose /></button>
          {viewUrl ? <img src={viewUrl} alt={view.name} /> : <div class="splash-text">Yükleniyor…</div>}
        </div>
      )}
    </>
  );
}

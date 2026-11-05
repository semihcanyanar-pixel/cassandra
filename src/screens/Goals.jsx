import { useState } from 'preact/hooks';
import { Page, Card, Chips, Progress } from '../components/ui.jsx';
import { IconPlus } from '../icons.jsx';
import { goalProgress } from '../lib/stats.js';
import { saveGoal, deleteGoal } from '../data.js';
import { today, diffDays, dayMonth } from '../lib/dates.js';

const UNITS = [{ value: 'gün', label: 'gün' }, { value: 'saat', label: 'saat' }, { value: 'adet', label: 'adet' }];

export function Goals({ data, nav }) {
  const t = today();
  return (
    <Page title="Hedefler" onClose={nav.back}
      footer={<button class="btn wide" onClick={() => nav.go({ n: 'goal' })}><IconPlus />Hedef ekle</button>}>
      <div class="sub" style="padding:0 4px">Uzun vadeli hedeflerin. Grafik ve raporlardan bağımsızdır.</div>
      {data.goals.length === 0 && (
        <div class="card empty"><div class="title-sm">Henüz hedef yok</div><div class="sub">Örn. “Yıl sonuna kadar 100 saat İngilizce”.</div></div>
      )}
      {data.goals.map((g) => {
        const p = goalProgress(g, data.logs, data.tasks);
        const left = g.dueDate ? diffDays(g.dueDate, t) : null;
        const done = p >= g.target;
        return (
          <button key={g.id} class="card tap" onClick={() => nav.go({ n: 'goal', id: g.id })} aria-label={`${g.title}, düzenle`}>
            <div class="row" style="justify-content:space-between;align-items:baseline">
              <span style="font-size:17px;font-weight:700">{g.title}</span>
              <span class="title-sm">{done ? 'Tamam' : `%${Math.round((p / g.target) * 100)}`}</span>
            </div>
            <div class="sub" style="margin:2px 0 8px">{p} / {g.target} {g.unit}{g.linkedActivityId ? ' · otomatik' : ''}{left != null ? ` · ${left >= 0 ? `${left} gün kaldı (${dayMonth(g.dueDate)})` : 'süre doldu'}` : ''}</div>
            <Progress pct={(p / g.target) * 100} />
          </button>
        );
      })}
    </Page>
  );
}

export function GoalForm({ uid, data, id, nav }) {
  const existing = id ? data.goals.find((g) => g.id === id) : null;
  const [title, setTitle] = useState(existing?.title || '');
  const [target, setTarget] = useState(existing?.target ?? '');
  const [unit, setUnit] = useState(existing?.unit || 'gün');
  const [due, setDue] = useState(existing?.dueDate || '');
  const [linked, setLinked] = useState(existing?.linkedActivityId || '');
  const [progress, setProgress] = useState(existing?.progress ?? 0);
  const [error, setError] = useState('');
  const canLink = unit === 'saat' || unit === 'gün';
  // repeating tasks can be a source too, but only for counting days (they have no minutes)
  const sources = [...data.activities.map((a) => ({ value: a.id, label: a.name })), ...(unit === 'gün' ? data.tasks.filter((t) => t.repeat === 'daily' || t.repeat === 'days').map((t) => ({ value: t.id, label: `${t.title} (görev)` })) : [])];
  const linkedOk = sources.some((x) => x.value === linked);
  const noMinutes = unit === 'saat' && linked && !data.logs.some((l) => l.activityId === linked && l.minutes);
  const isLinked = canLink && linked && linkedOk;

  function submit(e) {
    e.preventDefault();
    const tg = Number(target);
    if (!title.trim()) { setError('Hedefe bir ad ver.'); return; }
    if (!(tg > 0)) { setError('Hedef değeri 0’dan büyük olmalı.'); return; }
    const payload = {
      title: title.trim(), period: 'long', target: tg, unit, dueDate: due || null,
      linkedActivityId: isLinked ? linked : null, progress: Number(progress) || 0,
    };
    if (!existing) payload.startDate = today();
    saveGoal(uid, id, payload);
    nav.back();
  }
  const remove = () => { if (confirm('Hedef silinsin mi?')) { deleteGoal(uid, id); nav.back(); } };

  return (
    <form onSubmit={submit}>
      <Page title={existing ? 'Hedefi düzenle' : 'Yeni hedef'} onClose={nav.back} footer={<button class="btn wide" type="submit">Kaydet</button>}>
        <Card>
          <label class="label" for="hedef" style="padding:0;margin:0">HEDEF</label>
          <input id="hedef" class="big-input" value={title} maxLength={80} placeholder="Örn. Yıl sonuna kadar İngilizce" onInput={(e) => { setTitle(e.target.value); setError(''); }} />
        </Card>
        <Card label="HEDEF DEĞER">
          <div class="field">
            <label for="deger">Değer</label>
            <input id="deger" type="number" inputmode="decimal" min="0" step="any" value={target} placeholder="Örn. 100" onInput={(e) => { setTarget(e.target.value); setError(''); }} />
          </div>
          <div style="margin-top:10px"><Chips options={UNITS} value={unit} onChange={setUnit} label="Birim" /></div>
        </Card>
        {canLink && sources.length > 0 && (
          <Card label="İLERLEME KAYNAĞI">
            <Chips options={[{ value: '', label: 'Elle gir' }, ...sources]}
              value={linked} onChange={setLinked} label="İlerleme kaynağı" />
            <div class="sub" style="margin-top:8px">{linked && linkedOk ? (unit === 'gün' ? `Seçilenin yapıldığı günler${existing ? '' : ' bugünden itibaren'} otomatik sayılır.` : `Seçili aktivitenin süre kayıtları${existing ? '' : ' bugünden itibaren'} otomatik toplanır.`) : 'İlerlemeyi sen güncellersin.'}
            {noMinutes && <div class="sub" style="margin-top:6px">Bu aktiviteye henüz süre girmedin, saat 0 kalır. Süre girmiyorsan birim olarak “gün” seç.</div>}</div>
          </Card>
        )}
        {!isLinked && (
          <Card label="ŞU ANKİ İLERLEME">
            <input id="ilerleme" class="date-input" type="number" inputmode="decimal" min="0" step="any" value={progress} aria-label="Şu anki ilerleme" onInput={(e) => setProgress(e.target.value)} />
          </Card>
        )}
        <Card label="BİTİŞ TARİHİ (İSTEĞE BAĞLI)">
          <input class="date-input" type="date" value={due} min={today()} aria-label="Bitiş tarihi" onInput={(e) => setDue(e.target.value)} />
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
        {existing && <button type="button" class="chip" style="min-height:48px" onClick={remove}>Hedefi sil</button>}
      </Page>
    </form>
  );
}

import { useState } from 'preact/hooks';
import { Page, Card, Chips, Switch, COLOR_COUNT, actColor } from '../components/ui.jsx';
import { saveActivity } from '../data.js';

const DAYS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }));
const DURS = [15, 30, 45, 60, 90].map((n) => ({ value: n, label: `${n} dk` }));

export function ActivityForm({ uid, data, id, nav }) {
  const existing = id ? data.activities.find((a) => a.id === id) : null;
  const [name, setName] = useState(existing?.name || '');
  const [days, setDays] = useState(existing?.weeklyDays || 3);
  const [hasTarget, setHasTarget] = useState(existing ? existing.dailyMinutes != null : false);
  const [minutes, setMinutes] = useState(existing?.dailyMinutes || 45);
  const [color, setColor] = useState(existing?.color ?? data.activities.length % COLOR_COUNT);
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Bir ad yaz.'); return; }
    const m = Number(minutes);
    if (hasTarget && !(m >= 1 && m <= 1440)) { setError('Süre hedefi 1–1440 dakika olmalı.'); return; }
    saveActivity(uid, id, { name: name.trim(), color, weeklyDays: days, dailyMinutes: hasTarget ? m : null });
    nav.back();
  }
  const toggleArchive = () => { saveActivity(uid, id, { archived: !existing.archived }); nav.back(); };

  return (
    <form onSubmit={submit}>
      <Page title={existing ? 'Aktiviteyi düzenle' : 'Yeni aktivite'} onClose={nav.back}
        footer={<button class="btn wide" type="submit">Kaydet</button>}>
        <Card>
          <label class="label" for="ad" style="padding:0;margin:0">ADI</label>
          <input id="ad" class="big-input" value={name} maxLength={40} placeholder="Örn. Kitap okuma" onInput={(e) => { setName(e.target.value); setError(''); }} />
        </Card>
        <Card label="HAFTADA KAÇ GÜN?" right={<span class="title-sm">{days} gün</span>}>
          <Chips options={DAYS} value={days} onChange={setDays} label="Haftada kaç gün" size="seven" />
        </Card>
        <Card>
          <div class="row">
            <div class="grow">
              <div class="label" style="margin:0;padding:0">GÜNLÜK SÜRE HEDEFİ</div>
              <div class="sub">İsteğe bağlı</div>
            </div>
            <Switch checked={hasTarget} onChange={setHasTarget} label="Günlük süre hedefi" />
          </div>
          {hasTarget && (
            <div style="margin-top:12px">
              <Chips options={DURS} value={Number(minutes)} onChange={setMinutes} label="Günlük süre hedefi" />
              <div class="field" style="margin-top:10px">
                <label for="ozel">Özel süre (dakika)</label>
                <input id="ozel" type="number" inputmode="numeric" min="1" max="1440" value={minutes} onInput={(e) => setMinutes(e.target.value)} />
              </div>
            </div>
          )}
        </Card>
        <Card label="RENK">
          <div class="swatch-row" role="radiogroup" aria-label="Renk">
            {Array.from({ length: COLOR_COUNT }, (_, i) => (
              <button key={i} type="button" role="radio" aria-checked={color === i} aria-label={`Renk ${i + 1}`}
                class="swatch" style={`background:${actColor(i)}`} onClick={() => setColor(i)}>
                {color === i && <span class="swatch-dot" />}
              </button>
            ))}
          </div>
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
        <div class="sub" style="padding:0 4px;line-height:1.45">Kişisel alanında durur, eşin görmez. Sonradan düzenleyebilir ya da arşivleyebilirsin; geçmiş kayıtlar silinmez.</div>
        {existing && (
          <button type="button" class="chip" style="min-height:48px" onClick={toggleArchive}>
            {existing.archived ? 'Arşivden çıkar' : 'Arşivle'}
          </button>
        )}
      </Page>
    </form>
  );
}

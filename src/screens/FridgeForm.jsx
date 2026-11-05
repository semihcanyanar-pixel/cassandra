import { useState } from 'preact/hooks';
import { Page, Card, Chips } from '../components/ui.jsx';
import { saveFridge, deleteFridge } from '../data.js';
import { today } from '../lib/dates.js';
import { FRIDGE_KINDS, SHELF_QUICK, DEFAULT_SHELF } from '../lib/fridge.js';

const SHELF_OPTIONS = [...SHELF_QUICK.map((n) => ({ value: n, label: `${n} gün` })), { value: 0, label: 'Süre yok' }];

// Add / edit one fridge item: what it is, the day it was opened or cooked, and how many days it can be kept.
export function FridgeForm({ hid, uid, house, id, nav }) {
  const existing = id ? house.fridge.find((x) => x.id === id) : null;
  const [name, setName] = useState(existing?.name || '');
  const [kind, setKind] = useState(existing?.kind || 'urun');
  const [date, setDate] = useState(existing?.openedOn || today());
  const [shelf, setShelf] = useState(existing ? (existing.shelfDays || 0) : DEFAULT_SHELF.urun);
  const [touched, setTouched] = useState(Boolean(existing)); // once the days were chosen by hand, changing the kind no longer resets them
  const [error, setError] = useState('');

  const pickKind = (k) => { setKind(k); if (!touched) setShelf(DEFAULT_SHELF[k]); };

  function submit(e) {
    e.preventDefault();
    const n = Number(shelf);
    if (!name.trim()) { setError('Bir ad yaz.'); return; }
    if (!date || date > today()) { setError('Tarih bugünden sonra olamaz.'); return; }
    if (!(n >= 0 && n <= 365)) { setError('Gün sayısı 0–365 olmalı.'); return; }
    saveFridge(hid, uid, id, { name: name.trim(), kind, openedOn: date, shelfDays: n > 0 ? Math.round(n) : null });
    nav.back();
  }
  const remove = () => { if (confirm(`“${existing.name}” listeden kaldırılsın mı?`)) { deleteFridge(hid, id); nav.back(); } };

  return (
    <form onSubmit={submit}>
      <Page title={existing ? 'Kaydı düzenle' : 'Buzdolabına ekle'} onClose={nav.back} footer={<button class="btn wide" type="submit">Kaydet</button>}>
        <Card>
          <label class="label" for="fr-ad" style="padding:0;margin:0">ADI</label>
          <input id="fr-ad" class="big-input" value={name} maxLength={60} placeholder={kind === 'yemek' ? 'Örn. Mercimek çorbası' : 'Örn. Süt'} onInput={(e) => { setName(e.target.value); setError(''); }} />
        </Card>
        <Card label="TÜR">
          <Chips options={FRIDGE_KINDS} value={kind} onChange={pickKind} label="Tür" />
        </Card>
        <Card label={kind === 'yemek' ? 'YAPILDIĞI TARİH' : 'AÇILDIĞI TARİH'}>
          <input class="date-input" type="date" max={today()} value={date} aria-label="Tarih" onInput={(e) => { setDate(e.target.value); setError(''); }} />
        </Card>
        <Card label="KAÇ GÜN TÜKETİLEBİLİR?">
          <Chips options={SHELF_OPTIONS} value={Number(shelf)} onChange={(v) => { setShelf(v); setTouched(true); }} label="Tüketim süresi" />
          <div class="field" style="margin-top:10px">
            <label for="fr-gun">Özel gün sayısı</label>
            <input id="fr-gun" type="number" inputmode="numeric" min="0" max="365" value={shelf || ''} placeholder="Süre yok" onInput={(e) => { setShelf(e.target.value); setTouched(true); setError(''); }} />
          </div>
          <div class="sub" style="margin-top:8px;line-height:1.4">Paketin üzerindeki “açıldıktan sonra” süresine ya da kendi tahminine göre yaz. Süre yoksa yalnızca kaç gündür durduğu görünür.</div>
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
        {existing && <button type="button" class="chip" style="min-height:48px" onClick={remove}>Listeden kaldır</button>}
      </Page>
    </form>
  );
}

import { useState } from 'preact/hooks';
import { Page, Card, Chips } from '../components/ui.jsx';
import { updateShopping, updateFamilyTodo } from '../data.js';
import { SHOP_CATEGORIES } from '../lib/notes.js';
import { today } from '../lib/dates.js';

// Edit one item of Takip Listesi: a need (İhtiyaçlar: text + category) or a to-do (Yapılacaklar: text + optional due date).
export function ListItemForm({ hid, house, kind, id, nav }) {
  const isShop = kind === 'shop';
  const item = (isShop ? house.shopping : house.todos).find((x) => x.id === id);
  const [text, setText] = useState(item?.text || '');
  const [category, setCategory] = useState(item?.category || 'market');
  const [due, setDue] = useState(item?.dueDate || '');
  const [error, setError] = useState('');

  if (!item) {
    return <Page title="Kaydı düzenle" onClose={nav.back}><div class="card empty"><div class="title-sm">Bu kayıt artık yok</div></div></Page>;
  }

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) { setError('Bir ad yaz.'); return; }
    if (isShop) updateShopping(hid, id, { text: text.trim(), category });
    else updateFamilyTodo(hid, id, { text: text.trim(), dueDate: due || null });
    nav.back();
  }

  return (
    <form onSubmit={submit}>
      <Page title={isShop ? 'İhtiyacı düzenle' : 'Yapılacağı düzenle'} onClose={nav.back} footer={<button class="btn wide" type="submit">Kaydet</button>}>
        <Card>
          <label class="label" for="li-ad" style="padding:0;margin:0">{isShop ? 'ÜRÜN' : 'YAPILACAK'}</label>
          <input id="li-ad" class="big-input" value={text} maxLength={80} onInput={(e) => { setText(e.target.value); setError(''); }} />
        </Card>
        {isShop ? (
          <Card label="KATEGORİ"><Chips options={SHOP_CATEGORIES} value={category} onChange={setCategory} label="Kategori" /></Card>
        ) : (
          <Card label="ŞU TARİHE KADAR (İSTEĞE BAĞLI)">
            <input class="date-input" type="date" min={today()} value={due} aria-label="Son tarih" onInput={(e) => setDue(e.target.value)} />
            {due && <button type="button" class="chip" style="margin-top:10px" onClick={() => setDue('')}>Tarihi kaldır</button>}
            <div class="sub" style="margin-top:8px;line-height:1.4">Tarih verirsen bir gün önce sabah 09:00'da bildirim gelir, Bugün ekranında da “Yarın son gün” olarak görünür.</div>
          </Card>
        )}
        {error && <div class="error" role="alert">{error}</div>}
      </Page>
    </form>
  );
}

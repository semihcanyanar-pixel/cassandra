import { IconPlus, IconTrash } from '../icons.jsx';
import { today } from '../lib/dates.js';
import { sortFridge, fridgeState, ageText, leftText } from '../lib/fridge.js';
import { deleteFridge } from '../data.js';

// Buzdolabı: what was opened / cooked and for how many more days it can be eaten. The most urgent items come first.
export function Buzdolabi({ house, hid, nav }) {
  const t = today();
  const items = sortFridge(house.fridge, t);
  return (
    <>
      <button class="btn wide" onClick={() => nav.go({ n: 'fridge' })}><IconPlus />Açılan ürün ya da yemek ekle</button>

      {items.length === 0 ? (
        <div class="card empty">
          <div class="title-sm">Liste boş</div>
          <div class="sub">Açtığın süt, yoğurt gibi ürünleri ya da yaptığın yemekleri tarihiyle ekle. Kaç gün kaldığını buradan görürsün.</div>
        </div>
      ) : (
        <div class="card list-card">
          {items.map((i) => {
            const st = fridgeState(i, t);
            const left = leftText(i, t);
            return (
              <div class="list-row fr-row" key={i.id}>
                <button class="fr-main grow" onClick={() => nav.go({ n: 'fridge', id: i.id })} aria-label={`${i.name}, düzenle`}>
                  <span class="title-sm">{i.name}</span>
                  <span class="sub">{ageText(i, t)}{i.kind === 'yemek' ? ' · yemek' : ''}</span>
                </button>
                {left && <span class={`fr-pill ${st}`}>{left}</span>}
                <button class="iconbtn plain" aria-label={`${i.name} bitti, kaldır`} onClick={() => { if (confirm(`“${i.name}” bitti, listeden kaldırılsın mı?`)) deleteFridge(hid, i.id); }}><IconTrash /></button>
              </div>
            );
          })}
        </div>
      )}
      <div class="sub" style="padding:0 4px;line-height:1.45">Süreler senin girdiğin tahminlerdir. Kokusu ya da görünüşü şüpheliyse tarihine bakmadan tüketme.</div>
    </>
  );
}

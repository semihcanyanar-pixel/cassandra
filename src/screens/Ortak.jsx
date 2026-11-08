import { useEffect, useState } from 'preact/hooks';
import { Seg } from '../components/Seg.jsx';
import { Ilaclar } from './Ilaclar.jsx';
import { Buzdolabi } from './Buzdolabi.jsx';
import { notifyPartnerAdded } from '../push.js';
import { urgentCount } from '../lib/fridge.js';
import { today } from '../lib/dates.js';
import { IconPlus, IconTrash, IconEdit, IconClose } from '../icons.jsx';
import { Pop } from '../components/Pop.jsx';
import { dueText, dueState, sortTodos } from '../lib/due.js';
import { SHOP_CATEGORIES, categoryLabel } from '../lib/notes.js';
import {
  addShopping, setShoppingDone, deleteShopping, addFamilyTodo, setFamilyTodoDone, setFamilyTodoAssignee, deleteFamilyTodo,
} from '../data.js';

// Who is `id`? Resolves uid -> {name, initial} from the household profiles ('me' is a demo alias).
export function personOf(session, id) {
  const me = session.me;
  if (!id) return null;
  if (id === me.uid || id === 'me') return me;
  const slotOf = (u) => Math.min(1, Math.max(0, (session.household.members || []).indexOf(u)));
  const p = session.household.profiles?.[id];
  if (p) return { uid: id, name: p.name, initial: p.initial || p.name?.charAt(0), slot: slotOf(id) };
  if (id === 'other') {
    const other = (session.household.members || []).find((u) => u !== me.uid);
    const q = session.household.profiles?.[other];
    return q ? { uid: other, name: q.name, initial: q.initial, slot: slotOf(other) } : { uid: 'other', name: 'Eşi', initial: 'E', slot: 1 };
  }
  return { uid: id, name: 'Eşi', initial: 'E', slot: 1 };
}

// The sub-tab Ortak shows; other screens may set it before opening Ortak, and it is kept while you come back from a form.
export const ortakStart = { sub: 'ev' };

export function Avatar({ person, small }) {
  if (!person) return null;
  return <span class={`${small ? 'avatar mini' : 'avatar'} p${person.slot ?? 0}`} role="img" aria-label={person.name} title={person.name}>{person.initial}</span>;
}

export function Ortak({ session, house, nav, onSettings }) {
  const { me } = session;
  const hid = session.hid;
  const [sub, setSubState] = useState(ortakStart.sub);
  const setSub = (v) => { ortakStart.sub = v; setSubState(v); }; // remembered, so coming back from a form lands on the same sub-tab
  // Market mode: a big page of its own (not remembered: it opens only when asked). The screen stays awake while it is open.
  const [market, setMarket] = useState(false);
  const [drop, setDrop] = useState(null); // the row flying into the cart
  const [filter, setFilter] = useState('market'); // the open shopping category: new items go straight into it
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState(''); // optional due date for a new to-do

  const pick = (i) => {
    if (drop) return;
    try { navigator.vibrate?.(15); } catch { /* not supported */ }
    setDrop(i.id);
    setTimeout(() => { setShoppingDone(hid, i.id, true); setDrop(null); }, 400);
  };
  useEffect(() => {
    if (!market || sub !== 'ev' || !navigator.wakeLock) return undefined;
    let lock = null, gone = false;
    const get = () => navigator.wakeLock.request('screen').then((l) => { if (gone) l.release(); else lock = l; }).catch(() => {});
    const again = () => { if (document.visibilityState === 'visible') get(); };
    get(); document.addEventListener('visibilitychange', again);
    return () => { gone = true; document.removeEventListener('visibilitychange', again); lock?.release?.(); };
  }, [market, sub]);

  const partner = (session.household.members || []).find((u) => u !== me.uid);
  const countOpen = (c) => house.shopping.filter((i) => !i.done && i.category === c).length;

  function submit(e) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    if (sub === 'ev') addShopping(hid, me.uid, { text: v, category: filter });
    else addFamilyTodo(hid, me.uid, v, dueDate || null);
    if (partner) notifyPartnerAdded(sub, me.name, v);
    setText(''); setDueDate('');
  }

  const shopList = house.shopping.filter((i) => i.category === filter);
  const open = shopList.filter((i) => !i.done), done = shopList.filter((i) => i.done);
  const todoOpen = sortTodos(house.todos.filter((t) => !t.done)), todoDone = house.todos.filter((t) => t.done);
  const openShop = house.shopping.filter((i) => !i.done).length;

  const cycleAssignee = (t) => {
    const order = [null, me.uid, partner].filter((v, i, a) => a.indexOf(v) === i);
    const cur = t.assignee === 'me' ? me.uid : t.assignee;
    const next = order[(order.indexOf(cur ?? null) + 1) % order.length] ?? null;
    setFamilyTodoAssignee(hid, t.id, next);
  };

  return (
    <main class={sub === 'ilac' || sub === 'fridge' ? 'screen' : 'screen has-addbar'}>
      {market && sub === 'ev' && (
        <div class="mk-page" role="dialog" aria-label="Market modu">
          <div class="mk-top">
            <h2>Market</h2>
            <button type="button" class="iconbtn" aria-label="Marketi kapat" onClick={() => setMarket(false)}><IconClose /></button>
          </div>
          <Seg items={SHOP_CATEGORIES.map((c) => ({ ...c, badge: countOpen(c.value) || null }))} value={filter} onChange={setFilter} label="Kategori" />
          <div class="mk-list">
            {open.length === 0 && <div class="mk-empty">{done.length ? 'Hepsi sepette' : 'Listede bir şey yok'}</div>}
            {open.map((i) => (
              <button type="button" key={i.id} class={drop === i.id ? 'mk-row drop' : 'mk-row'} role="checkbox" aria-checked="false" aria-label={`${i.text} alındı`} onClick={() => pick(i)}>
                <span class="mk-circle" aria-hidden="true" /><span class="mk-text">{i.text}</span>
              </button>
            ))}
          </div>
          <div class="mk-cart">
            <div class="mk-cart-head">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.4-1.1L20.5 8H6.2" /><circle cx="9.5" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></svg>
              <span class="grow">Sepet</span>
              <span class="mk-count num"><Pop value={done.length}>{done.length}</Pop></span>
              {done.length > 0 && <button type="button" class="mk-clear" onClick={() => { if (confirm(`${done.length} ürün listeden silinsin mi?`)) done.forEach((i) => deleteShopping(hid, i.id)); }}>Temizle</button>}
            </div>
            {done.length > 0 && <div class="mk-chips">{done.map((i) => <button type="button" key={i.id} class="mk-chip" aria-label={`${i.text} sepetten çıkar`} onClick={() => setShoppingDone(hid, i.id, false)}>{i.text}</button>)}</div>}
          </div>
        </div>
      )}
      <div class="topbar">
        <h1 style="font-size:40px">Takip Listesi</h1>
      </div>

      <Seg items={[{ value: 'ev', label: 'İhtiyaçlar', badge: openShop || null }, { value: 'todo', label: 'Yapılacaklar', badge: todoOpen.length || null }, { value: 'fridge', label: 'Buzdolabı', badge: urgentCount(house.fridge, today()) || null }, { value: 'ilac', label: 'İlaçlar' }]} value={sub} onChange={setSub} label="Ortak bölüm" />

      {sub === 'ilac' ? <Ilaclar session={session} house={house} nav={nav} /> : sub === 'fridge' ? <Buzdolabi house={house} hid={hid} nav={nav} /> : sub === 'ev' ? (
        <>
          <Seg items={SHOP_CATEGORIES.map((c) => ({ ...c, badge: countOpen(c.value) || null }))} value={filter} onChange={setFilter} label="Kategori" />
          <button type="button" class="market-toggle" onClick={() => setMarket(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.4-1.1L20.5 8H6.2" /><circle cx="9.5" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></svg>
            Market modu
          </button>
          <div class="card list-card">
            {shopList.length === 0 && <div class="sub" style="padding:18px 0;text-align:center">Liste boş. Aşağıdan ekle.</div>}
            {[...open, ...done].map((i) => (
              <div class="list-row tight" key={i.id}>
                <button class={i.done ? 'check on' : 'check'} role="checkbox" aria-checked={i.done} aria-label={`${i.text} alındı`}
                  onClick={() => setShoppingDone(hid, i.id, !i.done)}>{i.done && <Tick />}</button>
                <div class="grow">
                  <div class={i.done ? 'title-sm struck' : 'title-sm'}>{i.text}</div>
                </div>
                <Avatar person={personOf(session, i.addedBy)} small />
                <button class="iconbtn plain" aria-label={`${i.text} düzenle`} onClick={() => nav.go({ n: 'listitem', kind: 'shop', id: i.id })}><IconEdit /></button>
                <button class="iconbtn plain" aria-label={`${i.text} sil`} onClick={() => deleteShopping(hid, i.id)}><IconTrash /></button>
              </div>
            ))}
          </div>
          {done.length > 0 && (
            <button class="chip" onClick={() => { if (confirm(`${done.length} alınan öğe silinsin mi?`)) done.forEach((i) => deleteShopping(hid, i.id)); }}>
              Alınanları temizle ({done.length})
            </button>
          )}
        </>
      ) : (
        <div class="card list-card">
          {house.todos.length === 0 && <div class="sub" style="padding:18px 0;text-align:center">Yapılacak yok. Aşağıdan ekle.</div>}
          {[...todoOpen, ...todoDone].map((t) => {
            const who = personOf(session, t.assignee);
            return (
              <div class="list-row tight" key={t.id}>
                <button class={t.done ? 'check on' : 'check'} role="checkbox" aria-checked={t.done} aria-label={`${t.text} tamamlandı`}
                  onClick={() => setFamilyTodoDone(hid, t.id, !t.done)}>{t.done && <Tick />}</button>
                <div class="grow">
                  <div class={t.done ? 'title-sm struck' : 'title-sm'}>{t.text}</div>
                  {who && <div class="sub">{who.name}</div>}
                  {t.dueDate && !t.done && <div style="margin-top:4px"><span class={`fr-pill ${dueState(t.dueDate, today())}`}>{dueText(t.dueDate, today())}</span></div>}
                </div>
                <button class="iconbtn plain" aria-label={`${t.text} atanan kişiyi değiştir`} onClick={() => cycleAssignee(t)}>
                  {who ? <Avatar person={who} small /> : <span class="avatar mini empty" aria-hidden="true">+</span>}
                </button>
                <button class="iconbtn plain" aria-label={`${t.text} düzenle`} onClick={() => nav.go({ n: 'listitem', kind: 'todo', id: t.id })}><IconEdit /></button>
                <button class="iconbtn plain" aria-label={`${t.text} sil`} onClick={() => deleteFamilyTodo(hid, t.id)}><IconTrash /></button>
              </div>
            );
          })}
        </div>
      )}

      {sub !== 'ilac' && sub !== 'fridge' && <form class="addbar" onSubmit={submit}>
        {sub === 'todo' && (
          <label class="row" style="gap:8px;font-size:13px;font-weight:700">
            <span class="grow muted">Şu tarihe kadar (isteğe bağlı)</span>
            <input class="addinput" style="flex:none;width:auto" type="date" min={today()} value={dueDate} aria-label="Son tarih" onInput={(e) => setDueDate(e.target.value)} />
          </label>
        )}
        <div class="row" style="gap:8px">
          <input class="addinput" aria-label={sub === 'ev' ? `${categoryLabel(SHOP_CATEGORIES, filter)} listesine ekle` : 'Yapılacak ekle'} placeholder={sub === 'ev' ? `${categoryLabel(SHOP_CATEGORIES, filter)} listesine ekle` : 'Yapılacak ekle'}
            value={text} maxLength={80} onInput={(e) => setText(e.target.value)} />
          <button class="btn" type="submit" aria-label="Ekle"><IconPlus /></button>
        </div>
      </form>}
    </main>
  );
}

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

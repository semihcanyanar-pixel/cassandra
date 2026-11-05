import { useState } from 'preact/hooks';
import { Seg } from '../components/Seg.jsx';
import { Ilaclar } from './Ilaclar.jsx';
import { IconPlus, IconTrash } from '../icons.jsx';
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

// Lets other screens open Ortak on a given sub-tab (read once on mount).
export const ortakStart = { sub: 'ev' };

export function Avatar({ person, small }) {
  if (!person) return null;
  return <span class={`${small ? 'avatar mini' : 'avatar'} p${person.slot ?? 0}`} role="img" aria-label={person.name} title={person.name}>{person.initial}</span>;
}

export function Ortak({ session, house, nav, onSettings }) {
  const { me } = session;
  const hid = session.hid;
  const [sub, setSub] = useState(() => { const s = ortakStart.sub; ortakStart.sub = 'ev'; return s; });
  const [filter, setFilter] = useState('all');
  const [addCat, setAddCat] = useState('market');
  const [text, setText] = useState('');

  const partner = (session.household.members || []).find((u) => u !== me.uid);
  const countOpen = (c) => house.shopping.filter((i) => !i.done && (c === 'all' || i.category === c)).length;

  function submit(e) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    if (sub === 'ev') addShopping(hid, me.uid, { text: v, category: filter === 'all' ? addCat : filter });
    else addFamilyTodo(hid, me.uid, v);
    setText('');
  }

  const shopList = house.shopping.filter((i) => filter === 'all' || i.category === filter);
  const open = shopList.filter((i) => !i.done), done = shopList.filter((i) => i.done);
  const todoOpen = house.todos.filter((t) => !t.done), todoDone = house.todos.filter((t) => t.done);
  const openShop = countOpen('all');

  const cycleAssignee = (t) => {
    const order = [null, me.uid, partner].filter((v, i, a) => a.indexOf(v) === i);
    const cur = t.assignee === 'me' ? me.uid : t.assignee;
    const next = order[(order.indexOf(cur ?? null) + 1) % order.length] ?? null;
    setFamilyTodoAssignee(hid, t.id, next);
  };

  return (
    <main class={sub === 'ilac' ? 'screen' : 'screen has-addbar'}>
      <div class="topbar">
        <h1 style="font-size:40px">Ortak</h1>
        <button class={`avatar p${me.slot ?? 0}`} aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
      </div>

      <Seg items={[{ value: 'ev', label: 'İhtiyaçlar', badge: openShop || null }, { value: 'todo', label: 'Yapılacaklar', badge: todoOpen.length || null }, { value: 'ilac', label: 'İlaçlar' }]} value={sub} onChange={setSub} label="Ortak bölüm" />

      {sub === 'ilac' ? <Ilaclar session={session} house={house} nav={nav} /> : sub === 'ev' ? (
        <>
          <Seg items={[{ value: 'all', label: 'Hepsi' }, ...SHOP_CATEGORIES].map((c) => ({ ...c, badge: countOpen(c.value) || null }))} value={filter} onChange={setFilter} label="Kategori" />
          <div class="card list-card">
            {shopList.length === 0 && <div class="sub" style="padding:18px 0;text-align:center">Liste boş. Aşağıdan ekle.</div>}
            {[...open, ...done].map((i) => (
              <div class="list-row" key={i.id}>
                <button class={i.done ? 'check on' : 'check'} role="checkbox" aria-checked={i.done} aria-label={`${i.text} alındı`}
                  onClick={() => setShoppingDone(hid, i.id, !i.done)}>{i.done && <Tick />}</button>
                <div class="grow">
                  <div class={i.done ? 'title-sm struck' : 'title-sm'}>{i.text}</div>
                  {filter === 'all' && <div class="sub">{categoryLabel(SHOP_CATEGORIES, i.category)}</div>}
                </div>
                <Avatar person={personOf(session, i.addedBy)} small />
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
              <div class="list-row" key={t.id}>
                <button class={t.done ? 'check on' : 'check'} role="checkbox" aria-checked={t.done} aria-label={`${t.text} tamamlandı`}
                  onClick={() => setFamilyTodoDone(hid, t.id, !t.done)}>{t.done && <Tick />}</button>
                <div class="grow">
                  <div class={t.done ? 'title-sm struck' : 'title-sm'}>{t.text}</div>
                  {who && <div class="sub">{who.name}</div>}
                </div>
                <button class="iconbtn plain" aria-label={`${t.text} atanan kişiyi değiştir`} onClick={() => cycleAssignee(t)}>
                  {who ? <Avatar person={who} small /> : <span class="avatar mini empty" aria-hidden="true">+</span>}
                </button>
                <button class="iconbtn plain" aria-label={`${t.text} sil`} onClick={() => deleteFamilyTodo(hid, t.id)}><IconTrash /></button>
              </div>
            );
          })}
        </div>
      )}

      {sub !== 'ilac' && <form class="addbar" onSubmit={submit}>
        {sub === 'ev' && filter === 'all' && (
          <div class="chips" role="radiogroup" aria-label="Yeni öğenin kategorisi">
            {SHOP_CATEGORIES.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={addCat === c.value}
                class={addCat === c.value ? 'chip small on' : 'chip small'} onClick={() => setAddCat(c.value)}>{c.label}</button>
            ))}
          </div>
        )}
        <div class="row" style="gap:8px">
          <input class="addinput" aria-label={sub === 'ev' ? 'Listeye ekle' : 'Yapılacak ekle'} placeholder={sub === 'ev' ? 'Listeye ekle' : 'Yapılacak ekle'}
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

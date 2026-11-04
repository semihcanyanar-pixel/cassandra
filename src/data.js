import { useEffect, useState } from 'preact/hooks';
import {
  collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase.js';

// Personal data lives ONLY under users/{uid}/... (SPEC §4/§5); nothing here touches households/.
const col = (uid, name) => collection(db, 'users', uid, name);
const ref = (uid, name, id) => doc(db, 'users', uid, name, id);

function useUserCollection(uid, name) {
  const [items, setItems] = useState(null);
  useEffect(() => onSnapshot(
    col(uid, name),
    (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error(name, err); setItems([]); },
  ), [uid, name]);
  return items;
}

const updated = (x) => x.updatedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
const created = (x) => x.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;

// Dev-only visual check: http://localhost:5173/?demo=1 shows sample data and never writes to Firestore.
const DEMO = import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('demo=1');
const dayOffset = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
function demoData() {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const logs = [];
  [[0, 'a', 35], [0, 'b', 60], [0, 'c', 40], [1, 'a', 45], [1, 'b', 50], [2, 'a', 30], [2, 'c', 90], [3, 'b', 45], [4, 'a', 40], [5, 'c', 60], [6, 'b', 30], [9, 'a', 45], [12, 'c', 80], [20, 'b', 60], [40, 'a', 45]]
    .forEach(([n, a, m], i) => logs.push({ id: `l${i}`, activityId: a, date: d(n), minutes: m }));
  return {
    ready: true,
    activities: [
      { id: 'a', name: 'İngilizce', color: 0, weeklyDays: 4, dailyMinutes: 45, archived: false },
      { id: 'b', name: 'Spor', color: 1, weeklyDays: 5, dailyMinutes: 60, archived: false },
      { id: 'c', name: 'Yazılım', color: 2, weeklyDays: 3, dailyMinutes: 90, archived: false },
    ],
    logs,
    tasks: [
      { id: 't1', title: 'Vitamin al', repeat: 'daily', date: d(10), doneDates: [d(0)] },
      { id: 't2', title: 'Faturayı öde', repeat: 'none', date: d(0), done: false },
    ],
    events: [{ id: 'pe1', title: 'Berber', date: dayOffset(18), time: null, repeat: 'none', remind: 'none' }],
    notes: [{ id: 'pn1', title: 'Doğum günü fikirleri', body: 'Kitap, eşarp, çiçek', color: 1, updatedAt: null }],
    goals: [{ id: 'g1', title: 'Yıl sonuna kadar İngilizce', period: 'long', target: 100, unit: 'saat', linkedActivityId: 'a', startDate: d(60), dueDate: null, progress: 0 }],
  };
}

export function useUserData(uid) {
  if (DEMO) return demoData();
  const activities = useUserCollection(uid, 'activities');
  const logs = useUserCollection(uid, 'logs');
  const tasks = useUserCollection(uid, 'tasks');
  const goals = useUserCollection(uid, 'goals');
  const notes = useUserCollection(uid, 'notes');
  const events = useUserCollection(uid, 'events');
  const ready = activities && logs && tasks && goals && notes && events;
  return {
    ready: Boolean(ready),
    activities: (activities || []).slice().sort((a, b) => created(a) - created(b)),
    logs: logs || [],
    tasks: (tasks || []).slice().sort((a, b) => created(a) - created(b)),
    goals: (goals || []).slice().sort((a, b) => created(a) - created(b)),
    notes: (notes || []).slice().sort((a, b) => updated(b) - updated(a)),
    events: events || [],
  };
}

// Writes are fire-and-forget: with offline persistence they resolve only after server ack.
const fire = (thunk) => { if (!DEMO) thunk().catch((e) => console.error(e)); };

export const saveActivity = (uid, id, data) => fire(() => id
  ? updateDoc(ref(uid, 'activities', id), data)
  : addDoc(col(uid, 'activities'), { ...data, archived: false, createdAt: serverTimestamp() }));
export const addLog = (uid, data) => fire(() => addDoc(col(uid, 'logs'), { ...data, createdAt: serverTimestamp() }));
export const deleteLog = (uid, id) => fire(() => deleteDoc(ref(uid, 'logs', id)));

export const saveTask = (uid, id, data) => fire(() => id
  ? updateDoc(ref(uid, 'tasks', id), data)
  : addDoc(col(uid, 'tasks'), { done: false, doneDates: [], ...data, createdAt: serverTimestamp() }));
export const deleteTask = (uid, id) => fire(() => deleteDoc(ref(uid, 'tasks', id)));
export function toggleTask(uid, task, iso, done) {
  if (task.repeat === 'daily' || task.repeat === 'days') {
    fire(() => updateDoc(ref(uid, 'tasks', task.id), { doneDates: done ? arrayUnion(iso) : arrayRemove(iso) }));
  } else {
    fire(() => updateDoc(ref(uid, 'tasks', task.id), { done }));
  }
}

export const saveGoal = (uid, id, data) => fire(() => id
  ? updateDoc(ref(uid, 'goals', id), data)
  : addDoc(col(uid, 'goals'), { ...data, createdAt: serverTimestamp() }));
export const deleteGoal = (uid, id) => fire(() => deleteDoc(ref(uid, 'goals', id)));

export { setDoc };

// ---------- Household (shared) data: households/{hid}/... ----------
const hcol = (hid, name) => collection(db, 'households', hid, name);
const href = (hid, name, id) => doc(db, 'households', hid, name, id);

function useHouseCollection(hid, name) {
  const [items, setItems] = useState(null);
  useEffect(() => onSnapshot(
    hcol(hid, name),
    (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error(name, err); setItems([]); },
  ), [hid, name]);
  return items;
}

function demoHouse() {
  return {
    ready: true,
    shopping: [
      { id: 's1', text: 'Süt', category: 'market', done: false, addedBy: 'me', createdAt: null },
      { id: 's2', text: 'Ekmek', category: 'market', done: true, addedBy: 'other', createdAt: null },
      { id: 's3', text: 'Çamaşır suyu', category: 'ev', done: false, addedBy: 'other', createdAt: null },
      { id: 's4', text: 'Bebek bezi', category: 'aslan', done: false, addedBy: 'me', createdAt: null },
    ],
    todos: [
      { id: 'f1', text: 'Aşı randevusu al', done: false, assignee: 'me', addedBy: 'other', createdAt: null },
      { id: 'f2', text: 'Faturaları öde', done: false, assignee: null, addedBy: 'me', createdAt: null },
    ],
    events: [
      { id: 'fe1', title: 'Hastane randevusu', date: dayOffset(2), time: '10:30', repeat: 'none', remind: '1d', createdBy: 'me' },
      { id: 'fe2', title: 'Doğum günü: Annem', date: dayOffset(10), time: null, repeat: 'yearly', remind: '1d', createdBy: 'other' },
    ],
    notes: [
      { id: 'n1', category: 'ev', title: 'Dolap düzeni', body: 'Kışlıkları üst rafa kaldır', color: 0, addedBy: 'me', updatedAt: null },
      { id: 'n2', category: 'aslan', title: 'Doktora sorulacaklar', items: [{ t: 'Ek gıda', done: false }, { t: 'Diş çıkarma', done: true }], color: 2, addedBy: 'other', updatedAt: null },
    ],
  };
}

export function useHouseData(hid) {
  if (DEMO) return demoHouse();
  const shopping = useHouseCollection(hid, 'shoppingItems');
  const todos = useHouseCollection(hid, 'familyTodos');
  const notes = useHouseCollection(hid, 'notes');
  const events = useHouseCollection(hid, 'events');
  return {
    ready: Boolean(shopping && todos && notes && events),
    shopping: (shopping || []).slice().sort((a, b) => created(a) - created(b)),
    todos: (todos || []).slice().sort((a, b) => created(a) - created(b)),
    notes: (notes || []).slice().sort((a, b) => updated(b) - updated(a)),
    events: events || [],
  };
}

export const addShopping = (hid, uid, { text, category }) => fire(() => addDoc(hcol(hid, 'shoppingItems'),
  { text, category, done: false, addedBy: uid, createdAt: serverTimestamp() }));
export const setShoppingDone = (hid, id, done) => fire(() => updateDoc(href(hid, 'shoppingItems', id), { done }));
export const deleteShopping = (hid, id) => fire(() => deleteDoc(href(hid, 'shoppingItems', id)));

export const addFamilyTodo = (hid, uid, text) => fire(() => addDoc(hcol(hid, 'familyTodos'),
  { text, done: false, assignee: null, addedBy: uid, createdAt: serverTimestamp() }));
export const setFamilyTodoDone = (hid, id, done) => fire(() => updateDoc(href(hid, 'familyTodos', id), { done }));
export const setFamilyTodoAssignee = (hid, id, assignee) => fire(() => updateDoc(href(hid, 'familyTodos', id), { assignee }));
export const deleteFamilyTodo = (hid, id) => fire(() => deleteDoc(href(hid, 'familyTodos', id)));

// Note destination comes only from the picked category (see lib/notes.js).
export function saveNote({ uid, hid }, category, id, data) {
  const personal = category === 'kisisel';
  const base = personal ? col(uid, 'notes') : hcol(hid, 'notes');
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (id) return fire(() => updateDoc(personal ? ref(uid, 'notes', id) : href(hid, 'notes', id), payload));
  return fire(() => addDoc(base, personal ? payload : { ...payload, category, addedBy: uid }));
}
export const deleteNote = ({ uid, hid }, category, id) => fire(() => deleteDoc(category === 'kisisel' ? ref(uid, 'notes', id) : href(hid, 'notes', id)));

// Events: scope 'aile' -> households/{hid}/events, 'kisisel' -> users/{uid}/events (chosen only by the explicit scope).
export function saveEvent({ uid, hid }, scope, id, data) {
  const personal = scope === 'kisisel';
  if (id) return fire(() => updateDoc(personal ? ref(uid, 'events', id) : href(hid, 'events', id), data));
  return fire(() => addDoc(personal ? col(uid, 'events') : hcol(hid, 'events'),
    personal ? { ...data, createdAt: serverTimestamp() } : { ...data, createdBy: uid, createdAt: serverTimestamp() }));
}
export const deleteEvent = ({ uid, hid }, scope, id) => fire(() => deleteDoc(scope === 'kisisel' ? ref(uid, 'events', id) : href(hid, 'events', id)));

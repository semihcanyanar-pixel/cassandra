import { useEffect, useState } from 'preact/hooks';
import {
  collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { reviveTimestamps } from './lib/backup.js';

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
      { id: 't2', title: 'Faturayı öde', repeat: 'none', date: d(0), done: false, remindTime: '18:30' },
      { id: 't3', title: 'Spor çantasını hazırla', repeat: 'days', days: [0, 2, 4], date: d(10), doneDates: [] },
    ],
    events: [{ id: 'pe1', title: 'Berber', date: dayOffset(18), time: null, repeat: 'none', remind: 'none' }],
    notes: [{ id: 'pn1', title: 'Doğum günü fikirleri', body: 'Kitap, eşarp, çiçek', color: 1, updatedAt: null }],
    insights: [],
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
  const insights = useUserCollection(uid, 'insights');
  const ready = activities && logs && tasks && goals && notes && events && insights;
  return {
    ready: Boolean(ready),
    activities: (activities || []).slice().sort((a, b) => created(a) - created(b)),
    logs: logs || [],
    tasks: (tasks || []).slice().sort((a, b) => created(a) - created(b)),
    goals: (goals || []).slice().sort((a, b) => created(a) - created(b)),
    notes: (notes || []).slice().sort((a, b) => updated(b) - updated(a)),
    events: events || [],
    insights: insights || [],
  };
}

// Writes are fire-and-forget: with offline persistence they resolve only after server ack.
const fire = (thunk) => { if (!DEMO) thunk().catch((e) => console.error(e)); };

export const saveActivity = (uid, id, data) => fire(() => id
  ? updateDoc(ref(uid, 'activities', id), data)
  : addDoc(col(uid, 'activities'), { ...data, archived: false, createdAt: serverTimestamp() }));
// Deletes an activity together with its time logs (logIds = ids of logs that belong to it).
export const deleteActivity = (uid, id, logIds) => fire(() => Promise.all([...logIds.map((l) => deleteDoc(ref(uid, 'logs', l))), deleteDoc(ref(uid, 'activities', id))]));
export const addLog =(uid, data) => fire(() => addDoc(col(uid, 'logs'), { ...data, createdAt: serverTimestamp() }));
// One-tap "done today" for an activity: a log without minutes. Undoing removes only such minute-less logs of that day.
export const markActivityDone = (uid, activityId, date) => addLog(uid, { activityId, date, minutes: null });
// Writes the restore operations (see lib/backup.js) in batches of 400. Returns the number of documents written.
export async function applyRestore(ops) {
  if (DEMO) return 0;
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    for (const { path, data } of ops.slice(i, i + 400)) batch.set(doc(db, ...path), reviveTimestamps(data, (sec, ns) => new Timestamp(sec, ns)));
    await batch.commit();
  }
  return ops.length;
}
export const updateLog =(uid, id, data) => fire(() => updateDoc(ref(uid, 'logs', id), data));
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

// Weekly AI summary cache: users/{uid}/insights/{weekId} (weekId = Monday ISO date).
export const saveInsight = (uid, weekId, data) => fire(() => setDoc(ref(uid, 'insights', weekId), { ...data, createdAt: serverTimestamp() }));

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
    medications: [
      { id: 'md1', forId: 'aslan', name: 'D vitamini', dose: '5 damla', timesPerDay: 1, times: ['09:00'], meal: 'tok', startDate: dayOffset(-3), endDate: dayOffset(20), note: '', archived: false },
      { id: 'md2', forId: 'me', name: 'Antibiyotik', dose: '1 tablet', timesPerDay: 3, times: ['08:00', '14:00', '20:00'], meal: 'tok', startDate: dayOffset(-2), endDate: dayOffset(4), note: '', archived: false },
      { id: 'md3', forId: 'other', name: 'Ağrı kesici', dose: '1 tablet', timesPerDay: 2, times: ['09:00', '21:00'], meal: 'fark_etmez', startDate: dayOffset(-12), endDate: dayOffset(-5), note: '', archived: false },
    ],
    medLogs: [
      { id: `md1_${dayOffset(0)}_09:00`, medicationId: 'md1', forId: 'aslan', date: dayOffset(0), time: '09:00', status: 'alindi', doneBy: 'other', doneAt: null },
      { id: `md2_${dayOffset(0)}_08:00`, medicationId: 'md2', forId: 'me', date: dayOffset(0), time: '08:00', status: 'alindi', doneBy: 'me', doneAt: null },
    ],
    fridge: [
      { id: 'fr1', name: 'Süt', kind: 'urun', openedOn: dayOffset(-3), shelfDays: 4, addedBy: 'me' },
      { id: 'fr2', name: 'Yoğurt', kind: 'urun', openedOn: dayOffset(-1), shelfDays: 5, addedBy: 'other' },
      { id: 'fr3', name: 'Mercimek çorbası', kind: 'yemek', openedOn: dayOffset(-3), shelfDays: 3, addedBy: 'other' },
      { id: 'fr4', name: 'Tavuklu pilav', kind: 'yemek', openedOn: dayOffset(-5), shelfDays: 3, addedBy: 'me' },
      { id: 'fr5', name: 'Reçel', kind: 'urun', openedOn: dayOffset(-8), shelfDays: null, addedBy: 'me' },
    ],
    notes: [
      { id: 'n1', category: 'aile', title: 'Dolap düzeni', body: 'Kışlıkları üst rafa kaldır', color: 0, addedBy: 'me', updatedAt: null },
      { id: 'n2', category: 'aile', title: 'Doktora sorulacaklar', items: [{ t: 'Ek gıda', done: false }, { t: 'Diş çıkarma', done: true }], color: 2, addedBy: 'other', updatedAt: null },
    ],
  };
}

export function useHouseData(hid) {
  if (DEMO) return demoHouse();
  const shopping = useHouseCollection(hid, 'shoppingItems');
  const todos = useHouseCollection(hid, 'familyTodos');
  const notes = useHouseCollection(hid, 'notes');
  const events = useHouseCollection(hid, 'events');
  const medications = useHouseCollection(hid, 'medications');
  const medLogs = useHouseCollection(hid, 'medLogs');
  const fridge = useHouseCollection(hid, 'fridgeItems');
  return {
    ready: Boolean(shopping && todos && notes && events && medications && medLogs && fridge),
    fridge: fridge || [],
    medications: (medications || []).slice().sort((a, b) => created(a) - created(b)),
    medLogs: medLogs || [],
    shopping: (shopping || []).slice().sort((a, b) => created(a) - created(b)),
    todos: (todos || []).slice().sort((a, b) => created(a) - created(b)),
    notes: (notes || []).slice().sort((a, b) => updated(b) - updated(a)),
    events: events || [],
  };
}

// Buzdolabı: opened products / cooked meals with their date (households/{hid}/fridgeItems).
export const saveFridge = (hid, uid, id, data) => fire(() => id
  ? updateDoc(href(hid, 'fridgeItems', id), data)
  : addDoc(hcol(hid, 'fridgeItems'), { ...data, addedBy: uid, createdAt: serverTimestamp() }));
export const deleteFridge = (hid, id) => fire(() => deleteDoc(href(hid, 'fridgeItems', id)));

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
// Medications (shared health data, households/{hid}/medications + medLogs).
export const saveMedication = (hid, uid, id, data) => fire(() => id
  ? updateDoc(href(hid, 'medications', id), data)
  : addDoc(hcol(hid, 'medications'), { ...data, archived: false, createdBy: uid, createdAt: serverTimestamp() }));
export const deleteMedication = (hid, id) => fire(() => deleteDoc(href(hid, 'medications', id)));
// Dose marks use a deterministic doc id ({medId}_{date}_{time}) so two phones marking the same dose write the SAME doc (never two).
export const markDose = (hid, uid, dose, status) => fire(() => setDoc(href(hid, 'medLogs', dose.id), {
  medicationId: dose.med.id, forId: dose.med.forId, date: dose.date, time: dose.time, status, doneBy: uid, doneAt: serverTimestamp(),
}));
export const unmarkDose = (hid, doseId) => fire(() => deleteDoc(href(hid, 'medLogs', doseId)));

export const deleteEvent = ({ uid, hid }, scope, id) => fire(() => deleteDoc(scope === 'kisisel' ? ref(uid, 'events', id) : href(hid, 'events', id)));

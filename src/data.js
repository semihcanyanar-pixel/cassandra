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

const created = (x) => x.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;

// Dev-only visual check: http://localhost:5173/?demo=1 shows sample data and never writes to Firestore.
const DEMO = import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('demo=1');
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
    goals: [{ id: 'g1', title: 'Yıl sonuna kadar İngilizce', period: 'long', target: 100, unit: 'saat', linkedActivityId: 'a', startDate: d(60), dueDate: null, progress: 0 }],
  };
}

export function useUserData(uid) {
  if (DEMO) return demoData();
  const activities = useUserCollection(uid, 'activities');
  const logs = useUserCollection(uid, 'logs');
  const tasks = useUserCollection(uid, 'tasks');
  const goals = useUserCollection(uid, 'goals');
  const ready = activities && logs && tasks && goals;
  return {
    ready: Boolean(ready),
    activities: (activities || []).slice().sort((a, b) => created(a) - created(b)),
    logs: logs || [],
    tasks: (tasks || []).slice().sort((a, b) => created(a) - created(b)),
    goals: (goals || []).slice().sort((a, b) => created(a) - created(b)),
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

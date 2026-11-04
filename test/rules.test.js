import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, addDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

const HID = 'hh1';
let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'cassandra-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'households', HID), { members: ['A', 'B'], profiles: {}, dependents: [] });
    await setDoc(doc(d, 'users', 'B', 'activities', 'x'), { name: 'gizli' });
    await setDoc(doc(d, 'users', 'A', 'activities', 'y'), { name: 'benim' });
    await setDoc(doc(d, 'households', HID, 'medications', 'm1'), { name: 'D vitamini' });
    await setDoc(doc(d, 'households', HID, 'medLogs', 'l1'), { status: 'alindi' });
    await setDoc(doc(d, 'households', HID, 'shoppingItems', 's1'), { text: 'süt' });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('1. Kişisel veri yalnızca sahibine açık', () => {
  it('A, B nin verisini okuyamaz', () => assertFails(getDoc(doc(as('A'), 'users', 'B', 'activities', 'x'))));
  it('A, B nin yoluna yazamaz', () => assertFails(setDoc(doc(as('A'), 'users', 'B', 'activities', 'z'), { name: 'x' })));
  it('A, B nin koleksiyonunu listeleyemez', () => assertFails(getDocs(collection(as('A'), 'users', 'B', 'activities'))));
  it('A kendi verisini okuyup yazar', async () => {
    await assertSucceeds(getDoc(doc(as('A'), 'users', 'A', 'activities', 'y')));
    await assertSucceeds(setDoc(doc(as('A'), 'users', 'A', 'goals', 'g'), { title: 'x' }));
  });
});

describe('2. Giriş yapmamış kimse okuyamaz', () => {
  it('kullanıcı verisi', () => assertFails(getDoc(doc(anon(), 'users', 'A', 'activities', 'y'))));
  it('hane belgesi', () => assertFails(getDoc(doc(anon(), 'households', HID))));
  it('hane alt koleksiyonu', () => assertFails(getDoc(doc(anon(), 'households', HID, 'shoppingItems', 's1'))));
});

describe('3. Hane üyesi olmayan erişemez', () => {
  it('hane belgesini okuyamaz', () => assertFails(getDoc(doc(as('C'), 'households', HID))));
  it('alt koleksiyonu okuyamaz', () => assertFails(getDoc(doc(as('C'), 'households', HID, 'shoppingItems', 's1'))));
  it('alt koleksiyona yazamaz', () => assertFails(addDoc(collection(as('C'), 'households', HID, 'shoppingItems'), { text: 'x' })));
});

describe('4. İki hane üyesi alt koleksiyonları okur ve yazar', () => {
  for (const uid of ['A', 'B']) {
    it(`${uid} okur ve yazar`, async () => {
      await assertSucceeds(getDoc(doc(as(uid), 'households', HID, 'shoppingItems', 's1')));
      await assertSucceeds(addDoc(collection(as(uid), 'households', HID, 'familyTodos'), { text: 'x', done: false }));
      await assertSucceeds(getDoc(doc(as(uid), 'households', HID)));
    });
  }
});

describe('5. Hane belgesinin kendisi yazılamaz', () => {
  for (const uid of ['A', 'B', 'C']) {
    it(`${uid} yazamaz`, () => assertFails(setDoc(doc(as(uid), 'households', HID), { members: [uid] })));
  }
  it('anonim yazamaz', () => assertFails(setDoc(doc(anon(), 'households', HID), { members: [] })));
});

describe('6. İlaç verisi yalnızca hane üyelerine açık', () => {
  for (const col of [['medications', 'm1'], ['medLogs', 'l1']]) {
    const [c, id] = col;
    it(`${c}: üye okur ve yazar`, async () => {
      await assertSucceeds(getDoc(doc(as('A'), 'households', HID, c, id)));
      await assertSucceeds(setDoc(doc(as('B'), 'households', HID, c, id), { v: 1 }));
    });
    it(`${c}: üye olmayan okuyamaz ve yazamaz`, async () => {
      await assertFails(getDoc(doc(as('C'), 'households', HID, c, id)));
      await assertFails(setDoc(doc(as('C'), 'households', HID, c, id), { v: 1 }));
    });
    it(`${c}: anonim okuyamaz`, () => assertFails(getDoc(doc(anon(), 'households', HID, c, id))));
  }
});

describe('7. Notlar: kişisel notlar gizli, ortak notlar hane içinde', () => {
  it('A, B nin kişisel notunu okuyamaz ve yazamaz', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users', 'B', 'notes', 'n1'), { title: 'gizli' }));
    await assertFails(getDoc(doc(as('A'), 'users', 'B', 'notes', 'n1')));
    await assertFails(setDoc(doc(as('A'), 'users', 'B', 'notes', 'n2'), { title: 'x' }));
    await assertFails(getDocs(collection(as('A'), 'users', 'B', 'notes')));
  });
  it('hane notlarını iki üye de okur ve yazar, dışarıdan biri okuyamaz', async () => {
    await assertSucceeds(addDoc(collection(as('A'), 'households', HID, 'notes'), { category: 'ev', title: 't' }));
    await assertSucceeds(getDocs(collection(as('B'), 'households', HID, 'notes')));
    await assertFails(getDocs(collection(as('C'), 'households', HID, 'notes')));
  });
});

describe('8. İlaç verisi (sağlık) yalnızca iki hane üyesine açık', () => {
  const dose = { medicationId: 'm1', forId: 'aslan', date: '2026-11-05', time: '08:00', status: 'alindi', doneBy: 'A' };
  for (const uid of ['A', 'B']) {
    it(`${uid} ilaç dönemi okur/yazar, doz işaretler ve geri alır`, async () => {
      await assertSucceeds(getDoc(doc(as(uid), 'households', HID, 'medications', 'm1')));
      await assertSucceeds(setDoc(doc(as(uid), 'households', HID, 'medications', 'm2'), { name: 'x', forId: 'aslan' }));
      await assertSucceeds(setDoc(doc(as(uid), 'households', HID, 'medLogs', 'm1_2026-11-05_08:00'), { ...dose, doneBy: uid }));
      await assertSucceeds(getDocs(collection(as(uid), 'households', HID, 'medLogs')));
      await assertSucceeds(deleteDoc(doc(as(uid), 'households', HID, 'medLogs', 'l1')));
    });
  }
  it('hane dışı hesap ilaç ve doz verisini okuyamaz', async () => {
    await assertFails(getDoc(doc(as('C'), 'households', HID, 'medications', 'm1')));
    await assertFails(getDocs(collection(as('C'), 'households', HID, 'medications')));
    await assertFails(getDoc(doc(as('C'), 'households', HID, 'medLogs', 'l1')));
    await assertFails(getDocs(collection(as('C'), 'households', HID, 'medLogs')));
  });
  it('hane dışı hesap ilaç/doz yazamaz ya da silemez', async () => {
    await assertFails(setDoc(doc(as('C'), 'households', HID, 'medications', 'zz'), { name: 'x' }));
    await assertFails(setDoc(doc(as('C'), 'households', HID, 'medLogs', 'zz'), dose));
    await assertFails(deleteDoc(doc(as('C'), 'households', HID, 'medLogs', 'l1')));
  });
  it('giriş yapmamış kimse okuyamaz', async () => {
    await assertFails(getDoc(doc(anon(), 'households', HID, 'medications', 'm1')));
    await assertFails(getDoc(doc(anon(), 'households', HID, 'medLogs', 'l1')));
  });
});

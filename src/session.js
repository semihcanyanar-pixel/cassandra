import { useEffect, useState } from 'preact/hooks';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, configured, HOUSEHOLD_ID } from './firebase.js';
import { applyTheme, currentTheme } from './theme.js';

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');

// status: loading | signedOut | ready | notMember | error | unconfigured
export function useSession() {
  const [state, setState] = useState({ status: configured ? 'loading' : 'unconfigured' });

  useEffect(() => {
    if (!configured) return undefined;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { setState({ status: 'signedOut' }); return; }
      try {
        // Household doc is created by hand and not writable from the client; a non-member read is denied.
        let hh;
        try { hh = await getDoc(doc(db, 'households', HOUSEHOLD_ID)); } catch { hh = null; }
        if (!hh || !hh.exists() || !(hh.data().members || []).includes(user.uid)) {
          setState({ status: 'notMember', user });
          return;
        }
        const household = hh.data();
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        let profile = snap.data();
        if (!snap.exists()) {
          profile = {
            displayName: household.profiles?.[user.uid]?.name || user.email.split('@')[0],
            theme: currentTheme(),
            householdId: HOUSEHOLD_ID,
            calendarToken: randomToken(),
            medReminderFor: ['self', 'aslan'],
          };
          await setDoc(ref, profile);
        } else if (profile.householdId !== HOUSEHOLD_ID) {
          await updateDoc(ref, { householdId: HOUSEHOLD_ID });
        }
        if (profile.theme) applyTheme(profile.theme);
        const p = household.profiles?.[user.uid] || {};
        const name = p.name || profile.displayName;
        setState({
          status: 'ready', user, household, hid: HOUSEHOLD_ID,
          me: { uid: user.uid, name, initial: p.initial || name.charAt(0).toUpperCase() },
        });
      } catch (e) {
        console.error(e);
        setState({ status: 'error', user, message: e.message });
      }
    });
  }, []);

  return state;
}

export async function saveTheme(uid, key) {
  applyTheme(key);
  try { await updateDoc(doc(db, 'users', uid), { theme: key }); } catch (e) { console.error(e); }
}

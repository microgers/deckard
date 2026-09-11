/**
 * Firebase is OPTIONAL. With no config in the environment the app runs fully on
 * browser storage and never loads the SDK at all.
 *
 * The values below are not secrets — they are compiled into the public bundle
 * and anyone can read them. Google says so directly:
 * https://firebase.google.com/docs/projects/api-keys
 * What protects the data is firestore.rules, evaluated server-side against a
 * verified ID token.
 */

// import.meta.env exists under Vite; guard so the module graph also imports
// cleanly under plain Node for the test suite.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

const cfg = {
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID
};

export const isConfigured = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);

let mods = null;
async function load() {
  if (mods) return mods;
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import('firebase/app'), import('firebase/auth'), import('firebase/firestore')
  ]);
  const app = initializeApp(cfg);
  // Offline cache, current API. enableIndexedDbPersistence() is deprecated.
  // initializeFirestore must run before any getFirestore() call for this app.
  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
    });
  } catch {
    db = fs.getFirestore(app);   // already initialized, or IndexedDB unavailable
  }
  mods = { app, db, auth: auth.getAuth(app), a: auth, fs };
  return mods;
}

export async function getAuthApi() {
  if (!isConfigured) return null;
  try { return await load(); } catch (e) { console.warn('Firebase failed to load', e); return null; }
}

export async function signInWithGoogle() {
  const m = await getAuthApi(); if (!m) throw new Error('not-configured');
  const provider = new m.a.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // signInWithPopup, not signInWithRedirect: redirect relies on a cross-origin
  // iframe that Chrome 115+, Safari 16.1+ and Firefox 109+ now partition away.
  const res = await m.a.signInWithPopup(m.auth, provider);
  return res.user;
}
export async function signOutUser() {
  const m = await getAuthApi(); if (!m) return;
  await m.a.signOut(m.auth);
}
export async function watchAuth(cb) {
  const m = await getAuthApi();
  if (!m) { cb(null); return () => {}; }
  return m.a.onAuthStateChanged(m.auth, cb);
}

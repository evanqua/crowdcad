// Firebase initialization — all values from environment variables.
// Copy .env.example to .env.local and fill in your Firebase project values.
import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, initializeAuth, browserLocalPersistence } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig: Record<string, string> = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Validate required config
const requiredKeys = ['apiKey', 'projectId', 'authDomain', 'storageBucket'];
const missing = requiredKeys.filter((k) => !firebaseConfig[k]);
if (missing.length) {
  const msg = `Missing required Firebase env vars: ${missing.join(', ')}. Copy .env.example to .env.local and fill in your values.`;
  if (typeof globalThis.window !== 'undefined' && process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_BACKEND !== 'pocketbase') {
    throw new Error(msg);
  } else {
    console.warn(msg);
  }
}

// Initialize Firebase (guard against duplicate initialization in SSR)
let app: FirebaseApp;
if (!getApps().length) {
  // If we are using pocketbase, we mock initialization to prevent crashes from stray imports
  if (missing.length && process.env.NEXT_PUBLIC_BACKEND === 'pocketbase') {
    app = {} as FirebaseApp;
  } else {
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApp();
}

export const db = (missing.length && process.env.NEXT_PUBLIC_BACKEND === 'pocketbase')
  ? new Proxy({} as ReturnType<typeof getFirestore>, {
      get(_, prop) {
        if (prop === 'type') return 'firestore';
        return () => { throw new Error('Firebase DB is bypassed because pocketbase is active.'); };
      }
    })
  : getFirestore(app);

// In test/emulator mode, use actual window.localStorage persistence so that
// Playwright's storageState() captures the Firebase auth token. Firebase v11+
// defaults to IndexedDB (firebaseLocalStorageDb), which storageState does NOT
// capture. The try/catch handles hot-reload re-evaluation without throwing.
function createAuth() {
  if (missing.length && process.env.NEXT_PUBLIC_BACKEND === 'pocketbase') {
    return new Proxy({} as ReturnType<typeof getAuth>, {
      get() { return () => { throw new Error('Firebase Auth bypassed'); }; }
    });
  }
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    try {
      return initializeAuth(app, { persistence: browserLocalPersistence });
    } catch {
      return getAuth(app); // already initialised (e.g. Next.js HMR)
    }
  }
  return getAuth(app);
}

// SSR: Firebase Auth requires a browser environment. Return a Proxy that throws
// a clear error if any property is accessed server-side, rather than silently
// returning null which leads to cryptic "cannot read property of null" errors.
export const auth = typeof globalThis.window === 'undefined'
  ? new Proxy({} as ReturnType<typeof getAuth>, {
      get(_, prop) {
        throw new Error(
          `Firebase Auth is not available on the server (accessed .${String(prop)}). ` +
          'Ensure auth-dependent code only runs in the browser.'
        );
      },
    })
  : createAuth();

// Connect to Firebase Emulators in test mode.
// Auth emulator: always enabled when NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true (no Java needed).
// Firestore emulator: requires Java — enable separately with NEXT_PUBLIC_USE_FIRESTORE_EMULATOR=true.
// The global flag guards against duplicate connections during Next.js HMR.
const g = globalThis as unknown as { __FIREBASE_EMULATORS_CONNECTED?: boolean };
if (typeof globalThis.window !== 'undefined' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' && !g.__FIREBASE_EMULATORS_CONNECTED) {
  g.__FIREBASE_EMULATORS_CONNECTED = true;
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  if (process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true') {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(getStorage(app), 'localhost', 9199);
  }
}

import { ensureInternalClientAccess } from "../internal-access.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, memoryLocalCache } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

export const LEGACY_TRUNGKIMSTAR_FIREBASE = {
  apiKey: "AIzaSyD859GY8qg0O7bQMmnPuRt1eRjV9n4GHZg",
  authDomain: "trungkimstar.firebaseapp.com",
  projectId: "trungkimstar",
  storageBucket: "trungkimstar.firebasestorage.app",
  messagingSenderId: "627215857693",
  appId: "1:627215857693:web:898245f32eba2ea554eef4"
};

let cached = null;

export function getLegacyClient() {
  if (cached) return cached;
  ensureInternalClientAccess({ allowHash: true, allowSession: true });
  const appName = "trungkimstar-legacy-core";
  const app = getApps().some((item) => item.name === appName)
    ? getApp(appName)
    : initializeApp(LEGACY_TRUNGKIMSTAR_FIREBASE, appName);

  const db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false,
  });

  cached = {
    app,
    auth: getAuth(app),
    db,
    storage: getStorage(app),
  };
  return cached;
}

export function normalizeDocSnapshot(docSnap) {
  if (!docSnap?.exists()) return null;
  const data = docSnap.data() || {};
  return { id: docSnap.id, ...data };
}

import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAMfx_4IkggT1x6wd0OF6qZ06DAqsUtgtU",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "andesuser-792d4.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "andesuser-792d4",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "andesuser-792d4.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "224322264432",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:224322264432:web:8ecbd7b2df4cb2151c83b5",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-95Z2J2E9T3"
};

const app = initializeApp(firebaseConfig);
// Cache Firestore data in the browser (shared across tabs) so pages render
// from cache on repeat visits and sync in the background.
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const auth = getAuth(app);
export const storage = getStorage(app);

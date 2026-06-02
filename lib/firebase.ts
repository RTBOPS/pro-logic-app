import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAdvTyeTAJCcYCyISUh1peL0o79wZXOvQk",
  authDomain: "prologicstudio-4a6f5.firebaseapp.com",
  projectId: "prologicstudio-4a6f5",
  storageBucket: "prologicstudio-4a6f5.firebasestorage.app",
  messagingSenderId: "1016394389770",
  appId: "1:1016394389770:web:0b80665d006bd9ffe202f3",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

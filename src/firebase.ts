import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCgl7kxjSOOgKOd___Iwn6Yc_77tRt9h_I",
  authDomain: "reincollects.firebaseapp.com",
  projectId: "reincollects",
  storageBucket: "reincollects.firebasestorage.app",
  messagingSenderId: "323119908142",
  appId: "1:323119908142:web:318359d258ff1eca2066bf",
  measurementId: "G-KH0YJBH2L6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Google provider options
googleProvider.setCustomParameters({
  prompt: 'select_account'
});


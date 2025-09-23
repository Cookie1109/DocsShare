// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Use static Firebase configuration for now to avoid async initialization issues
const firebaseConfig = {
  apiKey: "AIzaSyDCnFZ7Iah-k-GeFNCe6zA1p2t3q_qRVcs",
  authDomain: "docsshare-35adb.firebaseapp.com",
  projectId: "docsshare-35adb",
  storageBucket: "docsshare-35adb.firebasestorage.app",
  messagingSenderId: "321232637786",
  appId: "1:321232637786:web:25729d8e18dd87b857ad63"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// For future: we can still have the dynamic config loading function
export const initFirebaseServices = async () => {
  // This function can be used later for dynamic config loading
  console.log('Firebase services already initialized statically');
  return { auth, db, storage, googleProvider };
};
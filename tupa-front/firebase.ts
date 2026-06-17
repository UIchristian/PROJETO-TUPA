import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBIjVfpkXwOY356eiaCCFZfpEau3F1MkJw",
  authDomain: "safrasense.firebaseapp.com",
  projectId: "safrasense",
  storageBucket: "safrasense.firebasestorage.app",
  messagingSenderId: "402660304726",
  appId: "1:402660304726:web:e8b9923a176aae9e2a18f7",
  measurementId: "G-NXJR1WBYWZ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

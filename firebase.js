// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Sinun Firebase-konfiguraatiosi
const firebaseConfig = {
  apiKey: "AIzaSyDO7hzqOLT5nHOsGKKSHSj1iT_kuNuNZqo",
  authDomain: "humandash.firebaseapp.com",
  projectId: "humandash",
  storageBucket: "humandash.firebasestorage.app",
  messagingSenderId: "185042328331",
  appId: "1:185042328331:web:1a67385628cd83ffcda00e",
  measurementId: "G-G1C9ENT2CB"
};

// Alustetaan Firebase
const app = initializeApp(firebaseConfig);

// Alustetaan ja exportataan Firestore, jotta app.js voi käyttää sitä
export const db = getFirestore(app);
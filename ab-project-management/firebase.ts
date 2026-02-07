
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBMSv0goyJgq8UnPpPsronVkT8Qa4bBFUE",
  authDomain: "ab-project-management-381b1.firebaseapp.com",
  projectId: "ab-project-management-381b1",
  storageBucket: "ab-project-management-381b1.firebasestorage.app",
  messagingSenderId: "164293935889",
  appId: "1:164293935889:web:f33a5c55fc4a38892742b0",
  measurementId: "G-8RW48C4ZCG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

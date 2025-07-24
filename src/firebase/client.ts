import { initializeApp } from "firebase/app";
import { firebaseEnv } from "../env";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase client configuration for web app
const firebaseConfig = {
  apiKey: firebaseEnv.apiKey,
  authDomain: firebaseEnv.authDomain || `${firebaseEnv.projectId}.firebaseapp.com`,
  projectId: firebaseEnv.projectId,
  storageBucket: firebaseEnv.storageBucket || `${firebaseEnv.projectId}.appspot.com`,
  messagingSenderId: firebaseEnv.messagingSenderId,
  appId: firebaseEnv.appId,
};

console.log('🔥 Firebase Client Config:', {
  hasApiKey: !!firebaseConfig.apiKey,
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  hasStorageBucket: !!firebaseConfig.storageBucket,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  hasAppId: !!firebaseConfig.appId,
});

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider };
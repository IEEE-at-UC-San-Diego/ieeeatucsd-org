import type { ServiceAccount } from "firebase-admin";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { firebaseEnv } from "../env";
import { getAuth } from 'firebase-admin/auth';

const activeApps = getApps();

const serviceAccount = {
  type: "service_account",
  project_id: firebaseEnv.projectId,
  private_key_id: firebaseEnv.privateKeyId,
  private_key: firebaseEnv.privateKey?.replace(/\\n/g, '\n'), // Fix escaped newlines from env vars
  client_email: firebaseEnv.clientEmail,
  client_id: firebaseEnv.clientId,
  auth_uri: firebaseEnv.authUri,
  token_uri: firebaseEnv.tokenUri,
  auth_provider_x509_cert_url: firebaseEnv.authCertUrl,
  client_x509_cert_url: firebaseEnv.clientCertUrl,
};

const initApp = () => {
  // Check if we're in production (Firebase Functions environment)
  if (firebaseEnv.projectId && !firebaseEnv.privateKey) {
    console.info('Production env detected. Using default service account.');
    // Use default config in firebase functions. Should be already injected in the server by Firebase.
    return initializeApp();
  }
  
  console.info('Loading service account from environment variables.');
  console.log('Service account project ID:', serviceAccount.project_id);
  console.log('Service account client email:', serviceAccount.client_email);
  console.log('Private key available:', !!serviceAccount.private_key);
  
  return initializeApp({
    credential: cert(serviceAccount as ServiceAccount)
  });
};

export const app = activeApps.length === 0 ? initApp() : activeApps[0];

export const adminAuth = getAuth(app);
import type { APIRoute } from 'astro';
import { firebaseEnv, validateFirebaseClientConfig, validateFirebaseServerConfig } from '../../env';

export const GET: APIRoute = async () => {
  try {
    // Validate client-side configuration
    const clientValidation = validateFirebaseClientConfig();
    const serverValidation = validateFirebaseServerConfig();
    
    // Check if any required fields are present
    const hasBasicConfig = !!(firebaseEnv.apiKey || firebaseEnv.projectId);
    
    const response = {
      isValid: clientValidation.isValid,
      hasBasicConfig,
      client: {
        isValid: clientValidation.isValid,
        missing: clientValidation.missing,
        errors: clientValidation.errors,
        fields: {
          apiKey: !!firebaseEnv.apiKey,
          projectId: !!firebaseEnv.projectId,
          authDomain: !!firebaseEnv.authDomain,
          storageBucket: !!firebaseEnv.storageBucket,
          messagingSenderId: !!firebaseEnv.messagingSenderId,
          appId: !!firebaseEnv.appId,
        }
      },
      server: {
        isValid: serverValidation.isValid,
        missing: serverValidation.missing,
        errors: serverValidation.errors,
        fields: {
          privateKey: !!firebaseEnv.privateKey,
          clientEmail: !!firebaseEnv.clientEmail,
          privateKeyId: !!firebaseEnv.privateKeyId,
          clientId: !!firebaseEnv.clientId,
        }
      },
      instructions: {
        setup: [
          "1. Go to the Firebase Console (https://console.firebase.google.com/)",
          "2. Select your project or create a new one",
          "3. Go to Project Settings > General tab",
          "4. Scroll down to 'Your apps' and add a web app if you haven't already",
          "5. Copy the Firebase SDK configuration"
        ],
        webAppConfig: [
          "From the Firebase SDK configuration, set these environment variables:",
          "FIREBASE_API_KEY=your_api_key",
          "FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com",
          "FIREBASE_PROJECT_ID=your_project_id",
          "FIREBASE_STORAGE_BUCKET=your_project.appspot.com",
          "FIREBASE_MESSAGING_SENDER_ID=your_sender_id",
          "FIREBASE_APP_ID=your_app_id"
        ],
        serviceAccount: [
          "For server-side features, you also need a service account:",
          "1. Go to Project Settings > Service accounts",
          "2. Click 'Generate new private key'",
          "3. Download the JSON file",
          "4. Set FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, etc. from the JSON"
        ]
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      instructions: {
        general: [
          "There was an error checking your Firebase configuration.",
          "Please ensure all environment variables are properly set.",
          "Check the console for more detailed error messages."
        ]
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}; 
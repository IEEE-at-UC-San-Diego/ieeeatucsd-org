import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { firebaseEnv, debugEnvVars } from '../../../env';

// Firebase app instance
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

// Initialize Firebase
export function initializeFirebase(): FirebaseApp {
  try {
    // Debug environment variables
    console.log('🔧 Debugging Firebase Environment Variables:');
    debugEnvVars();
    
    // Check if Firebase is already initialized
    if (getApps().length === 0) {
      // Firebase web app configuration
      const firebaseConfig = {
        apiKey: firebaseEnv.apiKey,
        authDomain: firebaseEnv.authDomain || `${firebaseEnv.projectId}.firebaseapp.com`,
        projectId: firebaseEnv.projectId,
        storageBucket: firebaseEnv.storageBucket || `${firebaseEnv.projectId}.appspot.com`,
        messagingSenderId: firebaseEnv.messagingSenderId,
        appId: firebaseEnv.appId,
      };
      
      console.log('🔥 Initializing Firebase with config:', {
        apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
        projectId: firebaseConfig.projectId || 'MISSING',
        authDomain: firebaseConfig.authDomain || 'MISSING',
        hasStorageBucket: !!firebaseConfig.storageBucket,
        hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
        hasAppId: !!firebaseConfig.appId,
      });
      
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        throw new Error('Missing required Firebase configuration: API key and project ID are required');
      }
      
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase app initialized successfully');
    } else {
      app = getApp();
      console.log('♻️ Using existing Firebase app');
    }
    
    db = getFirestore(app);
    auth = getAuth(app);
    
    return app;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw error;
  }
}

// Firebase test operations
export class FirebaseTestService {
  private static instance: FirebaseTestService;
  
  static getInstance(): FirebaseTestService {
    if (!FirebaseTestService.instance) {
      FirebaseTestService.instance = new FirebaseTestService();
    }
    return FirebaseTestService.instance;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!app) {
        initializeFirebase();
      }
      
      // Try to read from the test collection
      const testCollection = collection(db, 'test');
      await getDocs(testCollection);
      
      return {
        success: true,
        message: 'Successfully connected to Firebase'
      };
    } catch (error) {
      console.error('Firebase connection test failed:', error);
      return {
        success: false,
        message: `Firebase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async createTestDocument(data: { name: string; value: string }): Promise<{ success: boolean; message: string; id?: string }> {
    try {
      if (!db) {
        initializeFirebase();
      }
      
      const testId = `test_${Date.now()}`;
      const testDoc = doc(db, 'test', testId);
      
      await setDoc(testDoc, {
        ...data,
        timestamp: new Date(),
        createdBy: 'dashboard-test'
      });
      
      return {
        success: true,
        message: 'Test document created successfully',
        id: testId
      };
    } catch (error) {
      console.error('Create test document failed:', error);
      return {
        success: false,
        message: `Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async readTestDocument(id: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!db) {
        initializeFirebase();
      }
      
      const testDoc = doc(db, 'test', id);
      const docSnap = await getDoc(testDoc);
      
      if (docSnap.exists()) {
        return {
          success: true,
          message: 'Document retrieved successfully',
          data: docSnap.data()
        };
      } else {
        return {
          success: false,
          message: 'Document not found'
        };
      }
    } catch (error) {
      console.error('Read test document failed:', error);
      return {
        success: false,
        message: `Failed to read document: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async deleteTestDocument(id: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!db) {
        initializeFirebase();
      }
      
      const testDoc = doc(db, 'test', id);
      await deleteDoc(testDoc);
      
      return {
        success: true,
        message: 'Document deleted successfully'
      };
    } catch (error) {
      console.error('Delete test document failed:', error);
      return {
        success: false,
        message: `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getAllTestDocuments(): Promise<{ success: boolean; message: string; data?: any[] }> {
    try {
      if (!db) {
        initializeFirebase();
      }
      
      const testCollection = collection(db, 'test');
      const querySnapshot = await getDocs(testCollection);
      
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        success: true,
        message: `Retrieved ${documents.length} documents`,
        data: documents
      };
    } catch (error) {
      console.error('Get all test documents failed:', error);
      return {
        success: false,
        message: `Failed to retrieve documents: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export initialized services
export { app, db, auth }; 
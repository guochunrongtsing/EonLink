import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, doc, getDocFromServer } from 'firebase/firestore';

export let db: any = null;
export let auth: any = null;
let initPromise: Promise<void> | null = null;

export async function getFirebase() {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      // @ts-ignore
      const firebaseConfig = await import('../../firebase-applet-config.json');
      const app = initializeApp(firebaseConfig.default);
      db = getFirestore(app, firebaseConfig.default.firestoreDatabaseId);
      auth = getAuth(app);
      console.log("Firebase initialized successfully.");
    } catch (e) {
      console.warn("Firebase config not found or initialization failed. Database features disabled.");
    }
  })();
  
  return initPromise;
}

// Start initialization immediately
getFirebase();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function fetchSkills() {
  await getFirebase();
  const path = 'skills';
  if (!db) return [];
  try {
    const q = query(collection(db, path));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function logTask(task: any) {
  await getFirebase();
  const path = 'tasks';
  if (!db || !auth?.currentUser) return;
  try {
    await addDoc(collection(db, path), {
      ...task,
      ownerId: auth.currentUser.uid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

async function testConnection() {
  await getFirebase();
  if (!db) return;
  try {
    // Attempt a lightweight server-side fetch to verify connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.warn("Firestore is currently unreachable. The app will operate in offline mode.");
      console.info("If this is a new project, please ensure you have provisioned the database using the 'set_up_firebase' tool.");
    }
  }
}
testConnection();

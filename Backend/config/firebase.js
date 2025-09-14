// Backend/config/firebase.js
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

let firebaseInitialized = false;

export const initializeFirebase = () => {
  if (firebaseInitialized || admin.apps.length > 0) {
    return;
  }

  try {
    // Try to load service account key from multiple possible locations
    const possiblePaths = [
      path.join(process.cwd(), 'config', 'serviceAccountKey.json'),
      path.join(process.cwd(), 'Backend', 'config', 'serviceAccountKey.json'),
      path.join(process.cwd(), 'serviceAccountKey.json'),
      path.join(process.cwd(), 'Backend', 'serviceAccountKey.json'),
    ];

    let serviceAccountPath = null;
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        serviceAccountPath = filePath;
        break;
      }
    }

    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized successfully');
    } else {
      console.log('⚠️  Firebase service account key not found. FCM notifications will not work.');
      console.log('Please add serviceAccountKey.json to one of these locations:');
      possiblePaths.forEach(path => console.log(`  - ${path}`));
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    console.log('Please check your serviceAccountKey.json file format');
  }
};

export const isFirebaseInitialized = () => {
  return firebaseInitialized && admin.apps.length > 0;
};

export { admin };

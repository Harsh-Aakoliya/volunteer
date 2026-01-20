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
    const serviceAccountPath =
      path.join(process.cwd(), 'serviceAccountKey.json');
      console.log("serviceAccountPath",serviceAccountPath);

    if(!fs.existsSync(serviceAccountPath)){
      console.log('⚠️  Firebase service account key not found. FCM notifications will not work.');
      console.log(`Please add serviceAccountKey.json to the following location: ${serviceAccountPath}`);
      return;
    }

    const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountContent);
    
    // Validate required fields
    if (!serviceAccount.private_key || !serviceAccount.client_email || !serviceAccount.project_id) {
      throw new Error('Invalid service account key: missing required fields (private_key, client_email, or project_id)');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully');
    console.log(`   Project ID: ${serviceAccount.project_id}`);
    console.log(`   Client Email: ${serviceAccount.client_email}`);
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    if (error.message.includes('Invalid JWT Signature') || error.message.includes('invalid_grant')) {
      console.error('\n🔧 FIX REQUIRED:');
      console.error('   1. Your Firebase service account key may have been revoked or expired.');
      console.error('   2. Go to Firebase Console: https://console.firebase.google.com/');
      console.error('   3. Navigate to: Project Settings > Service Accounts');
      console.error('   4. Click "Generate new private key"');
      console.error('   5. Download the new JSON file and replace serviceAccountKey.json');
      console.error('   6. Restart your server\n');
    } else {
      console.log('Please check your serviceAccountKey.json file format');
    }
  }
};

export const isFirebaseInitialized = () => {
  return firebaseInitialized && admin.apps.length > 0;
};

export { admin };

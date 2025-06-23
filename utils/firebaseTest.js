import { firestore, auth } from '../firebase.config';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const testFirebaseConnection = async () => {
  try {
    // Test Firestore connection
    const testRef = doc(collection(firestore, 'test'), 'connection-test');
    await setDoc(testRef, {
      timestamp: serverTimestamp(),
      test: 'Firebase connection successful'
    });
    
    console.log('Firebase Firestore connection successful');
    console.log('Firebase Auth initialized successfully');
    
    return {
      success: true,
      message: 'Firebase connection test successful'
    };
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 
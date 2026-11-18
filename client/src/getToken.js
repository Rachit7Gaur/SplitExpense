import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const unsubscribe = onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log('No logged-in Firebase user. Please log in first.');
    return;
  }

  try {
    const token = await user.getIdToken();
    console.log('Firebase ID Token:', token);
  } catch (error) {
    console.error('Token error:', error);
  } finally {
    unsubscribe();
  }
});
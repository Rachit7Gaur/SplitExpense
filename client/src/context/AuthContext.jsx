import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { onIdTokenChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import API_BASE_URL from '../config/api';

import AuthContext from './AuthContext';



export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileSynced, setProfileSynced] = useState(false);

  // Prevent older async requests from overwriting newer auth state.
  const requestId = useRef(0);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      const currentRequest = ++requestId.current;

      setUser(currentUser);
      setProfileError('');
      setProfileSynced(false);
      setAuthLoading(true);

      try {
        // User is logged out.
        if (!currentUser) {
          return;
        }

        // Do not sync incomplete or unverified profiles.
        if (!currentUser.email || !currentUser.emailVerified) {
          return;
        }

        const token = await currentUser.getIdToken();

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message || 'Could not synchronize your profile.'
          );
        }

        if (currentRequest === requestId.current) {
          setProfileSynced(true);
        }
      } catch (error) {
        if (currentRequest === requestId.current) {
          setProfileError(
            error.message === 'Failed to fetch'
              ? 'Cannot reach the backend. Make sure the server is running.'
              : error.message
          );
        }
      } finally {
        if (currentRequest === requestId.current) {
          setAuthLoading(false);
        }
      }
    });

    return () => {
      requestId.current += 1;
      unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    setProfileError('');
    setProfileSynced(false);

    try {
      await signOut(auth);
    } catch (error) {
      setProfileError(error.message || 'Could not log out.');
      throw error;
    }
  }, []);

  const clearProfileError = useCallback(() => {
    setProfileError('');
  }, []);

  const value = {
    user,
    authLoading,
    profileError,
    profileSynced,
    logout,
    clearProfileError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
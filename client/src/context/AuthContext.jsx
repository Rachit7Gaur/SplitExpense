
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;

      setUser(currentUser);
      setProfileError('');
      setAuthLoading(true);

      try {
        if (currentUser) {
          const token = await currentUser.getIdToken();

          const response = await fetch(
            'http://localhost:5000/api/auth/me',
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.message || 'Could not sync your profile.'
            );
          }
        }
      } catch (error) {
        if (isMounted) {
          setProfileError(
            error.message === 'Failed to fetch'
              ? 'Cannot reach the backend. Make sure the server is running.'
              : error.message
          );
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function logout() {
    await signOut(auth);
  }

  const value = {
    user,
    authLoading,
    profileError,
    logout,
    clearProfileError: () => setProfileError(''),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}

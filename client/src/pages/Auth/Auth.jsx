
import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

function Auth() {
  const { user, authLoading } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const redirectTo = location.state?.from?.pathname || '/groups';

  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Wait for Firebase to restore the user's session.
  if (authLoading) {
    return <p>Checking your session...</p>;
  }

  // Redirect users who are already logged in.
  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (mode === 'signup' && name.trim().length < 2) {
      setError('Name must contain at least 2 characters.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await updateProfile(credential.user, {
          displayName: name.trim(),
        });
      } else {
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
      }

      setPassword('');

      // Return to the originally requested page.
      navigate(redirectTo, { replace: true });

    } catch (err) {
      const messages = {
        'auth/email-already-in-use':
          'An account already exists with this email.',
        'auth/invalid-email':
          'Please enter a valid email address.',
        'auth/invalid-credential':
          'Incorrect email or password.',
        'auth/weak-password':
          'Choose a stronger password.',
        'auth/too-many-requests':
          'Too many attempts. Please try again later.',
        'auth/network-request-failed':
          'Network error. Check your internet connection.',
      };

      setError(
        messages[err.code] ||
        'Authentication failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    setPassword('');
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">S</div>

        <p className="eyebrow">SPLITEXPENSE</p>

        <h1>
          {mode === 'signup'
            ? 'Split expenses, not friendships.'
            : 'Welcome back.'}
        </h1>

        <p className="subtitle">
          {mode === 'signup'
            ? 'Create an account to start sharing group expenses.'
            : 'Log in to continue managing your shared expenses.'}
        </p>

        <div className="mode-switch">
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => changeMode('signup')}
          >
            Sign up
          </button>

          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => changeMode('login')}
          >
            Log in
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label>
              Full name
              <input
                type="text"
                autoComplete="name"
                placeholder="Enter your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={80}
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete={
                mode === 'signup'
                  ? 'new-password'
                  : 'current-password'
              }
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              maxLength={128}
              required
            />
          </label>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : mode === 'signup'
                ? 'Create account'
                : 'Log in'}
          </button>
        </form>

        <p className="security-note">
          Your account is secured by Firebase Authentication.
        </p>
      </section>
    </main>
  );
}

export default Auth;

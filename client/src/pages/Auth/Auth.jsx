
import { useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  EmailAuthProvider,
  linkWithCredential,
  reload,
} from 'firebase/auth';

import { Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

const googleProvider = new GoogleAuthProvider();

function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authLoading } = useAuth();

  const redirectTo = location.state?.from?.pathname || '/groups';

  const [mode, setMode] = useState('signup');
  const [authMethod, setAuthMethod] = useState('email');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneName, setPhoneName] = useState('');
  const [phoneEmail, setPhoneEmail] = useState('');
  const [phonePassword, setPhonePassword] = useState('');
  const [showPhonePassword, setShowPhonePassword] = useState(false);
  const [phoneStep, setPhoneStep] = useState('phone');

  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const recaptchaRef = useRef(null);
  const phoneFlowActiveRef = useRef(false);

  // Restore an interrupted phone-only profile completion flow.
  useEffect(() => {
    if (authLoading || !user) return;

    if (!user.email) {
      phoneFlowActiveRef.current = true;
      setAuthMethod('phone');
      setPhoneStep('profile');
    }
  }, [user, authLoading]);

  // Clear reCAPTCHA when the component unmounts.
  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    };
  }, []);

  function clearRecaptcha() {
    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
      recaptchaRef.current = null;
    }
  }

  function changeAuthMethod(method) {
    setError('');
    setResetMessage('');
    setAuthMethod(method);

    if (method === 'email') {
      phoneFlowActiveRef.current = false;
      setPhoneStep('phone');
      setConfirmation(null);
      clearRecaptcha();
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setError('');
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

        await sendEmailVerification(credential.user);

        navigate('/verify-email', { replace: true });
      } else {
        const credential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await reload(credential.user);

        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          navigate('/verify-email', { replace: true });
          return;
        }

        await credential.user.getIdToken(true);
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    setError('');
    setResetMessage('');

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError('Password reset ke liye pehle email address enter karo.');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);

      setResetMessage(
        'If an account exists with this email, a password reset link has been sent. Check your inbox and spam folder.'
      );
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await reload(result.user);

      if (!result.user.email) {
        throw new Error('Google account se email address nahi mila.');
      }

      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user);
        navigate('/verify-email', { replace: true });
        return;
      }

      await result.user.getIdToken(true);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      setError('Valid phone number enter karo, country code ke saath. Example: +919876543210');
      setLoading(false);
      return;
    }

    try {
      clearRecaptcha();

      phoneFlowActiveRef.current = true;

      recaptchaRef.current = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        { size: 'invisible' }
      );

      const result = await signInWithPhoneNumber(
        auth,
        phone.trim(),
        recaptchaRef.current
      );

      setConfirmation(result);
      setPhoneStep('otp');
    } catch (err) {
      clearRecaptcha();
      phoneFlowActiveRef.current = false;
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault();
    setError('');

    if (!confirmation) {
      setError('Pehle OTP request karo.');
      return;
    }

    setLoading(true);
    phoneFlowActiveRef.current = true;

    try {
      const result = await confirmation.confirm(otp.trim());
      const currentUser = result.user;

      await reload(currentUser);

      // Existing phone account with a verified email.
      if (currentUser.email && currentUser.emailVerified) {
        await currentUser.getIdToken(true);
        phoneFlowActiveRef.current = false;
        navigate(redirectTo, { replace: true });
        return;
      }

      // Existing phone account with an unverified email.
      if (currentUser.email && !currentUser.emailVerified) {
        await sendEmailVerification(currentUser);
        phoneFlowActiveRef.current = false;
        navigate('/verify-email', { replace: true });
        return;
      }

      // New phone-only account: collect email and password.
      setPhoneStep('profile');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCompletePhoneProfile(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('Session expire ho gaya. Dobara phone verification karo.');
      }

      if (!phoneName.trim() || phoneName.trim().length < 2) {
        throw new Error('Name kam se kam 2 characters ka hona chahiye.');
      }

      if (phonePassword.length < 6) {
        throw new Error('Password kam se kam 6 characters ka hona chahiye.');
      }

      const emailCredential = EmailAuthProvider.credential(
        phoneEmail.trim(),
        phonePassword
      );

      // Link email/password to the existing phone UID.
      // This keeps one Firebase account for both login methods.
      await linkWithCredential(currentUser, emailCredential);

      await updateProfile(currentUser, {
        displayName: phoneName.trim(),
      });

      await reload(currentUser);
      await sendEmailVerification(currentUser);

      phoneFlowActiveRef.current = false;
      navigate('/verify-email', { replace: true });
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError(
          'Ye email kisi doosre account se linked hai. Us account mein login karke phone number link karna hoga. Accounts ko automatically merge nahi kiya ja sakta.'
        );
      } else {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  function getAuthErrorMessage(err) {
    const messages = {
      'auth/email-already-in-use': 'Ye email pehle se registered hai.',
      'auth/invalid-email': 'Valid email address enter karo.',
      'auth/weak-password': 'Password kam se kam 6 characters ka hona chahiye.',
      'auth/user-not-found': 'Is email se koi account nahi mila.',
      'auth/wrong-password': 'Password incorrect hai.',
      'auth/invalid-credential': 'Email ya password incorrect hai.',
      'auth/too-many-requests': 'Bahut attempts ho chuke hain. Thodi der baad try karo.',
      'auth/invalid-phone-number': 'Phone number valid nahi hai.',
      'auth/invalid-verification-code': 'OTP incorrect hai.',
      'auth/code-expired': 'OTP expire ho gaya. Naya OTP request karo.',
      'auth/popup-closed-by-user': 'Google sign-in window close kar di gayi.',
      'auth/operation-not-allowed': 'Ye sign-in method Firebase Console mein enabled nahi hai.',
      'auth/billing-not-enabled': 'Firebase phone authentication ke liye billing configuration required hai. Development mein Firebase test phone numbers use karo.',
      'auth/credential-already-in-use': 'Ye credential kisi doosre account se linked hai.',
    };

    return messages[err.code] || err.message || 'Something went wrong. Dobara try karo.';
  }

  if (authLoading) {
    return (
      <div className="auth-loading">
        <p>Loading...</p>
      </div>
    );
  }

  // Redirect only users whose email is verified.
  // Phone-only users must remain here to complete their profile.
  if (user?.email && user.emailVerified && !phoneFlowActiveRef.current) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <Link to="/" className="auth-brand">
          <span className="auth-brand-icon">◐</span>
          <span>EquiSplit</span>
        </Link>

        <div className="auth-brand-content">
          <span className="auth-brand-eyebrow">
            SHARED EXPENSES, SIMPLIFIED
          </span>

          <h1>
            Good times
            <br />
            shouldn't come
            <br />
            with complicated
            <br />
            calculations.
          </h1>

          <p>
            Keep track of shared expenses, understand balances
            and settle up without the awkward conversations.
          </p>

          <div className="auth-preview-card">
            <div className="auth-preview-header">
              <div>
                <span className="auth-preview-label">YOUR GROUP</span>
                <h3>Goa Trip</h3>
              </div>

              <span className="auth-preview-status">Active</span>
            </div>

            <div className="auth-preview-balance">
              <span>Total group expenses</span>
              <strong>₹12,450</strong>
            </div>

            <div className="auth-preview-divider" />

            <div className="auth-preview-person">
              <div className="auth-avatar avatar-one">A</div>
              <span>Aarav owes you</span>
              <strong className="auth-positive">₹1,800</strong>
            </div>

            <div className="auth-preview-person">
              <div className="auth-avatar avatar-two">M</div>
              <span>Meera owes you</span>
              <strong className="auth-positive">₹2,100</strong>
            </div>

            <div className="auth-preview-person">
              <div className="auth-avatar avatar-three">K</div>
              <span>You owe Kabir</span>
              <strong className="auth-negative">₹450</strong>
            </div>
          </div>
        </div>

        <p className="auth-brand-footer">
          Less calculating. More living.
        </p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-mode-switch">
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => {
                setMode('signup');
                setError('');
                setResetMessage('');
              }}
            >
              Sign up
            </button>

            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setError('');
                setResetMessage('');
              }}
            >
              Log in
            </button>
          </div>

          <h2>
            {authMethod === 'phone'
              ? phoneStep === 'phone'
                ? 'Continue with phone'
                : phoneStep === 'otp'
                  ? 'Verify your phone'
                  : 'Complete your profile'
              : mode === 'signup'
                ? 'Create your account'
                : 'Welcome back'}
          </h2>

          <p className="auth-form-subtitle">
            {authMethod === 'phone'
              ? 'Use your phone number to securely access EquiSplit.'
              : mode === 'signup'
                ? 'Start splitting expenses with your group.'
                : 'Log in to manage your shared expenses.'}
          </p>

          {error && <div className="auth-error">{error}</div>}

          {resetMessage && (
            <div className="auth-success" role="status">
              {resetMessage}
            </div>
          )}

          {authMethod === 'email' ? (
            <>
              <form className="auth-form" onSubmit={handleEmailSubmit}>
                {mode === 'signup' && (
                  <div className="auth-field">
                    <label htmlFor="name">Full name</label>
                    <input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      minLength={2}
                      required
                    />
                  </div>
                )}

                <div className="auth-field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="password">Password</label>

                  <div className="auth-password-input">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                    />

                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((previous) => !previous)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {mode === 'login' && (
                    <div className="auth-forgot-password">
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={loading}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading
                    ? 'Please wait...'
                    : mode === 'signup'
                      ? 'Create account'
                      : 'Log in'}
                </button>
              </form>

              <div className="auth-divider">
                <span>OR</span>
              </div>

              <button
                type="button"
                className="google-signin-btn"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                Continue with Google
              </button>

              <button
                type="button"
                className="phone-signin-btn"
                onClick={() => changeAuthMethod('phone')}
                disabled={loading}
              >
                Continue with phone
              </button>
            </>
          ) : (
            <div className="auth-form">
              {phoneStep === 'phone' && (
                <form onSubmit={handleSendOtp}>
                  <div className="auth-field">
                    <label htmlFor="phone">Phone number</label>
                    <input
                      id="phone"
                      type="tel"
                      placeholder="+919876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loading}
                  >
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              )}

              {phoneStep === 'otp' && (
                <form onSubmit={handleVerifyOtp}>
                  <div className="auth-field">
                    <label htmlFor="otp">Verification code</label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loading}
                  >
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>

                  <button
                    type="button"
                    className="auth-back-btn"
                    onClick={() => {
                      setPhoneStep('phone');
                      setOtp('');
                      setConfirmation(null);
                      clearRecaptcha();
                    }}
                  >
                    Change phone number
                  </button>
                </form>
              )}

              {phoneStep === 'profile' && (
                <form onSubmit={handleCompletePhoneProfile}>
                  <div className="auth-field">
                    <label htmlFor="phoneName">Full name</label>
                    <input
                      id="phoneName"
                      type="text"
                      placeholder="Enter your name"
                      value={phoneName}
                      onChange={(e) => setPhoneName(e.target.value)}
                      minLength={2}
                      required
                    />
                  </div>

                  <div className="auth-field">
                    <label htmlFor="phoneEmail">Email address</label>
                    <input
                      id="phoneEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={phoneEmail}
                      onChange={(e) => setPhoneEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="auth-field">
                    <label htmlFor="phonePassword">Create password</label>

                    <div className="auth-password-input">
                      <input
                        id="phonePassword"
                        type={showPhonePassword ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={phonePassword}
                        onChange={(e) => setPhonePassword(e.target.value)}
                        minLength={6}
                        autoComplete="new-password"
                        required
                      />

                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowPhonePassword((previous) => !previous)}
                        aria-label={showPhonePassword ? 'Hide password' : 'Show password'}
                      >
                        {showPhonePassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loading}
                  >
                    {loading ? 'Creating profile...' : 'Complete profile'}
                  </button>
                </form>
              )}

              <button
                type="button"
                className="auth-back-btn"
                onClick={() => changeAuthMethod('email')}
              >
                Back to email login
              </button>
            </div>
          )}

          <div id="recaptcha-container" />

          <p className="auth-switch-text">
            {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'login' : 'signup');
                setError('');
                setResetMessage('');
              }}
            >
              {mode === 'signup' ? 'Log in' : 'Sign up'}
            </button>
          </p>

          <p className="auth-terms">
            By continuing, you agree to our terms and privacy policy.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Auth;

// import { useEffect, useRef, useState } from 'react';

// import {
//   createUserWithEmailAndPassword,
//   signInWithEmailAndPassword,
//   updateProfile,
//   GoogleAuthProvider,
//   signInWithPopup,
//   sendEmailVerification,
//   RecaptchaVerifier,
//   signInWithPhoneNumber,
//   EmailAuthProvider,
//   linkWithCredential,
// } from 'firebase/auth';

// import {
//   Navigate,
//   useLocation,
//   useNavigate,
//   Link,
// } from 'react-router-dom';

// import { auth } from '../../firebase';
// import { useAuth } from '../../context/AuthContext';

// import './Auth.css';

// const googleProvider = new GoogleAuthProvider();

// function Auth() {
//   const { user, authLoading } = useAuth();

//   const location = useLocation();
//   const navigate = useNavigate();

//   const redirectTo = location.state?.from?.pathname || '/groups';

//   const [mode, setMode] = useState('signup');
//   const [authMethod, setAuthMethod] = useState('email');

//   const [name, setName] = useState('');
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');

//   const [phone, setPhone] = useState('');
//   const [otp, setOtp] = useState('');
//   const [phoneName, setPhoneName] = useState('');
//   const [phoneEmail, setPhoneEmail] = useState('');
//   const [phonePassword, setPhonePassword] = useState('');

//   const [phoneStep, setPhoneStep] = useState('phone');
//   const [confirmation, setConfirmation] = useState(null);

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');

//   const recaptchaRef = useRef(null);
//   const phoneFlowActiveRef = useRef(false);

//   useEffect(() => {
//     return () => {
//       if (recaptchaRef.current) {
//         recaptchaRef.current.clear();
//         recaptchaRef.current = null;
//       }
//     };
//   }, []);

//   // Keep the user on this page while completing phone signup.
//   if (user && !phoneFlowActiveRef.current) {
//     return <Navigate to={redirectTo} replace />;
//   }

//   if (authLoading) {
//     return (
//       <main className="auth-loading">
//         <div className="auth-spinner" />
//         <p>Checking your session...</p>
//       </main>
//     );
//   }

//   function getFirebaseErrorMessage(err) {
//     const messages = {
//       'auth/email-already-in-use':
//         'An account already exists with this email.',
//       'auth/invalid-email':
//         'Please enter a valid email address.',
//       'auth/invalid-credential':
//         'Incorrect email or password.',
//       'auth/weak-password':
//         'Choose a stronger password.',
//       'auth/too-many-requests':
//         'Too many attempts. Please try again later.',
//       'auth/network-request-failed':
//         'Network error. Check your internet connection.',
//       'auth/popup-closed-by-user':
//         'Google sign-in was cancelled.',
//       'auth/popup-blocked':
//         'Your browser blocked the Google sign-in popup.',
//       'auth/account-exists-with-different-credential':
//         'An account already exists with this email using another sign-in method.',
//       'auth/unauthorized-domain':
//         'This domain is not authorized for Firebase authentication.',
//       'auth/operation-not-allowed':
//         'This sign-in method is not enabled in Firebase.',
//       'auth/invalid-verification-code':
//         'Incorrect OTP. Please try again.',
//       'auth/code-expired':
//         'The OTP has expired. Please request a new one.',
//       'auth/credential-already-in-use':
//         'This email is already linked to another account. Please log in using that account.',
//       'auth/provider-already-linked':
//         'This sign-in method is already linked to your account.',
//     };

//     return messages[err.code] || err.message ||
//       'Something went wrong. Please try again.';
//   }

//   async function handleSubmit(event) {
//     event.preventDefault();
//     setError('');

//     if (mode === 'signup' && name.trim().length < 2) {
//       setError('Name must contain at least 2 characters.');
//       return;
//     }

//     setLoading(true);

//     try {
//       const normalizedEmail = email.trim().toLowerCase();

//       if (mode === 'signup') {
//         const credential = await createUserWithEmailAndPassword(
//           auth,
//           normalizedEmail,
//           password
//         );

//         await updateProfile(credential.user, {
//           displayName: name.trim(),
//         });

//         await sendEmailVerification(credential.user);

//         navigate('/verify-email', { replace: true });
//         return;
//       }

//       await signInWithEmailAndPassword(
//         auth,
//         normalizedEmail,
//         password
//       );

//       setPassword('');
//       navigate(redirectTo, { replace: true });
//     } catch (err) {
//       setError(getFirebaseErrorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function handleGoogleSignIn() {
//     setError('');
//     setLoading(true);

//     try {
//       await signInWithPopup(auth, googleProvider);
//       navigate(redirectTo, { replace: true });
//     } catch (err) {
//       setError(getFirebaseErrorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function handleSendOtp() {
//     setError('');

//     const formattedPhone = phone.trim();

//     if (!/^\+[1-9]\d{7,14}$/.test(formattedPhone)) {
//       setError('Enter phone number with country code, e.g. +919876543210.');
//       return;
//     }

//     setLoading(true);

//     phoneFlowActiveRef.current = true;

//     try {
//       if (!recaptchaRef.current) {
//         recaptchaRef.current = new RecaptchaVerifier(
//           auth,
//           'recaptcha-container',
//           { size: 'invisible' }
//         );
//       }

//       const result = await signInWithPhoneNumber(
//         auth,
//         formattedPhone,
//         recaptchaRef.current
//       );

//       setConfirmation(result);
//       setPhoneStep('otp');
//     } catch (err) {
//       setError(getFirebaseErrorMessage(err));

//       if (recaptchaRef.current) {
//         recaptchaRef.current.clear();
//         recaptchaRef.current = null;
//       }
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function handleVerifyOtp() {
//     setError('');

//     if (!confirmation) {
//       setError('Please request an OTP first.');
//       return;
//     }

//     if (!/^\d{6}$/.test(otp.trim())) {
//       setError('Enter the 6-digit OTP.');
//       return;
//     }

//     setLoading(true);
//     phoneFlowActiveRef.current = true;

//     try {
//       const result = await confirmation.confirm(otp.trim());
//       const currentUser = result.user;

//       // Existing phone account with verified email.
//       if (currentUser.email && currentUser.emailVerified) {
//         phoneFlowActiveRef.current = false;
//         navigate(redirectTo, { replace: true });
//         return;
//       }

//       // Existing account with an unverified email.
//       if (currentUser.email && !currentUser.emailVerified) {
//         await sendEmailVerification(currentUser);
//         phoneFlowActiveRef.current = false;
//         navigate('/verify-email', { replace: true });
//         return;
//       }

//       // New phone-only account: collect profile details.
//       setPhoneStep('profile');
//     } catch (err) {
//       phoneFlowActiveRef.current = false;
//       setError(getFirebaseErrorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function handlePhoneProfile() {
//     setError('');

//     if (phoneName.trim().length < 2) {
//       setError('Name must contain at least 2 characters.');
//       return;
//     }

//     if (phonePassword.length < 6) {
//       setError('Password must contain at least 6 characters.');
//       return;
//     }

//     setLoading(true);

//     try {
//       const currentUser = auth.currentUser;

//       if (!currentUser) {
//         throw new Error('Your phone session expired. Please verify again.');
//       }

//       const normalizedEmail = phoneEmail.trim().toLowerCase();

//       if (!normalizedEmail) {
//         throw new Error('Please enter your email address.');
//       }

//       // Link email/password to the existing phone account.
//       // This keeps both methods under the same Firebase UID.
//       const emailCredential = EmailAuthProvider.credential(
//         normalizedEmail,
//         phonePassword
//       );

//       await linkWithCredential(currentUser, emailCredential);

//       await updateProfile(currentUser, {
//         displayName: phoneName.trim(),
//       });

//       await sendEmailVerification(currentUser);

//       phoneFlowActiveRef.current = false;
//       navigate('/verify-email', { replace: true });
//     } catch (err) {
//       setError(getFirebaseErrorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   }

//   function changeMode(nextMode) {
//     setMode(nextMode);
//     setAuthMethod('email');
//     setError('');
//     setPassword('');
//   }

//   function changeAuthMethod(nextMethod) {
//   setAuthMethod(nextMethod);
//   setError('');

//   if (nextMethod === 'phone') {
//     phoneFlowActiveRef.current = true;
//     setPhoneStep('phone');
//   } else {
//     phoneFlowActiveRef.current = false;
//   }
// }

//   return (
//     <main className="auth-page">

//       {/* Left branding panel */}
      // <section className="auth-brand-panel">
      //   <Link to="/" className="auth-brand">
      //     <span className="auth-brand-icon">◐</span>
      //     <span>EquiSplit</span>
      //   </Link>

      //   <div className="auth-brand-content">
      //     <span className="auth-brand-eyebrow">
      //       SHARED EXPENSES, SIMPLIFIED
      //     </span>

      //     <h1>
      //       Good times
      //       <br />
      //       shouldn't come
      //       <br />
      //       with complicated
      //       <br />
      //       calculations.
      //     </h1>

      //     <p>
      //       Keep track of shared expenses, understand balances
      //       and settle up without the awkward conversations.
      //     </p>

      //     <div className="auth-preview-card">
      //       <div className="auth-preview-header">
      //         <div>
      //           <span className="auth-preview-label">YOUR GROUP</span>
      //           <h3>Goa Trip</h3>
      //         </div>

      //         <span className="auth-preview-status">Active</span>
      //       </div>

      //       <div className="auth-preview-balance">
      //         <span>Total group expenses</span>
      //         <strong>₹12,450</strong>
      //       </div>

      //       <div className="auth-preview-divider" />

      //       <div className="auth-preview-person">
      //         <div className="auth-avatar avatar-one">A</div>
      //         <span>Aarav owes you</span>
      //         <strong className="auth-positive">₹1,800</strong>
      //       </div>

      //       <div className="auth-preview-person">
      //         <div className="auth-avatar avatar-two">M</div>
      //         <span>Meera owes you</span>
      //         <strong className="auth-positive">₹2,100</strong>
      //       </div>

      //       <div className="auth-preview-person">
      //         <div className="auth-avatar avatar-three">K</div>
      //         <span>You owe Kabir</span>
      //         <strong className="auth-negative">₹450</strong>
      //       </div>
      //     </div>
      //   </div>

      //   <p className="auth-brand-footer">
      //     Less calculating. More living.
      //   </p>
      // </section>

//       {/* Right authentication panel */}
//       <section className="auth-form-panel">
//         <div className="auth-form-container">

//           <Link to="/" className="auth-mobile-brand">
//             <span className="auth-brand-icon">◐</span>
//             EquiSplit
//           </Link>

//           <div className="auth-heading">
//             <span className="auth-form-eyebrow">
//               {mode === 'signup' ? 'GET STARTED' : 'WELCOME BACK'}
//             </span>

//             <h2>
//               {mode === 'signup'
//                 ? 'Create your account'
//                 : 'Welcome back'}
//             </h2>

//             <p>
//               {mode === 'signup'
//                 ? 'Start managing shared expenses with ease.'
//                 : 'Log in to continue managing your expenses.'}
//             </p>
//           </div>

//           <div className="auth-mode-switch">
//             <button
//               type="button"
//               className={mode === 'signup' ? 'active' : ''}
//               onClick={() => changeMode('signup')}
//             >
//               Sign up
//             </button>

//             <button
//               type="button"
//               className={mode === 'login' ? 'active' : ''}
//               onClick={() => changeMode('login')}
//             >
//               Log in
//             </button>
//           </div>

//           {authMethod === 'email' && (
//             <form className="auth-form" onSubmit={handleSubmit}>
//               {mode === 'signup' && (
//                 <label className="auth-field">
//                   <span>Full name</span>
//                   <input
//                     type="text"
//                     autoComplete="name"
//                     placeholder="Enter your full name"
//                     value={name}
//                     onChange={(event) => setName(event.target.value)}
//                     minLength={2}
//                     maxLength={80}
//                     required
//                   />
//                 </label>
//               )}

//               <label className="auth-field">
//                 <span>Email address</span>
//                 <input
//                   type="email"
//                   autoComplete="email"
//                   placeholder="you@example.com"
//                   value={email}
//                   onChange={(event) => setEmail(event.target.value)}
//                   maxLength={254}
//                   required
//                 />
//               </label>

//               <label className="auth-field">
//                 <span>Password</span>
//                 <input
//                   type="password"
//                   autoComplete={
//                     mode === 'signup'
//                       ? 'new-password'
//                       : 'current-password'
//                   }
//                   placeholder="Enter your password"
//                   value={password}
//                   onChange={(event) => setPassword(event.target.value)}
//                   minLength={6}
//                   maxLength={128}
//                   required
//                 />
//               </label>

//               {error && (
//                 <p className="auth-error" role="alert">
//                   {error}
//                 </p>
//               )}

//               <button
//                 className="auth-submit-btn"
//                 type="submit"
//                 disabled={loading}
//               >
//                 {loading
//                   ? 'Please wait...'
//                   : mode === 'signup'
//                     ? 'Create account'
//                     : 'Log in'}

//                 {!loading && <span>→</span>}
//               </button>
//             </form>
//           )}

//           {authMethod === 'phone' && (
//             <div className="auth-form">

//               {phoneStep === 'phone' && (
//                 <>
//                   <label className="auth-field">
//                     <span>Phone number with country code</span>
//                     <input
//                       type="tel"
//                       autoComplete="tel"
//                       placeholder="+919876543210"
//                       value={phone}
//                       onChange={(event) => setPhone(event.target.value)}
//                     />
//                   </label>

//                   <button
//                     type="button"
//                     className="auth-submit-btn"
//                     onClick={handleSendOtp}
//                     disabled={loading}
//                   >
//                     {loading ? 'Sending OTP...' : 'Send OTP'}
//                   </button>
//                 </>
//               )}

//               {phoneStep === 'otp' && (
//                 <>
//                   <label className="auth-field">
//                     <span>Enter verification code</span>
//                     <input
//                       type="text"
//                       inputMode="numeric"
//                       autoComplete="one-time-code"
//                       maxLength={6}
//                       placeholder="6-digit OTP"
//                       value={otp}
//                       onChange={(event) => setOtp(event.target.value)}
//                     />
//                   </label>

//                   <button
//                     type="button"
//                     className="auth-submit-btn"
//                     onClick={handleVerifyOtp}
//                     disabled={loading}
//                   >
//                     {loading ? 'Verifying...' : 'Verify OTP'}
//                   </button>

//                   <button
//                     type="button"
//                     className="google-signin-btn"
//                     onClick={() => {
//                       setPhoneStep('phone');
//                       setOtp('');
//                       setConfirmation(null);
//                       setError('');
//                     }}
//                     disabled={loading}
//                   >
//                     Change phone number
//                   </button>
//                 </>
//               )}

//               {phoneStep === 'profile' && (
//                 <>
//                   <p>
//                     Phone verified. Complete your profile to continue.
//                   </p>

//                   <label className="auth-field">
//                     <span>Full name</span>
//                     <input
//                       type="text"
//                       autoComplete="name"
//                       placeholder="Enter your full name"
//                       value={phoneName}
//                       onChange={(event) => setPhoneName(event.target.value)}
//                       minLength={2}
//                       maxLength={80}
//                     />
//                   </label>

//                   <label className="auth-field">
//                     <span>Email address</span>
//                     <input
//                       type="email"
//                       autoComplete="email"
//                       placeholder="you@example.com"
//                       value={phoneEmail}
//                       onChange={(event) => setPhoneEmail(event.target.value)}
//                       maxLength={254}
//                     />
//                   </label>

//                   <label className="auth-field">
//                     <span>Create password</span>
//                     <input
//                       type="password"
//                       autoComplete="new-password"
//                       placeholder="At least 6 characters"
//                       value={phonePassword}
//                       onChange={(event) => setPhonePassword(event.target.value)}
//                       minLength={6}
//                       maxLength={128}
//                     />
//                   </label>

//                   <button
//                     type="button"
//                     className="auth-submit-btn"
//                     onClick={handlePhoneProfile}
//                     disabled={loading}
//                   >
//                     {loading ? 'Please wait...' : 'Complete Profile'}
//                   </button>
//                 </>
//               )}

//               {error && (
//                 <p className="auth-error" role="alert">
//                   {error}
//                 </p>
//               )}
//             </div>
//           )}

//           <div className="auth-divider">
//             <span>OR CONTINUE WITH</span>
//           </div>

//           <button
//             type="button"
//             className="google-signin-btn"
//             onClick={handleGoogleSignIn}
//             disabled={loading}
//           >
//             <span className="google-icon">G</span>
//             {loading ? 'Please wait...' : 'Continue with Google'}
//           </button>

//           <button
//             type="button"
//             className="google-signin-btn"
//             onClick={() => changeAuthMethod(
//               authMethod === 'phone' ? 'email' : 'phone'
//             )}
//             disabled={loading}
//           >
//             {authMethod === 'phone'
//               ? 'Continue with Email'
//               : 'Continue with Phone'}
//           </button>

//           <div id="recaptcha-container" />

//           <p className="auth-security-note">
//             <span>✓</span>
//             Your account is secured by Firebase Authentication.
//           </p>

//           <p className="auth-bottom-note">
//             By continuing, you agree to use EquiSplit responsibly.
//           </p>

//         </div>
//       </section>
//     </main>
//   );
// }

// export default Auth;

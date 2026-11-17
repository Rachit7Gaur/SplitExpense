
import { useEffect, useRef, useState } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile,
  verifyBeforeUpdateEmail,
  reload,
} from 'firebase/auth';

import { auth } from '../../firebase';
import './PhoneAuth.css';

function PhoneAuth() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [confirmationResult, setConfirmationResult] = useState(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] =
    useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const recaptchaRef = useRef(null);

  // Initialize and clean up reCAPTCHA.
  useEffect(() => {
    try {
      recaptchaRef.current = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        {
          size: 'normal',
          callback: () => {
            setError('');
          },
          'expired-callback': () => {
            setError('reCAPTCHA expired. Please verify again.');
          },
        }
      );

      recaptchaRef.current.render().catch((err) => {
        console.error('reCAPTCHA render error:', err);
      });
    } catch (err) {
      console.error('reCAPTCHA initialization error:', err);
      setError('Could not initialize reCAPTCHA. Refresh the page.');
    }

    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  // Step 1: Send OTP to phone number.
  async function handleSendOtp() {
    setError('');
    setMessage('');

    if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber.trim())) {
      setError(
        'Enter a valid phone number with country code, e.g. +91XXXXXXXXXX.'
      );
      return;
    }

    if (!recaptchaRef.current) {
      setError('reCAPTCHA is not ready. Refresh the page.');
      return;
    }

    setLoading(true);

    try {
      const result = await signInWithPhoneNumber(
        auth,
        phoneNumber.trim(),
        recaptchaRef.current
      );

      setConfirmationResult(result);
      setMessage('OTP sent. Enter the verification code.');
    } catch (err) {
      console.error('OTP sending error:', err);

      setError(
        err.code === 'auth/invalid-phone-number'
          ? 'The phone number is invalid.'
          : err.code === 'auth/too-many-requests'
            ? 'Too many attempts. Please try again later.'
            : err.code === 'auth/billing-not-enabled'
              ? 'Firebase billing is not enabled for real SMS. Use a configured test phone number.'
              : 'Could not send OTP. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP.
  async function handleVerifyOtp() {
    setError('');
    setMessage('');

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter a valid 6-digit OTP.');
      return;
    }

    if (!confirmationResult) {
      setError('Please request an OTP first.');
      return;
    }

    setLoading(true);

    try {
      await confirmationResult.confirm(otp.trim());

      setPhoneVerified(true);
      setMessage('Phone number verified successfully.');
    } catch (err) {
      console.error('OTP verification error:', err);

      setError(
        err.code === 'auth/invalid-verification-code'
          ? 'Incorrect OTP. Please check the code.'
          : err.code === 'auth/code-expired'
            ? 'OTP expired. Please request a new one.'
            : 'Phone verification failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Save name and request email verification.
  async function handleCompleteProfile() {
    setError('');
    setMessage('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError('Name must contain between 2 and 80 characters.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser || !phoneVerified) {
      setError('Please verify your phone number first.');
      return;
    }

    setLoading(true);

    try {
      await updateProfile(currentUser, {
        displayName: trimmedName,
      });

      await verifyBeforeUpdateEmail(currentUser, trimmedEmail);

      setEmailVerificationSent(true);
      setMessage(
        'Verification link sent. Open your email inbox and click the link.'
      );
    } catch (err) {
      console.error('Email verification request error:', err);

      setError(
        err.code === 'auth/email-already-in-use'
          ? 'This email is already linked to another Firebase account.'
          : err.code === 'auth/invalid-email'
            ? 'Please enter a valid email address.'
            : err.code === 'auth/requires-recent-login'
              ? 'Please sign in again and retry.'
              : err.message || 'Could not send the verification email.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Step 4: Check verification and synchronize with MongoDB.
  async function handleCheckEmailVerification() {
    setError('');
    setMessage('');

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setLoading(true);

    try {
      await reload(currentUser);

      if (!currentUser.email || !currentUser.emailVerified) {
        setError(
          'Email is not verified yet. Open the verification link first.'
        );
        return;
      }

      const token = await currentUser.getIdToken(true);

      const response = await fetch(
        'http://localhost:5000/api/auth/complete-profile',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || 'Could not complete your profile.'
        );
      }

      setProfileCompleted(true);
      setMessage('Your profile has been completed successfully.');
    } catch (err) {
      console.error('Profile completion error:', err);

      setError(
        err.message === 'Failed to fetch'
          ? 'Cannot reach the backend. Make sure your server is running.'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="phone-auth">
      <h2>Phone Authentication</h2>

      {profileCompleted ? (
        <section>
          <h3>Profile completed</h3>
          <p className="success-message">
            Your phone number and email have been verified.
          </p>
          <p>You can now continue to the application.</p>
        </section>
      ) : !confirmationResult ? (
        <section>
          <p>Enter your phone number to get started.</p>

          <input
            type="tel"
            placeholder="+91XXXXXXXXXX"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={loading}
          />

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={loading}
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </section>
      ) : !phoneVerified ? (
        <section>
          <p>Enter the OTP sent to {phoneNumber}.</p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, ''))
            }
            disabled={loading}
          />

          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </section>
      ) : !emailVerificationSent ? (
        <section>
          <p>Phone verified. Complete your profile.</p>

          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <button
            type="button"
            onClick={handleCompleteProfile}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Verify Email'}
          </button>
        </section>
      ) : (
        <section>
          <h3>Verify your email</h3>

          <p>
            A verification link has been sent to:
          </p>

          <strong>{email}</strong>

          <p>
            Open your inbox, click the verification link, then
            return here.
          </p>

          <button
            type="button"
            onClick={handleCheckEmailVerification}
            disabled={loading}
          >
            {loading ? 'Checking...' : 'I Have Verified My Email'}
          </button>
        </section>
      )}

      {!confirmationResult && !phoneVerified && (
        <div id="recaptcha-container"></div>
      )}

      {message && (
        <p className="success-message">{message}</p>
      )}

      {error && (
        <p className="error-message">{error}</p>
      )}
    </main>
  );
}

export default PhoneAuth;


import { useState } from 'react';
import {
  sendEmailVerification,
  reload,
} from 'firebase/auth';
import { Navigate, Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/useAuth';
import './VerifyEmail.css';

function VerifyEmail() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (authLoading) {
    return <p className="verify-loading">Checking your account...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.emailVerified) {
    return <Navigate to="/groups" replace />;
  }

  async function handleResendEmail() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await sendEmailVerification(user);
      setMessage('A new verification email has been sent.');
    } catch (err) {
      console.error('Resend verification error:', err);

      setError(
        err.code === 'auth/too-many-requests'
          ? 'Too many requests. Please wait before trying again.'
          : 'Could not send the verification email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckVerification() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await reload(user);

      if (user.emailVerified) {
        await user.getIdToken(true);
        navigate('/groups', { replace: true });
      } else {
        setError(
          'Your email is not verified yet. Please check your inbox.'
        );
      }
    } catch (err) {
      console.error('Verification check error:', err);
      setError('Could not check verification status. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="verify-page">
      <section className="verify-card">
        <div className="verify-icon">✉</div>

        <span className="verify-eyebrow">EMAIL VERIFICATION</span>

        <h1>Verify your email address</h1>

        <p className="verify-description">
          We've sent a verification link to:
        </p>

        <strong className="verify-email">
          {user.email}
        </strong>

        <p className="verify-description">
          Open your inbox and click the link to verify your
          email address. Check your spam folder if you
          cannot find the email.
        </p>

        {message && (
          <p className="verify-success" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="verify-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="verify-primary-btn"
          onClick={handleCheckVerification}
          disabled={loading}
        >
          {loading ? 'Checking...' : "I've verified my email"}
        </button>

        <button
          className="verify-secondary-btn"
          onClick={handleResendEmail}
          disabled={loading}
        >
          Resend verification email
        </button>

        <p className="verify-footer">
          Wrong account? <Link to="/login">Go to login</Link>
        </p>
      </section>
    </main>
  );
}

export default VerifyEmail;

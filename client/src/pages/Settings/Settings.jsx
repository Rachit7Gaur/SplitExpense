
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential,
  reload,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  updatePhoneNumber,
  updateProfile,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import './Settings.css';

const API_BASE_URL = 'http://localhost:5000/api';

function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [modal, setModal] = useState('');
  const [name, setName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [providerVersion, setProviderVersion] = useState(0);

  const currentUser = auth.currentUser || user;
  const providers =
    currentUser?.providerData?.map((p) => p.providerId) || [];

  const hasPasswordProvider = providers.includes('password');
  const hasGoogleProvider = providers.includes('google.com');

  useEffect(() => {
    setName(user?.displayName || '');
    setNewEmail(user?.email || '');
    setNewPhone(user?.phoneNumber || '');
  }, [user]);

  const displayName = user?.displayName || 'EquiSplit User';
  const email = user?.email || 'Email unavailable';
  const phone = user?.phoneNumber || 'Not added';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const accountCreated = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Unavailable';

  const providerNames = providers.map((provider) => {
    if (provider === 'password') return 'Email and password';
    if (provider === 'google.com') return 'Google';
    if (provider === 'phone') return 'Phone';
    return provider;
  });

  function openModal(type) {
    setError('');
    setMessage('');
    setVerificationId('');
    setOtp('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    if (type === 'name') setName(user?.displayName || '');
    if (type === 'email') setNewEmail(user?.email || '');
    if (type === 'phone') setNewPhone(user?.phoneNumber || '');

    setModal(type);
  }

  function closeModal() {
    if (loading) return;

    setModal('');
    setError('');
    setMessage('');
    setVerificationId('');
    setOtp('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    window.settingsRecaptcha?.clear();
    window.settingsRecaptcha = null;
  }

  async function syncProfile() {
    const activeUser = auth.currentUser;

    if (!activeUser) {
      throw new Error('Your session has expired. Please sign in again.');
    }

    const token = await activeUser.getIdToken(true);

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Profile synchronization failed.');
    }

    await reload(activeUser);
  }

  async function handleNameUpdate(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedName = name.trim();

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError('Name must contain between 2 and 80 characters.');
      return;
    }

    setLoading(true);

    try {
      await updateProfile(auth.currentUser, {
        displayName: trimmedName,
      });

      await syncProfile();
      setMessage('Your name has been updated successfully.');
      setModal('');
    } catch (err) {
      setError(err.message || 'Unable to update your name.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailUpdate(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = newEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (trimmedEmail === user.email?.toLowerCase()) {
      setError('This is already your current email address.');
      return;
    }

    setLoading(true);

    try {
      await verifyBeforeUpdateEmail(auth.currentUser, trimmedEmail);

      setMessage(
        'Verification link sent. Your email will change after you verify the new address.'
      );
      setModal('');
    } catch (err) {
      setError(
        err.code === 'auth/requires-recent-login'
          ? 'Please sign in again before changing your email.'
          : err.message || 'Unable to send verification email.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSendPhoneOtp() {
    setError('');
    setMessage('');

    const normalizedPhone = newPhone.trim();

    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError('Enter a valid number with country code, e.g. +919876543210.');
      return;
    }

    if (normalizedPhone === user.phoneNumber) {
      setError('This is already your current phone number.');
      return;
    }

    setLoading(true);

    try {
      if (!window.settingsRecaptcha) {
        window.settingsRecaptcha = new RecaptchaVerifier(
          auth,
          'settings-recaptcha',
          { size: 'invisible' }
        );
      }

      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(
        normalizedPhone,
        window.settingsRecaptcha
      );

      setVerificationId(id);
      setMessage('OTP sent. Enter the verification code.');
    } catch (err) {
      window.settingsRecaptcha?.clear();
      window.settingsRecaptcha = null;
      setError(err.message || 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneUpdate(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!verificationId || !otp.trim()) {
      setError('Enter the OTP sent to your phone.');
      return;
    }

    setLoading(true);

    try {
      const credential = PhoneAuthProvider.credential(
        verificationId,
        otp.trim()
      );

      await updatePhoneNumber(auth.currentUser, credential);
      await syncProfile();

      setMessage('Your phone number has been updated successfully.');
      setModal('');
    } catch (err) {
      setError(
        err.code === 'auth/requires-recent-login'
          ? 'Please sign in again before changing your phone number.'
          : err.message || 'Phone verification failed.'
      );
    } finally {
      setLoading(false);
      window.settingsRecaptcha?.clear();
      window.settingsRecaptcha = null;
    }
  }

  // Link a password to the existing Google account.
  async function handleSetPassword(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!auth.currentUser || !user?.email) {
      setError('Your account email is unavailable. Please sign in again.');
      return;
    }

    if (!user.emailVerified) {
      setError('Verify your Google account email before setting a password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        newPassword
      );

      try {
        await linkWithCredential(auth.currentUser, credential);
      } catch (linkError) {
        // Linking may require the Google account to be reauthenticated.
        if (linkError.code !== 'auth/requires-recent-login') {
          throw linkError;
        }

        const googleProvider = new GoogleAuthProvider();

        await reauthenticateWithPopup(
          auth.currentUser,
          googleProvider
        );

        await linkWithCredential(auth.currentUser, credential);
      }

      await reload(auth.currentUser);
      setProviderVersion((version) => version + 1);

      setMessage(
        'Password set successfully. You can now sign in using Google or email and password.'
      );
      setModal('');
    } catch (err) {
      const messages = {
        'auth/email-already-in-use':
          'This email is already linked to another Firebase account.',
        'auth/credential-already-in-use':
          'These credentials are already associated with another account.',
        'auth/provider-already-linked':
          'Email and password are already linked to this account.',
        'auth/weak-password':
          'Choose a stronger password.',
        'auth/popup-closed-by-user':
          'Google reauthentication was cancelled.',
        'auth/popup-blocked':
          'Your browser blocked the Google sign-in popup. Allow popups and try again.',
      };

      setError(
        messages[err.code] ||
        err.message ||
        'Unable to set your password.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordUpdate(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!hasPasswordProvider) {
      setError('Set a password before trying to change it.');
      return;
    }

    if (!currentPassword || !newPassword) {
      setError('Enter your current and new passwords.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must contain at least 8 characters.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      setMessage('Your password has been updated successfully.');
      setModal('');
    } catch (err) {
      setError(
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
          ? 'Your current password is incorrect.'
          : err.code === 'auth/requires-recent-login'
            ? 'Please sign in again before changing your password.'
            : err.message || 'Unable to update your password.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setError('');
    setLoggingOut(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to log out. Please try again.');
      setLoggingOut(false);
    }
  }

  function renderModalContent() {
    switch (modal) {
      case 'name':
        return (
          <form onSubmit={handleNameUpdate}>
            <label htmlFor="settings-name">Full name</label>
            <input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
            <ModalActions
              loading={loading}
              submitText="Save name"
              onCancel={closeModal}
            />
          </form>
        );

      case 'email':
        return (
          <form onSubmit={handleEmailUpdate}>
            <label htmlFor="settings-email">New email address</label>
            <input
              id="settings-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <p className="settings-modal-note">
              A verification link will be sent to your new email address.
              Your account email changes only after verification.
            </p>
            <ModalActions
              loading={loading}
              submitText="Send verification link"
              onCancel={closeModal}
            />
          </form>
        );

      case 'phone':
        return (
          <form onSubmit={verificationId ? handlePhoneUpdate : (e) => e.preventDefault()}>
            <label htmlFor="settings-phone">New phone number</label>
            <input
              id="settings-phone"
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+919876543210"
              disabled={Boolean(verificationId)}
              required
            />

            {!verificationId ? (
              <button
                className="settings-modal-submit"
                type="button"
                onClick={handleSendPhoneOtp}
                disabled={loading}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            ) : (
              <>
                <label htmlFor="settings-otp">Verification code</label>
                <input
                  id="settings-otp"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP"
                  required
                />
                <ModalActions
                  loading={loading}
                  submitText="Verify and update"
                  onCancel={closeModal}
                />
              </>
            )}

            <div id="settings-recaptcha" />

            {!verificationId && (
              <button
                className="settings-modal-cancel"
                type="button"
                onClick={closeModal}
              >
                Cancel
              </button>
            )}
          </form>
        );

      case 'password':
        return hasPasswordProvider ? (
          <form onSubmit={handlePasswordUpdate}>
            <label htmlFor="settings-current-password">Current password</label>
            <input
              id="settings-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />

            <label htmlFor="settings-new-password">New password</label>
            <input
              id="settings-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <label htmlFor="settings-confirm-password">
              Confirm new password
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <ModalActions
              loading={loading}
              submitText="Update password"
              onCancel={closeModal}
            />
          </form>
        ) : (
          <form onSubmit={handleSetPassword}>
            <p className="settings-modal-note">
              Set a password for your existing Google account. Your account,
              groups and expenses will remain connected to the same profile.
            </p>

            <label htmlFor="settings-new-password">New password</label>
            <input
              id="settings-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <label htmlFor="settings-confirm-password">
              Confirm password
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <ModalActions
              loading={loading}
              submitText="Set password"
              onCancel={closeModal}
            />
          </form>
        );

      default:
        return null;
    }
  }

  const modalTitles = {
    name: 'Edit full name',
    email: 'Edit email address',
    phone: 'Edit phone number',
    password: hasPasswordProvider ? 'Change password' : 'Set password',
  };

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <p className="settings-eyebrow">EQUISPLIT WORKSPACE</p>
          <h1>Settings</h1>
          <p>Manage your account information and security.</p>
        </div>
      </header>

      {error && !modal && (
        <div className="settings-error" role="alert">{error}</div>
      )}

      {message && (
        <div className="settings-success" role="status">{message}</div>
      )}

      <section className="settings-section">
        <div className="settings-section-heading">
          <h2>Profile information</h2>
          <p>Manage the personal information associated with your account.</p>
        </div>

        <div className="settings-profile-card">
          <div className="settings-avatar">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" />
            ) : (
              initials || 'E'
            )}
          </div>

          <div className="settings-profile-details">
            <h3>{displayName}</h3>
            <p>{email}</p>
            <span className="settings-status">
              <span className="settings-status-dot" />
              Signed in
            </span>
          </div>
        </div>

        <div className="settings-info-list">
          <InfoRow
            label="Full name"
            value={displayName}
            onEdit={() => openModal('name')}
          />

          <InfoRow
            label="Email address"
            value={email}
            detail={user?.emailVerified ? 'Verified' : 'Not verified'}
            onEdit={() => openModal('email')}
          />

          <InfoRow
            label="Phone number"
            value={phone}
            onEdit={() => openModal('phone')}
          />

          <div className="settings-info-row">
            <div>
              <span className="settings-info-label">Account created</span>
              <strong>{accountCreated}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <h2>Password</h2>
          <p>
            {hasPasswordProvider
              ? 'Change the password used for email and password sign-in.'
              : 'Add a password to your existing account.'}
          </p>
        </div>

        <InfoRow
          label="Password"
          value={hasPasswordProvider ? '••••••••••' : 'No password linked'}
          onEdit={() => openModal('password')}
          buttonText={hasPasswordProvider ? 'Change' : 'Set password'}
        />
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <h2>Security</h2>
          <p>Information about how your account is authenticated.</p>
        </div>

        <div className="settings-security-card">
          <div className="settings-security-icon">✓</div>
          <div className="settings-security-details">
            <h3>Firebase Authentication</h3>
            <p>Your account is authenticated through Firebase.</p>
            <span>
              Sign-in method: {providerNames.length
                ? providerNames.join(', ')
                : 'Unavailable'}
            </span>
          </div>
          <span className="settings-security-badge">Active</span>
        </div>
      </section>

      <section className="settings-section settings-danger-section">
        <div className="settings-section-heading">
          <h2>Session</h2>
          <p>Sign out of your EquiSplit account on this device.</p>
        </div>

        <div className="settings-logout-card">
          <div>
            <h3>Log out</h3>
            <p>
              You will need to sign in again to access your groups
              and expenses.
            </p>
          </div>

          <button
            type="button"
            className="settings-logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </section>

      {modal && (
        <div
          className="settings-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <div className="settings-modal-header">
              <div>
                <p className="settings-eyebrow">EQUISPLIT ACCOUNT</p>
                <h2 id="settings-modal-title">{modalTitles[modal]}</h2>
              </div>

              <button
                className="settings-modal-close"
                type="button"
                onClick={closeModal}
                disabled={loading}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="settings-error" role="alert">{error}</div>
            )}

            {message && (
              <div className="settings-success" role="status">{message}</div>
            )}

            {renderModalContent()}
          </div>
        </div>
      )}
    </main>
  );
}

function InfoRow({ label, value, detail, onEdit, buttonText = 'Edit' }) {
  return (
    <div className="settings-info-row">
      <div>
        <span className="settings-info-label">{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>

      {onEdit && (
        <button
          className="settings-edit-button"
          type="button"
          onClick={onEdit}
        >
          {buttonText}
        </button>
      )}
    </div>
  );
}

function ModalActions({ loading, submitText, onCancel }) {
  return (
    <div className="settings-form-actions">
      <button type="submit" disabled={loading}>
        {loading ? 'Please wait...' : submitText}
      </button>
      <button type="button" onClick={onCancel} disabled={loading}>
        Cancel
      </button>
    </div>
  );
}

export default Settings;


import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function AppLayout() {
  const { user, logout, profileError } = useAuth();
  const [logoutError, setLogoutError] = useState('');

  async function handleLogout() {
    setLogoutError('');

    try {
      await logout();
    } catch {
      setLogoutError('Could not log out. Please try again.');
    }
  }

  return (
    <div className="app-dashboard">
      <header className="app-navbar">
        <div className="app-logo">
          <span className="brand-mark">S</span>
          <strong>SplitExpense</strong>
        </div>

        <div className="app-user-info">
          <span>{user?.displayName || user?.email}</span>

          <button
            type="button"
            onClick={handleLogout}
            className="logout-button"
          >
            Log out
          </button>
        </div>
      </header>

      <main>
        {profileError && (
          <p className="error-message" role="alert">
            Profile sync failed: {profileError}
          </p>
        )}

        {logoutError && (
          <p className="error-message" role="alert">
            {logoutError}
          </p>
        )}

        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;

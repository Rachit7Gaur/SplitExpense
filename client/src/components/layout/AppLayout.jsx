
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

function AppLayout() {
  const { user, logout, profileError } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();

  async function handleLogout() {
    setLogoutError('');

    try {
      await logout();
      navigate('/login');
    } catch {
      setLogoutError('Could not log out. Please try again.');
    }
  }

  const navigationItems = [
    { label: 'Dashboard', icon: '▦', path: '/dashboard', end: true },
    { label: 'Groups', icon: '◫', path: '/groups', end: false },
  ];

  const comingSoonItems = [
  ];

  return (
    <div className="app-shell">

      {/* Sidebar */}
      <aside className="app-sidebar">

        <NavLink to="/groups" className="app-brand">
          <span className="app-brand-icon">E</span>
          <strong>EquiSplit</strong>
        </NavLink>

        <div className="sidebar-navigation">
          <p className="sidebar-label">WORKSPACE</p>

          {navigationItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          <NavLink
            to="/friends"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-link-icon">♧</span>
            Friends
          </NavLink>

          <NavLink
            to="/activity"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-link-icon">↗</span>
            Activity
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-link-icon">⚙</span>
            Settings
          </NavLink>

          <p className="sidebar-label sidebar-label-spaced">
            PERSONAL
          </p>

          {comingSoonItems.map((item) => (
            <div
              key={item.label}
              className="sidebar-link sidebar-link-disabled"
              title={`${item.label} page coming soon`}
              aria-disabled="true"
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
              <span className="sidebar-coming-soon">Soon</span>
            </div>
          ))}
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {(user?.displayName || user?.email || 'U')
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="sidebar-user-details">
            <strong>{user?.displayName || 'User'}</strong>
            <span>{user?.email}</span>
          </div>

          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
          >
            ↗
          </button>
        </div>
      </aside>

      {/* Main workspace */}
      <div className="app-main">

        {(profileError || logoutError) && (
          <div className="app-notifications">
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
          </div>
        )}

        <div className="app-content">
          <Outlet />
        </div>

      </div>
    </div>
  );
}

export default AppLayout;

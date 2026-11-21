
import { useCallback, useEffect, useState } from 'react';

import {
  fetchGroups,
  createGroup,
} from '../../services/groupservice';

import GroupCard from '../../components/groups/GroupCard';

import './Groups.css';

function Groups() {
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadGroups = useCallback(async () => {
  try {
    const data = await fetchGroups();

    setGroups(data);
    setError('');
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
  let cancelled = false;

  async function getGroups() {
    try {
      const data = await fetchGroups();

      if (!cancelled) {
        setGroups(data);
        setError('');
      }
    } catch (err) {
      if (!cancelled) {
        setError(err.message);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  getGroups();

  return () => {
    cancelled = true;
  };
}, []);

  async function handleCreateGroup(event) {
    event.preventDefault();

    setError('');
    setMessage('');

    const trimmedName = groupName.trim();

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError('Group name must be between 2 and 80 characters.');
      return;
    }

    setCreating(true);

    try {
      await createGroup(trimmedName);

      setGroupName('');
      setMessage('Group created successfully!');

      await loadGroups();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="groups-page">

      {/* Page heading */}
      <header className="groups-header">
        <div className="groups-heading-content">
          <p className="groups-eyebrow">EQUISPLIT WORKSPACE</p>

          <h1>My Groups</h1>

          <p className="groups-subtitle">
            Keep your trips, shared expenses and group balances
            organized in one place.
          </p>
        </div>

        <div className="groups-count">
          <div className="groups-count-icon">▦</div>

          <div>
            <strong>{groups.length}</strong>
            <span>Total Groups</span>
          </div>
        </div>
      </header>

      {/* Create group */}
      <section className="create-group-card">

        <div className="create-group-info">
          <div className="create-group-icon">+</div>

          <div>
            <h2>Create a new group</h2>

            <p>
              Planning a trip or sharing expenses?
              Start by creating a group.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateGroup}>
          <input
            type="text"
            placeholder="Enter group name (e.g. Goa Trip)"
            value={groupName}
            onChange={(event) => {
              setGroupName(event.target.value);
              setError('');
              setMessage('');
            }}
            minLength={2}
            maxLength={80}
            aria-label="New group name"
            required
          />

          <button type="submit" disabled={creating}>
            {creating ? 'Creating...' : '+ Create Group'}
          </button>
        </form>

        {message && (
          <p className="group-success" role="status">
            <span>✓</span> {message}
          </p>
        )}

        {error && (
          <p className="group-error" role="alert">
            {error}
          </p>
        )}

      </section>

      {/* Groups list */}
      <section className="groups-list-section">

        <div className="groups-list-heading">
          <div>
            <h2>Your Groups</h2>
            <p>All your shared expense groups in one place.</p>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={loadGroups}
            disabled={loading}
          >
            <span>↻</span>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="groups-empty">
            <div className="groups-loader" />
            <p>Loading your groups...</p>
          </div>
        ) : error && groups.length === 0 ? (
          <div className="groups-empty">
            <h3>Couldn't load your groups</h3>
            <p>{error}</p>

            <button
              type="button"
              className="groups-retry-button"
              onClick={loadGroups}
            >
              Try again
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="groups-empty">
            <div className="groups-empty-icon">▦</div>
            <h3>No groups yet</h3>
            <p>
              Your groups will appear here.
              Create your first group to get started.
            </p>
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => (
              <GroupCard
                key={group._id}
                group={group}
              />
            ))}
          </div>
        )}

      </section>

    </main>
  );
}

export default Groups;

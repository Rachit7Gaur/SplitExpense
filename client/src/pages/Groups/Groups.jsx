
import { useCallback, useEffect, useState } from 'react';

import {
  fetchGroups,
  createGroup
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
    setError('');

    try {
      const data = await fetchGroups();
      setGroups(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

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

      <header className="groups-header">
        <div>
          <p className="groups-eyebrow">SPLITEXPENSE</p>
          <h1>My Groups</h1>

          <p className="groups-subtitle">
            Manage your trips and shared expenses in one place.
          </p>
        </div>

        <div className="groups-count">
          <strong>{groups.length}</strong>
          <span>Total Groups</span>
        </div>
      </header>

      <section className="create-group-card">
        <h2>Create a new group</h2>

        <p>
          Start a trip or create a group to share expenses.
        </p>

        <form onSubmit={handleCreateGroup}>
          <input
            type="text"
            placeholder="Enter group name (e.g. Goa Trip)"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            minLength={2}
            maxLength={80}
            required
          />

          <button type="submit" disabled={creating}>
            {creating ? 'Creating...' : '+ Create Group'}
          </button>
        </form>

        {message && (
          <p className="group-success" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="group-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="groups-list-section">

        <div className="groups-list-heading">
          <h2>Your Groups</h2>

          <button
            type="button"
            className="refresh-button"
            onClick={loadGroups}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="groups-empty">
            Loading your groups...
          </p>
        ) : groups.length === 0 ? (
          <div className="groups-empty">
            <h3>No groups yet</h3>
            <p>Create your first group to get started.</p>
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

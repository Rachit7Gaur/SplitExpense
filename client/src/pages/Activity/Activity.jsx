
import { useEffect, useMemo, useState } from 'react';
import {
  fetchGroups,
  fetchGroupExpenses,
} from '../../services/groupservice';
import './Activity.css';

function formatCurrency(amountInPaise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format((amountInPaise || 0) / 100);
}

function Activity() {
  const [activities, setActivities] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadActivity() {
      setLoading(true);
      setError('');

      try {
        const groupData = await fetchGroups();

        const results = await Promise.all(
          groupData.map(async (group) => {
            const expenses = await fetchGroupExpenses(group._id);

            return expenses.map((expense) => ({
              ...expense,
              groupName: group.name,
              groupId: group._id,
            }));
          })
        );

        const allActivities = results
          .flat()
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          );

        if (!cancelled) {
          setGroups(groupData);
          setActivities(allActivities);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load activity.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadActivity();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const matchesGroup =
        selectedGroup === 'all' ||
        activity.groupId === selectedGroup;

      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        activity.description?.toLowerCase().includes(query) ||
        activity.paidBy?.name?.toLowerCase().includes(query) ||
        activity.groupName?.toLowerCase().includes(query);

      return matchesGroup && matchesSearch;
    });
  }, [activities, selectedGroup, search]);

  const totalExpenses = useMemo(
    () => filteredActivities.reduce(
      (total, activity) => total + activity.amount,
      0
    ),
    [filteredActivities]
  );

  function formatDate(date) {
    if (!date) return 'Date unavailable';

    return new Date(date).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <main className="activity-page">
      <header className="activity-header">
        <div>
          <p className="activity-eyebrow">EQUISPLIT WORKSPACE</p>
          <h1>Activity</h1>
          <p className="activity-subtitle">
            A complete timeline of expenses across your groups.
          </p>
        </div>

        <div className="activity-total-card">
          <span>Filtered expense total</span>
          <strong>{formatCurrency(totalExpenses)}</strong>
        </div>
      </header>

      <section className="activity-controls">
        <input
          type="search"
          placeholder="Search expenses, people or groups..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search activity"
        />

        <select
          value={selectedGroup}
          onChange={(event) => setSelectedGroup(event.target.value)}
          aria-label="Filter by group"
        >
          <option value="all">All groups</option>
          {groups.map((group) => (
            <option key={group._id} value={group._id}>
              {group.name}
            </option>
          ))}
        </select>
      </section>

      <section className="activity-list-section">
        <div className="activity-section-heading">
          <div>
            <h2>Recent transactions</h2>
            <p>
              {filteredActivities.length} expense
              {filteredActivities.length === 1 ? '' : 's'} found
            </p>
          </div>
        </div>

        {loading ? (
          <div className="activity-state">
            <div className="activity-loader" />
            <p>Loading your activity...</p>
          </div>
        ) : error ? (
          <div className="activity-state">
            <h3>Couldn't load activity</h3>
            <p>{error}</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="activity-state">
            <div className="activity-empty-icon">↗</div>
            <h3>No expenses found</h3>
            <p>
              Try changing your search or group filter.
            </p>
          </div>
        ) : (
          <div className="activity-list">
            {filteredActivities.map((activity) => (
              <article
                className="activity-card"
                key={activity._id}
              >
                <div className="activity-icon">₹</div>

                <div className="activity-details">
                  <h3>{activity.description}</h3>
                  <p>
                    Paid by{' '}
                    <strong>
                      {activity.paidBy?.name || 'Unknown member'}
                    </strong>
                  </p>
                  <span>{activity.groupName}</span>
                </div>

                <div className="activity-amount">
                  <strong>{formatCurrency(activity.amount)}</strong>
                  <span>{formatDate(activity.createdAt)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Activity;

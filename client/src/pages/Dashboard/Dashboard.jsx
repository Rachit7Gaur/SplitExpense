
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

import {
  fetchGroups,
  fetchGroupExpenses,
  fetchGroupBalances,
} from '../../services/groupservice';

import './Dashboard.css';

function formatCurrency(amountInPaise = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amountInPaise / 100);
}

function Dashboard() {
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [groupSummaries, setGroupSummaries] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);

  const [summary, setSummary] = useState({
    totalSpending: 0,
    yourShare: 0,
    youOwe: 0,
    owedToYou: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        // Step 1: Fetch all groups belonging to the logged-in user.
        const groupData = await fetchGroups();

        // Step 2: Fetch expenses and balances for every group.
        const results = await Promise.all(
          groupData.map(async (group) => {
            const [expenses, balances] = await Promise.all([
              fetchGroupExpenses(group._id),
              fetchGroupBalances(group._id),
            ]);

            return {
              group,
              expenses,
              balances,
            };
          })
        );

        const currentEmail = user?.email?.trim().toLowerCase();

        let totalSpending = 0;
        let yourShare = 0;
        let youOwe = 0;
        let owedToYou = 0;

        const summaries = [];
        const allExpenses = [];

        // Step 3: Calculate dashboard information.
        results.forEach(({ group, expenses, balances }) => {
          const groupTotal = expenses.reduce(
            (total, expense) => total + (expense.amount || 0),
            0
          );

          totalSpending += groupTotal;

          // Find the logged-in user in this group's balances.
          const currentMember = balances.find((member) =>
            group.members?.some(
              (groupMember) =>
                String(groupMember._id) === String(member.userId) &&
                groupMember.email?.trim().toLowerCase() === currentEmail
            )
          );

          if (currentMember) {
            yourShare += currentMember.totalShare || 0;

            const netBalance = currentMember.netBalance || 0;

            if (netBalance < 0) {
              youOwe += Math.abs(netBalance);
            } else if (netBalance > 0) {
              owedToYou += netBalance;
            }
          }

          // Prepare group-wise spending information.
          summaries.push({
            _id: group._id,
            name: group.name,
            memberCount: group.members?.length || 0,
            totalSpending: groupTotal,
            expenseCount: expenses.length,
          });

          // Attach group information to each expense.
          expenses.forEach((expense) => {
            allExpenses.push({
              ...expense,
              groupName: group.name,
              groupId: group._id,
            });
          });
        });

        // Step 4: Sort expenses by latest date.
        allExpenses.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );

        // Step 5: Sort groups by highest spending.
        summaries.sort(
          (a, b) => b.totalSpending - a.totalSpending
        );

        if (!cancelled) {
          setGroups(groupData);
          setGroupSummaries(summaries);
          setRecentExpenses(allExpenses.slice(0, 5));

          setSummary({
            totalSpending,
            yourShare,
            youOwe,
            owedToYou,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load dashboard.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  // Positive means others owe you; negative means you owe others.
  const netBalance = summary.owedToYou - summary.youOwe;

  // Loading state.
  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-state">
          <div className="dashboard-loader" />
          <p>Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  // Error state.
  if (error) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-state">
          <h2>Unable to load dashboard</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">

      {/* Dashboard Header */}
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">
            EQUISPLIT WORKSPACE
          </p>

          <h1>
            Welcome back
            {user?.displayName ? `, ${user.displayName}` : ''}
          </h1>

          <p>
            Here's an overview of your shared expenses.
          </p>
        </div>

        <div className="dashboard-net-card">
          <span>Your net balance</span>

          <strong
            className={
              netBalance >= 0 ? 'positive' : 'negative'
            }
          >
            {netBalance > 0 ? '+' : ''}
            {formatCurrency(netBalance)}
          </strong>

          <small>
            {netBalance > 0
              ? 'You are owed money overall'
              : netBalance < 0
                ? 'You owe money overall'
                : 'You are all settled up'}
          </small>
        </div>
      </header>

      {/* Financial Summary Cards */}
      <section className="dashboard-stats">

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon green">
            ₹
          </span>

          <p>Total group spending</p>

          <h2>
            {formatCurrency(summary.totalSpending)}
          </h2>

          <small>Across all your groups</small>
        </article>

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon blue">
            ◷
          </span>

          <p>Your total share</p>

          <h2>
            {formatCurrency(summary.yourShare)}
          </h2>

          <small>Your portion of expenses</small>
        </article>

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon orange">
            ↗
          </span>

          <p>You owe</p>

          <h2>
            {formatCurrency(summary.youOwe)}
          </h2>

          <small>Amount you need to pay</small>
        </article>

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon purple">
            ↙
          </span>

          <p>Owed to you</p>

          <h2>
            {formatCurrency(summary.owedToYou)}
          </h2>

          <small>Amount others need to pay you</small>
        </article>

      </section>

      {/* Groups and Recent Activity */}
      <section className="dashboard-content-grid">

        {/* Groups Panel */}
        <div className="dashboard-panel">

          <div className="dashboard-panel-header">
            <div>
              <h2>Your groups</h2>
              <p>{groups.length} groups in total</p>
            </div>

            <Link to="/groups">
              View all
            </Link>
          </div>

          {groupSummaries.length === 0 ? (
            <div className="dashboard-empty">
              <h3>No groups yet</h3>

              <p>
                Create a group to start tracking shared expenses.
              </p>

              <Link to="/groups">
                Create a group
              </Link>
            </div>
          ) : (
            <div className="dashboard-group-list">
              {groupSummaries.map((group) => (
                <Link
                  to={`/groups/${group._id}`}
                  className="dashboard-group-item"
                  key={group._id}
                >
                  <div className="dashboard-group-icon">
                    G
                  </div>

                  <div className="dashboard-group-info">
                    <strong>{group.name}</strong>

                    <span>
                      {group.memberCount}{' '}
                      {group.memberCount === 1 ? 'member' : 'members'}
                      {' · '}
                      {group.expenseCount}{' '}
                      {group.expenseCount === 1 ? 'expense' : 'expenses'}
                    </span>
                  </div>

                  <div className="dashboard-group-total">
                    <strong>
                      {formatCurrency(group.totalSpending)}
                    </strong>

                    <span>Total spending</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

        </div>

        {/* Recent Activity Panel */}
        <div className="dashboard-panel">

          <div className="dashboard-panel-header">
            <div>
              <h2>Recent activity</h2>
              <p>Your latest expenses</p>
            </div>

            <Link to="/activity">
              View all
            </Link>
          </div>

          {recentExpenses.length === 0 ? (
            <div className="dashboard-empty">
              <h3>No recent expenses</h3>

              <p>
                Your latest group expenses will appear here.
              </p>
            </div>
          ) : (
            <div className="dashboard-expense-list">
              {recentExpenses.map((expense) => (
                <div
                  className="dashboard-expense-item"
                  key={expense._id}
                >
                  <div className="dashboard-expense-icon">
                    ₹
                  </div>

                  <div className="dashboard-expense-info">
                    <strong>{expense.description}</strong>

                    <span>
                      {expense.groupName}
                      {' · '}
                      Paid by {expense.paidBy?.name || 'Unknown'}
                    </span>
                  </div>

                  <strong className="dashboard-expense-amount">
                    {formatCurrency(expense.amount)}
                  </strong>
                </div>
              ))}
            </div>
          )}

        </div>

      </section>
    </main>
  );
}

export default Dashboard;

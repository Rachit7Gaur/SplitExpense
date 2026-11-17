
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import {
  fetchGroupById,
  generateInviteLink,
  createExpense,
  fetchGroupExpenses,
  fetchGroupBalances,
  fetchGroupSettlements,
} from '../../services/groupservice';

import './GroupDetails.css';

const formatCurrency = (amount) =>
  `₹${((amount || 0) / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;

const getInitial = (name) => (name || 'U').charAt(0).toUpperCase();

function GroupDetails() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [expenseMessage, setExpenseMessage] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const groupData = await fetchGroupById(groupId);

      const [expenseData, balanceData, settlementData] =
        await Promise.all([
          fetchGroupExpenses(groupId),
          fetchGroupBalances(groupId),
          fetchGroupSettlements(groupId),
        ]);

      setGroup(groupData);
      setExpenses(expenseData);
      setBalances(balanceData);
      setSettlements(settlementData);

      setPaidBy((current) =>
        current || groupData.members?.[0]?._id || ''
      );
    } catch (err) {
      setError(err.message || 'Unable to load group.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // Load again when the selected group changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const members = group?.members || [];

  const totalExpenses = useMemo(
    () => expenses.reduce((total, expense) => total + expense.amount, 0),
    [expenses]
  );

  const payerTotals = useMemo(() => {
    const totals = {};

    expenses.forEach((expense) => {
      const name = expense.paidBy?.name || 'Unknown';
      totals[name] = (totals[name] || 0) + expense.amount;
    });

    return Object.entries(totals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const dailySpending = useMemo(() => {
    const days = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const total = expenses
        .filter((expense) => {
          const expenseDate = new Date(expense.createdAt);
          return expenseDate >= date && expenseDate < nextDate;
        })
        .reduce((sum, expense) => sum + expense.amount, 0);

      days.push({
        label: date.toLocaleDateString('en-IN', { day: 'numeric' }),
        total,
      });
    }

    return days;
  }, [expenses]);

  const chartPoints = useMemo(() => {
    const max = Math.max(...dailySpending.map((day) => day.total), 1);

    return dailySpending.map((day, index) => ({
      ...day,
      x: 12 + index * 46,
      y: 112 - (day.total / max) * 85,
    }));
  }, [dailySpending]);

  const chartLine = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  const chartArea = chartPoints.length
    ? `12,120 ${chartLine} 288,120`
    : '';

  const maxPayerTotal = Math.max(
    ...payerTotals.map((payer) => payer.total),
    1
  );

  const currentMember = members.find(
    (member) =>
      member.email?.toLowerCase() === user?.email?.toLowerCase()
  );

  const currentBalance = balances.find(
    (balance) =>
      balance.userId === currentMember?._id ||
      balance.name === currentMember?.name
  );

  async function handleGenerateInvite() {
    try {
      setInviteLoading(true);
      setInviteError('');
      setCopied(false);

      const result = await generateInviteLink(groupId);
      setInviteLink(result.inviteLink);
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setInviteError('');
    } catch {
      setInviteError('Unable to copy link. Please copy it manually.');
    }
  }

  async function handleAddExpense(event) {
    event.preventDefault();

    setExpenseError('');
    setExpenseMessage('');

    if (!description.trim()) {
      setExpenseError('Please enter an expense description.');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setExpenseError('Please enter a valid amount.');
      return;
    }

    if (!paidBy) {
      setExpenseError('Please select who paid.');
      return;
    }

    try {
      setExpenseLoading(true);

      await createExpense(groupId, {
        description: description.trim(),
        amount: Number(amount),
        paidBy,
        splitBetween: members.map((member) => member._id),
      });

      const [updatedExpenses, updatedBalances, updatedSettlements] =
        await Promise.all([
          fetchGroupExpenses(groupId),
          fetchGroupBalances(groupId),
          fetchGroupSettlements(groupId),
        ]);

      setExpenses(updatedExpenses);
      setBalances(updatedBalances);
      setSettlements(updatedSettlements);

      setDescription('');
      setAmount('');
      setExpenseMessage('Expense added successfully!');
      setShowExpenseForm(false);
    } catch (err) {
      setExpenseError(err.message);
    } finally {
      setExpenseLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="group-dashboard-page">
        <div className="dashboard-state">
          <div className="details-loader" />
          <p>Loading your group dashboard...</p>
        </div>
      </main>
    );
  }

  if (error || !group) {
    return (
      <main className="group-dashboard-page">
        <div className="dashboard-state dashboard-error">
          <h2>Unable to load group</h2>
          <p>{error || 'This group could not be found.'}</p>
          <button onClick={() => navigate('/groups')}>
            Back to groups
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="group-dashboard-page">

      {/* Group overview */}
      <section className="group-dashboard-hero">
        <div>
          <p className="dashboard-eyebrow">GROUP</p>
          <h1>{group.name}</h1>

          <div className="hero-members">
            <div className="hero-avatars">
              {members.slice(0, 5).map((member, index) => (
                <span key={member._id} className={`hero-avatar avatar-${index % 5}`}>
                  {getInitial(member.name)}
                </span>
              ))}
            </div>
            <span>{members.length} members</span>
          </div>
        </div>

        <div className="hero-actions">
          <button
            className="dashboard-secondary-button"
            onClick={() => navigate('/groups')}
          >
            Back to groups
          </button>

          <button
            className="dashboard-primary-button"
            onClick={() => {
              setShowExpenseForm((value) => !value);
              setExpenseError('');
              setExpenseMessage('');
            }}
          >
            + Add expense
          </button>
        </div>
      </section>

      {/* Financial summary */}
      <section className="financial-summary">
        <article className="summary-card">
          <span>Total spent</span>
          <strong>{formatCurrency(totalExpenses)}</strong>
        </article>

        <article className="summary-card">
          <span>Your share</span>
          <strong>
            {currentBalance
              ? formatCurrency(currentBalance.totalShare)
              : '—'}
          </strong>
        </article>

        <article className="summary-card">
          <span>
            {currentBalance?.netBalance < 0
              ? 'You owe'
              : 'You are owed'}
          </span>
          <strong className={
            currentBalance?.netBalance < 0
              ? 'summary-negative'
              : 'summary-positive'
          }>
            {currentBalance
              ? formatCurrency(Math.abs(currentBalance.netBalance))
              : '—'}
          </strong>
        </article>
      </section>

      {/* Add expense form */}
      {showExpenseForm && (
        <section className="dashboard-panel dashboard-expense-form">
          <div className="panel-heading">
            <div>
              <h2>Add an expense</h2>
              <p>Record a shared expense for this group.</p>
            </div>
            <button
              className="panel-close-button"
              onClick={() => setShowExpenseForm(false)}
              aria-label="Close expense form"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleAddExpense}>
            <div className="dashboard-form-grid">
              <label>
                Description
                <input
                  type="text"
                  placeholder="e.g. Hotel booking"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={150}
                  required
                />
              </label>

              <label>
                Amount (₹)
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>

              <label>
                Paid by
                <select
                  value={paidBy}
                  onChange={(event) => setPaidBy(event.target.value)}
                  required
                >
                  {members.map((member) => (
                    <option key={member._id} value={member._id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="expense-split-hint">
              This expense will be split equally among all {members.length} members.
            </p>

            {expenseError && <p className="dashboard-error-text">{expenseError}</p>}

            <button
              className="dashboard-primary-button"
              type="submit"
              disabled={expenseLoading}
            >
              {expenseLoading ? 'Adding...' : 'Save expense'}
            </button>
          </form>
        </section>
      )}

      {expenseMessage && (
        <p className="dashboard-success-text" role="status">
          {expenseMessage}
        </p>
      )}

      {/* Charts */}
      <section className="dashboard-chart-grid">

        <article className="dashboard-panel spending-chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Daily spending</h2>
              <p>Expense activity over the last 7 days</p>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="chart-empty">
              Add expenses to see your spending trend.
            </div>
          ) : (
            <div className="spending-chart">
              <svg viewBox="0 0 300 145" role="img" aria-label="Daily spending over the last seven days">
                {[35, 75, 115].map((y) => (
                  <line
                    key={y}
                    x1="10"
                    y1={y}
                    x2="290"
                    y2={y}
                    className="chart-grid-line"
                  />
                ))}

                <polygon points={chartArea} className="chart-area" />
                <polyline points={chartLine} className="chart-line" />

                {chartPoints.map((point, index) => (
                  <g key={index}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="3.5"
                      className="chart-point"
                    />
                    <text
                      x={point.x}
                      y="138"
                      textAnchor="middle"
                      className="chart-label"
                    >
                      {point.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </article>

        <article className="dashboard-panel contribution-panel">
          <div className="panel-heading">
            <div>
              <h2>Who paid</h2>
              <p>Contribution by group members</p>
            </div>
          </div>

          {payerTotals.length === 0 ? (
            <div className="chart-empty">No contributions yet.</div>
          ) : (
            <div className="payer-chart-list">
              {payerTotals.map((payer, index) => (
                <div className="payer-chart-item" key={payer.name}>
                  <div className="payer-chart-label">
                    <span>{payer.name}</span>
                    <strong>{formatCurrency(payer.total)}</strong>
                  </div>
                  <div className="payer-bar-track">
                    <div
                      className={`payer-bar payer-color-${index % 5}`}
                      style={{
                        width: `${(payer.total / maxPayerTotal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      {/* Expense history and members */}
      <section className="dashboard-lower-grid">

        <article className="dashboard-panel expenses-panel">
          <div className="panel-heading">
            <div>
              <h2>Expenses</h2>
              <p>Recent group transactions</p>
            </div>
            <span className="panel-count">{expenses.length}</span>
          </div>

          {expenses.length === 0 ? (
            <div className="chart-empty">
              <h3>No expenses yet</h3>
              <p>New expenses will appear here.</p>
            </div>
          ) : (
            <div className="dashboard-expense-list">
              {expenses.map((expense, index) => (
                <article className="dashboard-expense-item" key={expense._id}>
                  <div className={`expense-avatar expense-avatar-${index % 5}`}>
                    {getInitial(expense.description)}
                  </div>

                  <div className="dashboard-expense-info">
                    <strong>{expense.description}</strong>
                    <span>
                      {expense.paidBy?.name || 'Unknown'} paid ·{' '}
                      {new Date(expense.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>

                  <strong className="dashboard-expense-amount">
                    {formatCurrency(expense.amount)}
                  </strong>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-panel members-panel">
          <div className="panel-heading">
            <div>
              <h2>Group members</h2>
              <p>{members.length} people in this group</p>
            </div>
          </div>

          <div className="dashboard-member-list">
            {members.map((member, index) => (
              <div className="dashboard-member-item" key={member._id}>
                <div className={`member-avatar-small avatar-${index % 5}`}>
                  {getInitial(member.name)}
                </div>
                <div className="dashboard-member-info">
                  <strong>{member.name}</strong>
                  <span>{member.email}</span>
                </div>
                {group.createdBy?._id === member._id && (
                  <span className="creator-label">Creator</span>
                )}
              </div>
            ))}
          </div>

          <button
            className="invite-toggle-button"
            onClick={() => setShowInvite((value) => !value)}
          >
            {showInvite ? 'Hide invitation' : '+ Invite members'}
          </button>

          {showInvite && (
            <div className="dashboard-invite-box">
              <p>Generate a link and share it with your friends.</p>

              <button
                className="dashboard-primary-button"
                onClick={handleGenerateInvite}
                disabled={inviteLoading}
              >
                {inviteLoading ? 'Generating...' : 'Generate invite link'}
              </button>

              {inviteLink && (
                <div className="dashboard-invite-link">
                  <input value={inviteLink} readOnly aria-label="Invitation link" />
                  <button onClick={handleCopyInvite}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}

              {inviteError && (
                <p className="dashboard-error-text">{inviteError}</p>
              )}
            </div>
          )}
        </article>
      </section>

      {/* Balances */}
      <section className="dashboard-panel balances-panel">
        <div className="panel-heading">
          <div>
            <h2>Group balances</h2>
            <p>What each member has paid and their share.</p>
          </div>
        </div>

        <div className="dashboard-balance-grid">
          {balances.map((member) => (
            <article className="dashboard-balance-card" key={member.userId}>
              <strong>{member.name}</strong>
              <div>
                <span>Paid</span>
                <strong>{formatCurrency(member.totalPaid)}</strong>
              </div>
              <div>
                <span>Share</span>
                <strong>{formatCurrency(member.totalShare)}</strong>
              </div>
              <p className={
                member.netBalance > 0
                  ? 'balance-positive'
                  : member.netBalance < 0
                    ? 'balance-negative'
                    : 'balance-settled'
              }>
                {member.netBalance > 0
                  ? `Gets back ${formatCurrency(member.netBalance)}`
                  : member.netBalance < 0
                    ? `Owes ${formatCurrency(Math.abs(member.netBalance))}`
                    : 'Settled up'}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Settlement suggestions */}
      <section className="dashboard-panel settlements-panel">
        <div className="panel-heading">
          <div>
            <h2>Settlement suggestions</h2>
            <p>Suggested payments to settle group balances.</p>
          </div>
        </div>

        {settlements.length === 0 ? (
          <div className="settlement-success-state">
            <span>✓</span>
            <div>
              <strong>Everyone is settled up!</strong>
              <p>There are no pending settlements for this group.</p>
            </div>
          </div>
        ) : (
          <div className="dashboard-settlement-list">
            {settlements.map((settlement, index) => (
              <div className="dashboard-settlement-item" key={index}>
                <div>
                  <strong>{settlement.from.name}</strong>
                  <span> pays </span>
                  <strong>{settlement.to.name}</strong>
                </div>
                <strong>{formatCurrency(settlement.amount)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}

export default GroupDetails;


import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/useAuth';

import {
  fetchGroupById,
  generateInviteLink,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchGroupExpenses,
  fetchGroupBalances,
  fetchGroupSettlements,
  downloadSettlementReport,
  createPayment,
  fetchGroupPayments,
  confirmPayment,
  rejectPayment,
  submitPaymentReference, // ADD THIS
} from '../../services/groupservice';

import './GroupDetails.css';

const formatCurrency = (amount) =>
  `₹${((amount || 0) / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;

  const formatPaymentDate = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const getInitial = (name) => (name || 'U').charAt(0).toUpperCase();

const getMemberId = (value) =>
  typeof value === 'string' ? value : value?._id?.toString();

function GroupDetails() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);

  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const isEditingExpense = Boolean(editingExpenseId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [contributions, setContributions] = useState([]);
  const [splitBetween, setSplitBetween] = useState([]);
  const [splitType, setSplitType] = useState('equal');
  const [customSplits, setCustomSplits] = useState({});

  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [expenseMessage, setExpenseMessage] = useState('');

  const [deletingExpenseId, setDeletingExpenseId] = useState(null);

  const [payments, setPayments] = useState([]);

const [showPaymentForm, setShowPaymentForm] = useState(false);
const [paymentReceiverId, setPaymentReceiverId] = useState('');
const [paymentAmount, setPaymentAmount] = useState('');
const [paymentMethod, setPaymentMethod] = useState('upi');
const [paymentNote, setPaymentNote] = useState('');

const [paymentLoading, setPaymentLoading] = useState(false);
const [paymentActionId, setPaymentActionId] = useState(null);
const [referenceInputs, setReferenceInputs] = useState({});
const [referenceSubmittingId, setReferenceSubmittingId] = useState(null);
const [paymentError, setPaymentError] = useState('');
const [paymentMessage, setPaymentMessage] = useState('');
const [upiQrData, setUpiQrData] = useState(null);

  async function refreshFinancialData() {
  const [
  expenseData,
  balanceData,
  settlementData,
  paymentData,
] = await Promise.all([
  fetchGroupExpenses(groupId),
  fetchGroupBalances(groupId),
  fetchGroupSettlements(groupId),
  fetchGroupPayments(groupId),
]);

setExpenses(expenseData);
setBalances(balanceData);
setSettlements(settlementData);
setPayments(paymentData);
  }

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const groupData = await fetchGroupById(groupId);

      setGroup(groupData);

      const [
  expenseData,
  balanceData,
  settlementData,
  paymentData,
] = await Promise.all([
  fetchGroupExpenses(groupId),
  fetchGroupBalances(groupId),
  fetchGroupSettlements(groupId),
  fetchGroupPayments(groupId),
]);

setExpenses(expenseData);
setBalances(balanceData);
setSettlements(settlementData);
setPayments(paymentData);
    } catch (err) {
      setError(err.message || 'Unable to load group.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const members = group?.members || [];

  const currentMember = members.find(
    (member) =>
      member.email?.toLowerCase() === user?.email?.toLowerCase()
  );

  const currentMemberId = getMemberId(currentMember);

  const totalExpenses = useMemo(
    () => expenses.reduce((total, expense) => total + expense.amount, 0),
    [expenses]
  );

  const payerTotals = useMemo(() => {
    const totals = new Map();

    expenses.forEach((expense) => {
      const items = expense.contributions?.length
        ? expense.contributions
        : expense.paidBy
          ? [{ user: expense.paidBy, amount: expense.amount }]
          : [];

      items.forEach((item) => {
        const name = item.user?.name || 'Unknown';
        totals.set(name, (totals.get(name) || 0) + item.amount);
      });
    });

    return Array.from(totals.entries())
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

  const chartLine = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const chartArea = chartPoints.length ? `12,120 ${chartLine} 288,120` : '';

  const maxPayerTotal = Math.max(...payerTotals.map((payer) => payer.total), 1);

  const currentBalance = balances.find(
    (balance) => getMemberId(balance.userId) === currentMemberId
  );

  const amountInPaise = Math.round(Number(amount) * 100);

  const contributionTotal = contributions.reduce(
    (sum, item) => sum + (Math.round(Number(item.amount) * 100) || 0),
    0
  );

  const customSplitTotal = splitBetween.reduce(
    (sum, memberId) =>
      sum + (Math.round(Number(customSplits[memberId]) * 100) || 0),
    0
  );

  function resetExpenseForm() {
    setEditingExpenseId(null);
    setDescription('');
    setAmount('');
    setContributions([]);
    setSplitBetween([]);
    setCustomSplits({});
    setSplitType('equal');
    setExpenseError('');
    setExpenseMessage('');
  }

  function openExpenseModal() {
    resetExpenseForm();
    setShowExpenseForm(true);
  }

  function openEditExpenseModal(expense) {
    const creatorId = getMemberId(expense.createdBy);

    if (!creatorId || !currentMemberId || creatorId !== currentMemberId) {
      setExpenseMessage(
        'This expense cannot be edited because you are not its creator.'
      );
      return;
    }

    const existingContributions = expense.contributions?.length
      ? expense.contributions
      : expense.paidBy
        ? [{ user: expense.paidBy, amount: expense.amount }]
        : [];

    setEditingExpenseId(expense._id);
    setDescription(expense.description);
    setAmount((expense.amount / 100).toFixed(2));

    setContributions(
      existingContributions.map((item) => ({
        userId: getMemberId(item.user),
        amount: (item.amount / 100).toFixed(2),
      }))
    );

    const selectedSplitMembers = expense.splits.map((item) =>
      getMemberId(item.user)
    );

    setSplitBetween(selectedSplitMembers);

    // Custom mode preserves the exact existing paise allocations.
    const existingCustomSplits = {};

    expense.splits.forEach((item) => {
      const memberId = getMemberId(item.user);
      existingCustomSplits[memberId] = (item.amount / 100).toFixed(2);
    });

    setCustomSplits(existingCustomSplits);
    setSplitType('custom');

    setExpenseError('');
    setExpenseMessage('');
    setShowExpenseForm(true);
  }

  function closeExpenseModal() {
    if (expenseLoading) return;
    setShowExpenseForm(false);
    resetExpenseForm();
  }

  function toggleContributor(memberId) {
    setContributions((current) => {
      const exists = current.some((item) => item.userId === memberId);

      if (exists) {
        return current.filter((item) => item.userId !== memberId);
      }

      return [...current, { userId: memberId, amount: '' }];
    });
  }

  function updateContribution(memberId, value) {
    setContributions((current) =>
      current.map((item) =>
        item.userId === memberId ? { ...item, amount: value } : item
      )
    );
  }

  function toggleSplitMember(memberId) {
    setSplitBetween((current) => {
      if (current.includes(memberId)) {
        setCustomSplits((previous) => {
          const updated = { ...previous };
          delete updated[memberId];
          return updated;
        });

        return current.filter((id) => id !== memberId);
      }

      return [...current, memberId];
    });
  }

  function updateCustomSplit(memberId, value) {
    setCustomSplits((current) => ({
      ...current,
      [memberId]: value,
    }));
  }

  async function handleSaveExpense(event) {
    event.preventDefault();
    setExpenseError('');
    setExpenseMessage('');

    if (!description.trim() || description.trim().length > 150) {
      setExpenseError('Enter a valid description (maximum 150 characters).');
      return;
    }

    if (
      !Number.isFinite(Number(amount)) ||
      amountInPaise <= 0 ||
      !Number.isSafeInteger(Number(amount) * 100)
    ) {
      setExpenseError('Enter a valid amount with up to two decimal places.');
      return;
    }

    if (!contributions.length) {
      setExpenseError('Select at least one contributor.');
      return;
    }

    if (
      contributions.some(
        (item) =>
          !item.amount ||
          !Number.isFinite(Number(item.amount)) ||
          Number(item.amount) <= 0 ||
          !Number.isSafeInteger(Number(item.amount) * 100)
      )
    ) {
      setExpenseError('Enter a valid amount for every contributor.');
      return;
    }

    if (contributionTotal !== amountInPaise) {
      setExpenseError('Contributor amounts must equal the expense amount.');
      return;
    }

    if (!splitBetween.length) {
      setExpenseError('Select at least one member for the split.');
      return;
    }

    if (splitType === 'custom') {
      if (
        splitBetween.some(
          (id) =>
            !customSplits[id] ||
            !Number.isFinite(Number(customSplits[id])) ||
            Number(customSplits[id]) <= 0 ||
            !Number.isSafeInteger(Number(customSplits[id]) * 100)
        )
      ) {
        setExpenseError('Enter a valid custom share for every selected member.');
        return;
      }

      if (customSplitTotal !== amountInPaise) {
        setExpenseError('Custom shares must equal the expense amount.');
        return;
      }
    }

    const expenseData = {
      description: description.trim(),
      amount: Number(amount),
      contributions: contributions.map((item) => ({
        userId: item.userId,
        amount: Number(item.amount),
      })),
      splitBetween,
      splitType,
      customSplits:
        splitType === 'custom'
          ? splitBetween.map((userId) => ({
              userId,
              amount: Number(customSplits[userId]),
            }))
          : [],
    };

    try {
      setExpenseLoading(true);

      if (isEditingExpense) {
        await updateExpense(groupId, editingExpenseId, expenseData);
      } else {
        await createExpense(groupId, expenseData);
      }

      await refreshFinancialData();

      setShowExpenseForm(false);
      resetExpenseForm();

      setExpenseMessage(
        isEditingExpense
          ? 'Expense updated successfully.'
          : 'Expense added successfully.'
      );
    } catch (err) {
      setExpenseError(err.message || 'Unable to save expense.');
    } finally {
      setExpenseLoading(false);
    }
  }

  async function handleDeleteExpense(expense) {
    const creatorId = getMemberId(expense.createdBy);

    if (!creatorId || !currentMemberId || creatorId !== currentMemberId) {
      setExpenseMessage('You can only delete expenses created by you.');
      return;
    }

    const confirmed = window.confirm(
      `Delete "${expense.description}"? This will update the group balances and settlements.`
    );

    if (!confirmed) return;

    try {
      setDeletingExpenseId(expense._id);
      setExpenseMessage('');
      setExpenseError('');

      await deleteExpense(groupId, expense._id);
      await refreshFinancialData();

      setExpenseMessage('Expense deleted successfully.');
    } catch (err) {
      setExpenseError(err.message || 'Unable to delete expense.');
    } finally {
      setDeletingExpenseId(null);
    }
  }

  async function handleGenerateInvite() {
    try {
      setInviteLoading(true);
      setInviteError('');
      setCopied(false);

      const result = await generateInviteLink(groupId);
      setInviteLink(result.inviteLink);
    } catch (err) {
      setInviteError(err.message || 'Unable to generate invite link.');
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

  async function handleDownloadReport() {
    try {
      setReportLoading(true);
      setReportError('');
      await downloadSettlementReport(groupId);
    } catch (err) {
      setReportError(err.message || 'Unable to download settlement report.');
    } finally {
      setReportLoading(false);
    }
  }

  function handleUPIPayment(settlement) {
    const receiverId = getMemberId(settlement.to?.userId);

    const receiver = members.find(
      (member) => getMemberId(member) === receiverId
    );

    const upiId = receiver?.upiProfile?.upiId;
    const isUPIActive = receiver?.upiProfile?.isActive === true;

    if (!upiId || !isUPIActive) {
      setPaymentError(
        `${settlement.to?.name || 'This member'} has not activated a UPI ID.`
      );
      setPaymentMessage('');
      return;
    }

    if (!/^[\w.-]+@[\w.-]+$/.test(upiId)) {
      setPaymentError('The receiver has an invalid UPI ID.');
      setPaymentMessage('');
      return;
    }

    if (
      !Number.isSafeInteger(settlement.amount) ||
      settlement.amount <= 0
    ) {
      setPaymentError('Invalid settlement amount.');
      setPaymentMessage('');
      return;
    }

    const params = new URLSearchParams({
      pa: upiId,
      pn: settlement.to.name,
      am: (settlement.amount / 100).toFixed(2),
      cu: 'INR',
      tn: `EquiSplit settlement - ${group.name}`,
    });

    const upiUrl = `upi://pay?${params.toString()}`;

    setPaymentError('');
    setPaymentMessage('Scan the QR code with a UPI app, or open it on a device with a UPI app installed.');
    setUpiQrData({
      url: upiUrl,
      amount: (settlement.amount / 100).toFixed(2),
      receiverName: settlement.to.name,
      upiId,
    });
  }

  async function handleRecordPayment(event) {
  event.preventDefault();

  setPaymentError('');
  setPaymentMessage('');

  const amountInPaise = Math.round(Number(paymentAmount) * 100);

  if (!paymentReceiverId) {
    setPaymentError('Select the member receiving this payment.');
    return;
  }

  if (
    !Number.isFinite(Number(paymentAmount)) ||
    amountInPaise <= 0 ||
    !Number.isSafeInteger(Number(paymentAmount) * 100)
  ) {
    setPaymentError('Enter a valid amount with up to two decimal places.');
    return;
  }

  try {
    setPaymentLoading(true);

    await createPayment(groupId, {
      toUserId: paymentReceiverId,
      amount: Number(paymentAmount),
      method: paymentMethod,
      note: paymentNote.trim(),
    });

    await refreshFinancialData();

    setPaymentAmount('');
    setPaymentNote('');
    setPaymentReceiverId('');
    setShowPaymentForm(false);

    setPaymentMessage(
      'Payment recorded. It is waiting for receiver confirmation.'
    );
  } catch (err) {
    setPaymentError(err.message || 'Unable to record payment.');
  } finally {
    setPaymentLoading(false);
  }
}

async function handleSubmitPaymentReference(paymentId) {
  const transactionReference = (
    referenceInputs[paymentId] || ''
  ).trim();

  if (!/^[a-zA-Z0-9/_-]{6,100}$/.test(transactionReference)) {
    setPaymentError(
      'Enter a valid transaction reference (6–100 letters, numbers, /, _ or -).'
    );
    setPaymentMessage('');
    return;
  }

  try {
    setReferenceSubmittingId(paymentId);
    setPaymentError('');
    setPaymentMessage('');

    await submitPaymentReference(
      groupId,
      paymentId,
      transactionReference
    );

    setReferenceInputs((previous) => ({
      ...previous,
      [paymentId]: '',
    }));

    await refreshFinancialData();

    setPaymentMessage('Transaction reference submitted successfully.');
  } catch (err) {
    setPaymentError(
      err.message || 'Unable to submit transaction reference.'
    );
  } finally {
    setReferenceSubmittingId(null);
  }
}

async function handlePaymentDecision(paymentId, action) {
  setPaymentError('');
  setPaymentMessage('');

  try {
    setPaymentActionId(paymentId);

    if (action === 'confirm') {
      await confirmPayment(groupId, paymentId);
      setPaymentMessage('Payment confirmed successfully.');
    } else {
      await rejectPayment(groupId, paymentId);
      setPaymentMessage('Payment rejected.');
    }

    await refreshFinancialData();
  } catch (err) {
    setPaymentError(err.message || 'Unable to update payment.');
  } finally {
    setPaymentActionId(null);
  }
}

  useEffect(() => {
    if (!showExpenseForm) return undefined;

    function handleEscape(event) {
      if (event.key === 'Escape' && !expenseLoading) {
        closeExpenseModal();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExpenseForm, expenseLoading]);

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
          <button onClick={() => navigate('/groups')}>Back to groups</button>
        </div>
      </main>
    );
  }

  return (
    <main className="group-dashboard-page">
      <section className="group-dashboard-hero">
        <div>
          <p className="dashboard-eyebrow">GROUP</p>
          <h1>{group.name}</h1>

          <div className="hero-members">
            <div className="hero-avatars">
              {members.slice(0, 5).map((member, index) => (
                <span
                  key={member._id}
                  className={`hero-avatar avatar-${index % 5}`}
                >
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
            onClick={handleDownloadReport}
            disabled={reportLoading}
          >
            {reportLoading ? 'Generating PDF...' : '↓ Download report'}
          </button>

          <button
            className="dashboard-secondary-button"
            onClick={() => navigate('/groups')}
          >
            Back to groups
          </button>

          <button
            className="dashboard-primary-button"
            onClick={openExpenseModal}
          >
            + Add expense
          </button>
        </div>
      </section>

      {reportError && (
        <p className="dashboard-error-text" role="alert">
          {reportError}
        </p>
      )}

      {expenseMessage && (
        <p className="dashboard-success-text" role="status">
          {expenseMessage}
        </p>
      )}

      {expenseError && !showExpenseForm && (
        <p className="dashboard-error-text" role="alert">
          {expenseError}
        </p>
      )}

      <section className="financial-summary">
        <article className="summary-card">
          <span>Total spent</span>
          <strong>{formatCurrency(totalExpenses)}</strong>
        </article>

        <article className="summary-card">
          <span>Your share</span>
          <strong>
            {currentBalance ? formatCurrency(currentBalance.totalShare) : '—'}
          </strong>
        </article>

        <article className="summary-card">
          <span>{currentBalance?.netBalance < 0 ? 'You owe' : 'You are owed'}</span>
          <strong
            className={
              currentBalance?.netBalance < 0
                ? 'summary-negative'
                : 'summary-positive'
            }
          >
            {currentBalance
              ? formatCurrency(Math.abs(currentBalance.netBalance))
              : '—'}
          </strong>
        </article>
      </section>

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
              <svg
                viewBox="0 0 300 145"
                role="img"
                aria-label="Daily spending over the last seven days"
              >
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
              <h2>Who contributed</h2>
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
              {expenses.map((expense, index) => {
                const contributors = expense.contributions?.length
                  ? expense.contributions
                  : expense.paidBy
                    ? [{ user: expense.paidBy, amount: expense.amount }]
                    : [];

                const creatorId = getMemberId(expense.createdBy);

                const canManageExpense =
                  Boolean(creatorId) &&
                  Boolean(currentMemberId) &&
                  creatorId === currentMemberId;

                const isDeleting = deletingExpenseId === expense._id;

                return (
                  <article
                    className="dashboard-expense-item"
                    key={expense._id}
                  >
                    <div className={`expense-avatar expense-avatar-${index % 5}`}>
                      {getInitial(expense.description)}
                    </div>

                    <div className="dashboard-expense-info">
                      <strong>{expense.description}</strong>
                      <span>
                        {contributors
                          .map((item) => item.user?.name || 'Unknown')
                          .join(', ')}
                        {' contributed · '}
                        {new Date(expense.createdAt).toLocaleDateString(
                          'en-IN',
                          {
                            day: 'numeric',
                            month: 'short',
                          }
                        )}
                      </span>
                    </div>

                    <strong className="dashboard-expense-amount">
                      {formatCurrency(expense.amount)}
                    </strong>

                    {canManageExpense && (
                      <div className="expense-item-actions">
                        <button
                          type="button"
                          className="expense-action-button"
                          onClick={() => openEditExpenseModal(expense)}
                          disabled={isDeleting}
                          aria-label={`Edit ${expense.description}`}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="expense-action-button expense-delete-button"
                          onClick={() => handleDeleteExpense(expense)}
                          disabled={isDeleting}
                          aria-label={`Delete ${expense.description}`}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
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
                {getMemberId(group.createdBy) === getMemberId(member) && (
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
                  <input
                    value={inviteLink}
                    readOnly
                    aria-label="Invitation link"
                  />
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

      <section className="dashboard-panel balances-panel">
        <div className="panel-heading">
          <div>
            <h2>Group balances</h2>
            <p>What each member has contributed and their share.</p>
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
              <p
                className={
                  member.netBalance > 0
                    ? 'balance-positive'
                    : member.netBalance < 0
                      ? 'balance-negative'
                      : 'balance-settled'
                }
              >
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
            {settlements.map((settlement, index) => {
              const isCurrentPayer =
                getMemberId(settlement.from?.userId) === currentMemberId;

              const receiverId = getMemberId(settlement.to?.userId);
              const receiver = members.find(
                (member) => getMemberId(member) === receiverId
              );

              const canPayByUPI =
                Boolean(receiver?.upiProfile?.upiId) &&
                receiver?.upiProfile?.isActive === true;

              return (
                <div className="dashboard-settlement-item" key={index}>
                  <div>
                    <strong>{settlement.from.name}</strong>
                    <span> pays </span>
                    <strong>{settlement.to.name}</strong>
                  </div>

                  <strong>{formatCurrency(settlement.amount)}</strong>

                  {isCurrentPayer && (
                    <button
                      type="button"
                      className="dashboard-primary-button"
                      onClick={() => handleUPIPayment(settlement)}
                      disabled={!canPayByUPI}
                      title={
                        canPayByUPI
                          ? 'Pay using UPI'
                          : 'Receiver has not activated a UPI ID'
                      }
                    >
                      {canPayByUPI ? 'Pay Now' : 'UPI unavailable'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      
      {/* Payments */}
<section className="dashboard-panel payments-panel">
  <div className="panel-heading">
    <div>
      <h2>Payments</h2>
      <p>Record payments and track receiver confirmations.</p>
    </div>

    <button
      type="button"
      className="dashboard-primary-button"
      onClick={() => {
        setPaymentError('');
        setPaymentMessage('');
        setShowPaymentForm((value) => !value);
      }}
    >
      {showPaymentForm ? 'Cancel' : '+ Record payment'}
    </button>
  </div>

  {paymentMessage && (
    <p className="dashboard-success-text" role="status">
      {paymentMessage}
    </p>
  )}

  {paymentError && (
    <p className="dashboard-error-text" role="alert">
      {paymentError}
    </p>
  )}

  {showPaymentForm && (
    <form className="payment-form" onSubmit={handleRecordPayment}>
      <h3>Record a payment</h3>

      <label>
        Paying to
        <select
          value={paymentReceiverId}
          onChange={(event) => setPaymentReceiverId(event.target.value)}
          required
        >
          <option value="">Select receiver</option>

          {settlements
            .filter(
              (settlement) =>
                getMemberId(settlement.from.userId) === currentMemberId
            )
            .map((settlement) => (
              <option
                key={getMemberId(settlement.to.userId)}
                value={getMemberId(settlement.to.userId)}
              >
                {settlement.to.name} — outstanding{' '}
                {formatCurrency(settlement.amount)}
              </option>
            ))}
        </select>
      </label>

      <label>
        Amount (₹)
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={paymentAmount}
          onChange={(event) => setPaymentAmount(event.target.value)}
          placeholder="e.g. 500"
          required
        />
      </label>

      <label>
        Payment method
        <select
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value)}
        >
          <option value="upi">UPI</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
        </select>
      </label>

      <label>
        Note (optional)
        <input
          type="text"
          maxLength={200}
          value={paymentNote}
          onChange={(event) => setPaymentNote(event.target.value)}
          placeholder="e.g. Paid through UPI"
        />
      </label>

      <button
        type="submit"
        className="dashboard-primary-button"
        disabled={paymentLoading}
      >
        {paymentLoading ? 'Recording...' : 'Submit payment'}
      </button>
    </form>
  )}

  <div className="payment-history">
    <h3>Payment history</h3>

    {payments.length === 0 ? (
      <div className="chart-empty">
        No payments have been recorded yet.
      </div>
    ) : (
      <div className="payment-list">
        {payments.map((payment) => {
          const receiverId = getMemberId(payment.toUser);
          const isReceiver = receiverId === currentMemberId;
          const isPending = payment.status === 'pending';
          const isProcessing = paymentActionId === payment._id;
          const payerId = getMemberId(payment.fromUser);
          const isPayer = payerId === currentMemberId;

          const isSubmittingReference =
            referenceSubmittingId === payment._id;

          return (
            <article className="payment-item" key={payment._id}>
              <div className="payment-item-main">
                <div>
                  <strong>
                    {payment.fromUser?.name || 'Unknown'} →{' '}
                    {payment.toUser?.name || 'Unknown'}
                  </strong>

                  <span>
                    {payment.method.replace('_', ' ').toUpperCase()}
                    {' · '}
                    {formatPaymentDate(payment.createdAt)}
                  </span>

                  {payment.note && <p>{payment.note}</p>}
                </div>

                <div className="payment-item-amount">
                  <strong>{formatCurrency(payment.amount)}</strong>
                  <span className={`payment-status status-${payment.status}`}>
                    {payment.status}
                  </span>
                </div>
              </div>

              {isPending &&
  isPayer &&
  payment.method === 'upi' &&
  !payment.transactionReference && (
    <div className="payment-reference-form">
      <label>
        UPI transaction reference

        <input
          type="text"
          value={referenceInputs[payment._id] || ''}
          onChange={(event) =>
            setReferenceInputs((previous) => ({
              ...previous,
              [payment._id]: event.target.value,
            }))
          }
          placeholder="Enter UPI transaction reference"
          maxLength={100}
          disabled={isSubmittingReference}
        />
      </label>

      <button
        type="button"
        className="dashboard-primary-button"
        onClick={() =>
          handleSubmitPaymentReference(payment._id)
        }
        disabled={isSubmittingReference}
      >
        {isSubmittingReference
          ? 'Submitting...'
          : 'Submit reference'}
      </button>
    </div>
  )}

  {payment.transactionReference && (
  <p className="payment-reference-display">
    Transaction reference:{' '}
    <strong>{payment.transactionReference}</strong>
  </p>
)}

              {isPending && isReceiver && (
                <div className="payment-actions">
                  <button
                    type="button"
                    className="payment-confirm-button"
                    onClick={() =>
                      handlePaymentDecision(payment._id, 'confirm')
                    }
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Confirm'}
                  </button>

                  <button
                    type="button"
                    className="payment-reject-button"
                    onClick={() =>
                      handlePaymentDecision(payment._id, 'reject')
                    }
                    disabled={isProcessing}
                  >
                    Reject
                  </button>
                </div>
              )}

              {isPending && isPayer && (
  <p className="payment-waiting">
    {payment.transactionReference
      ? 'Reference submitted. Waiting for receiver confirmation.'
      : payment.method === 'upi'
        ? 'Submit your UPI transaction reference after completing the payment.'
        : 'Waiting for receiver confirmation.'}
  </p>
)}
            </article>
          );
        })}
      </div>
    )}
  </div>
</section>

      {upiQrData && (
        <div
          className="upi-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setUpiQrData(null);
          }}
        >
          <section
            className="upi-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upi-modal-title"
          >
            <button
              type="button"
              className="upi-modal-close"
              onClick={() => setUpiQrData(null)}
              aria-label="Close QR code"
            >
              ×
            </button>

            <h2 id="upi-modal-title">Pay with UPI</h2>
            <p>Scan this QR code using a UPI app.</p>

            <div className="upi-qr-wrapper">
              <QRCodeSVG value={upiQrData.url} size={220} level="M" includeMargin />
            </div>

            <h3>₹{upiQrData.amount}</h3>
            <p>{upiQrData.receiverName}</p>
            <p className="upi-modal-id">{upiQrData.upiId}</p>

            <a href={upiQrData.url} className="upi-open-app-button">
              Open UPI App
            </a>

            <p className="upi-modal-note">
              Verify the receiver and amount in your UPI app before approving.
              After payment, return here and record it. Opening this link does not
              confirm that payment succeeded.
            </p>
          </section>
        </div>
      )}

      {showExpenseForm && (
        <div
          className="expense-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeExpenseModal();
          }}
        >
          <section
            className="expense-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-modal-title"
          >
            <div className="expense-modal-header">
              <div>
                <p className="dashboard-eyebrow">
                  {isEditingExpense ? 'EDIT TRANSACTION' : 'NEW TRANSACTION'}
                </p>
                <h2 id="expense-modal-title">
                  {isEditingExpense ? 'Edit expense' : 'Add an expense'}
                </h2>
                <p>Record who contributed and who shares the cost.</p>
              </div>

              <button
                type="button"
                className="panel-close-button"
                onClick={closeExpenseModal}
                disabled={expenseLoading}
                aria-label="Close expense form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
              <label className="expense-modal-field">
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

              <label className="expense-modal-field">
                Total expense amount (₹)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="3000.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </label>

              <div className="expense-modal-section">
                <div className="expense-modal-section-heading">
                  <h3>Who contributed?</h3>
                  <span>{contributions.length} selected</span>
                </div>
                <p>Select contributors and enter how much each person paid.</p>

                <div className="expense-member-options">
                  {members.map((member) => {
                    const selected = contributions.some(
                      (item) => item.userId === member._id
                    );

                    const item = contributions.find(
                      (entry) => entry.userId === member._id
                    );

                    return (
                      <div className="expense-allocation-row" key={member._id}>
                        <label className="expense-member-checkbox">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleContributor(member._id)}
                          />
                          <span>{member.name}</span>
                        </label>

                        {selected && (
                          <input
                            className="allocation-amount-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="₹ amount"
                            aria-label={`${member.name} contribution in rupees`}
                            value={item?.amount ?? ''}
                            onChange={(event) =>
                              updateContribution(member._id, event.target.value)
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="expense-allocation-total">
                  <span>Contributed</span>
                  <strong>{formatCurrency(contributionTotal)}</strong>
                  <span>of {formatCurrency(amountInPaise)}</span>
                </div>
              </div>

              <div className="expense-modal-section">
                <div className="expense-modal-section-heading">
                  <h3>Who shares this expense?</h3>
                  <span>{splitBetween.length} selected</span>
                </div>
                <p>
                  These members owe the expense. They do not have to be the
                  contributors.
                </p>

                <div className="expense-split-members">
                  {members.map((member) => (
                    <label
                      className="expense-member-checkbox"
                      key={member._id}
                    >
                      <input
                        type="checkbox"
                        checked={splitBetween.includes(member._id)}
                        onChange={() => toggleSplitMember(member._id)}
                      />
                      <span>{member.name}</span>
                    </label>
                  ))}
                </div>

                <div className="expense-split-type">
                  <label>
                    <input
                      type="radio"
                      name="splitType"
                      value="equal"
                      checked={splitType === 'equal'}
                      onChange={() => setSplitType('equal')}
                    />
                    Equal split
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="splitType"
                      value="custom"
                      checked={splitType === 'custom'}
                      onChange={() => setSplitType('custom')}
                    />
                    Custom amounts
                  </label>
                </div>

                {splitType === 'equal' &&
                  splitBetween.length > 0 &&
                  amountInPaise > 0 && (
                    <div className="expense-equal-preview">
                      {splitBetween.map((memberId) => {
                        const member = members.find(
                          (entry) => entry._id === memberId
                        );
                        const share = Math.floor(
                          amountInPaise / splitBetween.length
                        );

                        return (
                          <div key={memberId}>
                            <span>{member?.name}</span>
                            <strong>{formatCurrency(share)}</strong>
                          </div>
                        );
                      })}
                      <small>
                        Any remaining paise are distributed automatically when
                        saved.
                      </small>
                    </div>
                  )}

                {splitType === 'custom' && (
                  <div className="expense-custom-splits">
                    {splitBetween.map((memberId) => {
                      const member = members.find(
                        (entry) => entry._id === memberId
                      );

                      return (
                        <label key={memberId}>
                          <span>{member?.name}</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Share in ₹"
                            value={customSplits[memberId] || ''}
                            onChange={(event) =>
                              updateCustomSplit(memberId, event.target.value)
                            }
                          />
                        </label>
                      );
                    })}

                    <div className="expense-allocation-total">
                      <span>Custom shares</span>
                      <strong>{formatCurrency(customSplitTotal)}</strong>
                      <span>of {formatCurrency(amountInPaise)}</span>
                    </div>
                  </div>
                )}
              </div>

              {expenseError && (
                <p className="dashboard-error-text" role="alert">
                  {expenseError}
                </p>
              )}

              <div className="expense-modal-actions">
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={closeExpenseModal}
                  disabled={expenseLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="dashboard-primary-button"
                  disabled={expenseLoading}
                >
                  {expenseLoading
                    ? 'Saving...'
                    : isEditingExpense
                      ? 'Update expense'
                      : 'Save expense'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default GroupDetails;

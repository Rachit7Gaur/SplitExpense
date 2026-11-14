
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchGroupById,
  generateInviteLink,
  createExpense,
  fetchGroupExpenses,
  fetchGroupBalances,
  fetchGroupSettlements
} from '../../services/groupservice';

import './GroupDetails.css';

function GroupDetails() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invitation states
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  // Expense states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [expenseMessage, setExpenseMessage] = useState('');
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);

  useEffect(() => {
    async function loadGroup() {
      try {
        const data = await fetchGroupById(groupId);

        const settlementData = await fetchGroupSettlements(groupId);
        setSettlements(settlementData);

        setGroup(data);
        setPaidBy(data.members[0]?._id || '');

        const expenseData = await fetchGroupExpenses(groupId);
        setExpenses(expenseData);

        const balanceData = await fetchGroupBalances(groupId);
        setBalances(balanceData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [groupId]);

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
        splitBetween: group.members.map((member) => member._id)
      });

      const updatedExpenses = await fetchGroupExpenses(groupId);
      setExpenses(updatedExpenses);

      const updatedBalances = await fetchGroupBalances(groupId);
      setBalances(updatedBalances);

      const updatedSettlements = await fetchGroupSettlements(groupId);
      setSettlements(updatedSettlements);

      setDescription('');
      setAmount('');
      setExpenseMessage('Expense added successfully!');
    } catch (err) {
      setExpenseError(err.message);
    } finally {
      setExpenseLoading(false);
    }
  }

  if (loading) {
    return <p>Loading group details...</p>;
  }

  if (error) {
    return (
      <main className="group-details-page">
        <p className="group-details-error">{error}</p>
        <button onClick={() => navigate('/groups')}>
          Back to groups
        </button>
      </main>
    );
  }

  return (
    <main className="group-details-page">
      <button onClick={() => navigate('/groups')}>
        ← Back to groups
      </button>

      <h1>{group.name}</h1>

      <p>Created by: {group.createdBy?.name}</p>

      {/* Group Members */}
      <section className="members-section">
        <h2>Group Members ({group.members.length})</h2>

        {group.members.map((member) => (
          <article className="member-card" key={member._id}>
            <strong>{member.name}</strong>
            <p>{member.email}</p>
          </article>
        ))}
      </section>

      {/* Invitation */}
      <section className="invite-section">
        <h2>Invite Members</h2>

        <p>
          Share an invitation link with friends so they can join this group.
        </p>

        <button
          type="button"
          onClick={handleGenerateInvite}
          disabled={inviteLoading}
        >
          {inviteLoading ? 'Generating...' : 'Generate Invite Link'}
        </button>

        {inviteLink && (
          <div className="invite-link-container">
            <input type="text" value={inviteLink} readOnly />

            <button type="button" onClick={handleCopyInvite}>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        )}

        {inviteError && (
          <p className="group-details-error">{inviteError}</p>
        )}
      </section>

      {/* Add Expense */}
      <section className="expense-section">
        <h2>Add Expense</h2>

        <form onSubmit={handleAddExpense}>
          <div className="expense-form-group">
            <label htmlFor="expense-description">
              Description
            </label>

            <input
              id="expense-description"
              type="text"
              placeholder="e.g. Hotel booking"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={150}
              required
            />
          </div>

          <div className="expense-form-group">
            <label htmlFor="expense-amount">
              Amount (₹)
            </label>

            <input
              id="expense-amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              min="0.01"
              step="0.01"
              required
            />
          </div>

          <div className="expense-form-group">
            <label htmlFor="expense-payer">
              Paid by
            </label>

            <select
              id="expense-payer"
              value={paidBy}
              onChange={(event) => setPaidBy(event.target.value)}
              required
            >
              {group.members.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <p>
            <strong>Split:</strong> Equally among all {group.members.length} members.
          </p>

          {expenseError && (
            <p className="group-details-error">{expenseError}</p>
          )}

          {expenseMessage && (
            <p className="expense-success">{expenseMessage}</p>
          )}

          <button type="submit" disabled={expenseLoading}>
            {expenseLoading ? 'Adding Expense...' : 'Add Expense'}
          </button>
        </form>
      </section>

      {/* Expense History */}
      <section className="expense-history-section">
        <h2>Expense History</h2>

        {expenses.length === 0 ? (
          <p>No expenses added yet.</p>
        ) : (
          expenses.map((expense) => (
            <article className="expense-card" key={expense._id}>
              <div>
                <h3>{expense.description}</h3>

                <p>
                  Paid by: {expense.paidBy?.name || 'Unknown'}
                </p>

                <p>
                  {new Date(expense.createdAt).toLocaleDateString()}
                </p>
              </div>

              <h3>
                ₹{(expense.amount / 100).toFixed(2)}
              </h3>

              <div className="expense-splits">
                <strong>Split details:</strong>

                {expense.splits?.map((split) => (
                  <p key={split.user?._id}>
                    {split.user?.name || 'Member'}: ₹
                    {(split.amount / 100).toFixed(2)}
                  </p>
                ))}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="balances-section">
        <h2>Group Balances</h2>

        {balances.length === 0 ? (
          <p>No balance information available.</p>
        ) : (
          balances.map((member) => (
            <article className="balance-card" key={member.userId}>
              <h3>{member.name}</h3>

              <p>
                Total Paid: ₹{(member.totalPaid / 100).toFixed(2)}
              </p>

              <p>
                Total Share: ₹{(member.totalShare / 100).toFixed(2)}
              </p>

              <strong
                className={
                  member.netBalance > 0
                    ? 'balance-positive'
                    : member.netBalance < 0
                    ? 'balance-negative'
                    : 'balance-settled'
                }
              >
                {member.netBalance > 0
                  ? `Gets back ₹${(member.netBalance / 100).toFixed(2)}`
                  : member.netBalance < 0
                  ? `Owes ₹${(Math.abs(member.netBalance) / 100).toFixed(2)}`
                  : 'Settled'}
              </strong>
            </article>
          ))
        )}
      </section>

      <section className="settlements-section">
        <h2>Settlement Suggestions</h2>

        {settlements.length === 0 ? (
          <p>Everyone is settled up!</p>
        ) : (
          settlements.map((settlement, index) => (
            <article className="settlement-card" key={index}>
              <div>
                <strong>{settlement.from.name}</strong>
                <p>pays</p>
                <strong>{settlement.to.name}</strong>
              </div>

              <h3>
                ₹{(settlement.amount / 100).toFixed(2)}
              </h3>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

export default GroupDetails;

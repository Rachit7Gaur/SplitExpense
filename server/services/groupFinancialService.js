
const calculateSettlements = require('../utils/settlementCalculator');

function getId(value) {
  if (!value) return null;

  return value._id
    ? value._id.toString()
    : value.toString();
}

function getExpenseContributions(expense) {
  // New expense format.
  if (expense.contributions?.length) {
    return expense.contributions;
  }

  // Backward compatibility with old expenses.
  if (expense.paidBy) {
    return [
      {
        user: expense.paidBy,
        amount: expense.amount,
      },
    ];
  }

  return [];
}

function calculateGroupFinancials(group, expenses, payments = []) {
  const balances = new Map();

  // 1. Initialize every group member.
  group.members.forEach((member) => {
    const memberId = getId(member);

    balances.set(memberId, {
      userId: member._id || member,
      name: member.name || 'Unknown member',
      totalPaid: 0,
      totalShare: 0,
      netBalance: 0,
    });
  });

  // 2. Calculate expense contributions and shares.
  expenses.forEach((expense) => {
    getExpenseContributions(expense).forEach((contribution) => {
      const member = balances.get(getId(contribution.user));

      if (member) {
        member.totalPaid += contribution.amount;
      }
    });

    expense.splits.forEach((split) => {
      const member = balances.get(getId(split.user));

      if (member) {
        member.totalShare += split.amount;
      }
    });
  });

  // 3. Calculate initial net balance from expenses.
  balances.forEach((member) => {
    member.netBalance = member.totalPaid - member.totalShare;
  });

  // 4. Apply only confirmed payments.
  payments.forEach((payment) => {
    if (payment.status !== 'confirmed') {
      return;
    }

    const payer = balances.get(getId(payment.fromUser));
    const receiver = balances.get(getId(payment.toUser));

    if (!payer || !receiver) {
      return;
    }

    // Payer's outstanding debt decreases.
    payer.netBalance += payment.amount;

    // Receiver's credit decreases.
    receiver.netBalance -= payment.amount;
  });

  // 5. Generate final balance list.
  const balanceList = Array.from(balances.values());

  // 6. Generate settlement suggestions.
  const settlements = calculateSettlements(balanceList);

  return {
    balances: balanceList,
    settlements,
  };
}

module.exports = calculateGroupFinancials;
module.exports.getExpenseContributions = getExpenseContributions;

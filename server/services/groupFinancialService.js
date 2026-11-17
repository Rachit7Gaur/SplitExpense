
const calculateSettlements = require('../utils/settlementCalculator');

function getId(value) {
  if (!value) return null;
  return value._id ? value._id.toString() : value.toString();
}

function getExpenseContributions(expense) {
  // New expense format.
  if (expense.contributions?.length) {
    return expense.contributions;
  }

  // Backward compatibility with old expenses.
  if (expense.paidBy) {
    return [{
      user: expense.paidBy,
      amount: expense.amount,
    }];
  }

  return [];
}

function calculateGroupFinancials(group, expenses) {
  const balances = new Map();

  group.members.forEach((member) => {
    balances.set(getId(member._id), {
      userId: member._id,
      name: member.name,
      totalPaid: 0,
      totalShare: 0,
      netBalance: 0,
    });
  });

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

  const balanceList = Array.from(balances.values()).map((member) => ({
    ...member,
    netBalance: member.totalPaid - member.totalShare,
  }));

  return {
    balances: balanceList,
    settlements: calculateSettlements(balanceList),
  };
}

module.exports = calculateGroupFinancials;
module.exports.getExpenseContributions = getExpenseContributions;

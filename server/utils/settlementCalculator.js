
function calculateSettlements(balances) {
  const creditors = [];
  const debtors = [];

  // Separate creditors and debtors.
  balances.forEach((member) => {
    if (member.netBalance > 0) {
      creditors.push({
        userId: member.userId,
        name: member.name,
        amount: member.netBalance
      });
    } else if (member.netBalance < 0) {
      debtors.push({
        userId: member.userId,
        name: member.name,
        amount: Math.abs(member.netBalance)
      });
    }
  });

  const settlements = [];

  let creditorIndex = 0;
  let debtorIndex = 0;

  // Match debtors with creditors.
  while (
    creditorIndex < creditors.length &&
    debtorIndex < debtors.length
  ) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];

    const amount = Math.min(
      creditor.amount,
      debtor.amount
    );

    settlements.push({
      from: {
        userId: debtor.userId,
        name: debtor.name
      },
      to: {
        userId: creditor.userId,
        name: creditor.name
      },
      amount
    });

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0) {
      creditorIndex++;
    }

    if (debtor.amount === 0) {
      debtorIndex++;
    }
  }

  return settlements;
}

module.exports = calculateSettlements;

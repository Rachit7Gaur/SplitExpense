
import { auth } from '../firebase';

const API_URL = 'http://localhost:5000/api/groups';

// Get Firebase authentication token
async function getAuthToken() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('Please log in again.');
  }

  return currentUser.getIdToken();
}

// Fetch all groups
export async function fetchGroups() {
  const token = await getAuthToken();

  const response = await fetch(API_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Could not fetch groups.');
  }

  return result.data.groups;
}

// Create a new group
export async function createGroup(groupName) {
  const token = await getAuthToken();

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: groupName,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Group creation failed.');
  }

  return result.data.group;
}

// Fetch details of a specific group
export async function fetchGroupById(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || 'Could not fetch group details.'
    );
  }

  return result.data.group;
}

// Generate group invitation link
export async function generateInviteLink(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to generate invitation link.'
    );
  }

  return result.data;
}

// Accept group invitation
export async function acceptGroupInvite(inviteToken) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/join/${inviteToken}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to join this group.'
    );
  }

  return result.data;
}

// Create expense
export async function createExpense(groupId, expenseData) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(expenseData),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to create expense.');
  }

  return result.data.expense;
}

// Update expense
export async function updateExpense(groupId, expenseId, expenseData) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/${groupId}/expenses/${expenseId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(expenseData),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to update expense.');
  }

  return result.data.expense;
}

// Delete expense
export async function deleteExpense(groupId, expenseId) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/${groupId}/expenses/${expenseId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to delete expense.');
  }

  return result.data;
}

// Fetch group expenses
export async function fetchGroupExpenses(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/expenses`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to fetch expenses.');
  }

  return result.data.expenses;
}

// Fetch group balances
export async function fetchGroupBalances(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/balances`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to fetch group balances.');
  }

  return result.data.balances;
}

// Fetch settlement suggestions
export async function fetchGroupSettlements(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/settlements`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to fetch settlement suggestions.'
    );
  }

  return result.data.settlements;
}

// Download settlement PDF report
export async function downloadSettlementReport(groupId) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/${groupId}/settlement-report`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    let message = 'Unable to download settlement report.';

    try {
      const result = await response.json();
      message = result.message || message;
    } catch {
      // Keep default error message.
    }

    throw new Error(message);
  }

  const pdfBlob = await response.blob();
  const objectUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');

  const disposition = response.headers.get('Content-Disposition');
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);

  link.href = objectUrl;
  link.download = filenameMatch?.[1] || 'settlement-report.pdf';

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
}
// Create a manual payment record
export async function createPayment(groupId, paymentData) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(paymentData),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to record payment.');
  }

  return result.data.payment;
}

// Fetch payment history
export async function fetchGroupPayments(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/payments`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to fetch payment history.');
  }

  return result.data.payments;
}

// Confirm a payment received
export async function confirmPayment(groupId, paymentId) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/${groupId}/payments/${paymentId}/confirm`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to confirm payment.');
  }

  return result.data.payment;
}

// Reject a payment received
export async function rejectPayment(groupId, paymentId) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/${groupId}/payments/${paymentId}/reject`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to reject payment.');
  }

  return result.data.payment;
}
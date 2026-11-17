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
      Authorization: `Bearer ${token}`
    }
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
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: groupName
    })
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
      Authorization: `Bearer ${token}`
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || 'Could not fetch group details.'
    );
  }

  return result.data.group;
}

export async function generateInviteLink(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to generate invitation link.'
    );
  }

  return result.data;
}

export async function acceptGroupInvite(inviteToken) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/join/${inviteToken}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to join this group.'
    );
  }

  return result.data;
}

export async function createExpense(groupId, expenseData) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(expenseData)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to create expense.');
  }

  return result.data;
}

export async function fetchGroupExpenses(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/expenses`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to fetch expenses.');
  }

  return result.data.expenses;
}

export async function fetchGroupBalances(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/balances`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to fetch group balances.');
  }

  return result.data.balances;
}

export async function fetchGroupSettlements(groupId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/${groupId}/settlements`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || 'Unable to fetch settlement suggestions.'
    );
  }

  return result.data.settlements;
}


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
      // Keep the default error message if the response isn't JSON.
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

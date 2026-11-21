
import { auth } from '../firebase';

import API_BASE_URL from '../config/api';

const API_URL = `${API_BASE_URL}/payment-profile`;

async function getAuthToken() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('Please log in again.');
  }

  return currentUser.getIdToken();
}

// Fetch the saved UPI profile
export async function fetchPaymentProfile() {
  const token = await getAuthToken();

  const response = await fetch(API_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to fetch payment profile.');
  }

  return result.data;
}

// Save or update the UPI profile
export async function updatePaymentProfile(upiId, isActive) {
  const token = await getAuthToken();

  const response = await fetch(API_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      upiId,
      isActive,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Unable to update payment profile.');
  }

  return result.data;
}

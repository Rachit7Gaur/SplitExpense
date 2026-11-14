
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');

const serviceAccountPath = path.join(
  __dirname,
  '../secrets/firebase-service-account.json'
);

const serviceAccount = require(serviceAccountPath);

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount)
      })
    : getApps()[0];

const auth = getAuth(app);

module.exports = {
  app,
  auth
};

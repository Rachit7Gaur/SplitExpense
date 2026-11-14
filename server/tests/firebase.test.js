
try {
  const { auth } = require('../config/firebaseAdmin');

  console.log('PASS: Firebase Admin initialized.');
  console.log(
    'Token verification function:',
    typeof auth.verifyIdToken
  );
} catch (error) {
  console.error('FAIL: Firebase initialization failed.');
  console.error(error.message);
  process.exitCode = 1;
}

const mongoose = require('mongoose');
const Group = require('../models/Group');

async function withGroupTransaction(groupId, callback) {
  if (!mongoose.isValidObjectId(groupId)) {
    throw new Error('INVALID_GROUP_ID');
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(
      async () => {
        // Acquire the shared lock for this group.
        const lockedGroup = await Group.findOneAndUpdate(
          { _id: groupId },
          { $inc: { paymentLockVersion: 1 } },
          {
            session,
            returnDocument: 'after',
          }
        );

        if (!lockedGroup) {
          throw new Error('GROUP_NOT_FOUND');
        }

        // All financial database operations must use this session.
        result = await callback(session, lockedGroup);
      },
      {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary',
      }
    );

    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = withGroupTransaction;
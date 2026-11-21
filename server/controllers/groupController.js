
const mongoose = require('mongoose');
const crypto = require('crypto');

const User = require('../models/User');
const Group = require('../models/Group');

const withGroupTransaction = require('../utils/withGroupTransaction');

// --------------------------------------------------
// Common helpers
// --------------------------------------------------

function sendGroupError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.message === 'INVALID_GROUP_ID') {
    return res.status(400).json({
      success: false,
      message: 'Invalid group ID.'
    });
  }

  if (error.message === 'GROUP_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      message: 'Group not found.'
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A duplicate record already exists.'
    });
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage
  });
}

async function findCurrentUser(firebaseUid) {
  return User.findOne({ firebaseUid });
}

function isGroupMember(group, userId) {
  return group.members.some(
    (memberId) => memberId.toString() === userId.toString()
  );
}

// --------------------------------------------------
// Validate group name
// --------------------------------------------------

function validateGroupInput(req, res, next) {
  const { name } = req.body;

  if (typeof name !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Group name must be a string.'
    });
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2 || trimmedName.length > 80) {
    return res.status(400).json({
      success: false,
      message: 'Group name must be between 2 and 80 characters.'
    });
  }

  req.validatedGroupName = trimmedName;

  return next();
}

// --------------------------------------------------
// Create a new group
// --------------------------------------------------

async function createGroup(req, res) {
  try {
    const user = await findCurrentUser(req.user.uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found. Please sync your profile first.'
      });
    }

    const group = await Group.create({
      name: req.validatedGroupName,
      createdBy: user._id,
      members: [user._id]
    });

    await group.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'members', select: 'name email' }
    ]);

    return res.status(201).json({
      success: true,
      message: 'Group created successfully.',
      data: { group }
    });
  } catch (error) {
    return sendGroupError(res, error, 'Unable to create group.');
  }
}

// --------------------------------------------------
// Get all groups of the logged-in user
// --------------------------------------------------

async function getMyGroups(req, res) {
  try {
    const user = await findCurrentUser(req.user.uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found. Please sync your profile first.'
      });
    }

    const groups = await Group.find({
      members: user._id
    })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('members', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Groups fetched successfully.',
      count: groups.length,
      data: { groups }
    });
  } catch (error) {
    return sendGroupError(res, error, 'Unable to fetch groups.');
  }
}

// --------------------------------------------------
// Get details of a specific group
// --------------------------------------------------

async function getGroupById(req, res) {
  try {
    const { groupId } = req.params;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.'
      });
    }

    const user = await findCurrentUser(req.user.uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: user._id
    })
      .populate('createdBy', 'name email')
      .populate(
        'members',
        'name email upiProfile.upiId upiProfile.isActive'
      );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.'
      });
    }

    // Remove duplicate members from the response only.
    // A GET request should not modify the database.
    const uniqueMembers = [
      ...new Map(
        group.members.map((member) => [
          member._id.toString(),
          member
        ])
      ).values()
    ];

    const groupData = group.toObject();
    groupData.members = uniqueMembers;

    return res.status(200).json({
      success: true,
      message: 'Group details fetched successfully.',
      data: { group: groupData }
    });
  } catch (error) {
    return sendGroupError(
      res,
      error,
      'Unable to fetch group details.'
    );
  }
}

// --------------------------------------------------
// Generate invitation link
// Only the group creator can generate an invite.
// --------------------------------------------------

async function generateInviteLink(req, res) {
  try {
    const { groupId } = req.params;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.'
      });
    }

    const clientUrl = process.env.CLIENT_URL;

    if (!clientUrl) {
      console.error('CLIENT_URL is missing from server environment.');

      return res.status(500).json({
        success: false,
        message: 'Invitation service is not configured.'
      });
    }

    const user = await findCurrentUser(req.user.uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const result = await withGroupTransaction(
      groupId,
      async (session, lockedGroup) => {
        // Only the creator can generate invitation links.
        if (
          lockedGroup.createdBy.toString() !== user._id.toString()
        ) {
          const error = new Error('NOT_GROUP_CREATOR');
          error.statusCode = 403;
          throw error;
        }

        const inviteToken = crypto.randomBytes(32).toString('hex');

        const inviteTokenHash = crypto
          .createHash('sha256')
          .update(inviteToken)
          .digest('hex');

        const inviteExpiresAt = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        );

        // Store only the hash, never the original token.
        lockedGroup.inviteTokenHash = inviteTokenHash;
        lockedGroup.inviteExpiresAt = inviteExpiresAt;
        lockedGroup.inviteEnabled = true;

        await lockedGroup.save({ session });

        return {
          inviteToken,
          inviteExpiresAt
        };
      }
    );

    const normalizedClientUrl = clientUrl.replace(/\/+$/, '');

    const inviteLink =
      `${normalizedClientUrl}/join-group/${result.inviteToken}`;

    return res.status(200).json({
      success: true,
      message: 'Invitation link generated successfully.',
      data: {
        inviteLink,
        expiresAt: result.inviteExpiresAt
      }
    });
  } catch (error) {
    if (error.message === 'NOT_GROUP_CREATOR') {
      return res.status(403).json({
        success: false,
        message: 'Only the group creator can generate an invitation link.'
      });
    }

    return sendGroupError(
      res,
      error,
      'Unable to generate invitation link.'
    );
  }
}

// --------------------------------------------------
// Accept invitation
// Add the user to the group transactionally.
// --------------------------------------------------

async function acceptInvite(req, res) {
  try {
    const { token } = req.params;

    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invitation link.'
      });
    }

    const user = await findCurrentUser(req.user.uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const inviteTokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Initial lookup finds the group ID.
    // The invitation is checked again inside the transaction.
    const inviteGroup = await Group.findOne({
      inviteTokenHash,
      inviteEnabled: true,
      inviteExpiresAt: { $gt: new Date() }
    })
      .select('_id')
      .lean();

    if (!inviteGroup) {
      return res.status(404).json({
        success: false,
        message: 'Invitation is invalid or has expired.'
      });
    }

    const result = await withGroupTransaction(
      inviteGroup._id,
      async (session) => {
        // Re-check the invitation inside the transaction.
        const group = await Group.findOne({
          _id: inviteGroup._id,
          inviteTokenHash,
          inviteEnabled: true,
          inviteExpiresAt: { $gt: new Date() }
        })
          .select('+inviteTokenHash')
          .session(session);

        if (!group) {
          const error = new Error('INVITE_INVALID_OR_EXPIRED');
          error.statusCode = 404;
          throw error;
        }

        if (isGroupMember(group, user._id)) {
          return {
            alreadyMember: true,
            groupId: group._id
          };
        }

        // $addToSet prevents duplicate membership.
        group.members.addToSet(user._id);

        await group.save({ session });

        return {
          alreadyMember: false,
          groupId: group._id
        };
      }
    );

    if (result.alreadyMember) {
      return res.status(200).json({
        success: true,
        message: 'You are already a member of this group.',
        data: {
          groupId: result.groupId
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'You have successfully joined the group.',
      data: {
        groupId: result.groupId
      }
    });
  } catch (error) {
    if (error.message === 'INVITE_INVALID_OR_EXPIRED') {
      return res.status(404).json({
        success: false,
        message: 'Invitation is invalid or has expired.'
      });
    }

    return sendGroupError(
      res,
      error,
      'Unable to accept invitation.'
    );
  }
}

// --------------------------------------------------
// Exports
// --------------------------------------------------

module.exports = {
  validateGroupInput,
  createGroup,
  getMyGroups,
  getGroupById,
  generateInviteLink,
  acceptInvite
};

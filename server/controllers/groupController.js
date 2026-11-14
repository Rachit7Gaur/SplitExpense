const mongoose = require('mongoose');
const User = require('../models/User');
const Group = require('../models/Group');
const crypto = require('crypto');

// Validate group name
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
  next();
}

// Create a new group
async function createGroup(req, res) {
  try {
    const user = await User.findOne({
      firebaseUid: req.user.uid
    });

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

    return res.status(201).json({
      success: true,
      message: 'Group created successfully.',
      data: { group }
    });
  } catch (error) {
    console.error('Create group error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to create group.'
    });
  }
}

// Get all groups of the logged-in user
async function getMyGroups(req, res) {
  try {
    const user = await User.findOne({
      firebaseUid: req.user.uid
    });

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
    console.error('Get groups error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch groups.'
    });
  }
}

// Get details of a specific group
async function getGroupById(req, res) {
  try {
    // Validate the group ID
    if (!mongoose.isValidObjectId(req.params.groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.'
      });
    }

    // Find the logged-in user's database profile
    const user = await User.findOne({
      firebaseUid: req.user.uid
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    // Find the group only if the user is a member
    const group = await Group.findOne({
      _id: req.params.groupId,
      members: user._id
    })
      .populate('createdBy', 'name email')
      .populate('members', 'name email');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.'
      });
    }

        // Remove duplicate member IDs
    const uniqueMembers = [
      ...new Map(
        group.members.map((member) => [
          member.toString(),
          member
        ])
      ).values()
    ];

    if (uniqueMembers.length !== group.members.length) {
      group.members = uniqueMembers;
      await group.save();
    }

    // Populate member details
    await group.populate('createdBy', 'name email');
    await group.populate('members', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Group details fetched successfully.',
      data: { group }
    });

  } catch (error) {
    console.error('Get group details error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch group details.'
    });
  }
}

async function generateInviteLink(req, res) {
  try {
    const { groupId } = req.params;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.'
      });
    }

    const user = await User.findOne({
      firebaseUid: req.user.uid
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      createdBy: user._id
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not the creator.'
      });
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');

    const inviteTokenHash = crypto
      .createHash('sha256')
      .update(inviteToken)
      .digest('hex');

    const inviteExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    group.inviteTokenHash = inviteTokenHash;
    group.inviteExpiresAt = inviteExpiresAt;
    group.inviteEnabled = true;

    await group.save();

    const inviteLink =
      `${process.env.CLIENT_URL}/join-group/${inviteToken}`;

    return res.status(200).json({
      success: true,
      message: 'Invitation link generated successfully.',
      data: {
        inviteLink,
        expiresAt: inviteExpiresAt
      }
    });
  } catch (error) {
    console.error('Generate invite link error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to generate invitation link.'
    });
  }
}

async function acceptInvite(req, res) {
  try {
    const { token } = req.params;

    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invitation link.'
      });
    }

    const user = await User.findOne({
      firebaseUid: req.user.uid
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found. Please sync your profile first.'
      });
    }

    const inviteTokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const group = await Group.findOne({
      inviteTokenHash,
      inviteEnabled: true,
      inviteExpiresAt: { $gt: new Date() }
    }).select('+inviteTokenHash');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Invitation is invalid or has expired.'
      });
    }

    if (group.members.some(
      (memberId) => memberId.toString() === user._id.toString()
    )) {
      return res.status(200).json({
        success: true,
        message: 'You are already a member of this group.',
        data: { groupId: group._id }
      });
    }

    await Group.updateOne(
      {
        _id: group._id,
        members: { $ne: user._id }
      },
      {
        $addToSet: { members: user._id }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'You have successfully joined the group.',
      data: { groupId: group._id }
    });
  } catch (error) {
    console.error('Accept invite error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to accept invitation.'
    });
  }
}

module.exports = {
  validateGroupInput,
  createGroup,
  getMyGroups,
  getGroupById,
  generateInviteLink,
  acceptInvite
};
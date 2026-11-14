
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [2, 'Group name must be at least 2 characters'],
      maxlength: [80, 'Group name cannot exceed 80 characters']
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Group creator is required']
    },

    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      default: [],
      validate: {
        validator: function (members) {
          const memberIds = members.map((id) => id.toString());
          return new Set(memberIds).size === memberIds.length;
        },
        message: 'A user cannot be added to the group more than once'
      }
    },

    inviteTokenHash: {
      type: String,
      default: null,
      select: false
    },

    inviteExpiresAt: {
      type: Date,
      default: null
    },

    inviteEnabled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;

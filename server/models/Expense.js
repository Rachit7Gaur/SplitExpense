
const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Split amount must be a safe integer in paise'
      }
    }
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Expense description is required'],
      trim: true,
      maxlength: [150, 'Description cannot exceed 150 characters']
    },

    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [1, 'Amount must be at least 1 paisa'],
      validate: {
        validator: Number.isSafeInteger,
        message: 'Amount must be a safe integer in paise'
      }
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Payer is required']
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: [true, 'Group is required']
    },

    splits: {
      type: [splitSchema],
      required: true,
      validate: {
        validator: function (splits) {
          if (!splits || splits.length === 0) {
            return false;
          }

          const userIds = splits.map(
            (split) => split.user.toString()
          );

          const uniqueUsers = new Set(userIds);

          const totalSplit = splits.reduce(
            (total, split) => total + split.amount,
            0
          );

          return (
            uniqueUsers.size === userIds.length &&
            totalSplit === this.amount
          );
        },
        message: 'Splits must contain unique users and equal the expense amount.'
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;

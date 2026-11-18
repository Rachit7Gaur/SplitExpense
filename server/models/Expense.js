const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Allocation must be a safe integer in paise.',
      },
    },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Expense description is required'],
      trim: true,
      maxlength: [150, 'Description cannot exceed 150 characters'],
    },

    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [1, 'Amount must be at least 1 paisa'],
      validate: {
        validator: Number.isSafeInteger,
        message: 'Amount must be a safe integer in paise.',
      },
    },

    contributions: {
      type: [allocationSchema],
      default: [],
      validate: {
        validator: function (items) {
          if (!items || items.length === 0) {
            return Boolean(this.paidBy);
          }

          const ids = items.map((item) => item.user.toString());
          const uniqueIds = new Set(ids);
          const total = items.reduce((sum, item) => sum + item.amount, 0);

          return uniqueIds.size === ids.length && total === this.amount;
        },
        message:
          'Contributions must have unique users and equal the expense amount.',
      },
    },

    // Retained for legacy expenses.
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    // User who originally created this expense.
    // Optional to support expenses created before this field existed.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },

    splits: {
      type: [allocationSchema],
      required: true,
      validate: {
        validator: function (items) {
          if (!items || items.length === 0) return false;

          const ids = items.map((item) => item.user.toString());
          const uniqueIds = new Set(ids);
          const total = items.reduce((sum, item) => sum + item.amount, 0);

          return uniqueIds.size === ids.length && total === this.amount;
        },
        message: 'Splits must have unique users and equal the expense amount.',
      },
    },

    splitType: {
      type: String,
      enum: ['equal', 'custom'],
      default: 'equal',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },

    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [1, 'Payment must be at least 1 paisa'],
      validate: {
        validator: Number.isSafeInteger,
        message: 'Payment amount must be a safe integer in paise.',
      },
    },

    method: {
      type: String,
      enum: ['upi', 'cash', 'bank_transfer'],
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: [200, 'Note cannot exceed 200 characters'],
      default: '',
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected'],
      default: 'pending',
      required: true,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentSchema.index({ groupId: 1, createdAt: -1 });
paymentSchema.index({ groupId: 1, fromUser: 1, toUser: 1, status: 1 });

paymentSchema.pre('validate', function () {
  if (this.fromUser && this.toUser &&
      this.fromUser.toString() === this.toUser.toString()) {
    this.invalidate('toUser', 'Payer and receiver must be different users.');
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
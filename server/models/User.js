
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, 'Firebase UID is required'],
      trim: true
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters']
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email cannot exceed 254 characters']
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: null
    },

    // User's UPI payment profile
    upiProfile: {
      upiId: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [100, 'UPI ID cannot exceed 100 characters'],
        default: null
      },

      isActive: {
        type: Boolean,
        default: false
      }
    },

    profileCompleted: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

userSchema.index({ firebaseUid: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

userSchema.index(
  { phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phoneNumber: { $type: 'string' }
    }
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;

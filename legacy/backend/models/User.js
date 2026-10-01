'use strict';

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  role: {
    type: String,
    required: true,
    enum: ['patient', 'doctor', 'hospital', 'lab', 'admin', 'insurance']
  },
  name: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  walletAddress: {
    type: String,
    default: ''
  },
  passwordHash: {
    type: String,
    required: true
  },
  encryptionKey: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);

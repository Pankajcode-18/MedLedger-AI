'use strict';

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  doctorId: {
    type: String,
    required: true
  },
  doctorName: {
    type: String,
    default: 'Attending Physician'
  },
  recordId: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

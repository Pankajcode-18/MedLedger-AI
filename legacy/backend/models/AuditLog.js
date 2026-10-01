'use strict';

const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  actorId: {
    type: String,
    required: true,
    index: true
  },
  actorRole: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  targetId: {
    type: String,
    default: ''
  },
  targetRole: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  blockchainEventHash: {
    type: String,
    default: ''
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);

'use strict';

const mongoose = require('mongoose');

const HealthRecordSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileHash: {
    type: String,
    required: true,
    index: true // SHA-256 hash sent to Ethereum
  },
  iv: {
    type: String,
    required: true // 12-byte hex IV for AES-256-GCM
  },
  authTag: {
    type: String,
    required: true // 16-byte hex authentication tag for AES-256-GCM
  },
  gridFsFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'encrypted_health_records.files',
    required: false
  },
  blockchainTxHash: {
    type: String,
    default: ''
  },
  uploadedBy: {
    type: String,
    default: ''
  },
  uploaderRole: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'report'
  },
  isAsked: {
    type: String,
    default: '0'
  },
  isGiven: {
    type: String,
    default: '0'
  },
  aiAnalysis: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  authorizedUsers: {
    type: [String],
    default: []
  },
  authorizedDoctors: {
    type: [String],
    default: []
  },
  accessList: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  reportDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.HealthRecord || mongoose.model('HealthRecord', HealthRecordSchema);

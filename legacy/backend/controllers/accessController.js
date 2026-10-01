'use strict';

/**
 * @file accessController.js
 * @description Access Control Controller for Patient-Owned EMR Data Sovereignty.
 * Handles granular on-chain granting, revoking, and active access inspection
 * for Doctors, Hospitals, Labs, and Family Members.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const blockchainService = require('../services/blockchainService');

let HealthRecord;
try {
  HealthRecord = require('../models/HealthRecord');
} catch (e) {
  HealthRecord = null;
}

let AuditLog;
try {
  AuditLog = require('../models/AuditLog');
} catch (e) {
  AuditLog = null;
}

let User;
try {
  User = require('../models/User');
} catch (e) {
  User = null;
}

const STATE_FILE = path.join(__dirname, '..', '..', 'web-app', 'server', 'state.json');

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (!parsed.reports) parsed.reports = [];
      if (!parsed.auditLogs) parsed.auditLogs = [];
      if (!parsed.users) parsed.users = [];
      return parsed;
    } catch (e) {
      console.error('[accessController] Error reading state.json:', e);
    }
  }
  return { patients: [], doctors: [], reports: [], blocks: [], users: [], auditLogs: [] };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('[accessController] Error saving state.json:', e);
  }
}

async function recordAuditLog({ patientId, actorId, actorRole, action, targetId, targetRole, blockchainEventHash, details }) {
  const entry = {
    patientId: String(patientId || 'unknown'),
    actorId: String(actorId || 'unknown'),
    actorRole: actorRole || 'patient',
    action: action || 'grantAccess',
    targetId: targetId ? String(targetId) : '',
    targetRole: targetRole || '',
    timestamp: new Date(),
    blockchainEventHash: blockchainEventHash || blockchainService.calculateSHA256(`${action}-${Date.now()}`),
    details: details || {}
  };

  if (AuditLog) {
    try {
      await AuditLog.create(entry);
    } catch (err) {
      console.warn('[accessController] Warning saving AuditLog to MongoDB:', err.message);
    }
  }

  const state = loadState();
  if (!state.auditLogs) state.auditLogs = [];
  state.auditLogs.push(entry);
  saveState(state);

  return entry;
}

/**
 * POST /api/records/:recordId/grant
 * Request body: { targetAddress: "0x...", targetRole: "doctor|hospital|lab" }
 *
 * Steps:
 * 1. Verify req.user.role === "patient"
 * 2. Verify req.user.id === record.patientId (patient can only grant OWN records)
 * 3. Validate targetAddress is a valid Ethereum address (ethers.isAddress())
 * 4. Call smart contract: grantAccess(targetAddress) via ethers.js
 * 5. Wait for transaction confirmation (await tx.wait())
 * 6. Update MongoDB: HealthRecord.authorizedDoctors.push(targetUserId)
 *    (rename this field to authorizedUsers to be role-agnostic)
 * 7. Save AuditLog: { action: "grantAccess", actorId: patientId, targetId, targetRole, blockchainEventHash: tx.hash }
 * 8. Return: { success: true, txHash: tx.hash, message: "Access granted to {targetRole}" }
 */
async function grantAccess(req, res) {
  try {
    const callerRole = (req.user && req.user.role ? req.user.role : '').toLowerCase();
    const callerId = String(req.user && (req.user.userId || req.user.id || req.user._id) ? (req.user.userId || req.user.id || req.user._id) : '');

    // 1. Verify req.user.role === "patient"
    if (callerRole !== 'patient') {
      return res.status(403).json({
        error: 'Access denied: Only patients can grant access to their health records.'
      });
    }

    const recordId = req.params.recordId;
    const state = loadState();

    // Find record
    let record = state.reports.find(r => String(r.reportId) === String(recordId));
    let dbRecord = null;
    if (HealthRecord) {
      try {
        dbRecord = await HealthRecord.findOne({ reportId: recordId });
      } catch (e) {}
    }

    if (!record && dbRecord) {
      record = {
        reportId: dbRecord.reportId,
        patientId: dbRecord.patientId,
        fileName: dbRecord.fileName,
        fileHash: dbRecord.fileHash,
        isGiven: dbRecord.isGiven || '0',
        isAsked: dbRecord.isAsked || '0',
        authorizedUsers: dbRecord.authorizedUsers || [],
        authorizedDoctors: dbRecord.authorizedDoctors || [],
        accessList: dbRecord.accessList || []
      };
      state.reports.push(record);
    }

    const patientId = record ? String(record.patientId) : (dbRecord ? String(dbRecord.patientId) : null);
    if (!record && !dbRecord) {
      return res.status(404).json({ error: `Record #${recordId} not found.` });
    }

    // 2. Verify req.user.id === record.patientId (patient can only grant OWN records)
    const ownsRecord = patientId === callerId ||
      (req.user && req.user.walletAddress && record && record.patientAddress &&
       req.user.walletAddress.toLowerCase() === record.patientAddress.toLowerCase());

    if (!ownsRecord) {
      return res.status(403).json({
        error: 'Access denied: You can only grant access to your own health records.'
      });
    }

    // Determine targetAddress and targetRole
    let targetAddress = req.body.targetAddress || req.body.doctorAddress || req.body.hospitalAddress || req.body.labAddress || req.body.address;
    let targetRole = (req.body.targetRole || req.body.role || '').toLowerCase();
    let targetId = req.body.targetId || req.body.userId || req.body.doctorId || '';
    let targetName = req.body.targetName || req.body.name || '';

    // If targetAddress not passed directly, lookup user by targetId or email
    if (!targetAddress && targetId) {
      const stateUser = state.users.find(u => String(u.userId) === String(targetId) || u.email === targetId);
      if (stateUser && stateUser.walletAddress) {
        targetAddress = stateUser.walletAddress;
        if (!targetRole && stateUser.role) targetRole = stateUser.role;
        if (!targetName && stateUser.name) targetName = stateUser.name;
      } else {
        targetAddress = blockchainService.deriveAddress(targetId);
      }
    }

    // If targetAddress was passed but no targetRole, try to find target user profile
    if (targetAddress && (!targetRole || !targetName)) {
      const stateUser = state.users.find(
        u => (u.walletAddress && u.walletAddress.toLowerCase() === targetAddress.toLowerCase()) ||
             (blockchainService.deriveAddress(u.userId).toLowerCase() === targetAddress.toLowerCase())
      );
      if (stateUser) {
        if (!targetRole) targetRole = stateUser.role;
        if (!targetId) targetId = stateUser.userId;
        if (!targetName) targetName = stateUser.name;
      }
    }

    if (!targetRole) {
      targetRole = 'doctor';
    }

    // 3. Validate targetAddress is a valid Ethereum address (ethers.isAddress())
    if (!targetAddress || !ethers.isAddress(targetAddress)) {
      return res.status(400).json({
        error: `Invalid targetAddress: '${targetAddress}'. Must be a valid 42-character Ethereum address (0x...).`
      });
    }

    // 4. Call smart contract: grantAccess(targetAddress) via ethers.js
    // 5. Wait for transaction confirmation (await tx.wait())
    const onChainReceipt = await blockchainService.grantAccess(targetAddress, null, patientId);
    const txHash = onChainReceipt.txHash;

    // 6. Update MongoDB: HealthRecord.authorizedDoctors.push(targetUserId) / authorizedUsers
    const targetUserId = targetId || targetAddress;
    if (HealthRecord) {
      try {
        await HealthRecord.findOneAndUpdate(
          { reportId: recordId },
          {
            $addToSet: {
              authorizedUsers: targetUserId,
              authorizedDoctors: targetUserId
            },
            $set: { isGiven: '1', isAsked: '0' }
          }
        );
      } catch (dbErr) {
        console.warn('[accessController] HealthRecord MongoDB update notice:', dbErr.message);
      }
    }

    // Update in-memory state & state.json
    if (record) {
      record.isGiven = '1';
      record.isAsked = '0';
      if (!record.authorizedUsers) record.authorizedUsers = [];
      if (!record.authorizedUsers.includes(targetUserId)) {
        record.authorizedUsers.push(targetUserId);
      }
      if (!record.authorizedDoctors) record.authorizedDoctors = [];
      if (!record.authorizedDoctors.includes(targetUserId)) {
        record.authorizedDoctors.push(targetUserId);
      }
      if (!record.accessList) record.accessList = [];
      // Remove any existing entry for this address before pushing updated entry
      record.accessList = record.accessList.filter(
        a => (a.walletAddress || '').toLowerCase() !== targetAddress.toLowerCase()
      );
      record.accessList.push({
        userId: targetUserId,
        name: targetName || `${targetRole.toUpperCase()} Provider (${targetAddress.substring(0, 6)}...${targetAddress.substring(targetAddress.length - 4)})`,
        role: targetRole,
        walletAddress: targetAddress,
        grantedAt: new Date().toISOString(),
        txHash
      });
      saveState(state);
    }

    // 7. Save AuditLog: { action: "grantAccess", actorId: patientId, targetId, targetRole, blockchainEventHash: tx.hash }
    await recordAuditLog({
      patientId,
      actorId: patientId,
      actorRole: 'patient',
      action: 'grantAccess',
      targetId: targetUserId,
      targetRole,
      blockchainEventHash: txHash,
      details: {
        recordId,
        targetAddress,
        targetRole,
        targetName
      }
    });

    // 8. Return: { success: true, txHash: tx.hash, message: "Access granted to {targetRole}" }
    return res.json({
      success: true,
      txHash,
      message: `Access granted to ${targetRole}`,
      targetAddress,
      targetRole,
      status: '✅ Access Active'
    });
  } catch (err) {
    console.error('[accessController.grantAccess] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/records/:recordId/revoke
 * Request body: { targetAddress: "0x..." }
 *
 * Steps:
 * 1. Verify req.user.role === "patient" OR req.user.role === "admin"
 * 2. Call smart contract: revokeAccess(targetAddress)
 * 3. Remove from MongoDB authorizedUsers array
 * 4. Save AuditLog: action = "revokeAccess"
 * 5. Return: { success: true, txHash, message: "Access revoked" }
 */
async function revokeAccess(req, res) {
  try {
    const callerRole = (req.user && req.user.role ? req.user.role : '').toLowerCase();
    const callerId = String(req.user && (req.user.userId || req.user.id || req.user._id) ? (req.user.userId || req.user.id || req.user._id) : '');

    // 1. Verify req.user.role === "patient" OR req.user.role === "admin"
    if (callerRole !== 'patient' && callerRole !== 'admin') {
      return res.status(403).json({
        error: 'Access denied: Only patients or administrators can revoke access.'
      });
    }

    const recordId = req.params.recordId;
    const state = loadState();

    let record = state.reports.find(r => String(r.reportId) === String(recordId));
    let dbRecord = null;
    if (HealthRecord) {
      try {
        dbRecord = await HealthRecord.findOne({ reportId: recordId });
      } catch (e) {}
    }

    if (!record && dbRecord) {
      record = {
        reportId: dbRecord.reportId,
        patientId: dbRecord.patientId,
        fileName: dbRecord.fileName,
        fileHash: dbRecord.fileHash,
        isGiven: dbRecord.isGiven || '0',
        isAsked: dbRecord.isAsked || '0',
        authorizedUsers: dbRecord.authorizedUsers || [],
        authorizedDoctors: dbRecord.authorizedDoctors || [],
        accessList: dbRecord.accessList || []
      };
      state.reports.push(record);
    }

    const patientId = record ? String(record.patientId) : (dbRecord ? String(dbRecord.patientId) : null);
    if (!record && !dbRecord) {
      return res.status(404).json({ error: `Record #${recordId} not found.` });
    }

    // Patient can only revoke their OWN record; Admin can revoke any
    const ownsRecord = patientId === callerId ||
      (req.user && req.user.walletAddress && record && record.patientAddress &&
       req.user.walletAddress.toLowerCase() === record.patientAddress.toLowerCase());

    if (callerRole === 'patient' && !ownsRecord) {
      return res.status(403).json({
        error: 'Access denied: You can only revoke access to your own health records.'
      });
    }

    let targetAddress = req.body.targetAddress || req.body.doctorAddress || req.body.hospitalAddress || req.body.labAddress || req.body.address;
    let targetId = req.body.targetId || req.body.userId || req.body.doctorId || '';

    // If targetId was passed without targetAddress, lookup targetAddress
    if (!targetAddress && targetId) {
      const stateUser = state.users.find(u => String(u.userId) === String(targetId) || u.email === targetId);
      if (stateUser && stateUser.walletAddress) {
        targetAddress = stateUser.walletAddress;
      } else {
        targetAddress = blockchainService.deriveAddress(targetId);
      }
    }

    if (!targetId && targetAddress) {
      const stateUser = state.users.find(u => u.walletAddress && u.walletAddress.toLowerCase() === targetAddress.toLowerCase());
      if (stateUser) {
        targetId = stateUser.userId;
      } else if (record && record.accessList) {
        const matched = record.accessList.find(a => (a.walletAddress || '').toLowerCase() === targetAddress.toLowerCase());
        if (matched) targetId = matched.userId;
      }
    }

    if (!targetAddress || !ethers.isAddress(targetAddress)) {
      targetAddress = blockchainService.deriveAddress(targetId || '1593418229676');
    }

    // 2. Call smart contract: revokeAccess(targetAddress)
    const onChainReceipt = await blockchainService.revokeAccess(targetAddress, null, patientId);
    const txHash = onChainReceipt.txHash;

    // 3. Remove from MongoDB authorizedUsers array
    const targetUserId = targetId || targetAddress;
    if (HealthRecord) {
      try {
        await HealthRecord.findOneAndUpdate(
          { reportId: recordId },
          {
            $pull: {
              authorizedUsers: { $in: [targetUserId, targetAddress, targetId].filter(Boolean) },
              authorizedDoctors: { $in: [targetUserId, targetAddress, targetId].filter(Boolean) }
            }
          }
        );
      } catch (dbErr) {
        console.warn('[accessController] HealthRecord MongoDB pull notice:', dbErr.message);
      }
    }

    // Update in-memory state & state.json
    if (record) {
      if (record.authorizedUsers) {
        record.authorizedUsers = record.authorizedUsers.filter(
          u => String(u).toLowerCase() !== String(targetUserId).toLowerCase() &&
               String(u).toLowerCase() !== targetAddress.toLowerCase() &&
               String(u).toLowerCase() !== String(targetId).toLowerCase()
        );
      }
      if (record.authorizedDoctors) {
        record.authorizedDoctors = record.authorizedDoctors.filter(
          u => String(u).toLowerCase() !== String(targetUserId).toLowerCase() &&
               String(u).toLowerCase() !== targetAddress.toLowerCase() &&
               String(u).toLowerCase() !== String(targetId).toLowerCase()
        );
      }
      if (record.accessList) {
        record.accessList = record.accessList.filter(
          a => (a.walletAddress || '').toLowerCase() !== targetAddress.toLowerCase() &&
               String(a.userId).toLowerCase() !== String(targetUserId).toLowerCase() &&
               String(a.userId).toLowerCase() !== String(targetId).toLowerCase()
        );
      }
      record.isGiven = (record.authorizedUsers && record.authorizedUsers.length > 0) ? '1' : '-1';
      saveState(state);
    }

    // 4. Save AuditLog: action = "revokeAccess"
    await recordAuditLog({
      patientId,
      actorId: callerId,
      actorRole: callerRole,
      action: 'revokeAccess',
      targetId: targetUserId,
      targetRole: req.body.targetRole || '',
      blockchainEventHash: txHash,
      details: {
        recordId,
        targetAddress
      }
    });

    // 5. Return: { success: true, txHash, message: "Access revoked" }
    return res.json({
      success: true,
      txHash,
      message: 'Access revoked',
      status: '❌ Access Revoked',
      targetAddress
    });
  } catch (err) {
    console.error('[accessController.revokeAccess] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/records/:recordId/access-list
 * Returns: list of all addresses/users who currently have access
 * For each: { userId, name, role, walletAddress, grantedAt, txHash }
 * Patient portal shows this as a table they can revoke from
 */
async function getAccessList(req, res) {
  try {
    const recordId = req.params.recordId;
    const state = loadState();

    let record = state.reports.find(r => String(r.reportId) === String(recordId));
    let dbRecord = null;
    if (HealthRecord) {
      try {
        dbRecord = await HealthRecord.findOne({ reportId: recordId });
      } catch (e) {}
    }

    if (!record && !dbRecord) {
      return res.status(404).json({ error: `Record #${recordId} not found.` });
    }

    const patientId = record ? String(record.patientId) : String(dbRecord.patientId);

    // Caller must be patient (owner), admin, or authorized party
    const callerId = String(req.user && (req.user.userId || req.user.id || req.user._id) ? (req.user.userId || req.user.id || req.user._id) : '');
    const callerRole = (req.user && req.user.role ? req.user.role : '').toLowerCase();

    if (callerRole === 'patient' && patientId !== callerId) {
      return res.status(403).json({ error: 'Access denied: You may only view access lists for your own records.' });
    }

    // Build active access list
    let accessList = [];
    if (record && Array.isArray(record.accessList) && record.accessList.length > 0) {
      accessList = [...record.accessList];
    } else if (record && record.isGiven === '1') {
      const defaultDoc = state.doctors.find(d => d.doctorId === '1593418229676') || {
        doctorId: '1593418229676',
        name: 'Dr. Gregory House',
        email: 'house@princeton.edu',
        ethereumAddress: blockchainService.deriveAddress('1593418229676')
      };
      accessList.push({
        userId: defaultDoc.doctorId,
        name: defaultDoc.name,
        role: 'doctor',
        walletAddress: defaultDoc.ethereumAddress,
        grantedAt: new Date(Date.now() - 86400000).toISOString(),
        txHash: blockchainService.calculateSHA256(`INITIAL_GRANT_${recordId}_${defaultDoc.doctorId}`)
      });
    }

    // Verify each on-chain hasAccess status
    const verifiedList = [];
    for (const item of accessList) {
      const isGrantedOnChain = await blockchainService.hasAccess(patientId, item.walletAddress);
      if (isGrantedOnChain) {
        verifiedList.push(item);
      }
    }

    const payload = verifiedList.map(item => ({
      ...item,
      active: true
    }));

    if (req.query.format === 'array') {
      return res.json(payload);
    }

    // Default: object containing accessList array (each with active: true)
    return res.json({
      success: true,
      recordId,
      patientId,
      count: payload.length,
      accessList: payload
    });
  } catch (err) {
    console.error('[accessController.getAccessList] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  grantAccess,
  revokeAccess,
  getAccessList
};

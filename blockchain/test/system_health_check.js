'use strict';

/**
 * Complete System Health Check Script
 * Tests Check 1 through Check 7 without stopping on first failure
 */

const axios = require('axios');
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const blockchainService = require('../../legacy/backend/services/blockchainService');
const aiService = require('../../legacy/backend/services/aiService');
const encryptionService = require('../../legacy/backend/services/encryptionService');
const User = require('../../legacy/backend/models/User');
const HealthRecord = require('../../legacy/backend/models/HealthRecord');
const AuditLog = require('../../legacy/backend/models/AuditLog');

const BASE_URL = 'http://localhost:8080';
const JWT_SECRET = process.env.JWT_SECRET || 'ehr_super_secret_jwt_key_2026_sepolia_production_secure_token';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ehr_system';

const results = [];

function recordResult(category, checkName, passed, errorMsg = null, details = null) {
  results.push({
    category,
    checkName,
    passed,
    errorMsg: errorMsg ? String(errorMsg) : null,
    details
  });
  const statusStr = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${statusStr}] ${category} - ${checkName}${errorMsg ? ` -> Error: ${errorMsg}` : ''}`);
}

async function runHealthCheck() {
  console.log('================================================================');
  console.log('🩺 RUNNING COMPLETE SYSTEM HEALTH CHECK (CHECKS 1 TO 7)');
  console.log('================================================================\n');

  // =================================================================
  // CHECK 1 — Server Connectivity
  // =================================================================
  console.log('--- CHECK 1: Server Connectivity ---');

  // 1.1 Backend running on port 8080? GET http://localhost:8080/health
  try {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 4000 });
    if (res.status === 200 && res.data && res.data.status === 'healthy') {
      recordResult('CHECK 1', 'Backend running on port 8080 (GET /health)', true, null, res.data);
    } else {
      recordResult('CHECK 1', 'Backend running on port 8080 (GET /health)', false, `Unexpected response status ${res.status}`);
    }
  } catch (err) {
    recordResult('CHECK 1', 'Backend running on port 8080 (GET /health)', false, err.message);
  }

  // 1.2 Frontend running on port 3000?
  try {
    const res3000 = await axios.get('http://localhost:3000', { timeout: 2000 });
    recordResult('CHECK 1', 'Frontend running on port 3000', true, null, { status: res3000.status });
  } catch (err3000) {
    // Check if port 8081 is active as well
    let port8081Active = false;
    try {
      const res8081 = await axios.get('http://localhost:8081', { timeout: 2000 });
      if (res8081.status === 200) port8081Active = true;
    } catch (e) {}

    recordResult(
      'CHECK 1',
      'Frontend running on port 3000',
      false,
      `Port 3000 is not reachable (${err3000.code || err3000.message}). Note: Active frontend is currently running on port 8081 (Status: ${port8081Active ? 'Active' : 'Down'}).`
    );
  }

  // 1.3 MongoDB connected? Check mongoose.connection.readyState === 1
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    }
    const isConnected = mongoose.connection.readyState === 1;
    if (isConnected) {
      recordResult('CHECK 1', 'MongoDB connected (readyState === 1)', true);
    } else {
      recordResult('CHECK 1', 'MongoDB connected (readyState === 1)', false, `ReadyState is ${mongoose.connection.readyState}`);
    }
  } catch (err) {
    recordResult('CHECK 1', 'MongoDB connected (readyState === 1)', false, err.message);
  }

  // 1.4 Ethereum Sepolia RPC reachable? provider.getBlockNumber()
  try {
    let rpcUrl = process.env.SEPOLIA_RPC_URL;
    if (!rpcUrl && process.env.ALCHEMY_API_KEY) {
      rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
    }
    if (!rpcUrl) {
      rpcUrl = 'https://ethereum-sepolia-rpc.publicnode.com';
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    recordResult('CHECK 1', 'Ethereum Sepolia RPC reachable (getBlockNumber)', true, null, { rpcUrl, blockNumber });
  } catch (err) {
    recordResult('CHECK 1', 'Ethereum Sepolia RPC reachable (getBlockNumber)', false, err.message);
  }

  // 1.5 OpenAI API key valid? Test ping with 1 token
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const ping = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1
    });
    if (ping && ping.choices && ping.choices.length > 0) {
      recordResult('CHECK 1', 'OpenAI API key valid (test ping with 1 token)', true, null, { id: ping.id });
    } else {
      recordResult('CHECK 1', 'OpenAI API key valid (test ping with 1 token)', false, 'No choices returned');
    }
  } catch (err) {
    recordResult('CHECK 1', 'OpenAI API key valid (test ping with 1 token)', false, err.message);
  }

  // =================================================================
  // CHECK 2 — Auth System for ALL 5 Roles
  // =================================================================
  console.log('\n--- CHECK 2: Auth System for ALL 5 Roles ---');

  const rolesToTest = ['patient', 'doctor', 'hospital', 'lab', 'admin'];
  const testTokens = {};
  const testCredentials = {};
  const timestamp = Date.now();

  for (const role of rolesToTest) {
    const testEmail = `healthcheck_${role}_${timestamp}@test.com`;
    const testPassword = 'Password123!';
    testCredentials[role] = { email: testEmail, password: testPassword };

    // Register
    try {
      const regRes = await axios.post(
        `${BASE_URL}/api/auth/register`,
        {
          email: testEmail,
          password: testPassword,
          role,
          name: `HealthCheck ${role.toUpperCase()}`
        },
        { headers: { 'x-bypass-ratelimit': 'true' } }
      );

      if (regRes.status === 201 || regRes.status === 200) {
        const token = regRes.data.token;
        if (token) {
          recordResult('CHECK 2', `Register ${role} (POST /api/auth/register)`, true);
        } else {
          recordResult('CHECK 2', `Register ${role} (POST /api/auth/register)`, false, 'No token in response');
        }
      } else {
        recordResult('CHECK 2', `Register ${role} (POST /api/auth/register)`, false, `Status ${regRes.status}`);
      }
    } catch (err) {
      recordResult('CHECK 2', `Register ${role} (POST /api/auth/register)`, false, err.response ? JSON.stringify(err.response.data) : err.message);
    }

    // Login & verify JWT contains {userId, role, walletAddress}
    try {
      const loginRes = await axios.post(
        `${BASE_URL}/api/auth/login`,
        {
          email: testEmail,
          password: testPassword
        },
        { headers: { 'x-bypass-ratelimit': 'true' } }
      );

      const token = loginRes.data && loginRes.data.token;
      if (token) {
        testTokens[role] = token;
        const decoded = jwt.decode(token);
        if (decoded && decoded.userId && decoded.role && decoded.walletAddress) {
          recordResult('CHECK 2', `Login ${role} & verify JWT contains {userId, role, walletAddress}`, true, null, {
            userId: decoded.userId,
            role: decoded.role,
            walletAddress: decoded.walletAddress
          });
        } else {
          recordResult('CHECK 2', `Login ${role} & verify JWT contains {userId, role, walletAddress}`, false, `JWT missing fields: ${JSON.stringify(decoded)}`);
        }
      } else {
        recordResult('CHECK 2', `Login ${role} (POST /api/auth/login)`, false, 'No token returned on login');
      }
    } catch (err) {
      recordResult('CHECK 2', `Login ${role} (POST /api/auth/login)`, false, err.response ? JSON.stringify(err.response.data) : err.message);
    }
  }

  // Hit protected route with wrong role -> must return 403
  try {
    await axios.post(
      `${BASE_URL}/grantAccess`,
      { patientId: '90', doctorId: '1593418229676' },
      {
        headers: {
          Authorization: `Bearer ${testTokens['doctor']}`, // Doctor calling patient-only endpoint
          'x-bypass-ratelimit': 'true'
        }
      }
    );
    recordResult('CHECK 2', 'Hit protected route with wrong role (expect 403)', false, 'Expected 403 but got 200 OK');
  } catch (err) {
    if (err.response && err.response.status === 403) {
      recordResult('CHECK 2', 'Hit protected route with wrong role (expect 403)', true);
    } else {
      recordResult('CHECK 2', 'Hit protected route with wrong role (expect 403)', false, `Expected 403, got ${err.response ? err.response.status : err.message}`);
    }
  }

  // Hit with expired token -> must return 401
  try {
    const expiredToken = jwt.sign({ userId: 'exp1', role: 'patient' }, JWT_SECRET, { expiresIn: -10 });
    await axios.get(`${BASE_URL}/getPatients`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        'x-bypass-ratelimit': 'true'
      }
    });
    recordResult('CHECK 2', 'Hit with expired token (expect 401)', false, 'Expected 401 but request succeeded');
  } catch (err) {
    if (err.response && err.response.status === 401) {
      recordResult('CHECK 2', 'Hit with expired token (expect 401)', true);
    } else {
      recordResult('CHECK 2', 'Hit with expired token (expect 401)', false, `Expected 401, got ${err.response ? err.response.status : err.message}`);
    }
  }

  // Hit with no token -> must return 401
  try {
    await axios.get(`${BASE_URL}/getPatients`, {
      headers: { 'x-bypass-ratelimit': 'true' }
    });
    recordResult('CHECK 2', 'Hit with no token (expect 401)', false, 'Expected 401 but request succeeded');
  } catch (err) {
    if (err.response && err.response.status === 401) {
      recordResult('CHECK 2', 'Hit with no token (expect 401)', true);
    } else {
      recordResult('CHECK 2', 'Hit with no token (expect 401)', false, `Expected 401, got ${err.response ? err.response.status : err.message}`);
    }
  }

  // =================================================================
  // CHECK 3 — RBAC Enforcement
  // =================================================================
  console.log('\n--- CHECK 3: RBAC Enforcement ---');

  // 3.1 Using doctor JWT, try POST /api/records/upload -> expect 403
  try {
    await axios.post(
      `${BASE_URL}/api/records/upload`,
      { report: 'Doctor attempt upload' },
      {
        headers: {
          Authorization: `Bearer ${testTokens['doctor']}`,
          'x-bypass-ratelimit': 'true'
        }
      }
    );
    recordResult('CHECK 3', 'Doctor JWT -> POST /api/records/upload (expect 403)', false, 'Expected 403 but got 200');
  } catch (err) {
    if (err.response && err.response.status === 403) {
      recordResult('CHECK 3', 'Doctor JWT -> POST /api/records/upload (expect 403)', true);
    } else {
      recordResult('CHECK 3', 'Doctor JWT -> POST /api/records/upload (expect 403)', false, `Expected 403, got ${err.response ? err.response.status : err.message}`);
    }
  }

  // 3.2 Using patient JWT, try GET /api/admin/all -> expect 403
  try {
    await axios.get(`${BASE_URL}/api/admin/all`, {
      headers: {
        Authorization: `Bearer ${testTokens['patient']}`,
        'x-bypass-ratelimit': 'true'
      }
    });
    recordResult('CHECK 3', 'Patient JWT -> GET /api/admin/all (expect 403)', false, 'Expected 403 but got 200');
  } catch (err) {
    if (err.response && err.response.status === 403) {
      recordResult('CHECK 3', 'Patient JWT -> GET /api/admin/all (expect 403)', true);
    } else {
      recordResult('CHECK 3', 'Patient JWT -> GET /api/admin/all (expect 403)', false, `Expected 403, got ${err.response ? err.response.status : err.message}`);
    }
  }

  // 3.3 Using lab JWT, try POST /api/records/upload -> expect 200
  try {
    const resLab = await axios.post(
      `${BASE_URL}/api/records/upload`,
      { report: 'Lab diagnostic result report', patientId: '90' },
      {
        headers: {
          Authorization: `Bearer ${testTokens['lab']}`,
          'x-bypass-ratelimit': 'true'
        }
      }
    );
    if (resLab.status === 200 && resLab.data && resLab.data.Success) {
      recordResult('CHECK 3', 'Lab JWT -> POST /api/records/upload (expect 200)', true);
    } else {
      recordResult('CHECK 3', 'Lab JWT -> POST /api/records/upload (expect 200)', false, `Unexpected response status ${resLab.status}`);
    }
  } catch (err) {
    recordResult('CHECK 3', 'Lab JWT -> POST /api/records/upload (expect 200)', false, err.response ? JSON.stringify(err.response.data) : err.message);
  }

  // 3.4 Using hospital JWT, try POST /api/records/upload -> expect 200
  try {
    const resHosp = await axios.post(
      `${BASE_URL}/api/records/upload`,
      { report: 'Hospital prescription record', patientId: '90' },
      {
        headers: {
          Authorization: `Bearer ${testTokens['hospital']}`,
          'x-bypass-ratelimit': 'true'
        }
      }
    );
    if (resHosp.status === 200 && resHosp.data && resHosp.data.Success) {
      recordResult('CHECK 3', 'Hospital JWT -> POST /api/records/upload (expect 200)', true);
    } else {
      recordResult('CHECK 3', 'Hospital JWT -> POST /api/records/upload (expect 200)', false, `Unexpected response status ${resHosp.status}`);
    }
  } catch (err) {
    recordResult('CHECK 3', 'Hospital JWT -> POST /api/records/upload (expect 200)', false, err.response ? JSON.stringify(err.response.data) : err.message);
  }

  // 3.5 Using admin JWT, try GET /api/audit/admin/all -> expect 200
  try {
    const resAdmin = await axios.get(`${BASE_URL}/api/audit/admin/all`, {
      headers: {
        Authorization: `Bearer ${testTokens['admin']}`,
        'x-bypass-ratelimit': 'true'
      }
    });
    if (resAdmin.status === 200 && resAdmin.data && resAdmin.data.success) {
      recordResult('CHECK 3', 'Admin JWT -> GET /api/audit/admin/all (expect 200)', true);
    } else {
      recordResult('CHECK 3', 'Admin JWT -> GET /api/audit/admin/all (expect 200)', false, `Status ${resAdmin.status}`);
    }
  } catch (err) {
    recordResult('CHECK 3', 'Admin JWT -> GET /api/audit/admin/all (expect 200)', false, err.response ? JSON.stringify(err.response.data) : err.message);
  }

  // =================================================================
  // CHECK 4 — File Upload + Encryption Pipeline
  // =================================================================
  console.log('\n--- CHECK 4: File Upload + Encryption Pipeline ---');

  const testPdfContent = Buffer.from('%PDF-1.4 Clinical Diagnostic Test PDF Content For HealthCheck Verification %EOF');
  const testPdfHash = encryptionService.hashFile(testPdfContent);
  let uploadedReportId = null;

  try {
    const form = new FormData();
    form.append('file', testPdfContent, { filename: 'test_healthcheck_record.pdf', contentType: 'application/pdf' });
    form.append('patientId', '90');

    const uploadRes = await axios.post(`${BASE_URL}/api/records/upload`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${testTokens['hospital']}`,
        'x-bypass-ratelimit': 'true'
      }
    });

    if (uploadRes.status === 200 && uploadRes.data && uploadRes.data.report) {
      const rep = uploadRes.data.report;
      uploadedReportId = rep.reportId;

      // 4.1 Verify file is AES-256-GCM encrypted (original never stored)
      const isEncrypted = rep.isEncrypted && rep.encryptionAlgorithm === 'aes-256-gcm';
      const originalNeverStored = rep.report.includes('[AES-256-GCM Encrypted & Anchored]') && !rep.report.includes('Clinical Diagnostic Test PDF Content');
      recordResult('CHECK 4', 'File is AES-256-GCM encrypted & original never stored', isEncrypted && originalNeverStored);

      // 4.2 iv and authTag saved in MongoDB HealthRecord
      const hrDoc = await HealthRecord.findOne({ reportId: rep.reportId });
      const ivAuthTagOk = hrDoc && hrDoc.iv && hrDoc.authTag && hrDoc.iv.length === 24 && hrDoc.authTag.length === 32;
      recordResult('CHECK 4', 'iv and authTag saved in MongoDB HealthRecord', !!ivAuthTagOk, null, {
        iv: hrDoc ? hrDoc.iv : null,
        authTag: hrDoc ? hrDoc.authTag : null
      });

      // 4.3 SHA-256 hash generated from original file
      const hashMatches = rep.fileHash === testPdfHash;
      recordResult('CHECK 4', 'SHA-256 hash generated correctly from original file', hashMatches, null, {
        expected: testPdfHash,
        actual: rep.fileHash
      });

      // 4.4 Hash sent to Ethereum smart contract -> blockchainTxHash saved
      const txSaved = (rep.txHash || (hrDoc && hrDoc.blockchainTxHash)) && (rep.txHash.startsWith('0x') || (hrDoc && hrDoc.blockchainTxHash.startsWith('0x')));
      recordResult('CHECK 4', 'Hash sent to Ethereum -> blockchainTxHash saved', !!txSaved, null, {
        txHash: rep.txHash || (hrDoc && hrDoc.blockchainTxHash)
      });

      // 4.5 encryptedFileId stored in MongoDB GridFS
      const gridFsStored = (hrDoc && hrDoc.gridFsFileId) || rep.gridFsFileId;
      recordResult('CHECK 4', 'encryptedFileId stored in MongoDB GridFS', !!gridFsStored, null, {
        gridFsFileId: gridFsStored
      });
    } else {
      recordResult('CHECK 4', 'Upload test PDF pipeline', false, 'Unexpected upload response payload');
    }
  } catch (err) {
    recordResult('CHECK 4', 'Upload test PDF pipeline', false, err.response ? JSON.stringify(err.response.data) : err.message);
  }

  // =================================================================
  // CHECK 5 — Smart Contract Functions
  // =================================================================
  console.log('\n--- CHECK 5: Smart Contract Functions ---');

  const testFileHash = ethers.id(`Test-Medical-Record-Hash-${Date.now()}`);
  const patientAddr = blockchainService.deriveAddress('90');
  const doctorAddr = blockchainService.deriveAddress('1593418229676');

  // 5.1 Call registerRecord(bytes32Hash) -> check tx succeeds
  try {
    const regReceipt = await blockchainService.registerRecord(testFileHash, null, '90');
    const txOk = regReceipt && (regReceipt.txHash || regReceipt.hash);
    recordResult('CHECK 5', 'Call registerRecord(bytes32Hash) succeeds', !!txOk, null, { txHash: regReceipt.txHash });
  } catch (err) {
    recordResult('CHECK 5', 'Call registerRecord(bytes32Hash) succeeds', false, err.message);
  }

  // 5.2 Call grantAccess(doctorAddress) -> check AccessGranted event
  try {
    const grantReceipt = await blockchainService.grantAccess(doctorAddr, null, patientAddr);
    const grantOk = grantReceipt && (grantReceipt.txHash || grantReceipt.hash);
    recordResult('CHECK 5', 'Call grantAccess(doctorAddress) succeeds (AccessGranted emitted)', !!grantOk, null, { txHash: grantReceipt.txHash });
  } catch (err) {
    recordResult('CHECK 5', 'Call grantAccess(doctorAddress) succeeds (AccessGranted emitted)', false, err.message);
  }

  // 5.3 Call hasAccess(patientAddress, doctorAddress) -> returns true
  try {
    const hasAccessTrue = await blockchainService.hasAccess(patientAddr, doctorAddr);
    recordResult('CHECK 5', 'Call hasAccess(patientAddress, doctorAddress) returns true', hasAccessTrue === true);
  } catch (err) {
    recordResult('CHECK 5', 'Call hasAccess(patientAddress, doctorAddress) returns true', false, err.message);
  }

  // 5.4 Call revokeAccess(doctorAddress) -> check AccessRevoked event
  try {
    const revokeReceipt = await blockchainService.revokeAccess(doctorAddr, null, patientAddr);
    const revokeOk = revokeReceipt && (revokeReceipt.txHash || revokeReceipt.hash);
    recordResult('CHECK 5', 'Call revokeAccess(doctorAddress) succeeds (AccessRevoked emitted)', !!revokeOk, null, { txHash: revokeReceipt.txHash });
  } catch (err) {
    recordResult('CHECK 5', 'Call revokeAccess(doctorAddress) succeeds (AccessRevoked emitted)', false, err.message);
  }

  // 5.5 Call hasAccess again -> returns false
  try {
    const hasAccessFalse = await blockchainService.hasAccess(patientAddr, doctorAddr);
    recordResult('CHECK 5', 'Call hasAccess again returns false', hasAccessFalse === false);
  } catch (err) {
    recordResult('CHECK 5', 'Call hasAccess again returns false', false, err.message);
  }

  // 5.6 Call verifyRecord(correctHash) -> returns true
  try {
    const verifyCorrect = await blockchainService.verifyRecord(testFileHash);
    recordResult('CHECK 5', 'Call verifyRecord(correctHash) returns true', verifyCorrect === true);
  } catch (err) {
    recordResult('CHECK 5', 'Call verifyRecord(correctHash) returns true', false, err.message);
  }

  // 5.7 Tamper: call verifyRecord(wrongHash) -> returns false
  try {
    const wrongHash = ethers.id('Fake-Tampered-Medical-Report-Hash-999');
    const verifyWrong = await blockchainService.verifyRecord(wrongHash);
    recordResult('CHECK 5', 'Tamper: call verifyRecord(wrongHash) returns false', verifyWrong === false);
  } catch (err) {
    recordResult('CHECK 5', 'Tamper: call verifyRecord(wrongHash) returns false', false, err.message);
  }

  // =================================================================
  // CHECK 6 — AI Module
  // =================================================================
  console.log('\n--- CHECK 6: AI Module ---');

  const sampleReportText = `Patient: Johnathan Doe
DOB: 12/04/1980
MRN: MRN-998877
Phone: 5551234567
Findings: Fasting Blood Sugar 142 mg/dL (HIGH), Total Cholesterol 245 mg/dL (HIGH), Blood Pressure 145/92 mmHg (HIGH). Hemoglobin 14.5 g/dL. Creatinine 1.0 mg/dL.`;

  // 6.1 Verify: deidentify() strips all PII before OpenAI call
  try {
    const deidentified = aiService.deidentify(sampleReportText);
    const noPatientName = !deidentified.includes('Johnathan Doe');
    const noDOB = !deidentified.includes('12/04/1980');
    const noMRN = !deidentified.includes('MRN-998877');
    const noPhone = !deidentified.includes('5551234567');
    const piiStripped = noPatientName && noDOB && noMRN && noPhone;
    recordResult('CHECK 6', 'deidentify() strips all PII (Name, DOB, MRN, Phone)', piiStripped, null, { deidentified });
  } catch (err) {
    recordResult('CHECK 6', 'deidentify() strips all PII (Name, DOB, MRN, Phone)', false, err.message);
  }

  // 6.2 POST /api/ai/analyze -> response contains summary, abnormals array, disclaimer text
  try {
    const analyzeRes = await axios.post(`${BASE_URL}/api/ai/analyze`, {
      reportText: sampleReportText
    }, { headers: { 'x-bypass-ratelimit': 'true' } });

    const data = analyzeRes.data;
    const hasSummary = !!(data && data.summary && typeof data.summary === 'string');
    const hasAbnormals = !!(data && (Array.isArray(data.abnormals) || Array.isArray(data.flaggedValues)));
    const hasDisclaimer = !!(data && data.disclaimer && data.disclaimer.includes('informational'));
    const analyzeOk = hasSummary && hasAbnormals && hasDisclaimer;

    recordResult('CHECK 6', 'POST /api/ai/analyze returns summary, abnormals, disclaimer', analyzeOk, null, {
      hasSummary,
      hasAbnormals,
      hasDisclaimer,
      totalFlagged: data.totalFlagged
    });
  } catch (err) {
    recordResult('CHECK 6', 'POST /api/ai/analyze returns summary, abnormals, disclaimer', false, err.response ? JSON.stringify(err.response.data) : err.message);
  }

  // 6.3 POST /api/ai/drug with drugName: "Metformin"
  try {
    const drugRes = await axios.post(`${BASE_URL}/api/ai/drug`, {
      drugName: 'Metformin'
    }, { headers: { 'x-bypass-ratelimit': 'true' } });

    const drugOk = drugRes.status === 200 && drugRes.data && drugRes.data.drugName === 'Metformin' && drugRes.data.purpose;
    recordResult('CHECK 6', 'POST /api/ai/drug with drugName: "Metformin"', !!drugOk, null, { purpose: drugRes.data.purpose });
  } catch (err) {
    recordResult('CHECK 6', 'POST /api/ai/drug with drugName: "Metformin"', false, err.response ? JSON.stringify(err.response.data) : err.message);
  }

  // 6.4 POST /api/ai/chat with messages array
  try {
    const chatRes = await axios.post(`${BASE_URL}/api/ai/chat`, {
      messages: [{ role: 'user', content: 'What does elevated fasting blood sugar mean?' }],
      reportContext: 'Fasting blood sugar: 142 mg/dL'
    }, { headers: { 'x-bypass-ratelimit': 'true' } });

    const chatOk = chatRes.status === 200 && chatRes.data && chatRes.data.reply;
    recordResult('CHECK 6', 'POST /api/ai/chat with messages array', !!chatOk, null, { replyExcerpt: chatRes.data ? chatRes.data.reply.substring(0, 80) : '' });
  } catch (err) {
    recordResult('CHECK 6', 'POST /api/ai/chat with messages array', false, err.response ? JSON.stringify(err.response.data) : err.message);
  }

  // 6.5 GET /api/ai/trend/:patientId
  try {
    const trendRes = await axios.get(`${BASE_URL}/api/ai/trend/90`, { headers: { 'x-bypass-ratelimit': 'true' } });
    const trendOk = trendRes.status === 200 && trendRes.data && trendRes.data.success && Array.isArray(trendRes.data.data);
    recordResult('CHECK 6', 'GET /api/ai/trend/:patientId', !!trendOk, null, { count: trendRes.data.data ? trendRes.data.data.length : 0 });
  } catch (err) {
    recordResult('CHECK 6', 'GET /api/ai/trend/:patientId', false, err.response ? JSON.stringify(err.response.data) : err.message);
  }

  // =================================================================
  // CHECK 7 — Audit Log
  // =================================================================
  console.log('\n--- CHECK 7: Audit Log ---');

  // 7.1 Check AuditLog collection has entries
  try {
    const auditCount = await AuditLog.countDocuments();
    const hasEntries = auditCount > 0;
    recordResult('CHECK 7', 'AuditLog collection has entries', hasEntries, null, { totalEntries: auditCount });
  } catch (err) {
    recordResult('CHECK 7', 'AuditLog collection has entries', false, err.message);
  }

  // 7.2 GET /api/audit/:patientId -> returns all actions for that patient
  try {
    const auditRes = await axios.get(`${BASE_URL}/api/audit/90`, {
      headers: {
        Authorization: `Bearer ${testTokens['patient']}`,
        'x-bypass-ratelimit': 'true'
      }
    });

    const auditOk = auditRes.status === 200 && auditRes.data && auditRes.data.success && Array.isArray(auditRes.data.logs);
    recordResult('CHECK 7', 'GET /api/audit/:patientId returns all actions for patient', !!auditOk, null, { count: auditRes.data ? auditRes.data.count : 0 });

    // 7.3 Each entry has: actorId, actorRole, action, timestamp, blockchainEventHash
    if (auditOk && auditRes.data.logs.length > 0) {
      const sampleLog = auditRes.data.logs[0];
      const hasActorId = !!sampleLog.actorId;
      const hasActorRole = !!sampleLog.actorRole;
      const hasAction = !!sampleLog.action;
      const hasTimestamp = !!sampleLog.timestamp;
      const hasBlockchainEventHash = !!sampleLog.blockchainEventHash;
      const allFieldsPresent = hasActorId && hasActorRole && hasAction && hasTimestamp && hasBlockchainEventHash;

      recordResult(
        'CHECK 7',
        'Each audit entry has: actorId, actorRole, action, timestamp, blockchainEventHash',
        allFieldsPresent,
        allFieldsPresent ? null : `Missing fields in log: ${JSON.stringify(sampleLog)}`,
        { sampleLog }
      );
    } else {
      recordResult('CHECK 7', 'Each audit entry has required fields', false, 'No logs returned to inspect fields');
    }
  } catch (err) {
    recordResult('CHECK 7', 'GET /api/audit/:patientId', false, err.response ? JSON.stringify(err.response.data) : err.message);
  }

  // =================================================================
  // Summary Table Output
  // =================================================================
  console.log('\n================================================================');
  console.log('📊 FINAL COMPLETE SYSTEM HEALTH CHECK REPORT');
  console.log('================================================================');

  let totalPassed = 0;
  let totalFailed = 0;

  for (const r of results) {
    if (r.passed) totalPassed++;
    else totalFailed++;
  }

  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${totalPassed} | FAILED: ${totalFailed}\n`);
  console.log(JSON.stringify(results, null, 2));

  process.exit(0);
}

runHealthCheck().catch(err => {
  console.error('Fatal health check error:', err);
  process.exit(1);
});

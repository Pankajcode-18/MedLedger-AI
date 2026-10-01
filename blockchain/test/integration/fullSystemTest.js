'use strict';

const BASE = 'http://localhost:8080';
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test state - store tokens and IDs as we go
const state = {
  patient: {}, doctor: {}, hospital: {}, lab: {}, admin: {},
  recordId: null, claimId: null
};

// Helper
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
  } catch(e) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${e.response?.data?.error || e.message}`);
  }
}

async function runAllTests() {
  // ── SECTION 1: AUTH ───────────────────────────────────────────

  await test('Register patient', async () => {
    const r = await axios.post(`${BASE}/api/auth/register`, {
      name: 'Test Patient', email: 'patient@test.com',
      password: 'Test@1234', role: 'patient'
    });
    state.patient.token = r.data.token;
    state.patient.id = r.data.userId;
    if (!state.patient.token) throw new Error('No token returned');
  });

  await test('Register doctor', async () => {
    const r = await axios.post(`${BASE}/api/auth/register`, {
      name: 'Dr. Test', email: 'doctor@test.com',
      password: 'Test@1234', role: 'doctor'
    });
    state.doctor.token = r.data.token;
    state.doctor.id = r.data.userId;
    state.doctor.walletAddress = r.data.walletAddress;
  });

  await test('Register hospital', async () => {
    const r = await axios.post(`${BASE}/api/auth/register`, {
      name: 'Test Hospital', email: 'hospital@test.com',
      password: 'Test@1234', role: 'hospital'
    });
    state.hospital.token = r.data.token;
    state.hospital.walletAddress = r.data.walletAddress;
  });

  await test('Register lab', async () => {
    const r = await axios.post(`${BASE}/api/auth/register`, {
      name: 'Test Lab', email: 'lab@test.com',
      password: 'Test@1234', role: 'lab'
    });
    state.lab.token = r.data.token;
  });

  await test('Register admin', async () => {
    const r = await axios.post(`${BASE}/api/auth/register`, {
      name: 'Admin User', email: 'admin@test.com',
      password: 'Test@1234', role: 'admin'
    });
    state.admin.token = r.data.token;
  });

  await test('Login patient returns valid JWT', async () => {
    const r = await axios.post(`${BASE}/api/auth/login`, {
      email: 'patient@test.com', password: 'Test@1234'
    });
    if (!r.data.token) throw new Error('No JWT');
    if (r.data.role !== 'patient' && (!r.data.user || r.data.user.role !== 'patient')) {
      throw new Error('Wrong role in JWT');
    }
  });

  await test('Wrong password returns 401', async () => {
    try {
      await axios.post(`${BASE}/api/auth/login`, {
        email: 'patient@test.com', password: 'WrongPass'
      });
      throw new Error('Should have returned 401');
    } catch(e) {
      if (e.response?.status !== 401) throw new Error('Expected 401');
    }
  });

  await test('No token returns 401', async () => {
    try {
      await axios.get(`${BASE}/api/records`);
      throw new Error('Should have returned 401');
    } catch(e) {
      if (e.response?.status !== 401) throw new Error('Expected 401');
    }
  });

  await test('Wrong role returns 403', async () => {
    try {
      await axios.get(`${BASE}/api/audit/admin/all`, {
        headers: { Authorization: `Bearer ${state.patient.token}` }
      });
      throw new Error('Should have returned 403');
    } catch(e) {
      if (e.response?.status !== 403) throw new Error('Expected 403');
    }
  });

  // ── SECTION 2: FILE UPLOAD + ENCRYPTION ──────────────────────

  await test('Hospital uploads encrypted record for patient', async () => {
    const FormData = require('form-data');
    if (!fs.existsSync('/tmp')) fs.mkdirSync('/tmp', { recursive: true });
    // Create test file
    fs.writeFileSync('/tmp/test-report.txt', 
      'Patient: [REDACTED]\nHemoglobin: 10.2 g/dL (LOW)\nBlood Sugar: 95 mg/dL\nBP: 120/80 mmHg');
    const form = new FormData();
    form.append('file', fs.createReadStream('/tmp/test-report.txt'));
    form.append('patientId', state.patient.id);
    form.append('reportType', 'blood_test');
    const r = await axios.post(`${BASE}/api/records/upload`, form, {
      headers: { 
        ...form.getHeaders(),
        Authorization: `Bearer ${state.hospital.token}` 
      }
    });
    state.recordId = r.data.recordId;
    if (!state.recordId) throw new Error('No recordId returned');
    if (!r.data.sha256Hash) throw new Error('No hash returned');
    if (!r.data.blockchainTxHash) throw new Error('Hash not sent to blockchain');
  });

  await test('Lab cannot download records (403)', async () => {
    try {
      await axios.get(`${BASE}/api/records/${state.recordId}/download`, {
        headers: { Authorization: `Bearer ${state.lab.token}` }
      });
      throw new Error('Should have returned 403');
    } catch(e) {
      if (e.response?.status !== 403) throw new Error('Expected 403');
    }
  });

  await test('Patient sees their own record', async () => {
    const r = await axios.get(`${BASE}/api/records`, {
      headers: { Authorization: `Bearer ${state.patient.token}` }
    });
    if (!r.data.records.find(rec => rec._id === state.recordId))
      throw new Error('Patient cannot see their own record');
  });

  // ── SECTION 3: BLOCKCHAIN VERIFICATION ───────────────────────

  await test('Blockchain hash verification passes', async () => {
    const r = await axios.get(`${BASE}/api/records/${state.recordId}`, {
      headers: { Authorization: `Bearer ${state.patient.token}` }
    });
    const verifyR = await axios.get(
      `${BASE}/api/blockchain/verify/${r.data.sha256Hash}`,
      { headers: { Authorization: `Bearer ${state.patient.token}` } }
    );
    if (!verifyR.data.verified) throw new Error('Hash not verified on blockchain');
  });

  // ── SECTION 4: ACCESS CONTROL ─────────────────────────────────

  await test('Doctor has no access initially', async () => {
    const r = await axios.get(
      `${BASE}/api/records/${state.recordId}/access-status`,
      { headers: { Authorization: `Bearer ${state.doctor.token}` } }
    );
    if (r.data.hasAccess !== false) throw new Error('Doctor should not have access');
  });

  await test('Doctor cannot download without access (403)', async () => {
    try {
      await axios.get(`${BASE}/api/records/${state.recordId}/download`, {
        headers: { Authorization: `Bearer ${state.doctor.token}` }
      });
      throw new Error('Should have returned 403');
    } catch(e) {
      if (e.response?.status !== 403) throw new Error('Expected 403');
    }
  });

  await test('Patient grants access to doctor', async () => {
    const r = await axios.post(
      `${BASE}/api/records/${state.recordId}/grant`,
      { targetAddress: state.doctor.walletAddress, targetRole: 'doctor' },
      { headers: { Authorization: `Bearer ${state.patient.token}` } }
    );
    if (!r.data.txHash) throw new Error('No blockchain tx hash returned');
    state.grantTxHash = r.data.txHash;
  });

  await test('Doctor now has access after grant', async () => {
    const r = await axios.get(
      `${BASE}/api/records/${state.recordId}/access-status`,
      { headers: { Authorization: `Bearer ${state.doctor.token}` } }
    );
    if (r.data.hasAccess !== true) throw new Error('Doctor should have access now');
  });

  await test('Doctor can download after access granted', async () => {
    const r = await axios.get(
      `${BASE}/api/records/${state.recordId}/download`,
      { headers: { Authorization: `Bearer ${state.doctor.token}` } }
    );
    if (!r.data) throw new Error('No file returned');
  });

  await test('Patient grants access to hospital', async () => {
    const r = await axios.post(
      `${BASE}/api/records/${state.recordId}/grant`,
      { targetAddress: state.hospital.walletAddress, targetRole: 'hospital' },
      { headers: { Authorization: `Bearer ${state.patient.token}` } }
    );
    if (!r.data.txHash) throw new Error('No tx hash for hospital grant');
  });

  await test('Patient revokes doctor access', async () => {
    await axios.post(
      `${BASE}/api/records/${state.recordId}/revoke`,
      { targetAddress: state.doctor.walletAddress },
      { headers: { Authorization: `Bearer ${state.patient.token}` } }
    );
  });

  await test('Doctor cannot download after revoke (403)', async () => {
    try {
      await axios.get(`${BASE}/api/records/${state.recordId}/download`, {
        headers: { Authorization: `Bearer ${state.doctor.token}` }
      });
      throw new Error('Should have returned 403 after revoke');
    } catch(e) {
      if (e.response?.status !== 403) throw new Error('Expected 403 after revoke');
    }
  });

  await test('Access list shows correct state', async () => {
    const r = await axios.get(
      `${BASE}/api/records/${state.recordId}/access-list`,
      { headers: { Authorization: `Bearer ${state.patient.token}` } }
    );
    const hasDoctor = r.data.accessList.find(a => a.role === 'doctor' && a.active);
    const hasHospital = r.data.accessList.find(a => a.role === 'hospital' && a.active);
    if (hasDoctor) throw new Error('Doctor should not be in active access list');
    if (!hasHospital) throw new Error('Hospital should be in active access list');
  });

  // ── SECTION 5: AI MODULE ──────────────────────────────────────

  await test('AI summarizer runs and returns disclaimer', async () => {
    const r = await axios.post(
      `${BASE}/api/ai/analyze`,
      { recordId: state.recordId },
      { headers: { Authorization: `Bearer ${state.doctor.token}` } }
    );
    if (!r.data.summary) throw new Error('No summary returned');
    if (!r.data.abnormals) throw new Error('No abnormals array');
    const disclaimer = 'informational only';
    if (!r.data.summary.toLowerCase().includes(disclaimer) && 
        !r.data.disclaimer?.toLowerCase().includes(disclaimer))
      throw new Error('No disclaimer in AI response');
  });

  await test('PII is stripped before AI call', async () => {
    // Check that the aiService.deidentify function works
    const r = await axios.post(
      `${BASE}/api/ai/deidentify-test`,
      { text: 'Patient: John Doe, DOB: 12/03/1990, MRN: 12345, Phone: 9876543210' },
      { headers: { Authorization: `Bearer ${state.admin.token}` } }
    );
    if (r.data.result.includes('John Doe')) throw new Error('PII not stripped: name found');
    if (r.data.result.includes('12/03/1990')) throw new Error('PII not stripped: DOB found');
    if (r.data.result.includes('9876543210')) throw new Error('PII not stripped: phone found');
  });

  await test('Drug info lookup works', async () => {
    const r = await axios.post(
      `${BASE}/api/ai/drug`,
      { drugName: 'Metformin' },
      { headers: { Authorization: `Bearer ${state.doctor.token}` } }
    );
    if (!r.data.info) throw new Error('No drug info returned');
    if (r.data.info.split(' ').length > 120) throw new Error('Drug info too long');
  });

  await test('Medical chat returns response', async () => {
    const r = await axios.post(
      `${BASE}/api/ai/chat`,
      {
        recordId: state.recordId,
        messages: [{ role: 'user', content: 'What does my hemoglobin result mean?' }]
      },
      { headers: { Authorization: `Bearer ${state.doctor.token}` } }
    );
    if (!r.data.reply) throw new Error('No chat reply returned');
  });

  // ── SECTION 6: INSURANCE CLAIMS ───────────────────────────────

  await test('Patient submits insurance claim', async () => {
    const r = await axios.post(
      `${BASE}/api/claims`,
      {
        recordId: state.recordId,
        insuranceProvider: 'Test Insurance Co',
        claimAmount: 15000,
        claimType: 'lab',
        insuranceWalletAddress: '0x742d35Cc6634C0532925a3b8D4C9C2C5e4e0B12f'
      },
      { headers: { Authorization: `Bearer ${state.patient.token}` } }
    );
    state.claimId = r.data.claimId;
    if (!state.claimId) throw new Error('No claimId returned');
    if (!r.data.accessGranted) throw new Error('Insurance access not auto-granted');
  });

  await test('Patient sees their claim', async () => {
    const r = await axios.get(`${BASE}/api/claims`, {
      headers: { Authorization: `Bearer ${state.patient.token}` }
    });
    if (!r.data.claims.find(c => c._id === state.claimId))
      throw new Error('Claim not found in patient claims list');
  });

  await test('Patient revokes insurance access', async () => {
    await axios.put(
      `${BASE}/api/claims/${state.claimId}/revoke-access`,
      {},
      { headers: { Authorization: `Bearer ${state.patient.token}` } }
    );
  });

  // ── SECTION 7: AUDIT LOG ──────────────────────────────────────

  await test('Patient audit log has all actions', async () => {
    const r = await axios.get(
      `${BASE}/api/audit/${state.patient.id}`,
      { headers: { Authorization: `Bearer ${state.patient.token}` } }
    );
    const actions = r.data.auditLog.map(a => a.action);
    const required = ['upload', 'grantAccess', 'revokeAccess', 'insuranceClaimSubmitted'];
    required.forEach(action => {
      if (!actions.includes(action)) 
        throw new Error(`Missing audit entry for: ${action}`);
    });
  });

  await test('Admin sees full audit log', async () => {
    const r = await axios.get(`${BASE}/api/audit/admin/all`, {
      headers: { Authorization: `Bearer ${state.admin.token}` }
    });
    if (!r.data.auditLog || r.data.auditLog.length === 0)
      throw new Error('Admin audit log empty');
  });

  await test('Patient cannot see other patient audit log (403)', async () => {
    // Register second patient
    const r2 = await axios.post(`${BASE}/api/auth/register`, {
      name: 'Patient 2', email: 'patient2@test.com',
      password: 'Test@1234', role: 'patient'
    });
    try {
      await axios.get(`${BASE}/api/audit/${state.patient.id}`, {
        headers: { Authorization: `Bearer ${r2.data.token}` }
      });
      throw new Error('Should have returned 403');
    } catch(e) {
      if (e.response?.status !== 403) throw new Error('Expected 403');
    }
  });

  // ── SECTION 8: NOTIFICATIONS ──────────────────────────────────

  await test('Patient has notifications', async () => {
    const r = await axios.get(`${BASE}/api/notifications`, {
      headers: { Authorization: `Bearer ${state.patient.token}` }
    });
    if (!r.data.notifications) throw new Error('No notifications array');
  });

  // ── FINAL REPORT ──────────────────────────────────────────────

  console.log('\n══════════════════════════════════════');
  console.log('INTEGRATION TEST COMPLETE');
  console.log('══════════════════════════════════════');
  console.log('Fix every ❌ FAIL above before deployment.');
  console.log('Each failure shows the exact endpoint and error.');
}

runAllTests();

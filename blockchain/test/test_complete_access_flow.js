'use strict';

/**
 * test_complete_access_flow.js
 * End-to-end test validating the complete patient access control flow:
 * 1. Patient grants access to doctor -> verify hasAccess(patient, doctor) = true
 * 2. Patient grants access to hospital -> verify hasAccess(patient, hospital) = true
 * 3. Patient grants access to lab -> verify hasAccess(patient, lab) = true
 * 4. Patient revokes doctor access -> verify hasAccess(patient, doctor) = false
 * 5. Doctor tries to download after revoke -> must get 403
 * 6. All actions appear in patient's audit log
 */

const axios = require('axios');
const { ethers } = require('ethers');
const blockchainService = require('../../legacy/backend/services/blockchainService');

const BASE_URL = 'http://localhost:8080';

async function runTests() {
  console.log('===============================================================');
  console.log('STARTING END-TO-END ACCESS CONTROL VALIDATION');
  console.log('===============================================================');

  let passed = 0;
  let total = 6;

  try {
    // Step 0: Obtain JWT tokens for Patient and Doctor
    console.log('\n[Setup] Authenticating Patient and Doctor...');
    const patientLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'patient@ehr.com',
      password: 'patient123'
    });
    const patientToken = patientLogin.data.token;
    const patientHeaders = { Authorization: `Bearer ${patientToken}` };
    const patientId = patientLogin.data.user.userId || '90';
    console.log(`✅ Patient authenticated (ID: ${patientId}, Token: ${patientToken.substring(0, 16)}...)`);

    const doctorLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'doctor@hospital.org',
      password: 'doctor123'
    });
    const doctorToken = doctorLogin.data.token;
    const doctorHeaders = { Authorization: `Bearer ${doctorToken}` };
    const doctorId = doctorLogin.data.user.userId;
    const doctorAddress = doctorLogin.data.user.walletAddress || blockchainService.deriveAddress(doctorId);
    console.log(`✅ Doctor authenticated (ID: ${doctorId}, Wallet: ${doctorAddress})`);

    // Derive or fetch hospital and lab target wallet addresses
    const hospAddress = blockchainService.deriveAddress('hosp_st_jude_01');
    const labAddress = blockchainService.deriveAddress('lab_diagnostics_01');
    console.log(`✅ Hospital Wallet: ${hospAddress}`);
    console.log(`✅ Lab Wallet:      ${labAddress}`);

    const recordId = '1593418802454';

    // Test directory endpoints: GET /api/users?role=...
    console.log('\n[Directory Check] Querying /api/users?role=...');
    const docList = await axios.get(`${BASE_URL}/api/users?role=doctor`, { headers: patientHeaders });
    const hospList = await axios.get(`${BASE_URL}/api/users?role=hospital`, { headers: patientHeaders });
    const labList = await axios.get(`${BASE_URL}/api/users?role=lab`, { headers: patientHeaders });
    console.log(`Doctors count: ${docList.data.users.length}, Hospitals count: ${hospList.data.users.length}, Labs count: ${labList.data.users.length}`);

    // Helper to query running server's smart contract state
    async function checkSmartContractAccess(pat, doc) {
      const res = await axios.get(`${BASE_URL}/hasAccess?patient=${encodeURIComponent(pat)}&doctor=${encodeURIComponent(doc)}`);
      return res.data.hasAccess;
    }

    // TEST 1: Patient grants access to doctor -> verify hasAccess(patient, doctor) = true
    console.log('\n---------------------------------------------------------------');
    console.log('TEST 1: Patient grants access to doctor');
    console.log('POST /api/records/:recordId/grant { targetAddress, targetRole: "doctor" }');
    const grantDocRes = await axios.post(
      `${BASE_URL}/api/records/${recordId}/grant`,
      { targetAddress: doctorAddress, targetRole: 'doctor', targetId: doctorId },
      { headers: patientHeaders }
    );
    console.log('Response:', grantDocRes.data);

    const docAccessOnChain = await checkSmartContractAccess(patientId, doctorAddress);
    console.log(`Smart contract hasAccess(patient, doctor) = ${docAccessOnChain}`);
    if (grantDocRes.data.success && docAccessOnChain === true && grantDocRes.data.message.includes('doctor')) {
      console.log('>>> TEST 1 PASSED: hasAccess(patient, doctor) === true');
      passed++;
    } else {
      throw new Error(`Test 1 Failed: hasAccess is ${docAccessOnChain}`);
    }

    // TEST 2: Patient grants access to hospital -> verify hasAccess(patient, hospital) = true
    console.log('\n---------------------------------------------------------------');
    console.log('TEST 2: Patient grants access to hospital');
    console.log('POST /api/records/:recordId/grant { targetAddress, targetRole: "hospital" }');
    const grantHospRes = await axios.post(
      `${BASE_URL}/api/records/${recordId}/grant`,
      { targetAddress: hospAddress, targetRole: 'hospital', targetId: 'hosp_st_jude_01' },
      { headers: patientHeaders }
    );
    console.log('Response:', grantHospRes.data);

    const hospAccessOnChain = await checkSmartContractAccess(patientId, hospAddress);
    console.log(`Smart contract hasAccess(patient, hospital) = ${hospAccessOnChain}`);
    if (grantHospRes.data.success && hospAccessOnChain === true && grantHospRes.data.message.includes('hospital')) {
      console.log('>>> TEST 2 PASSED: hasAccess(patient, hospital) === true');
      passed++;
    } else {
      throw new Error(`Test 2 Failed: hasAccess is ${hospAccessOnChain}`);
    }

    // TEST 3: Patient grants access to lab -> verify hasAccess(patient, lab) = true
    console.log('\n---------------------------------------------------------------');
    console.log('TEST 3: Patient grants access to lab');
    console.log('POST /api/records/:recordId/grant { targetAddress, targetRole: "lab" }');
    const grantLabRes = await axios.post(
      `${BASE_URL}/api/records/${recordId}/grant`,
      { targetAddress: labAddress, targetRole: 'lab', targetId: 'lab_diagnostics_01' },
      { headers: patientHeaders }
    );
    console.log('Response:', grantLabRes.data);

    const labAccessOnChain = await checkSmartContractAccess(patientId, labAddress);
    console.log(`Smart contract hasAccess(patient, lab) = ${labAccessOnChain}`);
    if (grantLabRes.data.success && labAccessOnChain === true && grantLabRes.data.message.includes('lab')) {
      console.log('>>> TEST 3 PASSED: hasAccess(patient, lab) === true');
      passed++;
    } else {
      throw new Error(`Test 3 Failed: hasAccess is ${labAccessOnChain}`);
    }

    // Check GET /api/records/:recordId/access-list
    console.log('\n[Access List Check] Querying /api/records/:recordId/access-list');
    const accessListRes = await axios.get(
      `${BASE_URL}/api/records/${recordId}/access-list`,
      { headers: patientHeaders }
    );
    const activeList = Array.isArray(accessListRes.data) ? accessListRes.data : (accessListRes.data.accessList || []);
    console.log(`Active access entries count: ${activeList.length}`);
    activeList.forEach((a, i) => console.log(` [${i + 1}] ${a.role.toUpperCase()}: ${a.name} (${a.walletAddress})`));

    // TEST 4: Patient revokes doctor access -> verify hasAccess(patient, doctor) = false
    console.log('\n---------------------------------------------------------------');
    console.log('TEST 4: Patient revokes doctor access');
    console.log('POST /api/records/:recordId/revoke { targetAddress }');
    const revokeDocRes = await axios.post(
      `${BASE_URL}/api/records/${recordId}/revoke`,
      { targetAddress: doctorAddress, targetId: doctorId, targetRole: 'doctor' },
      { headers: patientHeaders }
    );
    console.log('Response:', revokeDocRes.data);

    const docAccessAfterRevoke = await checkSmartContractAccess(patientId, doctorAddress);
    console.log(`Smart contract hasAccess(patient, doctor) after revoke = ${docAccessAfterRevoke}`);
    if (revokeDocRes.data.success && docAccessAfterRevoke === false) {
      console.log('>>> TEST 4 PASSED: hasAccess(patient, doctor) === false');
      passed++;
    } else {
      throw new Error(`Test 4 Failed: hasAccess is ${docAccessAfterRevoke}`);
    }

    // TEST 5: Doctor tries to download after revoke -> must get 403
    console.log('\n---------------------------------------------------------------');
    console.log('TEST 5: Doctor tries to download record after revocation');
    console.log('GET /api/records/:recordId/download with Doctor JWT');
    let doctorDownloadBlocked = false;
    try {
      await axios.get(`${BASE_URL}/api/records/${recordId}/download`, { headers: doctorHeaders });
    } catch (err) {
      if (err.response && err.response.status === 403) {
        doctorDownloadBlocked = true;
        console.log(`Correctly received HTTP ${err.response.status} Forbidden:`, err.response.data);
      } else {
        console.log(`Unexpected error response: ${err.message}`);
      }
    }

    if (doctorDownloadBlocked) {
      console.log('>>> TEST 5 PASSED: Doctor download blocked with HTTP 403');
      passed++;
    } else {
      throw new Error('Test 5 Failed: Doctor download was NOT rejected with 403');
    }

    // TEST 6: All actions appear in patient's audit log
    console.log('\n---------------------------------------------------------------');
    console.log("TEST 6: Verifying all actions appear in patient's audit log");
    console.log('GET /api/audit/:patientId with Patient JWT');
    const auditRes = await axios.get(`${BASE_URL}/api/audit/${patientId}`, { headers: patientHeaders });
    const logs = auditRes.data.logs || [];
    console.log(`Total audit logs found for Patient #${patientId}: ${logs.length}`);

    const grantDoctorLog = logs.find(l => l.action === 'grantAccess' && (l.targetRole === 'doctor' || l.targetId === doctorId || (l.details && l.details.targetRole === 'doctor')));
    const grantHospLog = logs.find(l => l.action === 'grantAccess' && (l.targetRole === 'hospital' || (l.details && l.details.targetRole === 'hospital')));
    const grantLabLog = logs.find(l => l.action === 'grantAccess' && (l.targetRole === 'lab' || (l.details && l.details.targetRole === 'lab')));
    const revokeDocLog = logs.find(l => l.action === 'revokeAccess');

    console.log('Audit log matches:');
    console.log(' - Grant Doctor action:', Boolean(grantDoctorLog));
    console.log(' - Grant Hospital action:', Boolean(grantHospLog));
    console.log(' - Grant Lab action:', Boolean(grantLabLog));
    console.log(' - Revoke Doctor action:', Boolean(revokeDocLog));

    if (grantDoctorLog && grantHospLog && grantLabLog && revokeDocLog) {
      console.log('>>> TEST 6 PASSED: All grant & revoke actions verified in AuditLog');
      passed++;
    } else {
      throw new Error('Test 6 Failed: Missing required audit log events');
    }

    console.log('\n===============================================================');
    console.log(`ALL TESTS COMPLETED: ${passed} / ${total} PASSED (100%)`);
    console.log('===============================================================');

  } catch (err) {
    console.error('\n❌ Test execution encountered error:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Body:', err.response.data);
    }
    process.exit(1);
  }
}

runTests();

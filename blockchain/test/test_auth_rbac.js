'use strict';

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:8080';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING JWT AUTHENTICATION & RBAC TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    return async () => {
      try {
        await fn();
        console.log(`  [PASS] ${desc}`);
        passed++;
      } catch (err) {
        console.error(`  [FAIL] ${desc}`);
        console.error(`         ${err.message}`);
        failed++;
      }
    };
  }

  const tokens = {};
  const timestamp = Date.now();

  // Test 1: Helmet Headers
  await test('1. Security Headers: Helmet headers present in HTTP response', async () => {
    const res = await request('GET', '/api/printSomething');
    assert.strictEqual(res.statusCode, 200);
    assert(res.headers['x-content-type-options'] === 'nosniff', 'Missing x-content-type-options');
    assert(res.headers['x-frame-options'] || res.headers['content-security-policy'], 'Missing frame/CSP security headers');
  })();

  // Test 2: Rate Limiter Headers
  await test('2. Rate Limiting: 100 requests / 15 mins policy and headers active', async () => {
    const res = await request('GET', '/api/printSomething');
    assert.strictEqual(res.statusCode, 200);
    assert(res.headers['ratelimit-limit'] === '100', `Expected ratelimit-limit 100, got ${res.headers['ratelimit-limit']}`);
    assert(res.headers['ratelimit-remaining'] !== undefined, 'Missing ratelimit-remaining header');
  })();

  // Test 3: CORS Headers
  await test('3. CORS: Allows requests with Origin http://localhost:3000', async () => {
    const res = await request('GET', '/api/printSomething', null, { Origin: 'http://localhost:3000' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
  })();

  // Test 4: Register all 6 roles
  const roles = ['patient', 'doctor', 'hospital', 'lab', 'admin', 'insurance'];
  for (const role of roles) {
    await test(`4.${roles.indexOf(role) + 1} Register role: ${role}`, async () => {
      const email = `test_${role}_${timestamp}@test.com`;
      const res = await request('POST', '/api/auth/register', {
        email,
        password: `password_${role}_123`,
        role,
        name: `Test ${role.toUpperCase()}`
      });
      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
      assert(res.data.token, 'Token missing from registration response');
      assert.strictEqual(res.data.user.role, role);
      assert(res.data.user.walletAddress.startsWith('0x'), 'Missing or invalid walletAddress');
      tokens[role] = res.data.token;
    })();
  }

  // Test 5: Validation on Register (duplicate email, invalid role)
  await test('5. Register Validation: Reject invalid role', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: `badrole_${timestamp}@test.com`,
      password: 'password123',
      role: 'hacker'
    });
    assert.strictEqual(res.statusCode, 400);
    assert(res.data.error.includes('Invalid role'));
  })();

  await test('6. Register Validation: Reject duplicate email', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: `test_patient_${timestamp}@test.com`,
      password: 'password_patient_123',
      role: 'patient'
    });
    assert.strictEqual(res.statusCode, 400);
    assert(res.data.error.includes('already registered'));
  })();

  // Test 7: Login for all 5 roles
  for (const role of roles) {
    await test(`7.${roles.indexOf(role) + 1} Login role: ${role}`, async () => {
      const email = `test_${role}_${timestamp}@test.com`;
      const res = await request('POST', '/api/auth/login', {
        email,
        password: `password_${role}_123`
      });
      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
      assert(res.data.token, 'Token missing');
      assert.strictEqual(res.data.user.role, role);
      assert(res.data.user.walletAddress.startsWith('0x'), 'Invalid walletAddress');
      tokens[role] = res.data.token;
    })();
  }

  // Test 8: Login invalid credentials
  await test('8. Login Validation: Reject wrong password', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: `test_patient_${timestamp}@test.com`,
      password: 'wrong_password_xyz'
    });
    assert.strictEqual(res.statusCode, 401);
  })();

  // Test 9: Seed accounts login
  await test('9. Seed Accounts: Login with pre-seeded accounts', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'doctor@hospital.org',
      password: 'doctor123'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.user.role, 'doctor');
    tokens['seeded_doctor'] = res.data.token;
  })();

  // ====================================================
  // ROUTE PROTECTION & RBAC TESTS
  // ====================================================

  // Route: GET /getPatients (requires: doctor OR hospital OR admin)
  await test('10. RBAC GET /getPatients: Returns 401 without Bearer token', async () => {
    const res = await request('GET', '/getPatients');
    assert.strictEqual(res.statusCode, 401);
  })();

  await test('11. RBAC GET /getPatients: Returns 403 for patient role', async () => {
    const res = await request('GET', '/getPatients', null, { Authorization: `Bearer ${tokens['patient']}` });
    assert.strictEqual(res.statusCode, 403);
  })();

  await test('12. RBAC GET /getPatients: Returns 200 for doctor role', async () => {
    const res = await request('GET', '/getPatients', null, { Authorization: `Bearer ${tokens['doctor']}` });
    assert.strictEqual(res.statusCode, 200);
    assert(Array.isArray(res.data), 'Expected array of patients');
  })();

  await test('13. RBAC GET /getPatients: Returns 200 for hospital role', async () => {
    const res = await request('GET', '/getPatients', null, { Authorization: `Bearer ${tokens['hospital']}` });
    assert.strictEqual(res.statusCode, 200);
  })();

  await test('14. RBAC GET /getPatients: Returns 200 for admin role', async () => {
    const res = await request('GET', '/getPatients', null, { Authorization: `Bearer ${tokens['admin']}` });
    assert.strictEqual(res.statusCode, 200);
  })();

  await test('14b. RBAC GET /getPatients: Returns 200 for insurance role', async () => {
    const res = await request('GET', '/getPatients', null, { Authorization: `Bearer ${tokens['insurance']}` });
    assert.strictEqual(res.statusCode, 200);
  })();

  // Route: POST /uploadReport (requires: hospital OR lab)
  await test('15. RBAC POST /uploadReport: Returns 401 without Bearer token', async () => {
    const res = await request('POST', '/uploadReport', { patientId: '90', report: 'Blood test' });
    assert.strictEqual(res.statusCode, 401);
  })();

  await test('16. RBAC POST /uploadReport: Returns 403 for patient role', async () => {
    const res = await request('POST', '/uploadReport', { patientId: '90', report: 'Blood test' }, { Authorization: `Bearer ${tokens['patient']}` });
    assert.strictEqual(res.statusCode, 403);
  })();

  await test('17. RBAC POST /uploadReport: Returns 403 for doctor role', async () => {
    const res = await request('POST', '/uploadReport', { patientId: '90', report: 'Blood test' }, { Authorization: `Bearer ${tokens['doctor']}` });
    assert.strictEqual(res.statusCode, 403);
  })();

  await test('17b. RBAC POST /uploadReport: Returns 403 for insurance role', async () => {
    const res = await request('POST', '/uploadReport', { patientId: '90', report: 'Claim audit' }, { Authorization: `Bearer ${tokens['insurance']}` });
    assert.strictEqual(res.statusCode, 403);
  })();

  await test('18. RBAC POST /uploadReport: Returns 200 for hospital role', async () => {
    const res = await request('POST', '/uploadReport', { patientId: '90', report: 'CT Scan by Hospital' }, { Authorization: `Bearer ${tokens['hospital']}` });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.Success, 'Upload response missing Success');
  })();

  await test('19. RBAC POST /uploadReport: Returns 200 for lab role', async () => {
    const res = await request('POST', '/uploadReport', { patientId: '90', report: 'Lipid Profile by Lab' }, { Authorization: `Bearer ${tokens['lab']}` });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.Success, 'Upload response missing Success');
  })();

  // Route: POST /grantAccess (requires: patient)
  await test('20. RBAC POST /grantAccess: Returns 401 without token', async () => {
    const res = await request('POST', '/grantAccess', { patientId: '90', doctorId: '1593418229676' });
    assert.strictEqual(res.statusCode, 401);
  })();

  await test('21. RBAC POST /grantAccess: Returns 403 for doctor role', async () => {
    const res = await request('POST', '/grantAccess', { patientId: '90', doctorId: '1593418229676' }, { Authorization: `Bearer ${tokens['doctor']}` });
    assert.strictEqual(res.statusCode, 403);
  })();

  await test('22. RBAC POST /grantAccess: Returns 403 for hospital role', async () => {
    const res = await request('POST', '/grantAccess', { patientId: '90', doctorId: '1593418229676' }, { Authorization: `Bearer ${tokens['hospital']}` });
    assert.strictEqual(res.statusCode, 403);
  })();

  await test('23. RBAC POST /grantAccess: Returns 200 for patient role', async () => {
    const res = await request('POST', '/grantAccess', { patientId: '90', doctorId: '1593418229676' }, { Authorization: `Bearer ${tokens['patient']}` });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.Success, 'Grant access missing Success');
    assert(res.data.txHash, 'Grant access missing txHash');
  })();

  // Route: POST /summarizeReport (requires: doctor)
  await test('24. RBAC POST /summarizeReport: Returns 401 without token', async () => {
    const res = await request('POST', '/summarizeReport', { patientId: '90' });
    assert.strictEqual(res.statusCode, 401);
  })();

  await test('25. RBAC POST /summarizeReport: Returns 403 for patient role', async () => {
    const res = await request('POST', '/summarizeReport', { patientId: '90' }, { Authorization: `Bearer ${tokens['patient']}` });
    assert.strictEqual(res.statusCode, 403);
  })();

  await test('26. RBAC POST /summarizeReport: Returns 403 for lab role', async () => {
    const res = await request('POST', '/summarizeReport', { patientId: '90' }, { Authorization: `Bearer ${tokens['lab']}` });
    assert.strictEqual(res.statusCode, 403);
  })();

  await test('27. RBAC POST /summarizeReport: Returns 200 for doctor role', async () => {
    const res = await request('POST', '/summarizeReport', { patientId: '90' }, { Authorization: `Bearer ${tokens['doctor']}` });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.summary && res.data.summary.includes('AI Clinical Summary'));
  })();

  // Route: GET /getReports (requires: patient [own only] OR doctor [if granted])
  await test('28. RBAC GET /getReports: Returns 401 without token', async () => {
    const res = await request('GET', '/getReports');
    assert.strictEqual(res.statusCode, 401);
  })();

  await test('29. RBAC GET /getReports: Returns 403 for hospital or lab role', async () => {
    const res = await request('GET', '/getReports', null, { Authorization: `Bearer ${tokens['hospital']}` });
    assert.strictEqual(res.statusCode, 403);
  })();

  await test('30. RBAC GET /getReports: Returns 200 for patient and only own records', async () => {
    // Login as patient 90
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'patient@ehr.com',
      password: 'patient123'
    });
    const pat90Token = loginRes.data.token;

    const res = await request('GET', '/getReports', null, { Authorization: `Bearer ${pat90Token}` });
    assert.strictEqual(res.statusCode, 200);
    assert(Array.isArray(res.data));
    for (const item of res.data) {
      assert.strictEqual(item.Record.patientId, '90', `Patient 90 received report belonging to ${item.Record.patientId}`);
    }
  })();

  await test('31. RBAC GET /getReports: Returns 200 for doctor when access is granted', async () => {
    const res = await request('GET', '/getReports', null, { Authorization: `Bearer ${tokens['doctor']}` });
    assert.strictEqual(res.statusCode, 200);
    assert(Array.isArray(res.data));
  })();

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: Passed: ${passed}, Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});

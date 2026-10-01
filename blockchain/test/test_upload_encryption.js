'use strict';

const http = require('http');
const assert = require('assert');
const mongoose = require('mongoose');
const encryptionService = require('../../legacy/backend/services/encryptionService');

const PORT = 8080;
const HOST = 'localhost';

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const isMultipart = headers['Content-Type'] && headers['Content-Type'].includes('multipart/form-data');
    let data = '';
    let reqHeaders = { ...headers };

    if (!isMultipart && body && typeof body === 'object') {
      data = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    } else if (Buffer.isBuffer(body)) {
      data = body;
      reqHeaders['Content-Length'] = body.length;
    }

    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const text = rawBuffer.toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          parsed = text;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          buffer: rawBuffer
        });
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// Helper to construct multipart/form-data payload with a file
function createMultipartPayload(boundary, fields, fileField) {
  const chunks = [];

  // Add text fields
  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  // Add file field
  if (fileField) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    chunks.push(fileField.content);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

async function runEndToEndTests() {
  console.log('\n===============================================================');
  console.log('STARTING AES-256-GCM UPLOAD PIPELINE & GRIDFS INTEGRATION TESTS');
  console.log('===============================================================\n');

  // Step 1: Login as Hospital to obtain JWT
  console.log('Step 1: Authenticating as Hospital to obtain JWT...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'hospital@health.org',
    password: 'hospital123'
  });
  assert.strictEqual(loginRes.statusCode, 200, 'Hospital login must return 200');
  const hospitalToken = loginRes.data.token;
  assert(hospitalToken, 'JWT token must be present');
  console.log('   ✓ Hospital JWT received successfully.\n');

  // Step 2: Prepare a sample clinical report file
  const originalFileContent = Buffer.from(
    'ST. JUDE MEDICAL CENTER CLINICAL SUMMARY:\nPatient: Tanmay Shishodia (#90)\nDiagnosis: Stable cardiac parameters. Prescribed Atorvastatin 20mg once daily at bedtime.\nTamper check SHA-256 integrity seal active.'
  );
  const originalHash = encryptionService.hashFile(originalFileContent);
  console.log('Step 2: Prepared sample file to upload via Multer:');
  console.log('   Original File Size:', originalFileContent.length, 'bytes');
  console.log('   Computed File SHA-256:', originalHash);

  // Step 3: Construct multipart/form-data payload and upload via Multer to /uploadReport
  console.log('\nStep 3: Uploading file via Multer to POST /uploadReport with AES-256-GCM encryption...');
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const multipartBody = createMultipartPayload(boundary, {
    patientId: '90'
  }, {
    name: 'file',
    filename: 'st_jude_prescription_90.docx',
    content: originalFileContent
  });

  const uploadRes = await request('POST', '/uploadReport', multipartBody, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Authorization': `Bearer ${hospitalToken}`
  });

  assert.strictEqual(uploadRes.statusCode, 200, `Upload must succeed with 200 OK. Received: ${uploadRes.statusCode}`);
  const reportData = uploadRes.data.report;
  assert(reportData, 'Report object must be in response');
  assert.strictEqual(reportData.fileHash, originalHash, 'SHA-256 hash must match original file exactly');
  assert.strictEqual(reportData.isEncrypted, true, 'Report must be flagged as encrypted');
  assert.strictEqual(reportData.encryptionAlgorithm, 'aes-256-gcm', 'Algorithm must be AES-256-GCM');
  assert(reportData.iv, 'IV must be stored');
  assert.strictEqual(reportData.iv.length, 24, 'IV must be 12 bytes hex (24 chars)');
  assert(reportData.authTag, 'AuthTag must be stored');
  assert.strictEqual(reportData.authTag.length, 32, 'AuthTag must be 16 bytes hex (32 chars)');
  assert(reportData.gridFsFileId, 'GridFS File ID must be stored');
  assert(reportData.txHash, 'Blockchain Tx Hash must be recorded');

  console.log('   ✓ Upload Response Success:', uploadRes.data.Success);
  console.log('   ✓ Stored IV:', reportData.iv);
  console.log('   ✓ Stored AuthTag:', reportData.authTag);
  console.log('   ✓ GridFS File ID:', reportData.gridFsFileId);
  console.log('   ✓ Ethereum Sepolia TxHash:', reportData.txHash);

  // Step 4: Verify that MongoDB GridFS contains the ENCRYPTED bytes, NOT plaintext!
  console.log('\nStep 4: Inspecting MongoDB GridFS directly to verify zero plaintext leakage...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ehr_system');
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'encrypted_health_records'
  });

  const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(reportData.gridFsFileId));
  const gridFsChunks = [];
  await new Promise((resolve, reject) => {
    downloadStream.on('data', c => gridFsChunks.push(c));
    downloadStream.on('end', resolve);
    downloadStream.on('error', reject);
  });

  const storedGridFsBytes = Buffer.concat(gridFsChunks);
  console.log('   Stored GridFS Byte Count:', storedGridFsBytes.length);
  assert.notStrictEqual(
    storedGridFsBytes.toString('utf8'),
    originalFileContent.toString('utf8'),
    'CRITICAL: MongoDB GridFS must NEVER store plaintext original file!'
  );
  assert(!storedGridFsBytes.includes('ST. JUDE MEDICAL CENTER'), 'Plaintext string must not exist in GridFS file');
  console.log('   ✓ VERIFIED: GridFS contains only encrypted ciphertext! Plaintext is zero-knowledge.');

  // Step 5: Verify HealthRecord MongoDB model
  console.log('\nStep 5: Verifying HealthRecord Mongoose Model in database...');
  const HealthRecord = require('../../legacy/backend/models/HealthRecord');
  const hrDoc = await HealthRecord.findOne({ reportId: reportData.reportId });
  assert(hrDoc, 'HealthRecord document must exist in MongoDB');
  assert.strictEqual(hrDoc.iv, reportData.iv);
  assert.strictEqual(hrDoc.authTag, reportData.authTag);
  assert.strictEqual(hrDoc.fileHash, originalHash);
  assert.strictEqual(hrDoc.blockchainTxHash, reportData.txHash);
  console.log('   ✓ HealthRecord document confirmed in MongoDB with IV, AuthTag & TxHash.');

  // Step 6: Test Download & On-the-Fly AES-256-GCM Decryption
  console.log('\nStep 6: Testing GET /downloadReport/:reportId endpoint with AES-256-GCM decryption...');
  const dlRes = await request('GET', `/downloadReport/${reportData.reportId}`, null, {
    'Authorization': `Bearer ${hospitalToken}`
  });
  assert.strictEqual(dlRes.statusCode, 200, 'Download must return 200');
  assert.strictEqual(dlRes.buffer.toString('utf8'), originalFileContent.toString('utf8'), 'Decrypted content must match original byte-for-byte');
  console.log('   ✓ Decrypted download matches original unencrypted file byte-for-byte!');

  // Step 7: Test Tamper Detection (Modify 1 byte in GridFS file or authTag)
  console.log('\nStep 7: Testing Tamper Detection on-chain / decryption pipeline...');
  const User = require('../../legacy/backend/models/User');
  let patientUser = await User.findOne({ $or: [{ userId: '90' }, { email: 'patient@ehr.com' }, { email: '123@gmail.com' }] });
  let patientKey = patientUser ? patientUser.encryptionKey : null;
  if (!patientKey) {
    const state = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'web-app', 'server', 'state.json'), 'utf8'));
    const sUser = state.users.find(u => u.userId === '90' || u.email === 'patient@ehr.com' || u.email === '123@gmail.com');
    patientKey = sUser ? sUser.encryptionKey : null;
  }

  let caughtTamper = false;
  try {
    const badData = Buffer.from(storedGridFsBytes);
    badData[5] ^= 0xff; // Corrupt ciphertext
    encryptionService.decryptFile(badData, reportData.iv, reportData.authTag, patientKey);
  } catch (tErr) {
    caughtTamper = true;
    console.log('   ✓ Caught tamper error as expected:', tErr.message);
  }
  assert.strictEqual(caughtTamper, true, 'Tampering must be detected and rejected');

  console.log('\n===============================================================');
  console.log('>>> ALL 7 AES-256-GCM UPLOAD & GRIDFS INTEGRATION TESTS PASSED! <<<');
  console.log('===============================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runEndToEndTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

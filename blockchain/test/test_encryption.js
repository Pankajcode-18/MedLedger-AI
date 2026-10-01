'use strict';

const assert = require('assert');
const encryptionService = require('../../legacy/backend/services/encryptionService');

async function runTests() {
  console.log('--- RUNNING AES-256-GCM ENCRYPTION SERVICE UNIT TESTS ---');

  // 1. generateUserKey
  const key = encryptionService.generateUserKey();
  console.log('1. Generated 256-bit User Key:', key);
  assert.strictEqual(typeof key, 'string');
  assert.strictEqual(key.length, 64, 'Key must be 64-character hex (32 bytes / 256 bits)');

  // 2. hashFile
  const testData = Buffer.from('CONFIDENTIAL PATIENT MEDICAL RECORD: Patient diagnosed with Type II Diabetes. Prescribed Metformin 500mg daily.');
  const sha256 = encryptionService.hashFile(testData);
  console.log('2. File SHA-256 Hash:', sha256);
  assert.strictEqual(sha256.length, 64, 'SHA-256 hash must be 64-character hex');

  // 3. encryptFile
  const encResult = encryptionService.encryptFile(testData, key);
  console.log('3. Encrypted Data Length:', encResult.encryptedData.length, 'bytes');
  console.log('   IV (12-byte hex):', encResult.iv);
  console.log('   AuthTag (16-byte hex):', encResult.authTag);

  assert(Buffer.isBuffer(encResult.encryptedData));
  assert.strictEqual(encResult.iv.length, 24, 'IV must be 24 hex characters (12 bytes)');
  assert.strictEqual(encResult.authTag.length, 32, 'AuthTag must be 32 hex characters (16 bytes)');
  assert.notStrictEqual(encResult.encryptedData.toString('utf8'), testData.toString('utf8'), 'Ciphertext must not match plaintext');

  // 4. decryptFile (Success case)
  const decrypted = encryptionService.decryptFile(encResult.encryptedData, encResult.iv, encResult.authTag, key);
  assert.strictEqual(decrypted.toString('utf8'), testData.toString('utf8'), 'Decrypted text must match original plaintext');
  console.log('4. Decryption verified successfully: Plaintext matches 100%!');

  // 5. Tamper Detection Test (Modifying encrypted data)
  const tamperedData = Buffer.from(encResult.encryptedData);
  tamperedData[0] ^= 0x01; // Flip 1 bit

  let caughtTamper1 = false;
  try {
    encryptionService.decryptFile(tamperedData, encResult.iv, encResult.authTag, key);
  } catch (err) {
    caughtTamper1 = true;
    console.log('5. Tamper Detection (Ciphertext bit flip): Caught expected error:', err.message);
  }
  assert.strictEqual(caughtTamper1, true, 'Must detect ciphertext tampering');

  // 6. Tamper Detection Test (Modifying AuthTag)
  let caughtTamper2 = false;
  const badTag = encResult.authTag.substring(0, 30) + '00';
  try {
    encryptionService.decryptFile(encResult.encryptedData, encResult.iv, badTag, key);
  } catch (err) {
    caughtTamper2 = true;
    console.log('6. Tamper Detection (AuthTag alteration): Caught expected error:', err.message);
  }
  assert.strictEqual(caughtTamper2, true, 'Must detect authTag tampering');

  // 7. Tamper Detection Test (Wrong user key)
  const wrongKey = encryptionService.generateUserKey();
  let caughtTamper3 = false;
  try {
    encryptionService.decryptFile(encResult.encryptedData, encResult.iv, encResult.authTag, wrongKey);
  } catch (err) {
    caughtTamper3 = true;
    console.log('7. Tamper Detection (Wrong User Key): Caught expected error:', err.message);
  }
  assert.strictEqual(caughtTamper3, true, 'Must reject decryption with wrong key');

  console.log('\n>>> ALL 7 AES-256-GCM ENCRYPTION UNIT TESTS PASSED SUCCESSFULLY! <<<\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

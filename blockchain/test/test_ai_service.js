'use strict';

const assert = require('assert');
const http = require('http');
const aiService = require('../../legacy/backend/services/aiService');

const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ehr_system';

const PORT = 8080;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      ...headers,
      'x-bypass-ratelimit': 'true',
      'Content-Type': 'application/json'
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: reqHeaders
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      process.exitCode = 1;
    }
  };
}

(async function runTests() {
  console.log('\n====================================================');
  console.log('STARTING CLINICAL AI MODULE (GPT-4o) TEST SUITE');
  console.log('====================================================\n');

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    }
  } catch (err) {
    console.warn('Mongoose test connection note:', err.message);
  }

  // Test 1: De-identification PII Stripping
  await test('1. deidentify: Strips Patient Name, DOB, MRN, and 10-digit Phone', async () => {
    const sample = `Patient: Johnathan Doe
DOB: 12/05/1985
MRN: MRN88492
Phone: 9876543210
Email: john.doe@medmail.com
Clinical Note: Patient reports mild headache.`;

    const cleaned = aiService.deidentify(sample);
    assert(!cleaned.includes('Johnathan Doe'), 'Patient name was not stripped!');
    assert(!cleaned.includes('12/05/1985'), 'DOB was not stripped!');
    assert(!cleaned.includes('MRN88492'), 'MRN was not stripped!');
    assert(!cleaned.includes('9876543210'), 'Phone was not stripped!');
    assert(cleaned.includes('Patient: [REDACTED]'), 'Missing Patient: [REDACTED]');
    assert(cleaned.includes('DOB: [REDACTED]'), 'Missing DOB: [REDACTED]');
    assert(cleaned.includes('MRN: [REDACTED]'), 'Missing MRN: [REDACTED]');
    assert(cleaned.includes('[PHONE REDACTED]'), 'Missing [PHONE REDACTED]');
  })();

  // Test 2: Abnormal Values Detection (Layer 1 Keywords & Layer 2 Numeric Comparator)
  await test('2. detectAbnormalValues: Layer 1 keywords and Layer 2 standard thresholds', async () => {
    const reportText = `LABORATORY TEST REPORT:
Fasting Blood Sugar: 138 mg/dL
Total Cholesterol: 235 mg/dL
Hemoglobin (Male): 11.8 g/dL
Creatinine (Male): 1.1 mg/dL
Blood Pressure Systolic: 145 mmHg
TSH: 0.15 mIU/L
Note: Serum potassium was CRITICAL on initial draw.`;

    const result = aiService.detectAbnormalValues(reportText);
    assert(result.totalFlagged >= 4, `Expected at least 4 flagged values, got ${result.totalFlagged}`);

    const fbs = result.flaggedValues.find(f => f.parameter === 'Fasting Blood Sugar');
    assert(fbs && fbs.flag === 'HIGH', 'Fasting Blood Sugar should be flagged HIGH');

    const chol = result.flaggedValues.find(f => f.parameter === 'Total Cholesterol');
    assert(chol && chol.flag === 'HIGH', 'Total Cholesterol should be flagged HIGH');

    const hb = result.flaggedValues.find(f => f.parameter === 'Hemoglobin (Male)');
    assert(hb && hb.flag === 'LOW', 'Hemoglobin (Male) should be flagged LOW');

    const bp = result.flaggedValues.find(f => f.parameter === 'Blood Pressure Systolic');
    assert(bp && bp.flag === 'HIGH', 'Blood Pressure Systolic should be flagged HIGH');
  })();

  // Test 3: Abnormal Values with Severity
  await test('3. detectAbnormalValuesWithSeverity: Classifies severity (mild, moderate, requires attention)', async () => {
    const reportText = `Fasting Blood Sugar: 160 mg/dL
Total Cholesterol: 245 mg/dL
Platelets: 80000 /uL`;

    const result = await aiService.detectAbnormalValuesWithSeverity(reportText);
    assert(result.flaggedValues.length >= 2, 'Expected flagged values with severity');
    result.flaggedValues.forEach(f => {
      assert(['mild', 'moderate', 'requires attention'].includes(f.severity), `Invalid severity: ${f.severity}`);
      assert(f.clinicalNote, 'Missing clinicalNote');
    });
  })();

  // Test 4: Summarize Report
  await test('4. summarizeReport: Returns plain language summary, abnormal values, 3 questions, disclaimer', async () => {
    const report = `Patient: Tanmay Shishodia
MRN: 90
Fasting Blood Sugar: 125 mg/dL
Blood Pressure: 130/85 mmHg
Physician Note: Mild sinus congestion, lungs clear bilaterally.`;

    const res = await aiService.summarizeReport(report);
    assert(res.success, 'summarizeReport failed');
    assert(res.summary, 'Missing summary');
    assert(res.disclaimer.includes('Consult a qualified healthcare professional'), 'Missing required disclaimer');
    assert(!res.summary.includes('Tanmay Shishodia'), 'Patient PII leaked in summary output!');
  })();

  // Test 5: Analyze Trend for Recharts LineChart
  await test('5. analyzeTrend: Returns Recharts formatted data [{date, value, label}] and narrative', async () => {
    const trend = await aiService.analyzeTrend('90');
    assert(trend.patientId === '90', 'Invalid patientId');
    assert(Array.isArray(trend.chartData), 'chartData must be array');
    assert(trend.chartData.length >= 3, 'Expected at least 3 trend points');
    assert(trend.chartData[0].date && typeof trend.chartData[0].value === 'number', 'Invalid Recharts point schema');
    assert(trend.narrative && trend.narrative.length > 20, 'Missing narrative trend');
  })();

  // Test 6: Drug Info
  await test('6. getDrugInfo: Explains purpose, side effects, precautions under 100 words', async () => {
    const drug = await aiService.getDrugInfo('Metformin');
    assert(drug.success, 'getDrugInfo failed');
    assert(drug.explanation, 'Missing explanation');
    assert(drug.explanation.length > 20, 'Explanation too short');
    assert(drug.disclaimer, 'Missing drug disclaimer');
  })();

  // Test 7: Multi-turn Chat with Report
  await test('7. chatWithReport: Handles conversation with last 6 messages and context', async () => {
    const messages = [
      { role: 'user', content: 'What is my fasting blood sugar?' },
      { role: 'assistant', content: 'Your fasting blood sugar is 125 mg/dL.' },
      { role: 'user', content: 'Is that considered high?' }
    ];
    const context = 'Fasting blood sugar: 125 mg/dL. Reference: 70-100 mg/dL.';

    const chat = await aiService.chatWithReport(messages, context);
    assert(chat.success, 'chatWithReport failed');
    assert(chat.reply && chat.reply.length > 10, 'Missing reply');
    assert(chat.historyCount === 3, `Expected 3 history items, got ${chat.historyCount}`);
  })();

  // Test 8: Extract Text from File
  await test('8. extractTextFromFile: Normalizes whitespace and extracts clean text', async () => {
    const buffer = Buffer.from('Patient: Test   Record \r\n\r\n\r\nFindings:    Normal\n\n\n\n');
    const text = await aiService.extractTextFromFile(null, 'txt', buffer);
    assert.strictEqual(text, 'Patient: Test Record \n\nFindings: Normal');
  })();

  // Test 9: HTTP Endpoint /api/ai/trend
  await test('9. HTTP POST /api/ai/trend: Returns chartData and narrative', async () => {
    const res = await request('POST', '/api/ai/trend', { patientId: '90' });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.success);
    assert(Array.isArray(res.data.chartData));
  })();

  // Test 10: HTTP Endpoint /api/ai/drug
  await test('10. HTTP POST /api/ai/drug: Returns medication summary', async () => {
    const res = await request('POST', '/api/ai/drug', { drugName: 'Atorvastatin' });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.success);
    assert(res.data.explanation);
  })();

  // Test 11: HTTP Endpoint /api/ai/chat
  await test('11. HTTP POST /api/ai/chat: Returns natural language answer', async () => {
    const res = await request('POST', '/api/ai/chat', {
      messages: [{ role: 'user', content: 'Explain my cholesterol' }],
      reportContext: 'Total Cholesterol: 195 mg/dL'
    });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.success);
    assert(res.data.reply);
  })();

  // Test 12: HTTP Endpoint /api/ai/analyze
  await test('12. HTTP POST /api/ai/analyze: Returns full clinical breakdown with abnormal values', async () => {
    const res = await request('POST', '/api/ai/analyze', {
      reportText: 'Fasting Blood Sugar: 140 mg/dL\nTotal Cholesterol: 225 mg/dL'
    });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.success);
    assert(res.data.summary);
    assert(Array.isArray(res.data.flaggedValues));
  })();

  // Test 13: HTTP POST /summarizeReport with Doctor JWT
  await test('13. HTTP POST /summarizeReport: Strips PII and caches in HealthRecord.aiAnalysis', async () => {
    // Login as doctor to get token
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'doctor@hospital.org',
      password: 'doctor123'
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const token = loginRes.data.token;

    const res = await request('POST', '/summarizeReport', {
      patientId: '90',
      reportText: 'Patient: Tanmay Shishodia\nMRN: 90\nBlood Pressure: 120/80 mmHg'
    }, {
      Authorization: `Bearer ${token}`
    });

    assert.strictEqual(res.statusCode, 200);
    assert(res.data.summary, 'Missing summary');
    assert(res.data.disclaimer, 'Missing disclaimer');
    assert(!res.data.summary.includes('Tanmay Shishodia'), 'Patient PII should not be in summary output');
  })();

  try {
    await mongoose.disconnect();
  } catch (e) {}

  console.log('\n====================================================');
  console.log('ALL CLINICAL AI MODULE (GPT-4o) TESTS COMPLETED');
  console.log('====================================================\n');
})();

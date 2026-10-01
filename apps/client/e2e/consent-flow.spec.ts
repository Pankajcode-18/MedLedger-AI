import { test, expect, type Browser, type Page } from '@playwright/test';
import { signInAs, watchErrors } from './helpers';

/**
 * The core promise, end to end in the browser:
 * patient uploads → shares with a doctor → doctor opens the report → a lab checks it is unchanged →
 * the admin sees it in the record history → patient stops sharing → the doctor can no longer see it.
 */
test.describe.configure({ mode: 'serial' });

let patient: Page;
let doctor: Page;
const title = `Blood test ${Date.now().toString().slice(-5)}`;
let reportId = '';

const newPage = async (browser: Browser) => (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();

test.beforeAll(async ({ browser }) => {
  patient = await newPage(browser);
  doctor = await newPage(browser);
  await signInAs(patient, 'patient');
  await signInAs(doctor, 'doctor');
});

test('patient uploads a report', async () => {
  const errors = watchErrors(patient);
  await patient.goto('/patient/dashboard');
  await patient.getByRole('button', { name: 'Upload a report' }).first().click();
  const form = patient.locator('form').filter({ has: patient.getByRole('button', { name: 'Upload report' }) }).first();
  await form.locator('input[type="text"]').fill(title);
  await form.locator('textarea').fill('Haemoglobin 13.2 g/dL. Platelets 250 x10^9/L.');
  await form.locator('input[type="file"]').setInputFiles({ name: 'blood-test.txt', mimeType: 'text/plain', buffer: Buffer.from('Haemoglobin 13.2 g/dL') });
  await form.getByRole('button', { name: 'Upload report' }).click();
  await patient.goto('/patient/records');
  await expect(patient.locator('main')).toContainText(title);
  const res = await patient.request.get('http://localhost:8180/api/records', {
    headers: { Authorization: `Bearer ${await patient.evaluate(() => localStorage.getItem('medledger_token'))}` }
  });
  reportId = (await res.json()).data.find((r: { description?: string }) => r.description === title).reportId;
  expect(reportId).toBeTruthy();
  expect(errors).toEqual([]);
});

test('doctor cannot see it before the patient shares', async () => {
  await doctor.goto('/doctor/records');
  await expect(doctor.locator('main')).not.toContainText(title);
});

test('patient shares with the doctor who asked', async () => {
  await patient.goto('/patient/permissions');
  const row = patient.locator('li', { hasText: 'Dr. Anil Sharma' }).first();
  await row.getByRole('button', { name: 'Share my records' }).click();
  await expect(patient.locator('main')).toContainText('Can see your records now (1)');
});

test('doctor opens the shared report', async () => {
  await doctor.goto('/doctor/records');
  const row = doctor.locator('tbody tr', { hasText: title }).first();
  await expect(row).toBeVisible();
  const [download] = await Promise.all([doctor.waitForEvent('download'), row.getByRole('button', { name: /Download/ }).click()]);
  expect(await download.failure()).toBeNull();
});

test('a lab checks the report is unchanged using its fingerprint', async ({ browser }) => {
  const token = await patient.evaluate(() => localStorage.getItem('medledger_token'));
  const check = await (await patient.request.get(`http://localhost:8180/api/records/${reportId}/verify`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(check.data.verified).toBe(true);
  const lab = await newPage(browser);
  await signInAs(lab, 'lab');
  await lab.goto('/lab/verify');
  await lab.locator('main input').first().fill(check.data.fileHash);
  await lab.getByRole('button', { name: /^Check/ }).first().click();
  await expect(lab.locator('main')).toContainText('Fingerprint found');
  // a changed file gives a different fingerprint, which is not found
  await lab.locator('main input').first().fill(`0x${'0'.repeat(63)}1`);
  await lab.getByRole('button', { name: /^Check/ }).first().click();
  await expect(lab.locator('main')).toContainText('Fingerprint not found');
  await lab.context().close();
});

test('the administrator sees the upload and the share in the record history', async ({ browser }) => {
  const admin = await newPage(browser);
  await signInAs(admin, 'admin');
  await admin.goto('/admin/blockchain');
  await admin.getByRole('button', { name: 'Browse entries' }).click();
  const modal = admin.locator('.fixed.inset-0.z-50');
  await expect(modal).toContainText('Report fingerprint saved');
  await expect(modal).toContainText('Shared with a doctor');
  await expect(modal).toContainText('Links intact');
  await admin.context().close();
});

test('patient stops sharing and the doctor loses access', async () => {
  await patient.goto('/patient/permissions');
  const row = patient.locator('li', { hasText: 'Dr. Anil Sharma' }).first();
  await row.getByRole('button', { name: 'Stop sharing' }).click();
  await row.getByRole('button', { name: 'Yes, stop' }).click();
  await expect(patient.locator('main')).toContainText('You stopped sharing');
  await doctor.goto('/doctor/records');
  await expect(doctor.locator('main')).not.toContainText(title);
  const res = await doctor.request.get(`http://localhost:8180/api/records/${reportId}/download`, {
    headers: { Authorization: `Bearer ${await doctor.evaluate(() => localStorage.getItem('medledger_token'))}` }
  });
  expect(res.status()).toBe(403);
});

test('patient activity tells the story in sentences', async () => {
  await patient.goto('/patient/activity');
  await expect(patient.locator('main')).toContainText(/Dr\. Anil Sharma opened your/);
  await expect(patient.locator('main')).toContainText(/You stopped sharing/);
});

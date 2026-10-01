/**
 * Authentication & authorisation test suite.
 * Run with:  npm test   (inside apps/server)
 *
 * Uses a throw-away state file and no MongoDB, so it never touches real data.
 */
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-auth-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.EXPOSE_RESET_TOKEN = 'true';
process.env.MAX_FAILED_LOGINS = '5';

let server: Server;
let base = '';

type Json = Record<string, any>;

const call = async (
  method: string,
  url: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; body: Json }> => {
  const res = await fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let parsed: Json = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
};

const login = (email: string, password: string) => call('POST', '/api/auth/login', { email, password });

let seq = 0;
const uniqueEmail = (prefix = 'user') => `${prefix}.${Date.now()}.${seq++}@test.io`;

before(async () => {
  const { createApp } = await import('../src/app.js');
  const { userStore } = await import('../src/services/userStore.js');
  await userStore.seedDemoAccounts();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  const { loginGuard } = await import('../src/services/loginGuard.js');
  loginGuard.reset();
});

describe('registration', () => {
  test('patient can self-register and receives a token', async () => {
    const r = await call('POST', '/api/auth/register', {
      email: uniqueEmail('pat'),
      password: 'Str0ngPass',
      role: 'patient',
      name: 'Test Patient'
    });
    assert.equal(r.status, 201);
    assert.ok(r.body.data.token);
    assert.equal(r.body.data.user.role, 'patient');
    assert.equal(r.body.data.user.passwordHash, undefined, 'password hash must never be returned');
  });

  test('cannot self-register as admin, hospital, lab or insurance', async () => {
    for (const role of ['admin', 'system-admin', 'hospital-admin', 'hospital', 'lab', 'insurance']) {
      const r = await call('POST', '/api/auth/register', {
        email: uniqueEmail(role),
        password: 'Str0ngPass',
        role,
        name: 'Sneaky'
      });
      assert.equal(r.status, 400, `role ${role} should be rejected`);
    }
  });

  test('weak passwords are rejected', async () => {
    for (const password of ['short1', 'allletters', '12345678', '']) {
      const r = await call('POST', '/api/auth/register', {
        email: uniqueEmail('weak'),
        password,
        role: 'patient',
        name: 'Weak'
      });
      assert.equal(r.status, 400, `"${password}" should be rejected`);
    }
  });

  test('duplicate email is rejected (case-insensitive)', async () => {
    const email = uniqueEmail('dup');
    const first = await call('POST', '/api/auth/register', { email, password: 'Str0ngPass', role: 'doctor', name: 'Dr One' });
    assert.equal(first.status, 201);
    const second = await call('POST', '/api/auth/register', {
      email: email.toUpperCase(),
      password: 'Str0ngPass',
      role: 'doctor',
      name: 'Dr Two'
    });
    assert.equal(second.status, 409);
  });

  test('passwords are stored as bcrypt hashes, never plaintext', async () => {
    const email = uniqueEmail('hash');
    await call('POST', '/api/auth/register', { email, password: 'Str0ngPass', role: 'patient', name: 'Hash Check' });
    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const state = JSON.parse(fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8'));
    const user = state.users.find((u: Json) => u.email === email);
    assert.ok(user.passwordHash.startsWith('$2'), 'expected a bcrypt hash');
    assert.ok(!JSON.stringify(state).includes('Str0ngPass'), 'plaintext password found in storage');
  });
});

describe('login', () => {
  test('demo accounts sign in with their bcrypt-hashed passwords', async () => {
    const r = await login('patient@medledger.demo', 'secret99');
    assert.equal(r.status, 200);
    assert.equal(r.body.data.user.role, 'patient');
  });

  test('old "any demo password" shortcut no longer works', async () => {
    const r = await login('patient@medledger.demo', 'password');
    assert.equal(r.status, 401);
  });

  test('wrong password and unknown email give the same generic error', async () => {
    const wrong = await login('doctor@medledger.demo', 'nope12345');
    const unknown = await login('nobody@nowhere.io', 'nope12345');
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error, unknown.body.error);
  });

  test('account locks after 5 wrong passwords, even the correct one is refused', async () => {
    const email = uniqueEmail('lock');
    await call('POST', '/api/auth/register', { email, password: 'Str0ngPass', role: 'patient', name: 'Lock Test' });
    for (let i = 0; i < 4; i++) assert.equal((await login(email, 'Wrong1234')).status, 401);
    assert.equal((await login(email, 'Wrong1234')).status, 423);
    const correct = await login(email, 'Str0ngPass');
    assert.equal(correct.status, 423);
    assert.match(correct.body.error, /locked/i);
  });
});

describe('tokens', () => {
  test('protected route needs a token', async () => {
    assert.equal((await call('GET', '/api/auth/profile')).status, 401);
    assert.equal((await call('GET', '/api/records')).status, 401);
  });

  test('tampered, forged and "alg:none" tokens are rejected', async () => {
    const { body } = await login('patient@medledger.demo', 'secret99');
    const token: string = body.data.token;
    const [h, p, s] = token.split('.');

    // change role in payload without re-signing
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    payload.role = 'admin';
    const tampered = `${h}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${s}`;
    assert.equal((await call('GET', '/api/admin/audit', undefined, tampered)).status, 401);

    // unsigned token
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const unsigned = `${noneHeader}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.`;
    assert.equal((await call('GET', '/api/auth/profile', undefined, unsigned)).status, 401);

    // signed with a different secret
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ ...payload }, 'attacker-secret-attacker-secret-attacker');
    assert.equal((await call('GET', '/api/auth/profile', undefined, forged)).status, 401);
  });

  test('expired tokens are rejected', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const expired = jwt.sign(
      { userId: '90', role: 'patient', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET as string,
      { issuer: 'medledger-api', audience: 'medledger-client' }
    );
    assert.equal((await call('GET', '/api/auth/profile', undefined, expired)).status, 401);
  });

  test('logout revokes the token', async () => {
    const { body } = await login('lab@medledger.demo', 'lab123');
    const token = body.data.token;
    assert.equal((await call('GET', '/api/auth/profile', undefined, token)).status, 200);
    assert.equal((await call('POST', '/api/auth/logout', undefined, token)).status, 200);
    assert.equal((await call('GET', '/api/auth/profile', undefined, token)).status, 401);
  });
});

describe('sessions', () => {
  test('user can list their devices and sign out all other devices', async () => {
    const email = uniqueEmail('sess');
    await call('POST', '/api/auth/register', { email, password: 'Str0ngPass', role: 'patient', name: 'Sessions' });
    const a = (await login(email, 'Str0ngPass')).body.data.token;
    const b = (await login(email, 'Str0ngPass')).body.data.token;

    const list = await call('GET', '/api/auth/sessions', undefined, a);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length >= 3, 'register + two logins');
    assert.equal(list.body.data.filter((x: Json) => x.current).length, 1);

    const out = await call('POST', '/api/auth/logout-others', undefined, a);
    assert.equal(out.status, 200);
    assert.ok(out.body.ended >= 2);
    assert.equal((await call('GET', '/api/auth/profile', undefined, b)).status, 401, 'other device signed out');
    assert.equal((await call('GET', '/api/auth/profile', undefined, a)).status, 200, 'current device stays signed in');
  });
});

describe('role-based access (RBAC)', () => {
  test('patient cannot call admin-only endpoints', async () => {
    const { body } = await login('patient@medledger.demo', 'secret99');
    assert.equal((await call('GET', '/api/admin/audit', undefined, body.data.token)).status, 403);
    assert.equal(
      (await call('POST', '/api/admin/users', { email: uniqueEmail('x'), password: 'Str0ngPass', role: 'admin', name: 'X' }, body.data.token)).status,
      403
    );
  });

  test('doctor cannot grant consent on behalf of a patient', async () => {
    const { body } = await login('doctor@medledger.demo', 'secret99');
    assert.equal((await call('POST', '/api/access/grant', { patientId: '90' }, body.data.token)).status, 403);
    assert.equal((await call('POST', '/grantAccess', { patientId: '90' }, body.data.token)).status, 403);
  });

  test('legacy and AI endpoints no longer work without signing in', async () => {
    assert.equal((await call('POST', '/grantAccess', { patientId: '90' })).status, 401);
    assert.equal((await call('POST', '/registerPatient', { name: 'x' })).status, 401);
    assert.equal((await call('POST', '/api/ai/summarize', { reportText: 'x' })).status, 401);
    assert.equal((await call('GET', '/api/access/status?patientId=90')).status, 401);
  });

  test('admin can create an organisation account, which can then sign in', async () => {
    const admin = await login('admin@medledger.demo', 'admin123');
    const email = uniqueEmail('lab');
    const created = await call(
      'POST',
      '/api/admin/users',
      { email, password: 'LabPass123', role: 'lab', name: 'New Lab' },
      admin.body.data.token
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.data.token, undefined, 'admin must not be logged in as the new user');
    const r = await login(email, 'LabPass123');
    assert.equal(r.status, 200);
    assert.equal(r.body.data.user.role, 'lab');
  });

  test('admin can list users (no password hashes) and disable an account', async () => {
    const admin = await login('admin@medledger.demo', 'admin123');
    const adminToken = admin.body.data.token;
    const email = uniqueEmail('dis');
    const reg = await call('POST', '/api/auth/register', { email, password: 'Str0ngPass', role: 'patient', name: 'To Disable' });
    const userToken = reg.body.data.token;
    const userId = reg.body.data.user.userId;

    const list = await call('GET', '/api/admin/users', undefined, adminToken);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((u: Json) => u.email === email));
    assert.ok(!JSON.stringify(list.body).includes('passwordHash'));

    assert.equal((await call('PATCH', `/api/admin/users/${userId}/status`, { disabled: true }, adminToken)).status, 200);
    assert.equal((await call('GET', '/api/auth/profile', undefined, userToken)).status, 401, 'existing session must stop working');
    assert.equal((await login(email, 'Str0ngPass')).status, 403);

    assert.equal((await call('PATCH', `/api/admin/users/${userId}/status`, { disabled: false }, adminToken)).status, 200);
    assert.equal((await login(email, 'Str0ngPass')).status, 200);
  });

  test('admin cannot disable their own account', async () => {
    const admin = await login('admin@medledger.demo', 'admin123');
    const r = await call('PATCH', '/api/admin/users/admin-01/status', { disabled: true }, admin.body.data.token);
    assert.equal(r.status, 400);
  });

  test('role in the token cannot outrank the stored account role', async () => {
    const { body } = await login('patient@medledger.demo', 'secret99');
    const profile = await call('GET', '/api/auth/profile', undefined, body.data.token);
    assert.equal(profile.body.data.role, 'patient');
  });
});

describe('password management', () => {
  test('change password: needs current password, old sessions are signed out', async () => {
    const email = uniqueEmail('chg');
    const reg = await call('POST', '/api/auth/register', { email, password: 'Str0ngPass', role: 'patient', name: 'Changer' });
    const oldToken = reg.body.data.token;

    const wrongCurrent = await call('POST', '/api/auth/change-password', { currentPassword: 'nope', newPassword: 'Newer1234' }, oldToken);
    assert.equal(wrongCurrent.status, 400);

    // make sure the change happens in a later second than the old token's iat
    await new Promise((r) => setTimeout(r, 1100));
    const ok = await call('POST', '/api/auth/change-password', { currentPassword: 'Str0ngPass', newPassword: 'Newer1234' }, oldToken);
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.token);

    assert.equal((await call('GET', '/api/auth/profile', undefined, oldToken)).status, 401, 'old token must be invalid');
    assert.equal((await call('GET', '/api/auth/profile', undefined, ok.body.data.token)).status, 200);
    assert.equal((await login(email, 'Str0ngPass')).status, 401);
    assert.equal((await login(email, 'Newer1234')).status, 200);
  });

  test('forgot password does not reveal whether an email exists', async () => {
    const known = await call('POST', '/api/auth/forgot-password', { email: 'patient@medledger.demo' });
    const unknown = await call('POST', '/api/auth/forgot-password', { email: 'ghost@nowhere.io' });
    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.equal(known.body.message, unknown.body.message);
  });

  test('reset token works once and only once', async () => {
    const email = uniqueEmail('reset');
    await call('POST', '/api/auth/register', { email, password: 'Str0ngPass', role: 'doctor', name: 'Dr Reset' });
    const req = await call('POST', '/api/auth/forgot-password', { email });
    const token = req.body.devResetToken;
    assert.ok(token);

    assert.equal((await call('POST', '/api/auth/reset-password', { token, newPassword: 'weak' })).status, 400);
    assert.equal((await call('POST', '/api/auth/reset-password', { token, newPassword: 'Reset1234' })).status, 200);
    assert.equal((await call('POST', '/api/auth/reset-password', { token, newPassword: 'Again1234' })).status, 400);
    assert.equal((await login(email, 'Reset1234')).status, 200);

    await (await import('../src/models/stateStore.js')).stateStore.flush(); // writes are coalesced
    const state = JSON.parse(fs.readFileSync(process.env.STATE_FILE_PATH as string, 'utf8'));
    assert.ok(!JSON.stringify(state).includes(token), 'raw reset token must not be stored');
  });
});

/**
 * MetaMask wallet support: linking (EIP-4361 sign-in message), sign-in with a linked wallet,
 * consent signed in the wallet (EIP-712) and consent sent to the HealthRecords contract.
 * An ethers Wallet stands in for MetaMask — it produces exactly the same signatures.
 * Run with: npm test (inside apps/server).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ethers } from 'ethers';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const CONTRACT = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-wallet-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmpDir, 'state.json');
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.AUTH_RATE_LIMIT = '10000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';
process.env.CLIENT_URL = 'http://localhost:8081';
process.env.WALLET_CHAIN_ID = '31337';
process.env.HEALTH_RECORDS_CONTRACT_ADDRESS = CONTRACT;

type Json = Record<string, any>;
let server: Server;
let base = '';
let patient = '';
let doctor = '';
let lab = '';
const patientWallet = ethers.Wallet.createRandom();
const strangerWallet = ethers.Wallet.createRandom();
const DOCTOR_ID = '1593418229676';

const call = async (method: string, url: string, token?: string, body?: unknown) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};
const tokenFor = async (email: string, password: string) => (await call('POST', '/api/auth/login', undefined, { email, password })).body.data.token as string;

const linkWallet = async (token: string, wallet: ethers.HDNodeWallet) => {
  const ch = await call('POST', '/api/wallet/link/challenge', token, { address: wallet.address });
  const signature = await wallet.signMessage(ch.body.data.message);
  return call('POST', '/api/wallet/link', token, { message: ch.body.data.message, signature });
};

before(async () => {
  const { createApp } = await import('../src/app.js');
  const { userStore } = await import('../src/services/userStore.js');
  await userStore.seedDemoAccounts();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  patient = await tokenFor('patient@medledger.demo', 'secret99');
  doctor = await tokenFor('doctor@medledger.demo', 'secret99');
  lab = await tokenFor('lab@medledger.demo', 'lab123');
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('linking a wallet', () => {
  test('network details are public', async () => {
    const r = await call('GET', '/api/wallet/config');
    assert.equal(r.status, 200);
    assert.equal(r.body.data.chainId, 31337);
    assert.equal(r.body.data.chainIdHex, '0x7a69');
    assert.equal(r.body.data.contractAddress, CONTRACT);
  });

  test('the sign-in message follows EIP-4361 and costs nothing', async () => {
    const r = await call('POST', '/api/wallet/link/challenge', patient, { address: patientWallet.address.toLowerCase() });
    const msg: string = r.body.data.message;
    assert.match(msg, /^localhost:8081 wants you to sign in with your Ethereum account:\n0x[0-9a-fA-F]{40}\n/);
    assert.ok(msg.includes(patientWallet.address), 'checksummed address');
    assert.match(msg, /does not cost anything/);
    assert.match(msg, /Chain ID: 31337\nNonce: [0-9a-f]{32}\nIssued At: .+\nExpiration Time: .+$/);
    assert.equal((await call('POST', '/api/wallet/link/challenge', patient, { address: '0x123' })).status, 400);
    assert.equal((await call('POST', '/api/wallet/link/challenge', undefined, { address: patientWallet.address })).status, 401);
  });

  test('a wallet is linked only with a valid, fresh, matching signature', async () => {
    // signed by someone else
    const ch1 = await call('POST', '/api/wallet/link/challenge', patient, { address: patientWallet.address });
    const bad = await call('POST', '/api/wallet/link', patient, { message: ch1.body.data.message, signature: await strangerWallet.signMessage(ch1.body.data.message) });
    assert.equal(bad.status, 401);
    assert.match(bad.body.error, /does not match/);

    // message edited after signing
    const ch2 = await call('POST', '/api/wallet/link/challenge', patient, { address: patientWallet.address });
    const edited = ch2.body.data.message.replace('Link this wallet', 'Give away this wallet');
    assert.equal((await call('POST', '/api/wallet/link', patient, { message: edited, signature: await patientWallet.signMessage(ch2.body.data.message) })).status, 401);

    // the right signature
    const ok = await linkWallet(patient, patientWallet);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.address, patientWallet.address);
    assert.equal(ok.body.data.user.walletLinked, true);

    const status = await call('GET', '/api/wallet/status', patient);
    assert.equal(status.body.data.linked, true);
    assert.equal(status.body.data.address, patientWallet.address);
  });

  test('a signed message cannot be replayed, and one wallet belongs to one account', async () => {
    const ch = await call('POST', '/api/wallet/link/challenge', patient, { address: patientWallet.address });
    const signature = await patientWallet.signMessage(ch.body.data.message);
    assert.equal((await call('POST', '/api/wallet/link', patient, { message: ch.body.data.message, signature })).status, 200);
    assert.equal((await call('POST', '/api/wallet/link', patient, { message: ch.body.data.message, signature })).status, 401, 'replay');

    const other = await linkWallet(lab, patientWallet);
    assert.equal(other.status, 409);
  });

  test("a challenge issued to one account cannot be used by another", async () => {
    const ch = await call('POST', '/api/wallet/link/challenge', lab, { address: strangerWallet.address });
    const signature = await strangerWallet.signMessage(ch.body.data.message);
    assert.equal((await call('POST', '/api/wallet/link', doctor, { message: ch.body.data.message, signature })).status, 401);
  });
});

describe('signing in with MetaMask', () => {
  test('a linked wallet signs in; the token works like a password sign-in', async () => {
    const ch = await call('POST', '/api/auth/wallet/challenge', undefined, { address: patientWallet.address });
    assert.match(ch.body.data.message, /Sign in to MedLedger/);
    const r = await call('POST', '/api/auth/wallet/login', undefined, { message: ch.body.data.message, signature: await patientWallet.signMessage(ch.body.data.message) });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.user.userId, '90');
    const profile = await call('GET', '/api/auth/profile', r.body.data.token);
    assert.equal(profile.status, 200);
  });

  test('a wallet that is not linked is told how to link it', async () => {
    const ch = await call('POST', '/api/auth/wallet/challenge', undefined, { address: strangerWallet.address });
    const r = await call('POST', '/api/auth/wallet/login', undefined, { message: ch.body.data.message, signature: await strangerWallet.signMessage(ch.body.data.message) });
    assert.equal(r.status, 404);
    assert.match(r.body.error, /link the wallet in Settings/);
  });

  test('a link challenge cannot be used to sign in', async () => {
    const ch = await call('POST', '/api/wallet/link/challenge', patient, { address: patientWallet.address });
    const r = await call('POST', '/api/auth/wallet/login', undefined, { message: ch.body.data.message, signature: await patientWallet.signMessage(ch.body.data.message) });
    assert.equal(r.status, 401);
  });
});

describe('consent signed in the wallet (EIP-712)', () => {
  const canDoctorRead = async () => (await call('GET', '/api/vitals?patientId=90', doctor)).status === 200;

  test('the patient signs a grant; the doctor gets access; the signature is kept as evidence', async () => {
    assert.equal(await canDoctorRead(), false);
    const prep = await call('POST', '/api/wallet/consent/prepare', patient, { doctorId: DOCTOR_ID, action: 'grant' });
    assert.equal(prep.status, 200);
    const { domain, types, message } = prep.body.data.typedData;
    assert.equal(domain.name, 'MedLedger Consent');
    assert.equal(message.patient, patientWallet.address);
    assert.equal(message.doctorName, 'Dr. Anil Sharma');
    assert.equal(message.action, 'grant');

    const signature = await patientWallet.signTypedData(domain, types, message);
    const r = await call('POST', '/api/wallet/consent', patient, { nonce: message.nonce, signature });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.status, 'GRANTED');
    assert.equal(await canDoctorRead(), true);

    const { stateStore } = await import('../src/models/stateStore.js');
    const entry = [...(stateStore.getState().auditLogs || [])].reverse().find((a) => a.action === 'ACCESS_GRANTED');
    assert.equal((entry?.details as Json).consent.method, 'signature');
    assert.equal((entry?.details as Json).consent.signature, signature);

    assert.equal((await call('POST', '/api/wallet/consent', patient, { nonce: message.nonce, signature })).status, 401, 'replay');
  });

  test('a consent signed by another wallet is refused', async () => {
    const prep = await call('POST', '/api/wallet/consent/prepare', patient, { doctorId: DOCTOR_ID, action: 'revoke' });
    const { domain, types, message } = prep.body.data.typedData;
    const r = await call('POST', '/api/wallet/consent', patient, { nonce: message.nonce, signature: await strangerWallet.signTypedData(domain, types, message) });
    assert.equal(r.status, 401);
    assert.equal(await canDoctorRead(), true, 'nothing changed');
  });

  test('a signed revoke removes access', async () => {
    const prep = await call('POST', '/api/wallet/consent/prepare', patient, { doctorId: DOCTOR_ID, action: 'revoke' });
    const { domain, types, message } = prep.body.data.typedData;
    const r = await call('POST', '/api/wallet/consent', patient, { nonce: message.nonce, signature: await patientWallet.signTypedData(domain, types, message) });
    assert.equal(r.status, 200);
    assert.equal(await canDoctorRead(), false);
  });

  test('only patients with a linked wallet can use wallet consent', async () => {
    assert.equal((await call('POST', '/api/wallet/consent/prepare', doctor, { doctorId: DOCTOR_ID, action: 'grant' })).status, 403);
    const { userStore } = await import('../src/services/userStore.js');
    const tmp = await userStore.create({ email: 'p2@test.com', password: 'secret123', role: 'patient', name: 'Second Patient' });
    const t = await tokenFor('p2@test.com', 'secret123');
    const r = await call('POST', '/api/wallet/consent/prepare', t, { doctorId: DOCTOR_ID, action: 'grant' });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /Link your MetaMask wallet/);
    assert.ok(tmp.userId);
  });
});

describe('consent recorded on the blockchain', () => {
  const iface = new ethers.Interface([
    'event AccessGranted(address indexed patient, address indexed doctor, uint256 timestamp)',
    'event AccessRevoked(address indexed patient, address indexed doctor, uint256 timestamp)'
  ]);
  const receipts = new Map<string, unknown>();
  const fakeReceipt = (opts: { from: string; doctor: string; event?: 'AccessGranted' | 'AccessRevoked'; status?: number; to?: string }) => {
    const hash = ethers.hexlify(ethers.randomBytes(32));
    const log = iface.encodeEventLog(opts.event || 'AccessGranted', [opts.from, opts.doctor, 1_700_000_000]);
    receipts.set(hash, { status: opts.status ?? 1, to: opts.to || CONTRACT, from: opts.from, blockNumber: 42, logs: [{ address: CONTRACT, topics: log.topics, data: log.data }] });
    return hash;
  };

  before(async () => {
    const { walletService } = await import('../src/services/walletService.js');
    walletService.setProvider({ getTransactionReceipt: async (h: string) => (receipts.get(h) as never) || null } as never);
  });

  test('the page gets the exact transaction to send', async () => {
    const r = await call('POST', '/api/wallet/consent/prepare', patient, { doctorId: DOCTOR_ID, action: 'grant', mode: 'onchain' });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.tx.to, CONTRACT);
    assert.equal(r.body.data.tx.from, patientWallet.address);
    assert.ok(r.body.data.tx.data.startsWith('0x0ae5e739'), 'grantAccess(address) selector');
    assert.equal(r.body.data.chainIdHex, '0x7a69');
  });

  test('a confirmed grant transaction from the patient gives access; it cannot be reused', async () => {
    const prep = await call('POST', '/api/wallet/consent/prepare', patient, { doctorId: DOCTOR_ID, action: 'grant', mode: 'onchain' });
    const doctorWallet = prep.body.data.doctor.wallet;
    const tx = fakeReceipt({ from: patientWallet.address, doctor: doctorWallet });
    const r = await call('POST', '/api/wallet/consent/tx', patient, { txHash: tx, doctorId: DOCTOR_ID, action: 'grant' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.blockNumber, 42);
    assert.equal((await call('GET', '/api/vitals?patientId=90', doctor)).status, 200);
    assert.equal((await call('POST', '/api/wallet/consent/tx', patient, { txHash: tx, doctorId: DOCTOR_ID, action: 'grant' })).status, 409);
  });

  test('transactions that do not prove the consent are refused', async () => {
    const prep = await call('POST', '/api/wallet/consent/prepare', patient, { doctorId: DOCTOR_ID, action: 'revoke', mode: 'onchain' });
    const doctorWallet = prep.body.data.doctor.wallet;
    const cases: Array<[string, number]> = [
      [fakeReceipt({ from: strangerWallet.address, doctor: doctorWallet, event: 'AccessRevoked' }), 403],
      [fakeReceipt({ from: patientWallet.address, doctor: doctorWallet, event: 'AccessRevoked', status: 0 }), 422],
      [fakeReceipt({ from: patientWallet.address, doctor: doctorWallet, event: 'AccessRevoked', to: strangerWallet.address }), 422],
      [fakeReceipt({ from: patientWallet.address, doctor: doctorWallet, event: 'AccessGranted' }), 422],
      [fakeReceipt({ from: patientWallet.address, doctor: strangerWallet.address, event: 'AccessRevoked' }), 422],
      [ethers.hexlify(ethers.randomBytes(32)), 404]
    ];
    for (const [txHash, status] of cases) {
      const r = await call('POST', '/api/wallet/consent/tx', patient, { txHash, doctorId: DOCTOR_ID, action: 'revoke' });
      assert.equal(r.status, status, r.body.error);
    }
    assert.equal((await call('GET', '/api/vitals?patientId=90', doctor)).status, 200, 'access unchanged');
  });
});

describe('unlinking', () => {
  test('after unlinking, the wallet can no longer sign in', async () => {
    assert.equal((await call('DELETE', '/api/wallet/link', patient)).status, 200);
    assert.equal((await call('GET', '/api/wallet/status', patient)).body.data.linked, false);
    const ch = await call('POST', '/api/auth/wallet/challenge', undefined, { address: patientWallet.address });
    const r = await call('POST', '/api/auth/wallet/login', undefined, { message: ch.body.data.message, signature: await patientWallet.signMessage(ch.body.data.message) });
    assert.equal(r.status, 404);
  });
});

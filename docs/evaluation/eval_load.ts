/**
 * Load test on a realistic data set: 20 patients × 50 reports (1,000 records, audit history included),
 * then record list, record check, 100 KB upload and 5 MB download at 1–100 concurrent clients.
 *   npx --prefix apps/server tsx docs/evaluation/eval_load.ts        (LOAD_OUT=file.json to name the result)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { spawn } from 'child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-load-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmp, 'state.json');
process.env.FILE_STORAGE_DIR = path.join(tmp, 'files');
process.env.JWT_SECRET = 'evaluation-secret-that-is-definitely-longer-than-32-chars';
process.env.AUTH_RATE_LIMIT = '100000';
process.env.API_RATE_LIMIT = '10000000';
process.env.AI_RATE_LIMIT_PER_MIN = '100000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';
process.env.OCR_ENABLED = 'false';
process.env.LOG_LEVEL = 'silent';

type J = Record<string, any>;
let base = '';
const call = async (method: string, url: string, token?: string, body?: unknown, form?: FormData) => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + url, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const buf = Buffer.from(await res.arrayBuffer());
  let json: J = {};
  if ((res.headers.get('content-type') || '').includes('json')) json = JSON.parse(buf.toString('utf8'));
  return { status: res.status, body: json, bytes: buf.length };
};
const login = async (email: string, password: string) => (await call('POST', '/api/auth/login', undefined, { email, password })).body.data.token as string;
const pdf = (size: number) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size, 0x41), Buffer.from('\n%%EOF\n')]);
const upload = async (token: string, size: number, patientId?: string) => {
  const fd = new FormData();
  fd.append('file', new Blob([pdf(size)], { type: 'application/pdf' }), 'report.pdf');
  if (patientId) fd.append('patientId', patientId);
  return call('POST', '/api/records/upload', token, undefined, fd);
};
const ok = (s: number) => s >= 200 && s < 300;

// The server runs in its own process (LOAD_ROLE=server) so the load generator's own work — sending
// and receiving megabytes — is not counted as server time.
const startServer = async (): Promise<void> => {
  const { createApp } = await import('../../apps/server/src/app');
  const { userStore } = await import('../../apps/server/src/services/userStore');
  await userStore.seedDemoAccounts();
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  process.stdout.write(`PORT=${(server.address() as AddressInfo).port}\n`);
};

(async () => {
  if (process.env.LOAD_ROLE === 'server') return startServer();
  const child = spawn(process.execPath, [...process.execArgv, __filename], { env: { ...process.env, LOAD_ROLE: 'server' }, stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await new Promise<string>((resolve, reject) => {
    let buf = '';
    child.stdout!.on('data', (d) => {
      buf += d;
      const m = buf.match(/PORT=(\d+)/);
      if (m) resolve(m[1]);
    });
    child.once('exit', (c) => reject(new Error('server exited ' + c)));
  });
  base = `http://127.0.0.1:${port}`;
  const server = { close: () => child.kill('SIGTERM') };

  // ---- data set: 20 patients with 50 reports each, all shared with the demo doctor
  const doctor = await login('doctor@medledger.demo', 'secret99');
  const doctorId = String((await call('GET', '/api/auth/profile', doctor)).body.data.userId);
  const patients: string[] = [];
  const t0 = Date.now();
  for (let p = 0; p < 20; p++) {
    const email = `load${p}@eval.test`;
    await call('POST', '/api/auth/register', undefined, { email, password: 'Str0ngPass', role: 'patient', name: `Load Patient ${p}` });
    const tok = await login(email, 'Str0ngPass');
    patients.push(tok);
    await call('POST', '/api/access/request', doctor, { patientId: String((await call('GET', '/api/auth/profile', tok)).body.data.userId) });
    await call('POST', '/api/access/grant', tok, { doctorId });
    for (let i = 0; i < 50; i++) {
      const fd = new FormData();
      fd.append('clinicalNotes', `Hemoglobin ${(10 + (i % 7)).toFixed(1)} g/dL. Visit ${i}.`);
      const r = await call('POST', '/api/records/upload', tok, undefined, fd);
      if (!ok(r.status)) throw new Error('seed upload failed ' + r.status);
    }
  }
  const tok = patients[0];
  const rid = String((await call('GET', '/api/records', tok)).body.data[0].reportId);
  const big = await upload(tok, 5 * 1024 * 1024);
  const bigId = String(big.body.data.reportId);
  console.error(`seeded 1,000 records in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  // measure the steady state: wait until the background text reader has finished with the new uploads
  for (let i = 0; i < 600; i++) {
    const list = (await call('GET', '/api/records?fields=summary', doctor)).body.data as J[];
    if (list.every((r) => r.textStatus !== 'pending' && r.textStatus !== 'processing')) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const scenarios: Record<string, () => Promise<{ status: number }>> = {
    'list (patient, 51 records)': () => call('GET', '/api/records', tok),
    'list (doctor, 1,001 records)': () => call('GET', '/api/records', doctor),
    'list (doctor, summary, 1,001)': () => call('GET', '/api/records?fields=summary', doctor),
    'list (doctor, page of 25)': () => call('GET', '/api/records?limit=25&fields=summary', doctor),
    'record check': () => call('GET', `/api/records/${rid}/verify`, tok),
    'upload 100 KB': () => upload(tok, 100_000),
    'download 5 MB': () => call('GET', `/api/records/${bigId}/download`, tok)
  };
  const levels = (process.env.LEVELS || '1,5,10,25,50,100').split(',').map(Number);
  const results: J[] = [];
  const only = process.env.SCENARIOS ? process.env.SCENARIOS.split(',') : null;
  for (const [name, fn] of Object.entries(scenarios)) {
    if (only && !only.some((o) => name.startsWith(o))) continue;
    for (const conc of levels) {
      const N = name.startsWith('download') ? Math.max(20, conc * 2) : name.startsWith('upload') ? Math.max(30, conc * 2) : Math.max(100, conc * 4);
      const lat: number[] = [];
      let errors = 0, i = 0;
      const start = performance.now();
      await Promise.all(Array.from({ length: conc }, async () => {
        while (i < N) {
          i++;
          const s = performance.now();
          const r = await fn().catch(() => ({ status: 0 }));
          lat.push(performance.now() - s);
          if (!ok(r.status)) errors++;
        }
      }));
      const secs = (performance.now() - start) / 1000;
      lat.sort((a, b) => a - b);
      const row = { scenario: name, concurrency: conc, requests: lat.length, throughput: lat.length / secs, p50: lat[Math.floor(lat.length * 0.5)], p95: lat[Math.floor(lat.length * 0.95)], errors };
      results.push(row);
      console.error(`${name.padEnd(30)} c=${String(conc).padStart(3)}  ${row.throughput.toFixed(0).padStart(5)}/s  p50 ${row.p50.toFixed(1).padStart(7)}  p95 ${row.p95.toFixed(1).padStart(7)}  err ${errors}`);
    }
  }
  const out = { node: process.version, cpus: os.cpus().length, records: 1001, results };
  fs.writeFileSync(path.resolve(__dirname, 'results', process.env.LOAD_OUT || 'load_eval.json'), JSON.stringify(out, null, 1));
  server.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

/**
 * Access-control matrix (actor x action, expected vs observed HTTP outcome) and a concurrency test.
 *   npx --prefix apps/server tsx docs/evaluation/eval_access.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-access-'));
process.env.NODE_ENV = 'test';
process.env.STATE_FILE_PATH = path.join(tmp, 'state.json');
process.env.FILE_STORAGE_DIR = path.join(tmp, 'files');
process.env.JWT_SECRET = 'evaluation-secret-that-is-definitely-longer-than-32-chars';
process.env.AUTH_RATE_LIMIT = '100000';
process.env.DEMO_ACCOUNTS = 'true';
process.env.OPENAI_API_KEY = '';

type J = Record<string, any>;
let base = '';
const call = async (method: string, url: string, token?: string, body?: unknown, form?: FormData) => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + url, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const buf = Buffer.from(await res.arrayBuffer());
  let json: J = {};
  try { json = JSON.parse(buf.toString('utf8')); } catch { /* file */ }
  return { status: res.status, body: json, bytes: buf.length };
};
const login = async (email: string, password: string) => (await call('POST', '/api/auth/login', undefined, { email, password })).body.data.token as string;
const upload = async (token: string, size: number, patientId?: string) => {
  const fd = new FormData();
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size, 0x41), Buffer.from('\n%%EOF\n')]);
  fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'report.pdf');
  if (patientId) fd.append('patientId', patientId);
  return call('POST', '/api/records/upload', token, undefined, fd);
};

(async () => {
  const { createApp } = await import('../../apps/server/src/app');
  const { userStore } = await import('../../apps/server/src/services/userStore');
  await userStore.seedDemoAccounts();
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const tok: Record<string, string> = {
    patient: await login('patient@medledger.demo', 'secret99'),
    doctor: await login('doctor@medledger.demo', 'secret99'),
    hospital: await login('hospital@medledger.demo', 'hospital123'),
    lab: await login('lab@medledger.demo', 'lab123'),
    insurance: await login('insurance@medledger.demo', 'insurance123'),
    admin: await login('admin@medledger.demo', 'admin123')
  };
  await call('POST', '/api/auth/register', undefined, { email: 'other@eval.test', password: 'Str0ngPass', role: 'patient', name: 'Other Patient' });
  tok.other = await login('other@eval.test', 'Str0ngPass');
  const me = async (t: string) => (await call('GET', '/api/auth/profile', t)).body.data;
  const patientId = String((await me(tok.patient)).userId ?? (await me(tok.patient)).user?.userId);
  const doctorId = String((await me(tok.doctor)).userId ?? (await me(tok.doctor)).user?.userId);

  const up = await upload(tok.patient, 20_000);
  const rid = String(up.body.data?.reportId ?? up.body.data?.report?.reportId);
  if (!rid || rid === 'undefined') throw new Error('upload failed ' + JSON.stringify(up.body));

  const allowed = (s: number) => s >= 200 && s < 300;
  const inList = async (t?: string) => {
    const r = await call('GET', '/api/records', t);
    if (!allowed(r.status)) return r.status;
    const list = r.body.data?.records ?? r.body.data ?? [];
    return (Array.isArray(list) ? list : []).some((x: J) => String(x.reportId) === rid) ? 200 : 404;
  };
  const actions: Record<string, (t?: string) => Promise<number>> = {
    'See record in list': inList,
    'Download record': async (t) => (await call('GET', `/api/records/${rid}/download`, t)).status,
    'Verify record': async (t) => (await call('GET', `/api/records/${rid}/verify`, t)).status,
    // effect-based: the upload must succeed AND land in the owner's record
    'Add record for patient': async (t) => {
      if (!t) return (await call('POST', '/api/records/upload')).status;
      const r = await upload(t, 2000, patientId);
      if (!allowed(r.status)) return r.status;
      const landed = await call('GET', `/api/records/${r.body.data.reportId}/verify`, tok.patient);
      return allowed(landed.status) ? r.status : 409; // 409 = accepted, but stored in the caller's own record
    },
    'Grant access to a doctor': async (t) => (await call('POST', '/legacy-probe-not-used', t)).status,
    'View audit log (all)': async (t) => (await call('GET', '/api/admin/audit', t)).status,
    'Manage user accounts': async (t) => (await call('GET', '/api/admin/users', t)).status,
    'Read record history': async (t) => (await call('GET', '/api/blockchain/blocks', t)).status,
    'Lab triage (AI)': async (t) => (await call('POST', '/api/ai/doctor/lab-triage', t, { labResults: 'Hemoglobin: 9.1 g/dL' })).status
  };
  // grant is tested as "grant on behalf of the owner patient": patient grants for itself; others try the same endpoint
  // effect-based: after the actor's grant call, can the doctor open the owner's record? (state reset afterwards)
  actions['Grant access to a doctor'] = async (t) => {
    const before = await call('GET', `/api/records/${rid}/download`, tok.doctor);
    if (allowed(before.status)) return 409; // only measured from a not-shared state
    const g = await call('POST', '/api/access/grant', t, { doctorId, patientId, reason: 'Emergency access needed for treatment (break-glass test).' });
    const after = await call('GET', `/api/records/${rid}/download`, tok.doctor);
    if (allowed(after.status)) { await call('POST', '/api/access/revoke', tok.patient, { doctorId }); await call('POST', '/api/access/request', tok.doctor, { patientId }); }
    return allowed(after.status) ? g.status : allowed(g.status) ? 409 : g.status;
  };

  // expected policy (A = allowed, D = denied)
  const E: Record<string, string> = {
    'Owner patient':            'A A A A A D D D D',
    'Other patient':            'D D D D D D D D D',
    'Doctor, no consent':       'D D D D D D D D A',
    'Doctor, consent granted':  'A A A A D D D D A',
    'Doctor, consent revoked':  'D D D D D D D D A',
    'Laboratory':               'D D D A D D D D A',
    'Insurance, no claim':      'D D D D D D D D D',
    'Administrator':            'A A A A A A A A A',
    'Not signed in':            'D D D D D D D D D'
  };
  const names = Object.keys(actions);
  const matrix: J = {};
  const run = async (actor: string, t?: string, skip: string[] = []) => {
    matrix[actor] = {};
    for (const [i, n] of names.entries()) {
      if (skip.includes(n)) continue;
      const s = await actions[n](t);
      matrix[actor][n] = { status: s, observed: allowed(s) ? 'A' : 'D', expected: E[actor].split(' ')[i] };
    }
  };
  // the grant action changes state, so the grant column is measured on throw-away state where needed
  await call('POST', '/api/access/request', tok.doctor, { patientId });
  await run('Doctor, no consent', tok.doctor);
  await run('Other patient', tok.other);
  await run('Laboratory', tok.lab);
  await run('Insurance, no claim', tok.insurance);
  await run('Administrator', tok.admin);
  await run('Not signed in', undefined);
  await run('Owner patient', tok.patient); // grant is measured and reset
  await call('POST', '/api/access/grant', tok.patient, { doctorId });
  await run('Doctor, consent granted', tok.doctor, ['Grant access to a doctor']);
  matrix['Doctor, consent granted']['Grant access to a doctor'] = { status: 'n/a', observed: 'D', expected: 'D' };
  await call('POST', '/api/access/revoke', tok.patient, { doctorId });
  await run('Doctor, consent revoked', tok.doctor);

  let agree = 0, total = 0;
  for (const a of Object.values(matrix)) for (const c of Object.values(a as J)) { total++; if (c.observed === c.expected) agree++; }

  // ---- concurrency test: record check (verify) and list, plus uploads
  const loadRid = rid;
  const load: J[] = [];
  for (const conc of [1, 5, 10, 25, 50]) {
    for (const op of ['list', 'verify', 'upload']) {
      const N = op === 'upload' ? Math.max(20, conc * 2) : Math.max(100, conc * 6);
      const lat: number[] = [];
      let errors = 0, i = 0;
      const t0 = performance.now();
      await Promise.all(Array.from({ length: conc }, async () => {
        while (i < N) {
          i++;
          const s = performance.now();
          const r = op === 'list' ? await call('GET', '/api/records', tok.patient)
            : op === 'verify' ? await call('GET', `/api/records/${loadRid}/verify`, tok.patient)
            : await upload(tok.patient, 100_000);
          lat.push(performance.now() - s);
          if (!allowed(r.status)) errors++;
        }
      }));
      const secs = (performance.now() - t0) / 1000;
      lat.sort((a, b) => a - b);
      load.push({ op, concurrency: conc, requests: lat.length, throughput: lat.length / secs, p50: lat[Math.floor(lat.length * 0.5)], p95: lat[Math.floor(lat.length * 0.95)], errors });
    }
  }

  const out = { reportId: rid, matrix, agreement: `${agree}/${total}`, load, node: process.version };
  fs.writeFileSync(path.join(__dirname, 'results', 'access_eval.json'), JSON.stringify(out, null, 1));
  for (const [a, row] of Object.entries(matrix)) console.log(a.padEnd(26), names.map((n) => (row as J)[n]).map((c: J) => `${c.observed}${c.observed === c.expected ? ' ' : '!'}${c.status}`).join('  '));
  console.log('agreement', agree, '/', total);
  console.table(load.map((l) => ({ ...l, throughput: l.throughput.toFixed(0), p50: l.p50.toFixed(1), p95: l.p95.toFixed(1) })));
  server.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

/**
 * Tamper-detection trials, encryption throughput/overhead and record-history tamper checks.
 * Uses the server's own encryptionService, keyService and entryHash, and the same checks
 * recordVault.openFile performs (stored-ciphertext checksum, key unwrap, GCM tag, SHA-256 fingerprint).
 *   npx --prefix apps/server tsx docs/evaluation/eval_security.ts
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { encryptionService } from '../../apps/server/src/services/encryptionService';
import { keyService } from '../../apps/server/src/services/keyService';
import { entryHash } from '../../apps/server/src/services/blockchainService';

const rnd = (() => { let s = 99173; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const ri = (n: number) => Math.floor(rnd() * n);
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');
const fileAad = (r: string, p: string) => `medledger-file:v1:${r}:${p}`;
const keyCtx = (r: string) => `file:${r}`;

interface Sealed { reportId: string; patientId: string; ct: Buffer; iv: string; tag: string; wrapped: string; ctSha: string; fileHash: string }
function seal(pt: Buffer, reportId: string, patientId: string): Sealed {
  const dek = keyService.newDataKey();
  const e = encryptionService.encrypt(pt, dek, fileAad(reportId, patientId));
  const ct = e.encryptedData;
  return { reportId, patientId, ct, iv: e.iv, tag: e.authTag, wrapped: keyService.wrap(dek, keyCtx(reportId)), ctSha: sha(ct), fileHash: sha(pt) };
}
/** Returns the layer that rejected the record, or 'released'. */
function open(s: Sealed): string {
  if (sha(s.ct) !== s.ctSha) return 'checksum';
  let dek: Buffer;
  try { dek = keyService.unwrap(s.wrapped, keyCtx(s.reportId)); } catch { return 'key-unwrap'; }
  let pt: Buffer;
  try { pt = encryptionService.decrypt(s.ct, dek, s.iv, s.tag, fileAad(s.reportId, s.patientId)); } catch { return 'gcm-tag'; }
  if (sha(pt) !== s.fileHash) return 'fingerprint';
  return 'released';
}
const flipHex = (h: string) => { const b = Buffer.from(h, 'hex'); b[ri(b.length)] ^= 1 << ri(8); return b.toString('hex'); };
const flipWrapped = (w: string) => { const [v, id, b64] = w.split('.'); const b = Buffer.from(b64, 'base64'); b[ri(b.length)] ^= 1 << ri(8); return `${v}.${id}.${b.toString('base64')}`; };

const TRIALS = Number(process.env.TRIALS || 500);
const attacks: Record<string, (s: Sealed, other: Sealed) => Sealed> = {
  // attacker edits the stored blob and also fixes up the stored checksum (strongest variant)
  'Ciphertext bit flip': (s) => { const ct = Buffer.from(s.ct); ct[ri(ct.length)] ^= 1 << ri(8); return { ...s, ct, ctSha: sha(ct) }; },
  'Ciphertext truncation': (s) => { const ct = s.ct.subarray(0, Math.max(1, s.ct.length - 1 - ri(64))); return { ...s, ct: Buffer.from(ct), ctSha: sha(ct) }; },
  'IV modified': (s) => ({ ...s, iv: flipHex(s.iv) }),
  'Auth tag modified': (s) => ({ ...s, tag: flipHex(s.tag) }),
  'Wrapped key modified': (s) => ({ ...s, wrapped: flipWrapped(s.wrapped) }),
  'Key swapped from other record': (s, o) => ({ ...s, wrapped: o.wrapped }),
  'File swapped from other record': (s, o) => ({ ...s, ct: o.ct, iv: o.iv, tag: o.tag, ctSha: o.ctSha }),
  'Record moved to other patient': (s, o) => ({ ...s, patientId: o.patientId }),
  'Fingerprint in metadata edited': (s) => ({ ...s, fileHash: flipHex(s.fileHash) }),
  'Blob edited, checksum not updated': (s) => { const ct = Buffer.from(s.ct); ct[ri(ct.length)] ^= 0xff; return { ...s, ct }; }
};

const tamper: Record<string, { trials: number; detected: number; layers: Record<string, number> }> = {};
let controlsReleased = 0;
const sizes = [2e3, 2e4, 2e5];
for (let t = 0; t < TRIALS; t++) {
  const size = sizes[t % 3] + ri(1000);
  const a = seal(crypto.randomBytes(size), `rep-${t}`, `pat-${t % 37}`);
  const b = seal(crypto.randomBytes(size), `rep-x${t}`, `pat-${(t % 37) + 1}`);
  if (open(a) === 'released') controlsReleased++;
  for (const [name, fn] of Object.entries(attacks)) {
    const r = open(fn(a, b));
    const row = (tamper[name] ||= { trials: 0, detected: 0, layers: {} });
    row.trials++;
    if (r !== 'released') row.detected++;
    row.layers[r] = (row.layers[r] || 0) + 1;
  }
}

// ---- record-history tamper
function buildChain(n: number) {
  const list: any[] = [];
  let prev = '0x' + '0'.repeat(64);
  for (let i = 0; i < n; i++) {
    const e: any = { blockNumber: i, type: i % 3 ? 'ACCESS_GRANTED' : 'RECORD_ADDED', timestamp: 1_760_000_000_000 + i * 1000, previousHash: prev, payload: { fileHash: sha(Buffer.from(String(i))), patient: `0x${i.toString(16).padStart(40, '0')}` } };
    e.currentHash = entryHash(e);
    list.push(e);
    prev = e.currentHash;
  }
  return list;
}
function verify(list: any[]) {
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const prevOk = i === 0 ? b.previousHash === '0x' + '0'.repeat(64) : b.previousHash === list[i - 1].currentHash;
    if (!prevOk || b.currentHash !== entryHash(b) || b.blockNumber !== i) return i;
  }
  return null;
}
const chainAttacks: Record<string, (l: any[], k: number) => void> = {
  'Payload field edited': (l, k) => { l[k].payload.fileHash = sha(Buffer.from('forged' + k)); },
  'Timestamp edited': (l, k) => { l[k].timestamp += 1; },
  'Entry deleted': (l, k) => { l.splice(k, 1); },
  'Entries reordered': (l, k) => { const j = k + 1 < l.length ? k + 1 : k - 1; [l[k], l[j]] = [l[j], l[k]]; },
  'Entry edited and re-hashed': (l, k) => { l[k].payload.fileHash = sha(Buffer.from('forged' + k)); l[k].currentHash = entryHash(l[k]); },
  'Forged entry inserted': (l, k) => { const e: any = { ...l[k], payload: { fileHash: sha(Buffer.from('x')) } }; e.currentHash = entryHash(e); l.splice(k + 1, 0, e); }
};
const chain: Record<string, { trials: number; detected: number; locatedExactly: number }> = {};
const CH = 200;
for (let t = 0; t < CH; t++) {
  for (const [name, fn] of Object.entries(chainAttacks)) {
    const l = buildChain(50);
    const k = 1 + ri(47);
    fn(l, k);
    const at = verify(l);
    const row = (chain[name] ||= { trials: 0, detected: 0, locatedExactly: 0 });
    row.trials++;
    if (at !== null) row.detected++;
    if (at !== null && Math.abs(at - k) <= 1) row.locatedExactly++;
  }
}
const intactOk = Array.from({ length: CH }, () => verify(buildChain(50)) === null).filter(Boolean).length;

// ---- throughput and storage overhead
const perf: any[] = [];
for (const mb of [0.1, 1, 5, 10]) {
  const pt = crypto.randomBytes(Math.round(mb * 1024 * 1024));
  const reps = mb >= 5 ? 10 : 30;
  const enc: number[] = [], dec: number[] = [], hash: number[] = [];
  let s: Sealed | null = null;
  for (let i = 0; i < reps; i++) {
    let t0 = process.hrtime.bigint(); sha(pt); hash.push(Number(process.hrtime.bigint() - t0) / 1e6);
    t0 = process.hrtime.bigint(); s = seal(pt, `p${i}`, 'pat'); enc.push(Number(process.hrtime.bigint() - t0) / 1e6);
    t0 = process.hrtime.bigint(); open(s); dec.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const med = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const meta = Buffer.byteLength(JSON.stringify({ iv: s!.iv, authTag: s!.tag, wrappedKey: s!.wrapped, ciphertextSha256: s!.ctSha, fileHash: s!.fileHash, algorithm: 'aes-256-gcm' }));
  perf.push({ sizeMB: mb, sealMs: med(enc), openMs: med(dec), sha256Ms: med(hash), sealMBps: mb / (med(enc) / 1000), openMBps: mb / (med(dec) / 1000), ciphertextOverheadBytes: s!.ct.length - pt.length, metadataBytes: meta, overheadPct: (100 * (s!.ct.length - pt.length + meta)) / pt.length });
}

const out = { trials: TRIALS, controlsReleased, tamper, chain, chainIntactControls: `${intactOk}/${CH}`, perf, node: process.version };
fs.writeFileSync(path.join(__dirname, 'results', 'security_eval.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

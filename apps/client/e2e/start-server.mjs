// Starts the API server for the end-to-end tests with a brand-new, throw-away state.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '../../server');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'medledger-e2e-'));

const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: '8180',
    NODE_ENV: 'development',
    STATE_FILE_PATH: path.join(dir, 'state.json'),
    FILE_STORAGE_BACKEND: 'local',
    MONGODB_URI: 'mongodb://127.0.0.1:1/unused',
    CLIENT_ORIGINS: 'http://localhost:8181',
    CLIENT_URL: 'http://localhost:8181',
    DEMO_ACCOUNTS: 'true',
    AUTH_RATE_LIMIT: '10000',
    OPENAI_API_KEY: '',
    BLOCKCHAIN_MODE: process.env.E2E_BLOCKCHAIN_MODE || 'simulated',
    JWT_SECRET: 'e2e-secret-that-is-definitely-longer-than-32-characters'
  }
});
const stop = () => {
  child.kill();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));

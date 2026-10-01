# Deployment checklist

Work through this before MedLedger holds real patient data. Every item says **what to do** and **how to check it**.

## 1. Keys and secrets

- [ ] **Master encryption key.** Generate it with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set it as `MASTER_ENCRYPTION_KEY`. The server refuses to start in production without it.
  - **Back it up offline in two places**, for example a password manager and a sealed paper copy. Without it, no stored file can ever be opened again.
  - If you tried the app in development first, the key it used is in `apps/server/.medledger-master.key`. Copy that value, or run the rotation below.
- [ ] **Rotating the master key.** Put the old key in `MASTER_ENCRYPTION_KEYS_PREVIOUS` and the new one in `MASTER_ENCRYPTION_KEY`. Run `npm run keys:rotate` in `apps/server` until it reports 0 left, then remove the old key.
- [ ] **`JWT_SECRET`.** Set 48+ random bytes, for example `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. The server refuses weak or example values in production.
- [ ] **`CHAIN_PRIVATE_KEY`** (only if you use the contract). Use a **separate** account holding only a little ETH for fees. Never use a personal wallet. The server refuses Hardhat's public test key on any network except the local one.
- [ ] **Keep secrets out of the repository.** `.env` files are in `.gitignore`. Check with `git status` that none are staged.

## 2. Production `.env` (apps/server)

```ini
NODE_ENV=production
PORT=8080
JWT_SECRET=<48+ random bytes>
JWT_EXPIRES_IN=8h
MASTER_ENCRYPTION_KEY=<64 hex characters>
CLIENT_ORIGINS=https://medledger.example.org
CLIENT_URL=https://medledger.example.org
TRUST_PROXY=1

DEMO_ACCOUNTS=false
EXPOSE_RESET_TOKEN=false

AUTH_RATE_LIMIT=30
MAX_FAILED_LOGINS=5
LOCKOUT_MINUTES=15
BCRYPT_ROUNDS=12
UPLOAD_MAX_MB=25

MONGODB_URI=mongodb://medledger:<password>@db.internal:27017/medledger?authSource=admin
FILE_STORAGE_BACKEND=gridfs
STATE_FILE_PATH=/var/lib/medledger/state.json

# performance (defaults shown)
OCR_WORKERS=2                 # Tesseract workers reading in parallel (about 150 MB memory each)
STATE_SAVE_DELAY_MS=100       # changes are written together at most this often; 0 = write at once
AI_MIN_OCR_CONFIDENCE=80      # scans read with less confidence stay on the built-in AI

# optional
OPENAI_API_KEY=
WALLET_CHAIN_ID=11155111
HEALTH_RECORDS_CONTRACT_ADDRESS=
CHAIN_RPC_URL=
CHAIN_PRIVATE_KEY=
CHAIN_BATCH_SIZE=1            # >1: anchor uploads in batches (one Merkle root per transaction)
CHAIN_BATCH_WAIT_MS=60000     # …or after this long, whichever comes first
```

**Check:**
- The start-up log has no `WARNING`.
- `GET /health` shows `"demoMode": false`.
- The sign-in page has no **Try a demo** section, and the sample-data banner is gone.

## 3. Storage

- [ ] **MongoDB with GridFS for files.** With `FILE_STORAGE_BACKEND=gridfs`, encrypted files go to GridFS, and the server refuses uploads if MongoDB is unreachable instead of silently writing to disk.
  - **Check:** after an upload, **Admin → Dashboard** shows *MongoDB connected*. `GET /api/records/storage/status` (as an administrator) reports `gridfs`.
- [ ] **The state file.** Accounts, permissions, the record history and the encrypted lists (readings, prescriptions, claims and similar) are kept in `STATE_FILE_PATH`. The audit trail is kept next to it in `STATE_FILE_PATH.audit` (one encrypted line per event, appended only).
  - Put both on a persistent, backed-up volume, owned by the service user with mode 600.
  - Stop the server with SIGTERM (not SIGKILL): it writes pending changes before exiting.
- [ ] **Backups.** Take nightly backups of the state file, its `.audit` file and the MongoDB database (`mongodump`), kept for at least 30 days, stored somewhere other than the server.
  - **Test a restore once**, with the master key, on a separate machine.
- [ ] **Moving from development.** Existing files in the local encrypted-files folder keep working. Old note-only records are encrypted automatically on the first start.

## 4. Network and HTTPS

- [ ] **Serve over HTTPS only.** Put nginx or Caddy in front of the API and the built client, with a real certificate (Let's Encrypt), and redirect HTTP to HTTPS.
- [ ] **Build the client** with `VITE_API_URL=https://api.medledger.example.org npm run build` in `apps/client`, then serve `apps/client/dist` as static files. It needs a fallback to `index.html` for page routes.
- [ ] **CORS.** `CLIENT_ORIGINS` lists only the real front-end address(es). **Check:** a request from any other origin gets no `Access-Control-Allow-Origin` header.
- [ ] **Firewall.** Only 443 (and 80 for the redirect) is open. MongoDB and the API port are reachable only from the proxy.
- [ ] **Upload size.** Set nginx `client_max_body_size` to at least `UPLOAD_MAX_MB`.

## 5. Accounts and access

- [ ] Demo accounts are off (`DEMO_ACCOUNTS=false`). If they existed earlier, disable them under **Admin → Users**.
- [ ] Create the first administrator, then hospital, lab and insurer accounts from **Admin → Users**. Give each person a temporary password and ask them to change it under **Settings** at first sign-in; the app does not force this yet.
- [ ] Rate limits and lockout are active. **Check:** after `MAX_FAILED_LOGINS` (default 5) wrong passwords the account is locked for `LOCKOUT_MINUTES`, and **Admin → Security** shows it.
- [ ] Password reset links are delivered by email. This project has no mail service yet. With `EXPOSE_RESET_TOKEN=false` the reset link is not shown in the page, so connect a mail service to `authController.forgotPassword` before relying on self-service resets.

## 6. Blockchain (optional)

- [ ] **Deploy and configure.** Deploy with `npm run deploy:sepolia`, or to a production network after review. Set `HEALTH_RECORDS_CONTRACT_ADDRESS`, `CHAIN_RPC_URL` and `CHAIN_PRIVATE_KEY`.
  - The contract changed in Phase 10 (one storage slot per record, batches). A contract deployed before then must be **deployed again**; the server's calls do not match the old one.
  - **Batches (optional).** With `CHAIN_BATCH_SIZE=10`, uploads cost about 4.8k gas each instead of 48.7k, but each one waits for its batch (at most `CHAIN_BATCH_WAIT_MS`). Each record's Merkle proof is kept in the record history and shown on the verify page, so it can be checked with `verifyBatchedRecord`. Sharing and stopping sharing are always sent one by one.
- [ ] **Measure on Sepolia** (for the paper). With the server's `.env` values set in the shell, from `apps/server` run
  `NETWORK=sepolia node --import tsx ../../docs/evaluation/eval_chain.ts`. It sends 50 uploads and 50 share/stop pairs (about 0.02 Sepolia ETH) and writes `docs/evaluation/results/chain_eval_sepolia.json`: time to one confirmation (median, p95), gas and fee per write, and how many writes were confirmed. Add `CHAIN_BATCH_SIZE=10` for the batched figures.
- [ ] **Check the setup.**
  - The start-up log says `[Ledger] Writing to the HealthRecords contract …`.
  - After one share and one stop-sharing, `npm run chain:events:sepolia` lists `AccessGranted` and `AccessRevoked`.
  - **Admin → Record history** shows *On Sepolia* with transaction links.
- [ ] **Keep the relayer funded.** Watch its balance. Failed writes appear on the admin page and are retried at the next start.
- [ ] **What goes on-chain.** Only fingerprints (SHA-256 of files) and pseudonymous addresses are written, never names or medical content. Explain this in your privacy notice.

## 7. AI

- [ ] Without `OPENAI_API_KEY`, all AI runs on the server.
- [ ] With a key, only text with personal details removed is sent. Enable Zero Data Retention in the OpenAI organisation, and record OpenAI as a processor in your privacy documentation.
- [ ] Keep the notice that AI output is not a diagnosis. It is shown on every AI result.

## 8. Before go-live

- [ ] `npm test` passes: contract, server and client.
- [ ] `npm run test:e2e` passes against a staging copy.
- [ ] Run `node docs/ui-audit/plain-language-audit.js` against staging. Every page should score 8 or higher.
- [ ] Log rotation is set up for the API process (systemd journal or pm2).
- [ ] A named person owns the master key, the backups and the relayer key.

# Paper: updated System and Results sections

This text matches the build as of 25 Sep 2026 (Phases 1–5). Paste it into the paper's **System** and **Results** sections and adjust the numbering and figure references. The notes at the end list claims to keep, change or avoid.

---

## System design (replacement text)

### Overview

MedLedger AI is a web application with three parts:

- **A React client** written in TypeScript and built with Vite.
- **A REST API** built with Node.js and Express in TypeScript.
- **An Ethereum smart contract**, `HealthRecords`, written in Solidity 0.8.20.

The client provides six role-based workspaces: patient, doctor, hospital administrator, diagnostic laboratory, insurance specialist and system administrator. The interface is available in English, Nepali and Hindi.

### Document protection

1. **Encryption.** Each uploaded document is encrypted on the server with AES-256-GCM under its own random 256-bit data key and a random 96-bit IV. The data key is then wrapped (AES-256-GCM) with a master key held outside the data store, and the master key can be rotated.
2. **Fingerprint.** Before encryption, the server computes a SHA-256 digest of the plaintext and keeps it as the document's fingerprint.
3. **Storage.** Encrypted files are stored in MongoDB GridFS when a database is configured, or in a local encrypted-files directory otherwise.
4. **Checks on every opening.** Each time a file is opened, the server checks three things:
   - the GCM authentication tag of the stored ciphertext;
   - that the file decrypts correctly;
   - that the SHA-256 of the result equals the stored fingerprint.

   If any check fails, the file is not released, and a tamper event is written to the audit log.
5. **Other personal data.** Readings, chats, prescriptions, admissions, lab samples, claims and permissions are stored as individually sealed (AES-256-GCM) lists.

### Access control and consent

1. **Roles.** Every API request carries a signed JWT and is checked against the caller's role.
2. **Permissions.** A single permission list, one entry per patient and doctor, records whether a request is pending, granted, declined or revoked. All record listings, downloads, dashboard counts and notifications are derived from this list, so the pages cannot disagree.
3. **Record lists by role.** Doctors see only records of patients who granted them access. Laboratories see only their own uploads. Insurers see only documents attached to a claim.
4. **MetaMask confirmation (optional).** Patients may link a MetaMask wallet using Sign-In with Ethereum (EIP-4361). They can then confirm each permission change in one of two ways:
   - an EIP-712 typed-data signature that the server verifies;
   - a `grantAccess` / `revokeAccess` transaction sent from their own wallet, which the server verifies against the transaction receipt and its events.

### Record history and blockchain integration

1. **The record history.** Every upload and every permission decision is appended to a record history. Each entry contains:
   - the SHA-256 hash of its own canonical content;
   - the hash of the previous entry.

   The history is saved with the server state and checked link by link, so an edited or removed entry is detected.
2. **Writing to the contract.** When a `HealthRecords` contract is configured, each entry is also written to Ethereum:
   - **Uploads** become `registerRecordFor(patient, fingerprint)`.
   - **Sharing decisions** become `grantAccessFor` / `revokeAccessFor(patient, doctor)`. These are sent by the server's relayer account, which is the only account the contract allows to call these functions.
   - **Decisions the patient already sent from MetaMask** are recorded by their own transaction hash instead of being sent again.
3. **Queue.** Transactions are queued and sent in the background, one at a time, so user actions do not wait for block confirmation. Entries not yet sent are resent after a restart.
4. **What goes on-chain.** Only document fingerprints and pseudonymous addresses are placed on-chain, never document contents or personal identifiers.
5. **Deployment.** The contract is deployed to a local Hardhat network for development and to the Sepolia test network for evaluation. Each confirmed entry links to its transaction on Sepolia Etherscan.

### AI engine

1. **Text extraction.** Text is taken from PDF text layers and, for scanned pages and photos, from Tesseract OCR running on the server.
2. **Removing personal details.** Before any analysis, a de-identification step removes names, dates of birth, phone numbers, emails, addresses and ID numbers. It then re-checks the result independently.
3. **Built-in engine.** A rule-based engine, which needs no network, performs:
   - summarisation;
   - vital-sign and lab-value extraction, compared with reference ranges;
   - condition flags;
   - drug-interaction checks against a local knowledge base;
   - trend analysis.
4. **External model (optional).** When an OpenAI key is configured, GPT-4o receives only the de-identified text. The built-in engine checks the values it returns and remains the fallback.
5. **For doctors.** Clinicians have chart synthesis, lab triage, drug-interaction and SOAP-note tools.

---

## Results (replacement text)

### Functional verification

The system was verified with four automated test suites. All tests pass on the final build.

| Suite | Tests | Scope |
|---|---|---|
| Smart contract (Hardhat, Mocha) | 18 | record registration, duplicate and zero-hash rejection, grant and revoke, tamper verification, audit events, relayer-only functions and relayer hand-over |
| Server (node:test) | 171 | authentication, lockout and sessions; encryption, key wrapping and tamper detection; OCR; de-identification; AI outputs; MetaMask sign-in and consent; role-scoped access; record history; **end-to-end writes to a contract on a local Hardhat node** (upload → `RecordAdded`, share → `AccessGranted`, stop → `AccessRevoked`, each confirmed) |
| Client (Vitest) | 22 | forms, password rules, trend chart, wallet flow (mocked EIP-1193 provider), error messages, language switching |
| Browser end-to-end (Playwright) | 23 | full consent flow across patient, doctor, laboratory and administrator; every page of all six workspaces; access between roles; languages; phone layout |

**Tamper detection.** Changing one byte of a stored ciphertext caused the download to be refused (HTTP 409) and a `RECORD_TAMPER_DETECTED` audit event to be logged. Editing one field of a record-history entry was detected at that entry by the link check.

### Blockchain cost

Gas used per operation, measured on the Hardhat network (Solidity 0.8.20, optimizer on, 200 runs):

| Operation | Gas |
|---|---|
| Contract deployment | 752,619 |
| `registerRecord` (patient wallet) | 134,861 |
| `registerRecordFor` (relayer) | 120,387 |
| `grantAccess` (patient wallet) | 45,957 |
| `grantAccessFor` (relayer) | 48,670 |
| `revokeAccess` (patient wallet) | 24,046 |
| `revokeAccessFor` (relayer) | 26,738 |

The first registration by a patient address costs more than later ones, because the patient's record array is created at that point.

On a local chain, 48 of 48 queued writes were confirmed during a test of 45 uploads plus sharing changes. None failed.

**Sepolia.** Add the contract address and one `AccessGranted` / `AccessRevoked` transaction hash here after running `npm run deploy:sepolia` and `npm run chain:events:sepolia`.

### Server response times

These were measured on one machine (Node.js 22, local encrypted-file storage, no MongoDB), with 15 requests per file size. Times are in milliseconds, given as median / 95th percentile. The record check re-reads, decrypts and re-hashes the whole file.

| File size | Upload (encrypt + store) | Record check | Download (decrypt + verify) |
|---|---|---|---|
| 100 KB | 9.1 / 25.5 | 7.8 / 28.2 | 4.8 / 16.6 |
| 1 MB | 18.8 / 43.7 | 15.7 / 145.5 | 19.6 / 86.8 |
| 5 MB | 56.5 / 133.6 | 115.7 / 433.2 | 118.6 / 454.4 |

Blockchain writes are asynchronous and not included in these times.

### Usability

An automated audit read the visible text of all 56 pages and scored it out of 10. Points were taken off for technical jargon, all-caps labels, sentences over 28 words, vague button labels and raw error codes.

- **Before the plain-language work:** 16 pages scored below 8, and the average was 7.95.
- **After:** every page scored 9.7 or higher, and the average was 9.99.

All pages fit a 375 px phone screen, and every tap target is at least 44 px tall. A second audit opened every page in Nepali and in Hindi and found no interface text left in English. The only English left was personal names, identifiers and email addresses.

---

## Notes on claims

**Keep:**
- AES-256-GCM per file, with wrapped keys.
- SHA-256 fingerprints checked on every download.
- Patient-controlled consent.
- Role-based workspaces.
- AI summarisation, vital signs, condition flags, drug interactions and history synthesis.

**Be precise about:**
- **MongoDB with GridFS** stores the encrypted files when configured. Accounts, permissions and the record history are in an encrypted JSON state file.
- **The blockchain.** Consent and fingerprints are recorded on Ethereum when a contract is configured. Otherwise the record history is kept and checked on the server. The contract does not store documents.
- **"Immutable".** Use "tamper-evident" for the server-side history. Only entries confirmed on-chain are immutable.

**Avoid:**
- Implying that medical files are stored on the blockchain.
- Implying that the AI provides a diagnosis.

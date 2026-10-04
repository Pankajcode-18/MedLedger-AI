import os from 'os';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

/** Secrets that have been published in this repository and must never protect real data. */
const KNOWN_PUBLIC_SECRETS = new Set([
  'ehr_super_secret_jwt_key_2026_sepolia_production_secure_token',
  'your_jwt_secret_key_here'
]);

const DEV_FALLBACK_SECRET = 'medledger-dev-only-secret-change-me-before-deploying-0000';

const resolveJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET || '';
  const weak = !secret || secret.length < 32 || KNOWN_PUBLIC_SECRETS.has(secret);

  if (weak && isProduction) {
    throw new Error(
      '[Config] JWT_SECRET must be set to a private random value of at least 32 characters in production. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  if (weak && nodeEnv !== 'test') {
    console.warn(
      '[Config] WARNING: JWT_SECRET is missing, too short, or a publicly known example value. ' +
        'This is acceptable only for local development.'
    );
  }
  return secret || DEV_FALLBACK_SECRET;
};

const parseList = (value: string | undefined, fallback: string[]): string[] =>
  value
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : fallback;

const stateFilePath = process.env.STATE_FILE_PATH
  ? path.resolve(process.env.STATE_FILE_PATH)
  : path.resolve(__dirname, '..', '..', '..', 'web-app', 'server', 'state.json');
const dataDir = path.dirname(stateFilePath);

export const config = {
  // ---- Encrypted storage (Project Guide §5: AES-256-GCM + GridFS) ----
  /**
   * Master key (KEK) that wraps every per-file key. 64 hex characters or 32 bytes base64.
   * Required in production. In development a key is generated once and kept in `masterKeyFile`.
   */
  masterEncryptionKey: process.env.MASTER_ENCRYPTION_KEY || '',
  /** Older master keys (comma-separated) still accepted for decryption after a rotation. */
  previousMasterKeys: parseList(process.env.MASTER_ENCRYPTION_KEYS_PREVIOUS, []),
  masterKeyFile: process.env.MASTER_KEY_FILE ? path.resolve(process.env.MASTER_KEY_FILE) : path.join(dataDir, '.medledger-master.key'),
  /** Encrypted files go to MongoDB GridFS when connected, otherwise to this folder. */
  fileStorageDir: process.env.FILE_STORAGE_DIR ? path.resolve(process.env.FILE_STORAGE_DIR) : path.join(dataDir, 'encrypted-files'),
  /** "auto" (GridFS when MongoDB is connected), "gridfs" (required) or "local". */
  fileStorageBackend: (process.env.FILE_STORAGE_BACKEND || 'auto') as 'auto' | 'gridfs' | 'local',
  uploadMaxMb: parseInt(process.env.UPLOAD_MAX_MB || '25', 10),

  // ---- Reading uploaded files (PDF text + OCR for scans and photos) ----
  ocrEnabled: (process.env.OCR_ENABLED || 'true') !== 'false',
  /** Tesseract language codes joined with "+", e.g. "eng" or "eng+nep". English data ships with the app. */
  ocrLanguages: process.env.OCR_LANGUAGES || 'eng',
  /** Folder with extra *.traineddata(.gz) files; without it other languages are downloaded once from the internet. */
  ocrLangPath: process.env.OCR_LANG_PATH ? path.resolve(process.env.OCR_LANG_PATH) : '',
  /** Scanned pages OCR'd per document (text pages are always read) and the time allowed per page. */
  ocrMaxPages: parseInt(process.env.OCR_MAX_PAGES || '15', 10),
  ocrPageTimeoutMs: parseInt(process.env.OCR_PAGE_TIMEOUT_MS || '60000', 10),
  /** Tesseract workers reading in parallel (each needs roughly 150 MB of memory). */
  ocrWorkers: Math.max(1, Math.min(4, parseInt(process.env.OCR_WORKERS || String(Math.min(2, os.cpus().length || 1)), 10) || 1)),
  /** Where downloaded OCR language data is cached */
  ocrCacheDir: path.join(dataDir, '.ocr-cache'),

  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv,
  isProduction,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ehr_system',

  // ---- Authentication ----
  jwtSecret: resolveJwtSecret(),
  /** Access-token lifetime, e.g. "8h", "30m", "1d". */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtIssuer: 'medledger-api',
  jwtAudience: 'medledger-client',
  /** bcrypt work factor (10 = fast for tests, 12 = recommended). */
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || (nodeEnv === 'test' ? '4' : '12'), 10),
  /** Failed logins allowed per account before a temporary lock. */
  maxFailedLogins: parseInt(process.env.MAX_FAILED_LOGINS || '5', 10),
  lockoutMinutes: parseInt(process.env.LOCKOUT_MINUTES || '15', 10),
  passwordResetMinutes: parseInt(process.env.PASSWORD_RESET_MINUTES || '15', 10),
  /**
   * Outside production the reset token is also returned in the API response (and printed in the
   * server log when no email service is set up) to make the flow demoable.
   */
  exposeResetToken: (process.env.EXPOSE_RESET_TOKEN || (isProduction ? 'false' : 'true')) === 'true',
  /** Where the reset link in the email (or the log) points to. */
  clientUrl: process.env.CLIENT_URL || 'http://localhost:8081',
  /** Outgoing email for password-reset links. Without SMTP_HOST the link is printed in the server log. */
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    /** true for port 465 (TLS from the start); false uses STARTTLS on 587. */
    secure: (process.env.SMTP_SECURE || (process.env.SMTP_PORT === '465' ? 'true' : 'false')) === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'MedLedger AI <no-reply@medledger.local>'
  },
  /** Seed the six demo accounts shown on the login page (off by default in production). */
  demoAccounts: (process.env.DEMO_ACCOUNTS || (isProduction ? 'false' : 'true')) === 'true',
  /** Browser origins allowed to call the API. */
  clientOrigins: parseList(process.env.CLIENT_ORIGINS, [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:5173'
  ]),

  openaiApiKey: /^sk-/.test(process.env.OPENAI_API_KEY || '') ? (process.env.OPENAI_API_KEY as string) : '',
  /** Model for summaries/analysis (Project Guide: GPT-4o) and a cheaper one for chat (GPT-4o-mini). */
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  /** Give up on the external AI after this long and use the built-in engine instead. */
  aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '15000', 10),
  /**
   * Documents read by OCR below this average confidence (0–100) are analysed only by the built-in
   * engine: garbled text defeats de-identification patterns, so it is never sent to the external model.
   * A document whose text the uploader has checked and corrected is exempt.
   */
  aiMinOcrConfidence: parseInt(process.env.AI_MIN_OCR_CONFIDENCE || '80', 10),
  contractAddress: process.env.HEALTH_RECORDS_CONTRACT_ADDRESS || '',
  /** Express "trust proxy": a hop count ("1") or a list of proxy addresses; empty = off. */
  trustProxy: /^\d+$/.test(process.env.TRUST_PROXY || '') ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY || '',

  // ---- MetaMask wallet ----
  /** Network MetaMask should use: 11155111 = Sepolia (default), 31337 = local Hardhat node */
  walletChainId: parseInt(process.env.WALLET_CHAIN_ID || '11155111', 10),
  /** Public RPC offered to MetaMask when it needs to add the network (never a private key URL) */
  walletPublicRpcUrl: process.env.WALLET_PUBLIC_RPC_URL || '',
  /** Minutes a sign-in / link message stays valid */
  walletChallengeMinutes: parseInt(process.env.WALLET_CHALLENGE_MINUTES || '5', 10),
  sepoliaRpcUrl: process.env.CHAIN_RPC_URL || process.env.SEPOLIA_RPC_URL || '',
  sepoliaPrivateKey: process.env.CHAIN_PRIVATE_KEY || process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY || '',

  // ---- Record history on Ethereum ----
  /** "auto" = use the HealthRecords contract when address, RPC and key are all set; "simulated" = never. */
  blockchainMode: (process.env.BLOCKCHAIN_MODE || 'auto').toLowerCase() as 'auto' | 'simulated',
  /** RPC the server sends transactions through (Sepolia: an Alchemy/Infura URL; local: http://127.0.0.1:8545). */
  chainRpcUrl:
    process.env.CHAIN_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    (parseInt(process.env.WALLET_CHAIN_ID || '11155111', 10) === 31337 ? 'http://127.0.0.1:8545' : ''),
  /** Private key of the server's own account (the contract's "relayer"). Needs a little test ETH on Sepolia. */
  chainPrivateKey: process.env.CHAIN_PRIVATE_KEY || process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY || '',
  /**
   * Phase 10: anchor record fingerprints in batches (one Merkle root per transaction) once this many are
   * waiting, or after CHAIN_BATCH_WAIT_MS. 1 (default) = one transaction per record.
   */
  chainBatchSize: Math.max(1, parseInt(process.env.CHAIN_BATCH_SIZE || '1', 10) || 1),
  chainBatchWaitMs: Math.max(0, parseInt(process.env.CHAIN_BATCH_WAIT_MS || '60000', 10) || 0),
  stateFilePath
};

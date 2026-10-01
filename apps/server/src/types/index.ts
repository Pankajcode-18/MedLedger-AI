import { Request } from 'express';

export type UserRole =
  | 'patient'
  | 'doctor'
  | 'hospital-admin'
  | 'hospital'
  | 'lab'
  | 'insurance'
  | 'admin'
  | 'system-admin';

export interface AuthenticatedUser {
  id: string;
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  walletAddress?: string;
  organization?: string;
  /** JWT id (used for logout revocation) */
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface IPatientRecord {
  patientId: string;
  adharNo?: string;
  name: string;
  email: string;
  age?: string;
  phNo?: string;
  address?: string;
  city?: string;
  reportFile?: string;
  ethereumAddress?: string;
  type?: 'patient';
}

export interface IDoctorRecord {
  doctorId: string;
  licenseId?: string;
  name: string;
  email: string;
  age?: string;
  phNo?: string;
  ethereumAddress?: string;
  specialty?: string;
  hospitalName?: string;
  type?: 'doctor';
}

export interface IMedicalReport {
  reportId: string;
  patientId: string;
  report?: string;
  fileName: string;
  fileHash: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy?: string;
  uploadedRole?: UserRole;
  isAsked?: '0' | '1';
  isGiven?: '0' | '1';
  authorizedUsers?: string[];
  /** Title given at upload (e.g. "Lipid profile"), shown instead of the file name. */
  description?: string;
  gridFsFileId?: string;
  createdAt?: string | Date;
  type?: 'report';
  /** AES-256-GCM parameters of the stored file (the data key is wrapped by the master key). */
  encryption?: IRecordEncryption;
  /** Where the encrypted file is kept (GridFS or local encrypted-files folder). */
  storage?: IStoredFile;
  /** Transaction hash of the SHA-256 fingerprint anchor. */
  blockchainTxHash?: string;
  /** Created before encrypted storage existed — the original file was never kept. */
  legacy?: boolean;
  /** Text read from the file (PDF text layer, OCR or .docx). Encrypted at rest like the notes. */
  extractedText?: string;
  textExtraction?: ITextExtraction;
}

export interface ITextExtraction {
  status: 'pending' | 'processing' | 'done' | 'failed' | 'unsupported';
  method?: 'pdf-text' | 'ocr' | 'pdf-text+ocr' | 'docx' | 'plain' | 'unsupported';
  pages?: number;
  ocrPages?: number;
  /** average OCR confidence 0–100 (only when OCR was used) */
  confidence?: number | null;
  /** Short numbers OCR read with low confidence — flagged "check against the report" until the text is corrected. */
  uncertainNumbers?: string[];
  /** The photo was noisy and had to be cleaned up before reading. */
  cleanedPhoto?: boolean;
  chars?: number;
  language?: string;
  durationMs?: number;
  warnings?: string[];
  error?: string;
  /** The uploader or patient checked the recognised text and saved a corrected version. */
  corrected?: boolean;
  correctedAt?: string;
  correctedBy?: string;
  updatedAt: string;
}

export interface IRecordEncryption {
  algorithm: 'aes-256-gcm';
  version: 1;
  iv: string;
  authTag: string;
  /** Per-record data key, wrapped by the master key: v1.<keyId>.<base64> */
  wrappedKey: string;
  encryptedAt: string;
}

export interface IStoredFile {
  backend: 'gridfs' | 'local';
  ref: string;
  size: number;
  ciphertextSha256: string;
}

export interface IAuditLogEntry {
  patientId: string;
  actorId: string;
  actorRole: UserRole | 'system';
  action: string;
  timestamp: Date;
  blockchainEventHash: string;
  details?: Record<string, unknown>;
}

/** One entry in the record history (see services/blockchainService.ts). blockNumber is the entry number. */
export interface IBlockchainBlock {
  blockNumber: number;
  type: string;
  timestamp: string | number;
  previousHash: string;
  currentHash: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  /** Present when the entry is (or is being) written to Ethereum. */
  chain?: IChainReceipt;
}

export interface IChainReceipt {
  status: 'queued' | 'sent' | 'confirmed' | 'failed';
  network: string;
  chainId: number;
  /** relayer = the MedLedger server account; patient-wallet = the patient confirmed in MetaMask */
  by: 'relayer' | 'patient-wallet';
  txHash?: string;
  blockNumber?: number;
  explorerUrl?: string;
  error?: string;
  note?: string;
  /** When the transaction was sent and when it was first confirmed (Phase 10: latency). */
  sentAt?: string;
  confirmedAt?: string;
  /** Set when the record was anchored as part of a batch (a Merkle root for many records). */
  batch?: { root: string; proof: string[]; leafIndex: number; size: number; patient: string };
}

export interface IApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/** A measurement recorded outside a lab report: a home reading or one taken at a clinic visit. */
export type VitalType = 'bp' | 'heart_rate' | 'spo2' | 'temperature' | 'weight' | 'fasting_glucose' | 'random_glucose';

export interface IVitalReading {
  id: string;
  patientId: string;
  type: VitalType;
  /** main value (systolic for blood pressure; °C for temperature; kg for weight) */
  value: number;
  /** diastolic for blood pressure */
  value2?: number;
  unit: string;
  /** when the measurement was taken (ISO) */
  takenAt: string;
  note?: string;
  /** 'home' = entered by the patient, 'clinic' = entered by a clinician */
  origin: 'home' | 'clinic';
  enteredBy: string;
  enteredRole: string;
  createdAt: string;
}

export interface IChatMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  engine?: 'openai' | 'local';
  sources?: Array<{ label: string; date: string; origin: 'report' | 'home' | 'clinic'; reportId?: string }>;
}

/** One conversation per signed-in user and patient (patients talk about themselves; clinicians per patient). */
export interface IChatThread {
  ownerId: string;
  patientId: string;
  messages: IChatMessageRecord[];
  updatedAt: string;
}

/** Saved form values for one settings section of one user (profile, notifications, practice…). */
export interface IUserSettings {
  userId: string;
  section: string;
  values: Record<string, string | number | boolean>;
  updatedAt: string;
}

/** A prescription written by a doctor for a patient who has shared their records. */
export interface IPrescription {
  id: string;
  patientId: string;
  patientName?: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  status: 'Active' | 'Stopped';
  prescribedBy: string;
  prescriberName: string;
  createdAt: string;
  updatedAt: string;
}

/** One patient → doctor permission and its history. The single source of truth for record access. */
export interface IConsent {
  patientId: string;
  doctorId: string;
  status: 'pending' | 'granted' | 'declined' | 'revoked';
  reason?: string;
  requestedAt?: string;
  decidedAt?: string;
  updatedAt: string;
  /** Set when an administrator changed this permission for the patient (break-glass); shown to the patient. */
  override?: { by: string; reason: string; at: string; change: 'granted' | 'revoked' };
}

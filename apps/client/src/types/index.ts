export type UserRole =
  | 'patient'
  | 'doctor'
  | 'hospital-admin'
  | 'hospital'
  | 'lab'
  | 'insurance'
  | 'admin'
  | 'system-admin';

export interface User {
  id: string;
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  walletAddress?: string;
  /** true when walletAddress is the user's own MetaMask account (proved by a signature) */
  walletLinked?: boolean;
  organization?: string;
}

export interface Patient {
  patientId: string;
  adharNo?: string;
  name: string;
  email: string;
  age?: string;
  phNo?: string;
  phone?: string;
  address?: string;
  city?: string;
  reportFile?: string;
  ethereumAddress?: string;
  type?: 'patient';
}

export interface Doctor {
  doctorId: string;
  licenseId?: string;
  name: string;
  email: string;
  age?: string;
  phNo?: string;
  phone?: string;
  ethereumAddress?: string;
  specialty?: string;
  hospitalName?: string;
  type?: 'doctor';
}

export interface MedicalRecord {
  reportId: string;
  patientId: string;
  report?: string;
  fileName: string;
  fileHash: string;
  fileType?: string;
  fileSize?: number;
  description?: string;
  uploadedBy?: string;
  /** name of whoever uploaded it (set by the server) */
  uploaderName?: string | null;
  uploadedRole?: UserRole;
  isAsked?: '0' | '1';
  isGiven?: '0' | '1';
  authorizedUsers?: string[];
  createdAt?: string;
  type?: 'report';
  /** Stored encrypted with AES-256-GCM */
  encrypted?: boolean;
  /** false for older records whose original file was never kept */
  fileAvailable?: boolean;
  storageBackend?: 'gridfs' | 'local' | null;
  encryptionAlgorithm?: string | null;
  blockchainTxHash?: string;
  legacy?: boolean;
  /** Example card added by the dashboard for demonstration (not stored on the server) */
  isSample?: boolean;
  /** How (and whether) the text inside the file has been read */
  textExtraction?: TextExtractionInfo;
}

export interface TextExtractionInfo {
  status: 'pending' | 'processing' | 'done' | 'failed' | 'unsupported';
  method?: 'pdf-text' | 'ocr' | 'pdf-text+ocr' | 'docx' | 'plain' | 'unsupported';
  pages?: number;
  ocrPages?: number;
  confidence?: number | null;
  chars?: number;
  warnings?: string[];
  error?: string;
  /** Short numbers OCR read with low confidence — to be checked against the original. */
  uncertainNumbers?: string[];
  /** The photo was noisy and had to be cleaned up before reading. */
  cleanedPhoto?: boolean;
  /** A person checked the recognised text and saved a corrected version. */
  corrected?: boolean;
  correctedAt?: string;
  updatedAt?: string;
}

export interface BlockchainBlock {
  blockNumber: number;
  type: string;
  timestamp: string | number;
  previousHash: string;
  currentHash: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  /** Set when the entry is (or is being) written to Ethereum. */
  chain?: {
    status: 'queued' | 'sent' | 'confirmed' | 'failed';
    network: string;
    chainId: number;
    by: 'relayer' | 'patient-wallet';
    txHash?: string;
    blockNumber?: number;
    explorerUrl?: string;
    error?: string;
    note?: string;
  };
}

export interface LedgerStatus {
  mode: 'contract' | 'simulated';
  chainId: number;
  network: string;
  contractAddress: string | null;
  explorerTxUrl: string | null;
  intact: boolean;
  entries: number;
  firstBroken: number | null;
  chain: { confirmed: number; waiting: number; failed: number };
}

export interface AuditLog {
  _id?: string;
  patientId: string;
  actorId: string;
  actorRole: string;
  action: string;
  timestamp: string | Date;
  blockchainEventHash: string;
  details?: Record<string, unknown>;
  /** Names added by the server so activity reads as a sentence */
  actorName?: string | null;
  patientName?: string | null;
  doctorName?: string | null;
  recordTitle?: string | null;
}

export type AiEngine = 'openai' | 'local';

export interface AiAbnormalValue {
  test: string;
  value: string;
  referenceRange: string;
  status: 'low' | 'high';
  severity: 'mild' | 'moderate' | 'requires attention';
  explanation: string;
  /** Hard to read in the scan — check against the original report. */
  uncertain?: boolean;
}

export interface AiLabValue {
  key: string;
  label: string;
  value: number;
  unit: string;
  display: string;
  referenceRange: string;
  status: 'normal' | 'low' | 'high';
  severity?: 'mild' | 'moderate' | 'requires attention';
  uncertain?: boolean;
}

export interface AiSummaryResponse {
  summary: string;
  keyFindings: string[];
  vitalSigns: {
    bloodPressure?: string;
    heartRate?: string;
    spO2?: string;
    respiratoryRate?: string;
    temperature?: string;
  };
  labValues: AiLabValue[];
  abnormalValues: AiAbnormalValue[];
  keywordFlags: Array<{ line: string; flag: string }>;
  medications: string[];
  questionsForDoctor: string[];
  recommendations: string[];
  engine: AiEngine;
  deidentification: { redactions: number; categories: string[]; categoryCounts?: Record<string, number> };
  safetyDisclaimer: string;
  /** Why only the built-in engine was used (e.g. the report was read from an unclear image). */
  privacyNotice?: string;
  generatedAt: string;
}

export interface DrugInteractionAlert {
  severity: 'high' | 'moderate' | 'low';
  drugs: string[];
  description: string;
  actionableAdvice: string;
  kind?: 'interaction' | 'duplicate' | 'allergy';
  source?: 'knowledge-base' | 'openai';
}

export interface DrugInteractionResponse {
  hasSevereConflict: boolean;
  alerts: DrugInteractionAlert[];
  recognised: string[];
  unrecognised: string[];
  engine: AiEngine;
  safetyDisclaimer: string;
  /** Why only the built-in engine was used (e.g. the report was read from an unclear image). */
  privacyNotice?: string;
}

export interface DrugInfoResponse {
  name: string;
  found: boolean;
  purpose: string;
  commonSideEffects: string[];
  precautions: string[];
  engine: AiEngine;
  safetyDisclaimer: string;
  /** Why only the built-in engine was used (e.g. the report was read from an unclear image). */
  privacyNotice?: string;
}

export interface TrendSeries {
  key: string;
  label: string;
  unit: string;
  referenceRange: string;
  points: TrendPoint[];
  direction: 'rising' | 'falling' | 'stable' | 'single reading';
  changePercent: number | null;
  latestStatus: 'normal' | 'low' | 'high';
  note: string;
  /** numeric normal range for the chart band (absent where there is none, e.g. weight) */
  rangeLow?: number;
  rangeHigh?: number;
}

export interface TrendPoint {
  date: string;
  value: number;
  status: 'normal' | 'low' | 'high';
  source?: string;
  /** report = read from an uploaded record; home = the patient's own reading; clinic = entered by a clinician */
  origin?: 'report' | 'home' | 'clinic';
  reportId?: string;
}

export type VitalType = 'bp' | 'heart_rate' | 'spo2' | 'temperature' | 'weight' | 'fasting_glucose' | 'random_glucose';

export interface VitalReading {
  id: string;
  patientId: string;
  type: VitalType;
  value: number;
  value2?: number;
  unit: string;
  takenAt: string;
  note?: string;
  origin: 'home' | 'clinic';
  enteredBy: string;
  enteredRole: string;
  createdAt: string;
}

export interface ChatSource {
  label: string;
  date: string;
  origin: 'report' | 'home' | 'clinic';
  reportId?: string;
}

export interface SavedChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  engine?: AiEngine;
  sources?: ChatSource[];
}

export interface TrendsResponse {
  series: TrendSeries[];
  narrative: string;
  engine: AiEngine;
  safetyDisclaimer: string;
  /** Why only the built-in engine was used (e.g. the report was read from an unclear image). */
  privacyNotice?: string;
}

export interface ChartSynthesisResponse {
  title: string;
  recordsReviewed: number;
  patientStatus: string;
  vitalTrends: Array<{ parameter: string; trend: string; latest: string; range: string; status: string }>;
  series?: TrendSeries[];
  activeMedications: string[];
  riskFlags: Array<{ area: string; level: string; reason: string }>;
  clinicalSummary: string;
  engine: AiEngine;
  safetyDisclaimer: string;
  /** Why only the built-in engine was used (e.g. the report was read from an unclear image). */
  privacyNotice?: string;
}

export interface SoapNoteResponse {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  engine: AiEngine;
  safetyDisclaimer: string;
  /** Why only the built-in engine was used (e.g. the report was read from an unclear image). */
  privacyNotice?: string;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  dateGroup: 'Today' | 'Yesterday' | 'Last 7 days' | 'Earlier';
  time: string;
  category: 'record' | 'access' | 'verification' | 'login' | 'ai' | 'admin';
  status: 'Verified' | 'Active' | 'Completed' | 'Pending' | 'Needs Review' | 'Revoked' | 'Failed';
  actor: string;
  actorRole: string;
  recordName?: string;
  explanation: string;
  /** how many identical events were merged into this one (e.g. several sign-ins in a row) */
  count?: number;
  /** ISO time of the (latest) event */
  at?: string;
  technicalDetails?: {
    digitalFingerprint: string;
    network: string;
    transactionHash: string;
    blockNumber: number;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  /** when it happened (ISO); used to decide what is new since the user last looked */
  at?: string;
  type: 'access_request' | 'report_ready' | 'record_verified' | 'claim_update' | 'security';
  actionHref?: string;
  actionText?: string;
}


/** POST /api/ai/deidentify — exactly what the AI works with after personal details are removed. */
export interface DeidentifyPreviewResponse {
  text: string;
  redactions: number;
  categories: string[];
  categoryCounts: Record<string, number>;
  residualFindings: Array<{ category: string; count: number }>;
  safeForExternal: boolean;
  originalLength: number;
}

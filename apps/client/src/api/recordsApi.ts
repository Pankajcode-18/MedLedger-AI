import { apiClient } from './apiClient.js';
import { MedicalRecord, TextExtractionInfo } from '../types/index.js';

/** Reads the server's error message — also from blob responses used for downloads. */
export const recordErrorMessage = async (err: unknown): Promise<string> => {
  const data = (err as { response?: { data?: unknown; status?: number } })?.response?.data;
  try {
    if (data instanceof Blob) {
      const parsed = JSON.parse(await data.text()) as { error?: string };
      if (parsed.error) return parsed.error;
    } else if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  } catch {
    // fall through to the generic message
  }
  return 'The request could not be completed. Please try again.';
};

/** File name from Content-Disposition (RFC 5987 form preferred). */
const nameFromHeader = (header: string | undefined, fallback: string): string => {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* use the plain form */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : fallback;
};

export interface IntegrityCheck {
  reportId: string;
  verified: boolean;
  fileStored: boolean;
  storageBackend: 'gridfs' | 'local' | null;
  ciphertextIntact: boolean | null;
  decrypts: boolean | null;
  fingerprintMatches: boolean | null;
  blockchainAnchored: boolean;
  /** Where the fingerprint is recorded: the server's record history, and Ethereum when a contract is set up. */
  history?: {
    inHistory: boolean;
    entry: number | null;
    recordedAt: string | null;
    chain: { status: 'queued' | 'sent' | 'confirmed' | 'failed'; network: string; txHash: string | null; explorerUrl: string | null } | null;
  };
  fileHash: string;
  algorithm: string | null;
  problem?: string;
  checkedAt: string;
}

export interface RecordTextResponse {
  reportId: string;
  fileName: string;
  notes: string;
  text: string;
  extraction: TextExtractionInfo;
}

export const recordsApi = {
  /**
   * Records the user may see. `summary` leaves out notes and sharing lists (much smaller for doctors with
   * many patients); `limit` returns only the newest N (used by notifications, refreshed every 30 s).
   */
  getRecords: async (opts: { summary?: boolean; limit?: number } = {}): Promise<MedicalRecord[]> => {
    const params: Record<string, string | number> = {};
    if (opts.summary) params.fields = 'summary';
    if (opts.limit) params.limit = opts.limit;
    const res = await apiClient.get('/api/records', { params });
    return res.data.data || res.data.records || res.data;
  },

  uploadRecord: async (formData: FormData): Promise<{ reportId: string; fileHash: string; txHash: string; storageBackend: string }> => {
    const res = await apiClient.post('/api/records/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.data;
  },

  /**
   * Downloads the original file. The server decrypts it only after checking the patient's
   * permission and the file's integrity; any refusal is thrown with the server's reason.
   */
  downloadRecord: async (reportId: string, fileName: string): Promise<void> => {
    let res;
    try {
      res = await apiClient.get(`/api/records/${encodeURIComponent(reportId)}/download`, { responseType: 'blob' });
    } catch (err) {
      throw new Error(await recordErrorMessage(err));
    }
    const type = String(res.headers['content-type'] || 'application/octet-stream');
    const url = window.URL.createObjectURL(new Blob([res.data], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', nameFromHeader(res.headers['content-disposition'], fileName));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
  },

  /** Text read from the file (PDF text layer / OCR / Word) and how it was read. */
  getText: async (reportId: string): Promise<RecordTextResponse> => {
    const res = await apiClient.get(`/api/records/${encodeURIComponent(reportId)}/text`);
    return res.data.data;
  },

  /** Reads the file again (patient, uploader or admin). */
  reextract: async (reportId: string): Promise<void> => {
    await apiClient.post(`/api/records/${encodeURIComponent(reportId)}/extract`);
  },

  /** Saves text the patient or uploader has checked against the original file (the file itself is unchanged). */
  correctText: async (reportId: string, text: string): Promise<RecordTextResponse> => {
    try {
      const res = await apiClient.put(`/api/records/${encodeURIComponent(reportId)}/text`, { text });
      return res.data.data;
    } catch (err) {
      throw new Error(await recordErrorMessage(err));
    }
  },

  /** Runs the full integrity check (storage, AES-GCM tag, SHA-256 fingerprint, blockchain anchor). */
  verifyRecord: async (reportId: string): Promise<IntegrityCheck> => {
    const res = await apiClient.get(`/api/records/${encodeURIComponent(reportId)}/verify`);
    return res.data.data;
  }
};

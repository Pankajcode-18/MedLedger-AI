import { apiClient } from './apiClient.js';
import { BlockchainBlock, LedgerStatus } from '../types/index.js';

export const blockchainApi = {
  /** Administrators only. */
  getBlocks: async (): Promise<BlockchainBlock[]> => {
    const res = await apiClient.get('/api/blockchain/blocks');
    return res.data;
  },

  /** Administrators only: where the history is written and whether its links are intact. */
  getStatus: async (): Promise<LedgerStatus> => {
    const res = await apiClient.get('/api/blockchain/status');
    return res.data.data;
  },

  verifyRecord: async (
    fileHash: string
  ): Promise<{ verified: boolean; anchored?: boolean; knownRecord?: boolean; recordedAt?: string | null; status: string; message: string }> => {
    const res = await apiClient.post('/api/blockchain/verify', { fileHash });
    return res.data;
  }
};

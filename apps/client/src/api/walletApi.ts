import { apiClient } from './apiClient.js';
import { User } from '../types/index.js';
import { ChainInfo, TypedData } from '../lib/wallet.js';

export interface WalletConfig extends ChainInfo {
  chainId: number;
  contractAddress: string | null;
  onChainConsent: boolean;
}

export interface WalletStatus {
  linked: boolean;
  address: string | null;
  linkedAt: string | null;
  config: WalletConfig;
}

export const walletApi = {
  config: async (): Promise<WalletConfig> => (await apiClient.get('/api/wallet/config')).data.data,
  status: async (): Promise<WalletStatus> => (await apiClient.get('/api/wallet/status')).data.data,

  linkChallenge: async (address: string): Promise<{ message: string }> => (await apiClient.post('/api/wallet/link/challenge', { address })).data.data,
  link: async (message: string, signature: string): Promise<{ address: string; user: User }> =>
    (await apiClient.post('/api/wallet/link', { message, signature })).data.data,
  unlink: async (): Promise<{ user: User }> => (await apiClient.delete('/api/wallet/link')).data.data,

  loginChallenge: async (address: string): Promise<{ message: string }> => (await apiClient.post('/api/auth/wallet/challenge', { address })).data.data,
  login: async (message: string, signature: string): Promise<{ token: string; user: User }> =>
    (await apiClient.post('/api/auth/wallet/login', { message, signature })).data.data,

  prepareConsent: async (
    doctorId: string,
    action: 'grant' | 'revoke',
    mode: 'signature' | 'onchain'
  ): Promise<
    | { mode: 'signature'; typedData: TypedData & { message: { nonce: string } } }
    | { mode: 'onchain'; chainIdHex: string; tx: { from: string; to: string; data: string; value: string }; doctor: { id: string; name: string; wallet: string } }
  > => (await apiClient.post('/api/wallet/consent/prepare', { doctorId, action, mode })).data.data,

  submitConsent: async (nonce: string, signature: string): Promise<{ message: string }> =>
    (await apiClient.post('/api/wallet/consent', { nonce, signature })).data,
  submitConsentTx: async (txHash: string, doctorId: string, action: 'grant' | 'revoke'): Promise<{ message: string; data: { txHash: string; blockNumber: number } }> =>
    (await apiClient.post('/api/wallet/consent/tx', { txHash, doctorId, action })).data
};

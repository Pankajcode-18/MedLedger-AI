import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { connectWallet, signMessage, signTypedData, switchChain, waitForReceipt, walletErrorMessage, WalletUserError, shortAddress } from '../lib/wallet.js';

type Call = { method: string; params?: unknown };
let calls: Call[] = [];
let handler: (c: Call) => unknown;

beforeEach(() => {
  calls = [];
  (window as unknown as { ethereum?: unknown }).ethereum = {
    isMetaMask: true,
    request: async (c: Call) => {
      calls.push(c);
      return handler(c);
    }
  };
});
afterEach(() => {
  delete (window as unknown as { ethereum?: unknown }).ethereum;
});

describe('MetaMask wallet flow', () => {
  test('connecting returns the first shared account', async () => {
    handler = () => ['0xabc0000000000000000000000000000000000001', '0xabc2'];
    expect(await connectWallet()).toBe('0xabc0000000000000000000000000000000000001');
    expect(calls[0].method).toBe('eth_requestAccounts');
  });

  test('a missing wallet gives a plain instruction', async () => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
    await expect(connectWallet()).rejects.toBeInstanceOf(WalletUserError);
    await expect(connectWallet()).rejects.toThrow(/Install the MetaMask/);
  });

  test('switching to an unknown network adds it first', async () => {
    handler = (c) => {
      if (c.method === 'wallet_switchEthereumChain') throw Object.assign(new Error('unknown chain'), { code: 4902 });
      return null;
    };
    await switchChain({
      chainIdHex: '0xaa36a7',
      chainName: 'Sepolia',
      nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://rpc.sepolia.org'],
      blockExplorerUrl: 'https://sepolia.etherscan.io'
    });
    expect(calls.map((c) => c.method)).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain']);
    expect((calls[1].params as Array<Record<string, unknown>>)[0].blockExplorerUrls).toEqual(['https://sepolia.etherscan.io']);
  });

  test('the sign-in message is sent as readable text (hex of UTF-8)', async () => {
    handler = () => '0xsig';
    await signMessage('0xabc', 'Sign in to MedLedger');
    const [hex, addr] = calls[0].params as string[];
    expect(addr).toBe('0xabc');
    expect(Buffer.from(hex.slice(2), 'hex').toString('utf8')).toBe('Sign in to MedLedger');
  });

  test('consent is signed as EIP-712 with the contract in the domain', async () => {
    handler = () => '0xsig';
    await signTypedData('0xabc', {
      domain: { name: 'MedLedger Consent', version: '1', chainId: 11155111, verifyingContract: '0x5FbDB2315678afecb367f032d93F642f64180aa3' },
      types: { Consent: [{ name: 'action', type: 'string' }] },
      primaryType: 'Consent',
      message: { action: 'grant' }
    });
    expect(calls[0].method).toBe('eth_signTypedData_v4');
    const payload = JSON.parse((calls[0].params as string[])[1]);
    expect(payload.types.EIP712Domain.map((f: { name: string }) => f.name)).toEqual(['name', 'version', 'chainId', 'verifyingContract']);
  });

  test('waits for the transaction receipt', async () => {
    vi.useFakeTimers();
    let n = 0;
    handler = () => (++n < 3 ? null : { status: '0x1' });
    const p = waitForReceipt('0xtx', 60_000);
    await vi.advanceTimersByTimeAsync(6000);
    await expect(p).resolves.toEqual({ status: '0x1' });
    vi.useRealTimers();
  });

  test('wallet errors become sentences', () => {
    expect(walletErrorMessage({ code: 4001 })).toMatch(/cancelled/);
    expect(walletErrorMessage({ code: -32002 })).toMatch(/already waiting/);
    expect(walletErrorMessage({ code: -32603, message: 'insufficient funds for gas' })).toMatch(/enough test ETH/);
    expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678');
  });
});

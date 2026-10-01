/**
 * MetaMask (any EIP-1193 wallet) helpers — no extra libraries.
 * Private keys never leave the wallet: the app only asks it to show an address,
 * sign a message, or send a transaction the user approves in MetaMask.
 */

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

interface ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

export class WalletUserError extends Error {}

const discovered: ProviderDetail[] = [];
let listening = false;

/** EIP-6963: wallets announce themselves, so MetaMask is found even when several wallets are installed. */
const listen = () => {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('eip6963:announceProvider', ((e: CustomEvent<ProviderDetail>) => {
    if (!discovered.some((d) => d.info.uuid === e.detail.info.uuid)) discovered.push(e.detail);
  }) as EventListener);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
};
listen();

export const getProvider = (): Eip1193Provider | null => {
  listen();
  const mm = discovered.find((d) => d.info.rdns === 'io.metamask');
  if (mm) return mm.provider;
  if (discovered[0]) return discovered[0].provider;
  const injected = (window as unknown as { ethereum?: Eip1193Provider & { providers?: Eip1193Provider[] } }).ethereum;
  if (!injected) return null;
  return injected.providers?.find((p) => p.isMetaMask) || injected;
};

export const walletName = (): string => {
  const mm = discovered.find((d) => d.info.rdns === 'io.metamask');
  return mm?.info.name || discovered[0]?.info.name || (getProvider()?.isMetaMask ? 'MetaMask' : 'your wallet');
};

export const METAMASK_INSTALL_URL = 'https://metamask.io/download/';

/** Turns wallet errors (EIP-1193 codes) into sentences. */
export const walletErrorMessage = (err: unknown): string => {
  const e = err as { code?: number; message?: string; info?: { error?: { code?: number } } };
  const code = e?.code ?? e?.info?.error?.code;
  if (err instanceof WalletUserError) return err.message;
  if (code === 4001) return 'You cancelled the request in MetaMask.';
  if (code === -32002) return 'MetaMask is already waiting for you — open the MetaMask window to continue.';
  if (code === 4902) return 'This network is not in MetaMask yet.';
  if (code === -32603 && /insufficient funds/i.test(e?.message || '')) return 'Your wallet does not have enough test ETH to pay the network fee.';
  return e?.message ? e.message.replace(/^MetaMask - /, '').slice(0, 200) : 'The wallet request failed.';
};

const need = (): Eip1193Provider => {
  const p = getProvider();
  if (!p) throw new WalletUserError('MetaMask was not found. Install the MetaMask browser extension and reload the page.');
  return p;
};

export const connectWallet = async (): Promise<string> => {
  const accounts = (await need().request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.length) throw new WalletUserError('No account was shared from MetaMask.');
  return accounts[0];
};

export const currentAccount = async (): Promise<string | null> => {
  const p = getProvider();
  if (!p) return null;
  const accounts = (await p.request({ method: 'eth_accounts' }).catch(() => [])) as string[];
  return accounts?.[0] || null;
};

export const currentChainId = async (): Promise<string | null> => {
  const p = getProvider();
  if (!p) return null;
  return ((await p.request({ method: 'eth_chainId' }).catch(() => null)) as string | null)?.toLowerCase() || null;
};

export interface ChainInfo {
  chainIdHex: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrl: string | null;
}

/** Asks MetaMask to switch network, adding it first when MetaMask does not know it. */
export const switchChain = async (chain: ChainInfo): Promise<void> => {
  const p = need();
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chain.chainIdHex }] });
  } catch (err) {
    if ((err as { code?: number })?.code !== 4902 || !chain.rpcUrls.length) throw err;
    await p.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chain.chainIdHex,
          chainName: chain.chainName,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls,
          ...(chain.blockExplorerUrl ? { blockExplorerUrls: [chain.blockExplorerUrl] } : {})
        }
      ]
    });
  }
};

/** personal_sign: the message is shown to the user in MetaMask exactly as written. */
export const signMessage = async (address: string, message: string): Promise<string> => {
  const hex = '0x' + Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, '0')).join('');
  return (await need().request({ method: 'personal_sign', params: [hex, address] })) as string;
};

export interface TypedData {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

/** EIP-712 — MetaMask shows each field (patient, doctor, action…) before signing. */
export const signTypedData = async (address: string, typed: TypedData): Promise<string> => {
  const domainType = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    ...(typed.domain.verifyingContract ? [{ name: 'verifyingContract', type: 'address' }] : [])
  ];
  const payload = { ...typed, types: { EIP712Domain: domainType, ...typed.types } };
  return (await need().request({ method: 'eth_signTypedData_v4', params: [address, JSON.stringify(payload)] })) as string;
};

export const sendTransaction = async (tx: { from: string; to: string; data: string; value?: string }): Promise<string> =>
  (await need().request({ method: 'eth_sendTransaction', params: [tx] })) as string;

/** Waits until the transaction is mined (polls the wallet's own node). */
export const waitForReceipt = async (txHash: string, timeoutMs = 180_000): Promise<{ status: string }> => {
  const p = need();
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const r = (await p.request({ method: 'eth_getTransactionReceipt', params: [txHash] }).catch(() => null)) as { status: string } | null;
    if (r) return r;
    await new Promise((res) => setTimeout(res, 2500));
  }
  throw new WalletUserError('The transaction is taking a long time. It will still count once it is confirmed — try again in a minute.');
};

/** Subscribes to account / network changes. Returns an unsubscribe function. */
export const onWalletChange = (handler: () => void): (() => void) => {
  const p = getProvider();
  if (!p?.on) return () => undefined;
  p.on('accountsChanged', handler);
  p.on('chainChanged', handler);
  return () => {
    p.removeListener?.('accountsChanged', handler);
    p.removeListener?.('chainChanged', handler);
  };
};

export const shortAddress = (a?: string | null): string => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

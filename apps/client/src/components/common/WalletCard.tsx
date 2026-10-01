import { formatDate } from '../../lib/format.js';
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Link2, Loader2, Unlink, Wallet } from 'lucide-react';
import { walletApi, WalletStatus } from '../../api/walletApi.js';
import { useAuthStore } from '../../store/authStore.js';
import {
  METAMASK_INSTALL_URL,
  connectWallet,
  currentAccount,
  currentChainId,
  getProvider,
  onWalletChange,
  shortAddress,
  signMessage,
  switchChain,
  walletErrorMessage,
  walletName
} from '../../lib/wallet.js';

const apiError = (e: unknown): string =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || walletErrorMessage(e);

/**
 * Settings card: link a MetaMask wallet to the account (one free signature), see the network,
 * and unlink. The linked wallet can then sign in and — for patients — approve access changes.
 */
export const WalletCard: React.FC = () => {
  const { user, token, setAuth } = useAuthStore();
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasWallet = Boolean(getProvider());

  const refresh = useCallback(async () => {
    try {
      setStatus(await walletApi.status());
    } catch (e) {
      setError(apiError(e));
    }
    setAccount(await currentAccount());
    setChainId(await currentChainId());
  }, []);

  useEffect(() => {
    refresh();
    return onWalletChange(() => {
      currentAccount().then(setAccount);
      currentChainId().then(setChainId);
    });
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const updateUser = (u: { walletAddress?: string; walletLinked?: boolean }) => {
    if (user && token) setAuth({ ...user, walletAddress: u.walletAddress, walletLinked: u.walletLinked }, token);
  };

  const link = () =>
    run('Waiting for MetaMask…', async () => {
      const address = await connectWallet();
      setAccount(address);
      setBusy('Sign the message in MetaMask (free, no transaction)…');
      const { message } = await walletApi.linkChallenge(address);
      const signature = await signMessage(address, message);
      const res = await walletApi.link(message, signature);
      updateUser(res.user);
      setNotice(`Wallet ${shortAddress(res.address)} is now linked to your account.`);
      await refresh();
    });

  const unlink = () =>
    run('Unlinking…', async () => {
      const res = await walletApi.unlink();
      updateUser(res.user);
      setNotice('Wallet unlinked. You can link it again at any time.');
      await refresh();
    });

  const cfg = status?.config;
  const wrongChain = Boolean(cfg && chainId && chainId !== cfg.chainIdHex.toLowerCase());
  const otherAccount = Boolean(status?.linked && account && status.address && account.toLowerCase() !== status.address.toLowerCase());

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">MetaMask wallet</h3>
          <p className="text-xs text-slate-500">
            Link your wallet to sign in without a password
            {user?.role === 'patient' ? ' and to confirm sharing changes in MetaMask' : ''}. Your secret wallet details never leave MetaMask.
          </p>
        </div>
      </div>

      {!status ? (
        <div className="h-16 rounded-2xl bg-slate-50 animate-pulse" />
      ) : status.linked ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4" /> Linked
            </span>
            <span className="text-slate-500">since {formatDate(status.linkedAt as string)}</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[12px] text-slate-800 break-all">
            {status.address}
            <button type="button" onClick={() => navigator.clipboard.writeText(status.address || '').catch(() => undefined)} className="text-slate-400 hover:text-slate-700 shrink-0" aria-label="Copy wallet address">
              <Copy className="w-3.5 h-3.5" />
            </button>
            {cfg?.blockExplorerUrl && (
              <a href={`${cfg.blockExplorerUrl}/address/${status.address}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 shrink-0" aria-label="View wallet online">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <p className="text-slate-600">
            Network: <strong>{cfg?.chainName}</strong>
            {cfg?.onChainConsent ? ' · sharing changes are saved to your record history from MetaMask' : user?.role === 'patient' ? ' · you confirm sharing changes in MetaMask' : ''}
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
          No wallet linked. Linking asks you to sign one message in MetaMask — it is free and does not send any transaction.
        </p>
      )}

      {!hasWallet && (
        <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            MetaMask was not found in this browser.{' '}
            <a href={METAMASK_INSTALL_URL} target="_blank" rel="noreferrer" className="ml-tap font-bold underline">
              Install MetaMask
            </a>{' '}
            and reload this page.
          </span>
        </div>
      )}
      {hasWallet && otherAccount && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          MetaMask is currently using {shortAddress(account)}, not your linked wallet. Switch accounts in MetaMask before approving anything.
        </p>
      )}
      {hasWallet && wrongChain && cfg && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <span>MetaMask is on a different network. MedLedger uses {cfg.chainName}.</span>
          <button type="button" onClick={() => run('Switching network…', () => switchChain(cfg).then(refresh))} className="font-bold text-amber-900 underline">
            Switch to {cfg.chainName}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {error}
        </p>
      )}
      {notice && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">{notice}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {status && !status.linked && (
          <button
            type="button"
            disabled={!hasWallet || Boolean(busy)}
            onClick={link}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-4 py-2.5 rounded-xl"
          >
            <Link2 className="w-4 h-4" /> Connect &amp; link {hasWallet ? walletName() : 'MetaMask'}
          </button>
        )}
        {status?.linked && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={unlink}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-700 border border-slate-200 px-3 py-2 rounded-xl disabled:opacity-50"
          >
            <Unlink className="w-3.5 h-3.5" /> Unlink wallet
          </button>
        )}
        {busy && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy}
          </span>
        )}
      </div>
    </div>
  );
};

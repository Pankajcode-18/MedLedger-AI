import { useCallback, useEffect, useState } from 'react';
import { consentApi, ConsentEntry, summaryApi } from '../api/consentApi.js';
import { walletApi, WalletStatus } from '../api/walletApi.js';
import { consentWithWallet } from '../lib/walletConsent.js';
import { walletErrorMessage } from '../lib/wallet.js';

/**
 * The patient's record permissions from the one status endpoint, plus the actions that change them.
 * With a linked MetaMask wallet, grant and revoke are approved in the wallet first.
 */
export function usePatientConsent(onMessage: (text: string, ok?: boolean) => void) {
  const [entries, setEntries] = useState<ConsentEntry[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletStatus | null>(null);

  const refresh = useCallback(async () => {
    const [s, c] = await Promise.allSettled([consentApi.status(), summaryApi.get()]);
    if (s.status === 'fulfilled') setEntries(s.value.entries);
    if (c.status === 'fulfilled') setSummary(c.value);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    walletApi.status().then(setWallet).catch(() => setWallet(null));
  }, [refresh]);

  const act = async (action: 'grant' | 'decline' | 'revoke', doctorId: string): Promise<boolean> => {
    setBusy(`${action}:${doctorId}`);
    try {
      let message: string;
      if (wallet?.linked && action !== 'decline') {
        message = await consentWithWallet(wallet, doctorId, action, (step) => onMessage(step));
      } else {
        message = (await consentApi[action](doctorId)).message;
      }
      onMessage(message);
      await refresh();
      return true;
    } catch (err) {
      const apiErr = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      onMessage(apiErr || walletErrorMessage(err), false);
      return false;
    } finally {
      setBusy(null);
    }
  };

  return {
    entries,
    pending: entries.filter((e) => e.status === 'pending'),
    granted: entries.filter((e) => e.status === 'granted'),
    past: entries.filter((e) => e.status === 'declined' || e.status === 'revoked'),
    summary,
    loaded,
    busy,
    walletLinked: Boolean(wallet?.linked),
    refresh,
    act
  };
}

export type PatientConsent = ReturnType<typeof usePatientConsent>;

import { walletApi, WalletStatus } from '../api/walletApi.js';
import { connectWallet, currentChainId, sendTransaction, shortAddress, signTypedData, switchChain, waitForReceipt, WalletUserError } from './wallet.js';

/**
 * Grants or removes a doctor's access with the patient's MetaMask wallet:
 *  - when the server has the HealthRecords contract: a real transaction (the patient pays the network fee)
 *  - otherwise: an EIP-712 signature (free), kept by the server as proof of consent
 * Returns the server's confirmation message.
 */
export const consentWithWallet = async (
  status: WalletStatus,
  doctorId: string,
  action: 'grant' | 'revoke',
  onStep?: (step: string) => void
): Promise<string> => {
  if (!status.linked || !status.address) throw new WalletUserError('Link your MetaMask wallet first (Settings → Wallet).');
  onStep?.('Waiting for MetaMask…');
  const account = await connectWallet();
  if (account.toLowerCase() !== status.address.toLowerCase()) {
    throw new WalletUserError(`MetaMask is using ${shortAddress(account)}. Switch MetaMask to your linked account ${shortAddress(status.address)} and try again.`);
  }
  const cfg = status.config;
  if ((await currentChainId()) !== cfg.chainIdHex.toLowerCase()) {
    onStep?.(`Switching MetaMask to ${cfg.chainName}…`);
    await switchChain(cfg);
  }

  if (cfg.onChainConsent) {
    const prep = await walletApi.prepareConsent(doctorId, action, 'onchain');
    if (prep.mode !== 'onchain') throw new WalletUserError('Unexpected server response.');
    onStep?.('Confirm the transaction in MetaMask…');
    const txHash = await sendTransaction(prep.tx);
    onStep?.('Waiting for the blockchain to confirm…');
    const receipt = await waitForReceipt(txHash);
    if (receipt.status !== '0x1') throw new WalletUserError('The transaction failed on the blockchain. Nothing was changed.');
    onStep?.('Checking the transaction…');
    return (await walletApi.submitConsentTx(txHash, doctorId, action)).message;
  }

  const prep = await walletApi.prepareConsent(doctorId, action, 'signature');
  if (prep.mode !== 'signature') throw new WalletUserError('Unexpected server response.');
  onStep?.('Review and sign the consent in MetaMask…');
  const signature = await signTypedData(status.address, prep.typedData);
  return (await walletApi.submitConsent(prep.typedData.message.nonce, signature)).message;
};

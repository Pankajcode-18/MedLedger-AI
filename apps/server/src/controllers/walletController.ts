import { Request, Response } from 'express';
import { z } from 'zod';
import { walletService, WalletError } from '../services/walletService.js';
import { userStore } from '../services/userStore.js';
import { tokenService } from '../services/tokenService.js';
import { auditService } from '../services/auditService.js';
import { consentService } from '../services/consentService.js';
import { blockchainService } from '../services/blockchainService.js';
import { stateStore } from '../models/stateStore.js';
import { AuthenticatedRequest, UserRole } from '../types/index.js';

const addressSchema = z.object({ address: z.string().min(1, 'Connect a wallet first.').max(64) });
const signedSchema = z.object({ message: z.string().min(1).max(2000), signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, 'Invalid signature.') });
const prepareSchema = z.object({
  doctorId: z.string().min(1).max(64),
  action: z.enum(['grant', 'revoke']),
  mode: z.enum(['signature', 'onchain']).default('signature')
});
const consentSchema = z.object({ nonce: z.string().regex(/^[0-9a-f]{32}$/), signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, 'Invalid signature.') });
const txSchema = z.object({ txHash: z.string().max(80), doctorId: z.string().min(1).max(64), action: z.enum(['grant', 'revoke']) });

const fail = (res: Response, err: unknown): void => {
  if (err instanceof WalletError) {
    res.status(err.status).json({ success: false, error: err.message });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ success: false, error: err.issues[0]?.message || 'Invalid request.' });
    return;
  }
  console.error('[Wallet]', err);
  res.status(500).json({ success: false, error: 'The wallet request could not be completed.' });
};

/** The doctor's on-chain identity: their linked MetaMask wallet, or the address the ledger uses for them. */
const doctorFor = async (doctorId: string) => {
  const user = await userStore.findById(doctorId);
  const dir = stateStore.getState().doctors.find((d) => String(d.doctorId) === String(doctorId));
  if (!user && !dir) throw new WalletError('Doctor not found.', 404);
  if (user && !['doctor', 'hospital', 'hospital-admin'].includes(user.role)) throw new WalletError('Access can only be given to doctors and hospitals.');
  return {
    doctorId,
    name: user?.name || dir?.name || 'Doctor',
    wallet: user?.walletAddress || dir?.ethereumAddress || blockchainService.deriveAddress(doctorId),
    walletLinked: Boolean(user?.walletVerifiedAt)
  };
};

/** The signed-in patient's verified wallet (consent via MetaMask needs one). */
const patientWallet = async (req: AuthenticatedRequest) => {
  const user = await userStore.findById(String(req.user?.userId || ''));
  if (!user || user.role !== 'patient') throw new WalletError('Only patients can approve access to their records.', 403);
  if (!user.walletVerifiedAt || !user.walletAddress) throw new WalletError('Link your MetaMask wallet first (Settings → Wallet).', 409);
  return user;
};

export const walletController = {
  /** GET /api/wallet/config — network and contract details for the page (public). */
  config(_req: Request, res: Response): void {
    res.status(200).json({ success: true, data: walletService.publicConfig });
  },

  /** GET /api/wallet/status */
  async status(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await userStore.findById(String(req.user?.userId || ''));
    res.status(200).json({
      success: true,
      data: {
        linked: Boolean(user?.walletVerifiedAt),
        address: user?.walletVerifiedAt ? user.walletAddress : null,
        linkedAt: user?.walletVerifiedAt || null,
        config: walletService.publicConfig
      }
    });
  },

  /** POST /api/wallet/link/challenge {address} — message for MetaMask to sign. */
  async linkChallenge(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { address } = addressSchema.parse(req.body || {});
      res.status(200).json({ success: true, data: walletService.createChallenge(address, 'link', String(req.user?.userId)) });
    } catch (err) {
      fail(res, err);
    }
  },

  /** POST /api/wallet/link {message, signature} */
  async link(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { message, signature } = signedSchema.parse(req.body || {});
      const uid = String(req.user?.userId || '');
      const address = walletService.verifyChallenge(message, signature, 'link', uid);
      const owner = userStore.findByWallet(address);
      if (owner && owner.userId !== uid) throw new WalletError('This wallet is already linked to another MedLedger account.', 409);
      const user = await userStore.linkWallet(uid, address);
      if (!user) throw new WalletError('Account not found.', 404);
      await auditService.logEvent({
        patientId: uid,
        actorId: uid,
        actorRole: user.role as UserRole,
        action: 'WALLET_LINKED',
        details: { wallet: address }
      });
      res.status(200).json({ success: true, message: 'Wallet linked.', data: { address, user: userStore.toPublic(user) } });
    } catch (err) {
      fail(res, err);
    }
  },

  /** DELETE /api/wallet/link */
  async unlink(req: AuthenticatedRequest, res: Response): Promise<void> {
    const uid = String(req.user?.userId || '');
    const before = await userStore.findById(uid);
    const user = await userStore.unlinkWallet(uid);
    if (!user) {
      res.status(404).json({ success: false, error: 'Account not found.' });
      return;
    }
    await auditService.logEvent({
      patientId: uid,
      actorId: uid,
      actorRole: user.role as UserRole,
      action: 'WALLET_UNLINKED',
      details: { wallet: before?.walletAddress }
    });
    res.status(200).json({ success: true, data: { user: userStore.toPublic(user) } });
  },

  /** POST /api/auth/wallet/challenge {address} — public; for "Sign in with MetaMask". */
  loginChallenge(req: Request, res: Response): void {
    try {
      const { address } = addressSchema.parse(req.body || {});
      res.status(200).json({ success: true, data: walletService.createChallenge(address, 'login') });
    } catch (err) {
      fail(res, err);
    }
  },

  /** POST /api/auth/wallet/login {message, signature} */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { message, signature } = signedSchema.parse(req.body || {});
      const address = walletService.verifyChallenge(message, signature, 'login');
      const user = userStore.findByWallet(address);
      if (!user) throw new WalletError('No MedLedger account is linked to this wallet. Sign in with your email once and link the wallet in Settings.', 404);
      if (user.disabled) throw new WalletError('This account has been disabled. Please contact your administrator.', 403);
      const publicUser = userStore.toPublic(user);
      const { token, expiresAt } = tokenService.sign(publicUser, { userAgent: req.get('user-agent'), ip: req.ip });
      await auditService.logEvent({
        patientId: user.userId,
        actorId: user.userId,
        actorRole: user.role as UserRole,
        action: 'USER_LOGGED_IN',
        details: { method: 'metamask', wallet: address, ip: req.ip }
      });
      res.status(200).json({ success: true, message: 'Signed in with MetaMask.', data: { token, expiresAt, user: publicUser } });
    } catch (err) {
      fail(res, err);
    }
  },

  /**
   * POST /api/wallet/consent/prepare {doctorId, action, mode}
   *  - mode "signature": EIP-712 typed data for eth_signTypedData_v4
   *  - mode "onchain":   the transaction (to, data) for eth_sendTransaction
   */
  async prepareConsent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const body = prepareSchema.parse(req.body || {});
      const patient = await patientWallet(req);
      const doctor = await doctorFor(body.doctorId);
      if (body.mode === 'onchain') {
        const cfg = walletService.publicConfig;
        if (!cfg.onChainConsent || !cfg.contractAddress) throw new WalletError('On-chain consent is not set up on this server.', 503);
        res.status(200).json({
          success: true,
          data: {
            mode: 'onchain',
            chainIdHex: cfg.chainIdHex,
            tx: { from: patient.walletAddress, to: cfg.contractAddress, data: walletService.encodeConsentCall(body.action, doctor.wallet), value: '0x0' },
            doctor: { id: doctor.doctorId, name: doctor.name, wallet: doctor.wallet }
          }
        });
        return;
      }
      const typed = walletService.createConsent({
        patient: patient.walletAddress as string,
        patientId: patient.userId,
        doctorId: doctor.doctorId,
        doctorName: doctor.name,
        doctorWallet: doctor.wallet,
        action: body.action
      });
      res.status(200).json({ success: true, data: { mode: 'signature', typedData: typed } });
    } catch (err) {
      fail(res, err);
    }
  },

  /** POST /api/wallet/consent {nonce, signature} — apply a consent signed in MetaMask. */
  async submitConsent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { nonce, signature } = consentSchema.parse(req.body || {});
      const patient = await patientWallet(req);
      const consent = walletService.verifyConsent(nonce, signature, patient.userId);
      const actor = { userId: patient.userId, role: patient.role };
      const evidence = { method: 'signature' as const, wallet: consent.patient, signature };
      const result =
        consent.action === 'grant'
          ? await consentService.grant(patient.userId, consent.doctorId, actor, evidence)
          : await consentService.revoke(patient.userId, consent.doctorId, actor, evidence);
      res.status(200).json({
        success: true,
        message: consent.action === 'grant' ? `Access granted to ${consent.doctorName}, confirmed with your wallet signature.` : `Access removed for ${consent.doctorName}, confirmed with your wallet signature.`,
        data: { status: consent.action === 'grant' ? 'GRANTED' : 'REVOKED', doctorId: consent.doctorId, signedBy: consent.patient, blockchainTxHash: result.ledgerTx }
      });
    } catch (err) {
      fail(res, err);
    }
  },

  /** POST /api/wallet/consent/tx {txHash, doctorId, action} — apply a consent made on the blockchain. */
  async submitConsentTx(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const body = txSchema.parse(req.body || {});
      const patient = await patientWallet(req);
      const doctor = await doctorFor(body.doctorId);
      const proof = await walletService.verifyConsentTx(body.txHash, body.action, patient.walletAddress as string, doctor.wallet);
      const actor = { userId: patient.userId, role: patient.role };
      const evidence = { method: 'onchain' as const, wallet: patient.walletAddress, ...proof };
      if (body.action === 'grant') await consentService.grant(patient.userId, doctor.doctorId, actor, evidence);
      else await consentService.revoke(patient.userId, doctor.doctorId, actor, evidence);
      res.status(200).json({
        success: true,
        message: body.action === 'grant' ? `Access granted to ${doctor.name} on the blockchain.` : `Access removed for ${doctor.name} on the blockchain.`,
        data: { status: body.action === 'grant' ? 'GRANTED' : 'REVOKED', doctorId: doctor.doctorId, ...proof }
      });
    } catch (err) {
      fail(res, err);
    }
  }
};

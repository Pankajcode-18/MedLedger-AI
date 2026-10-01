"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletController = void 0;
const zod_1 = require("zod");
const walletService_js_1 = require("../services/walletService.js");
const userStore_js_1 = require("../services/userStore.js");
const tokenService_js_1 = require("../services/tokenService.js");
const auditService_js_1 = require("../services/auditService.js");
const consentService_js_1 = require("../services/consentService.js");
const blockchainService_js_1 = require("../services/blockchainService.js");
const stateStore_js_1 = require("../models/stateStore.js");
const addressSchema = zod_1.z.object({ address: zod_1.z.string().min(1, 'Connect a wallet first.').max(64) });
const signedSchema = zod_1.z.object({ message: zod_1.z.string().min(1).max(2000), signature: zod_1.z.string().regex(/^0x[0-9a-fA-F]{130}$/, 'Invalid signature.') });
const prepareSchema = zod_1.z.object({
    doctorId: zod_1.z.string().min(1).max(64),
    action: zod_1.z.enum(['grant', 'revoke']),
    mode: zod_1.z.enum(['signature', 'onchain']).default('signature')
});
const consentSchema = zod_1.z.object({ nonce: zod_1.z.string().regex(/^[0-9a-f]{32}$/), signature: zod_1.z.string().regex(/^0x[0-9a-fA-F]{130}$/, 'Invalid signature.') });
const txSchema = zod_1.z.object({ txHash: zod_1.z.string().max(80), doctorId: zod_1.z.string().min(1).max(64), action: zod_1.z.enum(['grant', 'revoke']) });
const fail = (res, err) => {
    if (err instanceof walletService_js_1.WalletError) {
        res.status(err.status).json({ success: false, error: err.message });
        return;
    }
    if (err instanceof zod_1.z.ZodError) {
        res.status(400).json({ success: false, error: err.issues[0]?.message || 'Invalid request.' });
        return;
    }
    console.error('[Wallet]', err);
    res.status(500).json({ success: false, error: 'The wallet request could not be completed.' });
};
/** The doctor's on-chain identity: their linked MetaMask wallet, or the address the ledger uses for them. */
const doctorFor = async (doctorId) => {
    const user = await userStore_js_1.userStore.findById(doctorId);
    const dir = stateStore_js_1.stateStore.getState().doctors.find((d) => String(d.doctorId) === String(doctorId));
    if (!user && !dir)
        throw new walletService_js_1.WalletError('Doctor not found.', 404);
    if (user && !['doctor', 'hospital', 'hospital-admin'].includes(user.role))
        throw new walletService_js_1.WalletError('Access can only be given to doctors and hospitals.');
    return {
        doctorId,
        name: user?.name || dir?.name || 'Doctor',
        wallet: user?.walletAddress || dir?.ethereumAddress || blockchainService_js_1.blockchainService.deriveAddress(doctorId),
        walletLinked: Boolean(user?.walletVerifiedAt)
    };
};
/** The signed-in patient's verified wallet (consent via MetaMask needs one). */
const patientWallet = async (req) => {
    const user = await userStore_js_1.userStore.findById(String(req.user?.userId || ''));
    if (!user || user.role !== 'patient')
        throw new walletService_js_1.WalletError('Only patients can approve access to their records.', 403);
    if (!user.walletVerifiedAt || !user.walletAddress)
        throw new walletService_js_1.WalletError('Link your MetaMask wallet first (Settings → Wallet).', 409);
    return user;
};
exports.walletController = {
    /** GET /api/wallet/config — network and contract details for the page (public). */
    config(_req, res) {
        res.status(200).json({ success: true, data: walletService_js_1.walletService.publicConfig });
    },
    /** GET /api/wallet/status */
    async status(req, res) {
        const user = await userStore_js_1.userStore.findById(String(req.user?.userId || ''));
        res.status(200).json({
            success: true,
            data: {
                linked: Boolean(user?.walletVerifiedAt),
                address: user?.walletVerifiedAt ? user.walletAddress : null,
                linkedAt: user?.walletVerifiedAt || null,
                config: walletService_js_1.walletService.publicConfig
            }
        });
    },
    /** POST /api/wallet/link/challenge {address} — message for MetaMask to sign. */
    async linkChallenge(req, res) {
        try {
            const { address } = addressSchema.parse(req.body || {});
            res.status(200).json({ success: true, data: walletService_js_1.walletService.createChallenge(address, 'link', String(req.user?.userId)) });
        }
        catch (err) {
            fail(res, err);
        }
    },
    /** POST /api/wallet/link {message, signature} */
    async link(req, res) {
        try {
            const { message, signature } = signedSchema.parse(req.body || {});
            const uid = String(req.user?.userId || '');
            const address = walletService_js_1.walletService.verifyChallenge(message, signature, 'link', uid);
            const owner = userStore_js_1.userStore.findByWallet(address);
            if (owner && owner.userId !== uid)
                throw new walletService_js_1.WalletError('This wallet is already linked to another MedLedger account.', 409);
            const user = await userStore_js_1.userStore.linkWallet(uid, address);
            if (!user)
                throw new walletService_js_1.WalletError('Account not found.', 404);
            await auditService_js_1.auditService.logEvent({
                patientId: uid,
                actorId: uid,
                actorRole: user.role,
                action: 'WALLET_LINKED',
                details: { wallet: address }
            });
            res.status(200).json({ success: true, message: 'Wallet linked.', data: { address, user: userStore_js_1.userStore.toPublic(user) } });
        }
        catch (err) {
            fail(res, err);
        }
    },
    /** DELETE /api/wallet/link */
    async unlink(req, res) {
        const uid = String(req.user?.userId || '');
        const before = await userStore_js_1.userStore.findById(uid);
        const user = await userStore_js_1.userStore.unlinkWallet(uid);
        if (!user) {
            res.status(404).json({ success: false, error: 'Account not found.' });
            return;
        }
        await auditService_js_1.auditService.logEvent({
            patientId: uid,
            actorId: uid,
            actorRole: user.role,
            action: 'WALLET_UNLINKED',
            details: { wallet: before?.walletAddress }
        });
        res.status(200).json({ success: true, data: { user: userStore_js_1.userStore.toPublic(user) } });
    },
    /** POST /api/auth/wallet/challenge {address} — public; for "Sign in with MetaMask". */
    loginChallenge(req, res) {
        try {
            const { address } = addressSchema.parse(req.body || {});
            res.status(200).json({ success: true, data: walletService_js_1.walletService.createChallenge(address, 'login') });
        }
        catch (err) {
            fail(res, err);
        }
    },
    /** POST /api/auth/wallet/login {message, signature} */
    async login(req, res) {
        try {
            const { message, signature } = signedSchema.parse(req.body || {});
            const address = walletService_js_1.walletService.verifyChallenge(message, signature, 'login');
            const user = userStore_js_1.userStore.findByWallet(address);
            if (!user)
                throw new walletService_js_1.WalletError('No MedLedger account is linked to this wallet. Sign in with your email once and link the wallet in Settings.', 404);
            if (user.disabled)
                throw new walletService_js_1.WalletError('This account has been disabled. Please contact your administrator.', 403);
            const publicUser = userStore_js_1.userStore.toPublic(user);
            const { token, expiresAt } = tokenService_js_1.tokenService.sign(publicUser, { userAgent: req.get('user-agent'), ip: req.ip });
            await auditService_js_1.auditService.logEvent({
                patientId: user.userId,
                actorId: user.userId,
                actorRole: user.role,
                action: 'USER_LOGGED_IN',
                details: { method: 'metamask', wallet: address, ip: req.ip }
            });
            res.status(200).json({ success: true, message: 'Signed in with MetaMask.', data: { token, expiresAt, user: publicUser } });
        }
        catch (err) {
            fail(res, err);
        }
    },
    /**
     * POST /api/wallet/consent/prepare {doctorId, action, mode}
     *  - mode "signature": EIP-712 typed data for eth_signTypedData_v4
     *  - mode "onchain":   the transaction (to, data) for eth_sendTransaction
     */
    async prepareConsent(req, res) {
        try {
            const body = prepareSchema.parse(req.body || {});
            const patient = await patientWallet(req);
            const doctor = await doctorFor(body.doctorId);
            if (body.mode === 'onchain') {
                const cfg = walletService_js_1.walletService.publicConfig;
                if (!cfg.onChainConsent || !cfg.contractAddress)
                    throw new walletService_js_1.WalletError('On-chain consent is not set up on this server.', 503);
                res.status(200).json({
                    success: true,
                    data: {
                        mode: 'onchain',
                        chainIdHex: cfg.chainIdHex,
                        tx: { from: patient.walletAddress, to: cfg.contractAddress, data: walletService_js_1.walletService.encodeConsentCall(body.action, doctor.wallet), value: '0x0' },
                        doctor: { id: doctor.doctorId, name: doctor.name, wallet: doctor.wallet }
                    }
                });
                return;
            }
            const typed = walletService_js_1.walletService.createConsent({
                patient: patient.walletAddress,
                patientId: patient.userId,
                doctorId: doctor.doctorId,
                doctorName: doctor.name,
                doctorWallet: doctor.wallet,
                action: body.action
            });
            res.status(200).json({ success: true, data: { mode: 'signature', typedData: typed } });
        }
        catch (err) {
            fail(res, err);
        }
    },
    /** POST /api/wallet/consent {nonce, signature} — apply a consent signed in MetaMask. */
    async submitConsent(req, res) {
        try {
            const { nonce, signature } = consentSchema.parse(req.body || {});
            const patient = await patientWallet(req);
            const consent = walletService_js_1.walletService.verifyConsent(nonce, signature, patient.userId);
            const actor = { userId: patient.userId, role: patient.role };
            const evidence = { method: 'signature', wallet: consent.patient, signature };
            const result = consent.action === 'grant'
                ? await consentService_js_1.consentService.grant(patient.userId, consent.doctorId, actor, evidence)
                : await consentService_js_1.consentService.revoke(patient.userId, consent.doctorId, actor, evidence);
            res.status(200).json({
                success: true,
                message: consent.action === 'grant' ? `Access granted to ${consent.doctorName}, confirmed with your wallet signature.` : `Access removed for ${consent.doctorName}, confirmed with your wallet signature.`,
                data: { status: consent.action === 'grant' ? 'GRANTED' : 'REVOKED', doctorId: consent.doctorId, signedBy: consent.patient, blockchainTxHash: result.ledgerTx }
            });
        }
        catch (err) {
            fail(res, err);
        }
    },
    /** POST /api/wallet/consent/tx {txHash, doctorId, action} — apply a consent made on the blockchain. */
    async submitConsentTx(req, res) {
        try {
            const body = txSchema.parse(req.body || {});
            const patient = await patientWallet(req);
            const doctor = await doctorFor(body.doctorId);
            const proof = await walletService_js_1.walletService.verifyConsentTx(body.txHash, body.action, patient.walletAddress, doctor.wallet);
            const actor = { userId: patient.userId, role: patient.role };
            const evidence = { method: 'onchain', wallet: patient.walletAddress, ...proof };
            if (body.action === 'grant')
                await consentService_js_1.consentService.grant(patient.userId, doctor.doctorId, actor, evidence);
            else
                await consentService_js_1.consentService.revoke(patient.userId, doctor.doctorId, actor, evidence);
            res.status(200).json({
                success: true,
                message: body.action === 'grant' ? `Access granted to ${doctor.name} on the blockchain.` : `Access removed for ${doctor.name} on the blockchain.`,
                data: { status: body.action === 'grant' ? 'GRANTED' : 'REVOKED', doctorId: doctor.doctorId, ...proof }
            });
        }
        catch (err) {
            fail(res, err);
        }
    }
};

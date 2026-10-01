"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletService = exports.HEALTH_RECORDS_ABI = exports.CONSENT_TYPES = exports.WalletError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ethers_1 = require("ethers");
const index_js_1 = require("../config/index.js");
/**
 * MetaMask support.
 *
 *  1. Sign-In with Ethereum (EIP-4361): the server issues a one-time message, MetaMask signs it
 *     (personal_sign), the server recovers the address. Used to LINK a wallet to an account and
 *     to SIGN IN with a linked wallet. No private key ever reaches the server.
 *  2. Consent signatures (EIP-712): the patient signs a typed "grant / revoke access" message,
 *     which is verifiable proof that the wallet owner approved the change.
 *  3. On-chain consent: the patient sends grantAccess / revokeAccess to the HealthRecords contract
 *     from MetaMask; the server checks the transaction receipt and its event before applying it.
 */
class WalletError extends Error {
    status;
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
exports.WalletError = WalletError;
exports.CONSENT_TYPES = {
    Consent: [
        { name: 'patient', type: 'address' },
        { name: 'patientId', type: 'string' },
        { name: 'doctorId', type: 'string' },
        { name: 'doctorName', type: 'string' },
        { name: 'doctorWallet', type: 'address' },
        { name: 'action', type: 'string' },
        { name: 'nonce', type: 'string' },
        { name: 'issuedAt', type: 'string' },
        { name: 'deadline', type: 'uint256' }
    ]
};
exports.HEALTH_RECORDS_ABI = [
    'function grantAccess(address doctor)',
    'function revokeAccess(address doctor)',
    'function hasAccess(address patient, address doctor) view returns (bool)',
    'event AccessGranted(address indexed patient, address indexed doctor, uint256 timestamp)',
    'event AccessRevoked(address indexed patient, address indexed doctor, uint256 timestamp)'
];
const iface = new ethers_1.ethers.Interface(exports.HEALTH_RECORDS_ABI);
const CHAIN_NAMES = {
    11155111: { name: 'Sepolia', explorer: 'https://sepolia.etherscan.io', currency: 'SepoliaETH', rpc: 'https://rpc.sepolia.org' },
    31337: { name: 'Hardhat Local', explorer: '', currency: 'ETH', rpc: 'http://127.0.0.1:8545' },
    1337: { name: 'Localhost', explorer: '', currency: 'ETH', rpc: 'http://127.0.0.1:8545' }
};
class WalletService {
    challenges = new Map();
    usedTx = new Set();
    provider = null;
    /** Tests inject a fake provider; otherwise SEPOLIA_RPC_URL (or the local node) is used. */
    setProvider(p) {
        this.provider = p;
    }
    getProvider() {
        if (this.provider)
            return this.provider;
        const url = index_js_1.config.sepoliaRpcUrl || (index_js_1.config.walletChainId === 31337 ? 'http://127.0.0.1:8545' : '');
        if (!url)
            throw new WalletError('The server has no blockchain connection (SEPOLIA_RPC_URL), so on-chain consent cannot be verified.', 503);
        this.provider = new ethers_1.ethers.JsonRpcProvider(url, index_js_1.config.walletChainId);
        return this.provider;
    }
    get publicConfig() {
        const info = CHAIN_NAMES[index_js_1.config.walletChainId] || { name: `Chain ${index_js_1.config.walletChainId}`, explorer: '', currency: 'ETH', rpc: '' };
        return {
            chainId: index_js_1.config.walletChainId,
            chainIdHex: `0x${index_js_1.config.walletChainId.toString(16)}`,
            chainName: info.name,
            nativeCurrency: { name: info.currency, symbol: info.currency === 'SepoliaETH' ? 'ETH' : info.currency, decimals: 18 },
            rpcUrls: [index_js_1.config.walletPublicRpcUrl || info.rpc].filter(Boolean),
            blockExplorerUrl: info.explorer || null,
            contractAddress: ethers_1.ethers.isAddress(index_js_1.config.contractAddress) ? ethers_1.ethers.getAddress(index_js_1.config.contractAddress) : null,
            onChainConsent: ethers_1.ethers.isAddress(index_js_1.config.contractAddress) && Boolean(index_js_1.config.sepoliaRpcUrl || this.provider || index_js_1.config.walletChainId === 31337)
        };
    }
    sweep() {
        const now = Date.now();
        for (const [k, v] of this.challenges)
            if (v.expiresAt < now)
                this.challenges.delete(k);
    }
    domain() {
        try {
            const u = new URL(index_js_1.config.clientUrl);
            return { host: u.host, uri: u.origin };
        }
        catch {
            return { host: 'localhost', uri: 'http://localhost' };
        }
    }
    // ---------------- Sign-In with Ethereum ----------------
    createChallenge(rawAddress, purpose, userId) {
        if (!ethers_1.ethers.isAddress(rawAddress))
            throw new WalletError('That is not a valid Ethereum address.');
        this.sweep();
        const address = ethers_1.ethers.getAddress(rawAddress);
        const nonce = crypto_1.default.randomBytes(16).toString('hex');
        const issued = new Date();
        const expires = new Date(issued.getTime() + index_js_1.config.walletChallengeMinutes * 60_000);
        const { host, uri } = this.domain();
        const statement = purpose === 'link'
            ? 'Link this wallet to my MedLedger account. This request does not cost anything and does not send a transaction.'
            : 'Sign in to MedLedger with this wallet. This request does not cost anything and does not send a transaction.';
        const message = [
            `${host} wants you to sign in with your Ethereum account:`,
            address,
            '',
            statement,
            '',
            `URI: ${uri}`,
            'Version: 1',
            `Chain ID: ${index_js_1.config.walletChainId}`,
            `Nonce: ${nonce}`,
            `Issued At: ${issued.toISOString()}`,
            `Expiration Time: ${expires.toISOString()}`
        ].join('\n');
        this.challenges.set(nonce, { purpose, address, userId, expiresAt: expires.getTime() });
        return { message, nonce, expiresAt: expires.toISOString() };
    }
    /** Checks the signed message and returns the wallet address that signed it (one use only). */
    verifyChallenge(message, signature, purpose, userId) {
        const nonce = /\nNonce: ([0-9a-f]{32})\n/.exec(String(message || ''))?.[1];
        const pending = nonce ? this.challenges.get(nonce) : undefined;
        if (!nonce || !pending || pending.purpose !== purpose)
            throw new WalletError('This sign-in request is unknown or was already used. Please try again.', 401);
        this.challenges.delete(nonce); // one attempt per message
        if (pending.expiresAt < Date.now())
            throw new WalletError('The signing request expired. Please try again.', 401);
        if (pending.userId && pending.userId !== userId)
            throw new WalletError('This request was issued to a different account.', 401);
        const { host } = this.domain();
        if (!message.startsWith(`${host} wants you to sign in`) || !message.includes(`\n${pending.address}\n`)) {
            throw new WalletError('The signed message was changed.', 401);
        }
        let recovered;
        try {
            recovered = ethers_1.ethers.verifyMessage(message, signature);
        }
        catch {
            throw new WalletError('The signature could not be read.', 401);
        }
        if (recovered !== pending.address)
            throw new WalletError('The signature does not match the wallet address.', 401);
        return recovered;
    }
    // ---------------- EIP-712 consent ----------------
    consentDomain() {
        const contract = this.publicConfig.contractAddress;
        return { name: 'MedLedger Consent', version: '1', chainId: index_js_1.config.walletChainId, ...(contract ? { verifyingContract: contract } : {}) };
    }
    createConsent(input) {
        this.sweep();
        const message = {
            ...input,
            patient: ethers_1.ethers.getAddress(input.patient),
            doctorWallet: ethers_1.ethers.getAddress(input.doctorWallet),
            nonce: crypto_1.default.randomBytes(16).toString('hex'),
            issuedAt: new Date().toISOString(),
            deadline: Math.floor(Date.now() / 1000) + index_js_1.config.walletChallengeMinutes * 60
        };
        this.challenges.set(message.nonce, { purpose: 'consent', address: message.patient, userId: input.patientId, expiresAt: message.deadline * 1000, consent: message });
        return { domain: this.consentDomain(), types: exports.CONSENT_TYPES, primaryType: 'Consent', message };
    }
    verifyConsent(nonce, signature, userId) {
        const pending = this.challenges.get(String(nonce || ''));
        if (!pending || pending.purpose !== 'consent' || !pending.consent)
            throw new WalletError('This consent request is unknown or was already used. Please try again.', 401);
        this.challenges.delete(nonce);
        if (pending.expiresAt < Date.now())
            throw new WalletError('The consent request expired. Please try again.', 401);
        if (pending.userId !== userId)
            throw new WalletError('This consent request belongs to a different account.', 403);
        let recovered;
        try {
            recovered = ethers_1.ethers.verifyTypedData(this.consentDomain(), exports.CONSENT_TYPES, pending.consent, signature);
        }
        catch {
            throw new WalletError('The signature could not be read.', 401);
        }
        if (recovered !== pending.consent.patient)
            throw new WalletError('The consent was not signed by your linked wallet.', 401);
        return pending.consent;
    }
    // ---------------- On-chain consent ----------------
    /**
     * Confirms that `txHash` is a successful grantAccess / revokeAccess call on our contract,
     * sent by `patientWallet` for `doctorWallet`. Each transaction can be used once.
     */
    async verifyConsentTx(txHash, action, patientWallet, doctorWallet) {
        const cfg = this.publicConfig;
        if (!cfg.contractAddress)
            throw new WalletError('No HealthRecords contract is configured (HEALTH_RECORDS_CONTRACT_ADDRESS).', 503);
        if (!/^0x[0-9a-fA-F]{64}$/.test(txHash))
            throw new WalletError('That is not a valid transaction hash.');
        if (this.usedTx.has(txHash.toLowerCase()))
            throw new WalletError('This transaction has already been used.', 409);
        const receipt = await this.getProvider().getTransactionReceipt(txHash);
        if (!receipt)
            throw new WalletError('The transaction was not found yet. Wait for it to be confirmed and try again.', 404);
        if (receipt.status !== 1)
            throw new WalletError('The transaction failed on the blockchain.', 422);
        if (!receipt.to || ethers_1.ethers.getAddress(receipt.to) !== cfg.contractAddress)
            throw new WalletError('The transaction was not sent to the MedLedger contract.', 422);
        if (ethers_1.ethers.getAddress(receipt.from) !== ethers_1.ethers.getAddress(patientWallet))
            throw new WalletError('The transaction was not sent from your linked wallet.', 403);
        const wanted = action === 'grant' ? 'AccessGranted' : 'AccessRevoked';
        const event = receipt.logs
            .filter((l) => ethers_1.ethers.getAddress(l.address) === cfg.contractAddress)
            .map((l) => {
            try {
                return iface.parseLog({ topics: [...l.topics], data: l.data });
            }
            catch {
                return null;
            }
        })
            .find((e) => e?.name === wanted);
        if (!event)
            throw new WalletError(`The transaction does not contain an ${wanted} event.`, 422);
        if (ethers_1.ethers.getAddress(event.args.patient) !== ethers_1.ethers.getAddress(patientWallet) || ethers_1.ethers.getAddress(event.args.doctor) !== ethers_1.ethers.getAddress(doctorWallet)) {
            throw new WalletError('The transaction is for a different patient or doctor.', 422);
        }
        this.usedTx.add(txHash.toLowerCase());
        return { txHash, blockNumber: receipt.blockNumber, chainId: index_js_1.config.walletChainId };
    }
    /** Calldata for grantAccess / revokeAccess, so the page can build the MetaMask transaction. */
    encodeConsentCall(action, doctorWallet) {
        return iface.encodeFunctionData(action === 'grant' ? 'grantAccess' : 'revokeAccess', [ethers_1.ethers.getAddress(doctorWallet)]);
    }
}
exports.walletService = new WalletService();

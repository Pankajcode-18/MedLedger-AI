"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockchainService = exports.BlockchainService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const index_js_1 = require("../config/index.js");
class BlockchainService {
    contractAddress;
    rpcUrl;
    defaultPrivateKey;
    isConnectedToSepolia = false;
    // Local simulated blockchain state for zero-gas execution
    simulatedBlocks = [];
    simulatedAccessControl = new Map();
    simulatedRecords = new Map();
    constructor() {
        this.contractAddress = index_js_1.config.contractAddress;
        this.rpcUrl = index_js_1.config.sepoliaRpcUrl;
        this.defaultPrivateKey = index_js_1.config.sepoliaPrivateKey;
        this.initGenesis();
    }
    initGenesis() {
        // Block #0: Genesis Block
        this.simulatedBlocks.push({
            blockNumber: 0,
            type: 'Root Genesis Block',
            timestamp: 'Network Genesis (Block #0)',
            previousHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            currentHash: '0x3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
            payload: {
                description: 'MedLedger Decentralized Medical Network Initialized on Ethereum Sepolia.',
                contract: 'HealthRecords.sol'
            }
        });
        // Block #1: Smart Contract Deployed
        this.simulatedBlocks.push({
            blockNumber: 1,
            type: 'Smart Contract Deployed',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            previousHash: '0x3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
            currentHash: '0x7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d',
            payload: {
                contract: 'HealthRecords.sol',
                functions: ['registerRecord', 'grantAccess', 'revokeAccess', 'verifyRecord']
            }
        });
        // Block #2: Patient Registered
        this.simulatedBlocks.push({
            blockNumber: 2,
            type: 'Patient Identity Registered',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            previousHash: '0x7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d',
            currentHash: '0xca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
            payload: {
                patientName: 'tanmay shishodia',
                patientId: '90',
                patientAddress: '0x495e7483db248DCA08B37121D15917Ae19D93C20'
            }
        });
        // Block #3: Encrypted Medical Record Anchored
        this.simulatedBlocks.push({
            blockNumber: 3,
            type: 'SHA-256 Medical Record Anchored',
            timestamp: new Date(Date.now() - 600000).toISOString(),
            previousHash: '0xca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
            currentHash: '0x4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce',
            payload: {
                fileHash: '0x04a21f8828d1556e472ac7c4474fb99ad8fb873121ea69cfdc618d17284d5095',
                fileName: 'hp9.docx',
                patientId: '90'
            }
        });
        // Pre-seed test record
        this.simulatedRecords.set('0x04a21f8828d1556e472ac7c4474fb99ad8fb873121ea69cfdc618d17284d5095', {
            patientAddress: '0x495e7483db248DCA08B37121D15917Ae19D93C20',
            timestamp: Date.now() - 600000
        });
    }
    deriveAddress(identifier) {
        const hash = crypto_1.default.createHash('sha256').update(String(identifier)).digest('hex');
        return `0x${hash.substring(0, 40)}`;
    }
    calculateSHA256(data) {
        const hash = crypto_1.default.createHash('sha256').update(data).digest('hex');
        return hash.startsWith('0x') ? hash : `0x${hash}`;
    }
    async registerRecord(fileHash, patientAddress, patientId) {
        const pAddress = patientAddress || (patientId ? this.deriveAddress(patientId) : this.deriveAddress('system'));
        const prevBlock = this.simulatedBlocks[this.simulatedBlocks.length - 1];
        const prevHash = prevBlock ? prevBlock.currentHash : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const currentHash = this.calculateSHA256(`${prevHash}-${fileHash}-${Date.now()}`);
        const newBlock = {
            blockNumber: this.simulatedBlocks.length,
            type: 'SHA-256 Medical Record Anchored',
            timestamp: new Date().toISOString(),
            previousHash: prevHash,
            currentHash: currentHash,
            payload: {
                fileHash,
                patientAddress: pAddress,
                patientId: patientId || 'unknown'
            }
        };
        this.simulatedBlocks.push(newBlock);
        this.simulatedRecords.set(fileHash, { patientAddress: pAddress, timestamp: Date.now() });
        return {
            txHash: currentHash,
            blockNumber: newBlock.blockNumber
        };
    }
    async grantAccess(patientId, doctorIdentifier) {
        const key = `${patientId}-${doctorIdentifier}`;
        this.simulatedAccessControl.set(key, true);
        const prevBlock = this.simulatedBlocks[this.simulatedBlocks.length - 1];
        const prevHash = prevBlock ? prevBlock.currentHash : '0x0';
        const txHash = this.calculateSHA256(`grant-${key}-${Date.now()}`);
        this.simulatedBlocks.push({
            blockNumber: this.simulatedBlocks.length,
            type: 'Doctor Access Permission Granted',
            timestamp: new Date().toISOString(),
            previousHash: prevHash,
            currentHash: txHash,
            payload: {
                patientId,
                doctorId: doctorIdentifier,
                action: 'GRANT_ACCESS'
            }
        });
        return txHash;
    }
    async revokeAccess(patientId, doctorIdentifier) {
        const key = `${patientId}-${doctorIdentifier}`;
        this.simulatedAccessControl.set(key, false);
        const prevBlock = this.simulatedBlocks[this.simulatedBlocks.length - 1];
        const prevHash = prevBlock ? prevBlock.currentHash : '0x0';
        const txHash = this.calculateSHA256(`revoke-${key}-${Date.now()}`);
        this.simulatedBlocks.push({
            blockNumber: this.simulatedBlocks.length,
            type: 'Doctor Access Permission Revoked',
            timestamp: new Date().toISOString(),
            previousHash: prevHash,
            currentHash: txHash,
            payload: {
                patientId,
                doctorId: doctorIdentifier,
                action: 'REVOKE_ACCESS'
            }
        });
        return txHash;
    }
    async hasAccess(patientId, doctorIdentifier) {
        const key = `${patientId}-${doctorIdentifier}`;
        if (this.simulatedAccessControl.has(key)) {
            return this.simulatedAccessControl.get(key) === true;
        }
        return false;
    }
    async verifyRecord(fileHash) {
        if (!fileHash)
            return false;
        const normalized = fileHash.toLowerCase();
        for (const block of this.simulatedBlocks) {
            const p = (block.data || block.payload || {});
            if (p && p.fileHash && String(p.fileHash).toLowerCase() === normalized) {
                return true;
            }
        }
        return this.simulatedRecords.has(fileHash);
    }
    getBlocks() {
        return this.simulatedBlocks;
    }
}
exports.BlockchainService = BlockchainService;
exports.blockchainService = new BlockchainService();

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockchainController = exports.BlockchainController = void 0;
const blockchainService_js_1 = require("../services/blockchainService.js");
class BlockchainController {
    async getBlocks(_req, res) {
        try {
            const blocks = blockchainService_js_1.blockchainService.getBlocks();
            res.status(200).json(blocks);
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
    async verifyRecord(req, res) {
        try {
            const hashParam = req.params.sha256Hash || req.query.fileHash || req.body.fileHash;
            if (!hashParam) {
                res.status(400).json({ success: false, error: 'SHA-256 fingerprint is required.' });
                return;
            }
            const isVerified = await blockchainService_js_1.blockchainService.verifyRecord(hashParam);
            res.status(200).json({
                success: true,
                verified: isVerified,
                status: isVerified ? 'VERIFIED_INTACT_ON_CHAIN' : 'UNVERIFIED_OR_MODIFIED',
                message: isVerified
                    ? 'Digital fingerprint verified on the blockchain. This document is authentic and untouched.'
                    : 'Fingerprint could not be matched. The document may have been altered or not yet recorded.'
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
}
exports.BlockchainController = BlockchainController;
exports.blockchainController = new BlockchainController();

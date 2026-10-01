import { Request, Response } from 'express';
import { blockchainService } from '../services/blockchainService.js';
import { stateStore } from '../models/stateStore.js';

export class BlockchainController {
  public async getBlocks(_req: Request, res: Response): Promise<void> {
    try {
      const blocks = blockchainService.getBlocks();
      res.status(200).json(blocks);
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  /** GET /api/blockchain/status (admin): where the history is written and whether its links are intact. */
  public async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const entries = blockchainService.getBlocks();
      const onChain = entries.filter((b) => b.chain);
      res.status(200).json({
        success: true,
        data: {
          ...blockchainService.networkInfo(),
          ...blockchainService.verifyChain(),
          chain: {
            confirmed: onChain.filter((b) => b.chain?.status === 'confirmed').length,
            waiting: onChain.filter((b) => b.chain?.status === 'queued' || b.chain?.status === 'sent').length,
            failed: onChain.filter((b) => b.chain?.status === 'failed').length
          }
        }
      });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  public async verifyRecord(req: Request, res: Response): Promise<void> {
    try {
      const hashParam = req.params.sha256Hash || (req.query.fileHash as string) || (req.body.fileHash as string);
      if (!hashParam) {
        res.status(400).json({ success: false, error: 'Enter a file fingerprint or report ID to check.' });
        return;
      }

      const raw = String(hashParam).trim().toLowerCase();
      const fileHash = /^[0-9a-f]{64}$/.test(raw) ? `0x${raw}` : raw;
      if (!/^0x[0-9a-f]{64}$/.test(fileHash)) {
        res.status(400).json({ success: false, error: 'A file fingerprint is 64 letters and numbers (0–9, a–f), optionally starting with 0x.' });
        return;
      }

      const anchored = await blockchainService.verifyRecord(fileHash);
      const history = blockchainService.recordStatus(fileHash);
      const stored = stateStore.getState().reports.find((r) => String(r.fileHash || '').toLowerCase() === fileHash);
      const isVerified = anchored || Boolean(stored);

      res.status(200).json({
        success: true,
        verified: isVerified,
        anchored,
        knownRecord: Boolean(stored),
        recordedAt: stored?.createdAt || history.recordedAt || null,
        historyEntry: history.entry,
        chain: history.chain,
        status: isVerified ? 'FINGERPRINT_FOUND' : 'FINGERPRINT_NOT_FOUND',
        message: isVerified
          ? 'This fingerprint matches a file stored in MedLedger. If your copy gives the same fingerprint, it has not been changed.'
          : 'No stored file has this fingerprint. The copy you have may have been changed, or it was never uploaded here.'
      });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }
}

export const blockchainController = new BlockchainController();

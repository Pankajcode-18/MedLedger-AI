import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { userStore } from './services/userStore.js';
import { migrateLegacyRecords } from './services/recordMigration.js';
import { keyService } from './services/keyService.js';
import { textExtraction } from './services/textExtraction.js';
import { shutdownOcr } from './services/documentText.js';
import { blockchainService } from './services/blockchainService.js';
import { stateStore } from './models/stateStore.js';

const app = createApp();

async function startServer(): Promise<void> {
  try {
    // Attempt MongoDB connection
    try {
      await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 5000 });
      console.log(`[MongoDB] Connected successfully to ${config.mongodbUri}`);
    } catch (dbErr: unknown) {
      console.warn(
        `[MongoDB] Warning: Could not connect to MongoDB (${(dbErr as Error).message}). Using persistent state store fallback.`
      );
    }

    // Encrypted storage: load the master key (fails fast in production if it is missing)
    console.log(`[Storage] Master key ${keyService.currentKeyId} loaded from ${keyService.source}.`);
    await migrateLegacyRecords();
    // read text (PDF / OCR) from stored files that have not been read yet
    textExtraction.backfill();

    // Demo accounts (login page quick-access) are stored as real bcrypt-hashed users
    const seeded = await userStore.seedDemoAccounts();
    if (seeded > 0) console.log(`[Auth] Seeded ${seeded} demo account(s). Set DEMO_ACCOUNTS=false to disable.`);

    // record history: load it, add entries for anything older, re-send anything that had not reached the chain
    blockchainService.init();
    const net = blockchainService.networkInfo();
    const check = blockchainService.verifyChain();
    console.log(
      net.mode === 'contract'
        ? `[Ledger] Writing to the HealthRecords contract ${net.contractAddress} on ${net.network} (chain ${net.chainId}).`
        : '[Ledger] No contract configured: the record history is kept on this server only (see README → Blockchain).'
    );
    console.log(`[Ledger] ${check.entries} entries, links ${check.intact ? 'intact' : `broken at entry #${check.firstBroken}`}.`);

    const server = app.listen(config.port, () => {
      console.log(`[MedLedger AI] TypeScript Express Server running on http://localhost:${config.port}`);
      console.log(`[MedLedger AI] Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown: stop taking requests, write pending state and audit lines, then exit
    const stop = (signal: string) => {
      console.log(`${signal} received: closing HTTP server.`);
      server.close(async () => {
        await stateStore.flush().catch(() => undefined);
        void shutdownOcr();
        await mongoose.connection.close().catch(() => undefined);
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => stop('SIGTERM'));
    process.on('SIGINT', () => stop('SIGINT'));
  } catch (err: unknown) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();

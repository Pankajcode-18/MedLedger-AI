"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const app_js_1 = require("./app.js");
const index_js_1 = require("./config/index.js");
const userStore_js_1 = require("./services/userStore.js");
const recordMigration_js_1 = require("./services/recordMigration.js");
const keyService_js_1 = require("./services/keyService.js");
const textExtraction_js_1 = require("./services/textExtraction.js");
const documentText_js_1 = require("./services/documentText.js");
const app = (0, app_js_1.createApp)();
async function startServer() {
    try {
        // Attempt MongoDB connection
        try {
            await mongoose_1.default.connect(index_js_1.config.mongodbUri, { serverSelectionTimeoutMS: 5000 });
            console.log(`[MongoDB] Connected successfully to ${index_js_1.config.mongodbUri}`);
        }
        catch (dbErr) {
            console.warn(`[MongoDB] Warning: Could not connect to MongoDB (${dbErr.message}). Using persistent state store fallback.`);
        }
        // Encrypted storage: load the master key (fails fast in production if it is missing)
        console.log(`[Storage] Master key ${keyService_js_1.keyService.currentKeyId} loaded from ${keyService_js_1.keyService.source}.`);
        await (0, recordMigration_js_1.migrateLegacyRecords)();
        // read text (PDF / OCR) from stored files that have not been read yet
        textExtraction_js_1.textExtraction.backfill();
        // Demo accounts (login page quick-access) are stored as real bcrypt-hashed users
        const seeded = await userStore_js_1.userStore.seedDemoAccounts();
        if (seeded > 0)
            console.log(`[Auth] Seeded ${seeded} demo account(s). Set DEMO_ACCOUNTS=false to disable.`);
        const server = app.listen(index_js_1.config.port, () => {
            console.log(`[MedLedger AI] TypeScript Express Server running on http://localhost:${index_js_1.config.port}`);
            console.log(`[MedLedger AI] Environment: ${index_js_1.config.nodeEnv}`);
            console.log(`[Blockchain] Verified Ethereum Sepolia Engine Ready`);
        });
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM signal received: closing HTTP server.');
            server.close(() => {
                void (0, documentText_js_1.shutdownOcr)();
                mongoose_1.default.connection.close();
                process.exit(0);
            });
        });
    }
    catch (err) {
        console.error('[Server] Fatal startup error:', err);
        process.exit(1);
    }
}
startServer();

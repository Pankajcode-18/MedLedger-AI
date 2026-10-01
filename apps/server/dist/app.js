"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const mongoose_1 = __importDefault(require("mongoose"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authRoutes_js_1 = __importDefault(require("./routes/authRoutes.js"));
const recordRoutes_js_1 = __importDefault(require("./routes/recordRoutes.js"));
const accessRoutes_js_1 = __importDefault(require("./routes/accessRoutes.js"));
const aiRoutes_js_1 = __importDefault(require("./routes/aiRoutes.js"));
const vitalsRoutes_js_1 = __importDefault(require("./routes/vitalsRoutes.js"));
const walletRoutes_js_1 = __importDefault(require("./routes/walletRoutes.js"));
const blockchainRoutes_js_1 = __importDefault(require("./routes/blockchainRoutes.js"));
const adminRoutes_js_1 = __importDefault(require("./routes/adminRoutes.js"));
const legacyRoutes_js_1 = __importDefault(require("./routes/legacyRoutes.js"));
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const index_js_1 = require("./config/index.js");
function createApp() {
    const app = (0, express_1.default)();
    // 1. Security Headers
    app.use((0, helmet_1.default)());
    // 2. CORS configuration
    // Only the configured front-end origins may call the API from a browser (CLIENT_ORIGINS in .env).
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            // Non-browser clients (curl, tests, server-to-server) send no Origin header
            if (!origin || index_js_1.config.clientOrigins.includes(origin))
                return callback(null, true);
            return callback(null, false);
        },
        credentials: false,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));
    // 3. Rate limiting (15 min window, 500 requests for local dev / testing)
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 500,
        skip: () => index_js_1.config.nodeEnv === 'development' || index_js_1.config.nodeEnv === 'test',
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests from this IP. Please try again in 15 minutes.' }
    });
    app.use(limiter);
    // 4. Request logging & body parsing
    if (index_js_1.config.nodeEnv !== 'test') {
        app.use((0, morgan_1.default)('dev'));
    }
    app.use(express_1.default.json({ limit: '50mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
    // 5. Health check endpoint
    app.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            mongoConnected: mongoose_1.default.connection.readyState === 1,
            network: 'Ethereum Sepolia (Local Verification Active)'
        });
    });
    // 6. Mount modular API routes
    app.use('/api/auth', authRoutes_js_1.default);
    app.use('/api/records', recordRoutes_js_1.default);
    app.use('/api/access', accessRoutes_js_1.default);
    app.use('/api/ai', aiRoutes_js_1.default);
    app.use('/api/vitals', vitalsRoutes_js_1.default);
    app.use('/api/wallet', walletRoutes_js_1.default);
    app.use('/api/blockchain', blockchainRoutes_js_1.default);
    app.use('/api/admin', adminRoutes_js_1.default);
    // 7. Mount legacy compatibility routes
    app.use('/', legacyRoutes_js_1.default);
    // 8. Global error handling
    app.use(errorHandler_js_1.errorHandler);
    return app;
}

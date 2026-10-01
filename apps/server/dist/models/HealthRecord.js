"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthRecord = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const HealthRecordSchema = new mongoose_1.Schema({
    reportId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    fileHash: { type: String, required: true, index: true },
    iv: { type: String, default: '' },
    authTag: { type: String, default: '' },
    wrappedKey: { type: String, default: '' },
    storageBackend: { type: String, default: '' },
    storageRef: { type: String, default: '' },
    ciphertextSha256: { type: String, default: '' },
    fileType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    gridFsFileId: { type: mongoose_1.Schema.Types.ObjectId, required: false },
    blockchainTxHash: { type: String, default: '' },
    uploadedBy: { type: String, default: '' },
    uploaderRole: { type: String, default: '' },
    type: { type: String, default: 'report' },
    isAsked: { type: String, default: '0' },
    isGiven: { type: String, default: '0' },
    aiAnalysis: { type: mongoose_1.Schema.Types.Mixed, default: null },
    authorizedUsers: { type: [String], default: [] },
    authorizedDoctors: { type: [String], default: [] },
    reportDate: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});
exports.HealthRecord = mongoose_1.default.models.HealthRecord || mongoose_1.default.model('HealthRecord', HealthRecordSchema);

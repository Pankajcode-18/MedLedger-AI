"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.singleUpload = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const index_js_1 = require("../config/index.js");
/** Files are held in memory only long enough to be validated and encrypted — never written unencrypted. */
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: index_js_1.config.uploadMaxMb * 1024 * 1024,
        files: 1,
        fields: 20,
        fieldSize: 64 * 1024
    }
});
/** Single-file upload with friendly errors (413 for too large, 400 for malformed forms). */
const singleUpload = (field) => (req, res, next) => {
    exports.upload.single(field)(req, res, (err) => {
        if (!err)
            return next();
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                res.status(413).json({ success: false, error: `The file is larger than the ${index_js_1.config.uploadMaxMb} MB limit.` });
                return;
            }
            res.status(400).json({ success: false, error: `Upload problem: ${err.message}.` });
            return;
        }
        next(err);
    });
};
exports.singleUpload = singleUpload;

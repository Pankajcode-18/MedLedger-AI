"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, _next) {
    console.error('[Error]', err.message);
    res.status(500).json({
        success: false,
        error: err.message || 'An unexpected error occurred. Please try again.'
    });
}

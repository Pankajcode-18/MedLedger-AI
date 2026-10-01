"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const tokenService_js_1 = require("../services/tokenService.js");
const ADMIN_ROLES = ['admin', 'system-admin'];
/**
 * Requires a valid access token. Optionally restricts the route to specific roles
 * (administrators are always allowed).
 *  401 = not signed in / token invalid, expired, revoked or issued before a password change
 *  403 = signed in but the role is not allowed
 */
function authMiddleware(allowedRoles) {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Authentication required. Please sign in to continue.'
            });
            return;
        }
        const token = authHeader.substring(7).trim();
        try {
            const user = await tokenService_js_1.tokenService.verify(token);
            req.user = user;
            if (allowedRoles) {
                const roles = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map((r) => r.toLowerCase());
                const userRole = (user.role || '').toLowerCase();
                if (!roles.includes(userRole) && !ADMIN_ROLES.includes(userRole)) {
                    res.status(403).json({
                        success: false,
                        error: 'You do not have permission to access this resource.'
                    });
                    return;
                }
            }
            next();
        }
        catch (err) {
            res.status(401).json({
                success: false,
                error: err instanceof tokenService_js_1.TokenError
                    ? err.message
                    : 'Your session has expired or the token is invalid. Please sign in again.'
            });
        }
    };
}

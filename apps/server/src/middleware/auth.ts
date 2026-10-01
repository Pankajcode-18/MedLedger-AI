import { Response, NextFunction } from 'express';
import { tokenService, TokenError } from '../services/tokenService.js';
import { AuthenticatedRequest, UserRole } from '../types/index.js';

const ADMIN_ROLES: UserRole[] = ['admin', 'system-admin'];

/**
 * Requires a valid access token. Optionally restricts the route to specific roles
 * (administrators are always allowed).
 *  401 = not signed in / token invalid, expired, revoked or issued before a password change
 *  403 = signed in but the role is not allowed
 */
export function authMiddleware(allowedRoles?: UserRole | UserRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Please sign in to continue.'
      });
      return;
    }

    const token = authHeader.substring(7).trim();

    try {
      const user = await tokenService.verify(token);
      req.user = user;

      if (allowedRoles) {
        const roles = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map((r) => r.toLowerCase());
        const userRole = (user.role || '').toLowerCase() as UserRole;
        if (!roles.includes(userRole) && !ADMIN_ROLES.includes(userRole)) {
          res.status(403).json({
            success: false,
            error: "You don't have permission to open this page. Sign in with an account that can."
          });
          return;
        }
      }

      next();
    } catch (err) {
      res.status(401).json({
        success: false,
        error:
          err instanceof TokenError
            ? err.message
            : 'Your sign-in has expired. Please sign in again.'
      });
    }
  };
}

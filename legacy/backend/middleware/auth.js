'use strict';

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'ehr_super_secret_jwt_key_2026_sepolia';

/**
 * Role-Based Access Control & JWT Authentication Middleware
 * @param {string|string[]} requiredRole - Single role string or array of allowed roles
 */
function authMiddleware(requiredRole) {
  return (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];

      if (!authHeader) {
        return res.status(401).json({
          error: 'Access denied. No Authorization header provided.'
        });
      }

      // Extract JWT from "Authorization: Bearer <token>"
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return res.status(401).json({
          error: 'Access denied. Malformed token format. Expected: Bearer <token>.'
        });
      }

      const token = parts[1];

      // Verify token with JWT_SECRET from .env
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          error: 'Access denied. Invalid or expired token.',
          details: err.message
        });
      }

      // Attach decoded user info to req.user for downstream use
      req.user = decoded;

      // Check role authorization if requiredRole is specified
      if (requiredRole) {
        const allowedRoles = Array.isArray(requiredRole)
          ? requiredRole.map(r => r.toLowerCase())
          : [requiredRole.toLowerCase()];

        const userRole = (decoded.role || '').toLowerCase();

        if (!allowedRoles.includes(userRole)) {
          return res.status(403).json({
            error: `Access forbidden. Role '${decoded.role}' does not have permission for this resource. Required role(s): ${allowedRoles.join(', ')}.`,
            userRole: decoded.role,
            requiredRole
          });
        }
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Internal server error during authentication verification.',
        details: error.message
      });
    }
  };
}

module.exports = {
  authMiddleware,
  JWT_SECRET
};

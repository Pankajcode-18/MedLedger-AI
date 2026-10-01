'use strict';

// Standalone Server Wrapper running Express app with JWT, RBAC, Helmet, Rate Limiter & Ethereum Sepolia
const app = require('./app');

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`EHR Standalone Express Server running on http://localhost:${PORT}`);
});

module.exports = server;

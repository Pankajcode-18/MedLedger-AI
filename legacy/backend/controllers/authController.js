'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const blockchainService = require('../services/blockchainService');
const encryptionService = require('../services/encryptionService');
let User;
try {
  User = require('../models/User');
} catch (e) {
  User = null;
}
const { JWT_SECRET } = require('../middleware/auth');

const STATE_FILE = path.join(__dirname, '..', '..', 'web-app', 'server', 'state.json');

const VALID_ROLES = ['patient', 'doctor', 'hospital', 'lab', 'admin', 'insurance'];
const BCRYPT_SALT_ROUNDS = 10;

// Helper to load state
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (!parsed.users) parsed.users = [];
      return parsed;
    } catch (e) {
      console.error('[authController] Error reading state.json:', e);
    }
  }
  return { patients: [], doctors: [], reports: [], blocks: [], users: [] };
}

// Helper to save state
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('[authController] Error saving state.json:', e);
  }
}

// Ensure default seed users for all 6 roles exist with bcrypt hashes
(async function seedDefaultUsers() {
  try {
    const state = loadState();
    let updated = false;

    const seedAccounts = [
      {
        userId: '90',
        email: 'patient@ehr.com',
        altEmail: '123@gmail.com',
        plainPassword: 'patient123',
        role: 'patient',
        name: 'Tanmay Shishodia (Patient)',
        walletAddress: blockchainService.deriveAddress('90')
      },
      {
        userId: '1593418229676',
        email: 'doctor@hospital.org',
        altEmail: 'house@princeton.edu',
        plainPassword: 'doctor123',
        role: 'doctor',
        name: 'Dr. Gregory House',
        walletAddress: blockchainService.deriveAddress('1593418229676')
      },
      {
        userId: 'hosp_st_jude_01',
        email: 'hospital@health.org',
        altEmail: 'admin@generalhospital.org',
        plainPassword: 'hospital123',
        role: 'hospital',
        name: 'Metro General Hospital Admin',
        walletAddress: blockchainService.deriveAddress('hosp_st_jude_01')
      },
      {
        userId: 'lab_diagnostics_01',
        email: 'lab@biolab.com',
        altEmail: 'diagnostics@metrolabs.com',
        plainPassword: 'lab123',
        role: 'lab',
        name: 'Apex Diagnostic Pathology Lab',
        walletAddress: blockchainService.deriveAddress('lab_diagnostics_01')
      },
      {
        userId: 'admin_sys_01',
        email: 'admin@ehr.org',
        altEmail: 'superadmin@ehr.org',
        plainPassword: 'admin123',
        role: 'admin',
        name: 'Global EHR System Administrator',
        walletAddress: blockchainService.deriveAddress('admin_sys_01')
      },
      {
        userId: 'ins_healthshield_01',
        email: 'insurance@healthshield.com',
        altEmail: 'claims@healthshield.com',
        plainPassword: 'insurance123',
        role: 'insurance',
        name: 'HealthShield Medical Insurance Corp',
        walletAddress: blockchainService.deriveAddress('ins_healthshield_01')
      }
    ];

      for (const acc of seedAccounts) {
      let existing = state.users.find(u =>
        u.email.toLowerCase() === acc.email.toLowerCase() ||
        (acc.altEmail && u.email.toLowerCase() === acc.altEmail.toLowerCase()) ||
        u.userId === acc.userId
      );
      if (!existing) {
        const passwordHash = await bcrypt.hash(acc.plainPassword, BCRYPT_SALT_ROUNDS);
        const encryptionKey = encryptionService.generateUserKey();
        const seededUser = {
          userId: acc.userId,
          email: acc.email,
          role: acc.role,
          name: acc.name,
          walletAddress: acc.walletAddress,
          passwordHash,
          encryptionKey,
          createdAt: new Date().toISOString()
        };
        state.users.push(seededUser);
        updated = true;
        if (User) {
          try {
            await User.findOneAndUpdate({ userId: acc.userId }, seededUser, { upsert: true });
          } catch (e) {}
        }
      } else if (!existing.encryptionKey) {
        existing.encryptionKey = encryptionService.generateUserKey();
        updated = true;
        if (User) {
          try {
            await User.findOneAndUpdate({ userId: existing.userId }, { encryptionKey: existing.encryptionKey });
          } catch (e) {}
        }
      }
    }

    if (updated) {
      saveState(state);
      console.log('[authController] Default seed accounts initialized for 6 roles');
    }
  } catch (err) {
    console.warn('[authController] Seed warning:', err.message);
  }
})();

/**
 * POST /api/auth/register
 * Request body: { email, password, role, name, ... }
 * - Hashes password with bcrypt (10 rounds)
 * - Derives / assigns walletAddress
 * - Persists user in state.json
 * - Returns JWT with { userId, role, walletAddress }
 */
async function register(req, res) {
  try {
    const { email, password, role, name, phone, adharNo, licenseId } = req.body;

    // 1. Validation
    if (!email || !password || !role) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, and role are mandatory.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase();

    if (!VALID_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        error: `Invalid role: '${role}'. Allowed roles are: ${VALID_ROLES.join(', ')}.`
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long.'
      });
    }

    const state = loadState();

    // 2. Check for duplicate email - if exists, return existing user with token for idempotency
    const existingUser = state.users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (existingUser) {
      const tokenPayload = {
        userId: existingUser.userId,
        email: existingUser.email,
        role: existingUser.role,
        walletAddress: existingUser.walletAddress
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
      return res.status(200).json({
        message: 'User already registered, authenticated',
        token,
        userId: existingUser.userId,
        role: existingUser.role,
        walletAddress: existingUser.walletAddress,
        user: {
          userId: existingUser.userId,
          email: existingUser.email,
          role: existingUser.role,
          walletAddress: existingUser.walletAddress,
          name: existingUser.name
        }
      });
    }

    // 3. Hash password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 4. Generate user ID and derive Ethereum wallet address
    const userId = req.body.userId || Date.now().toString();
    const walletAddress = req.body.walletAddress || blockchainService.deriveAddress(userId);

    const encryptionKey = encryptionService.generateUserKey();

    const newUser = {
      userId,
      email: normalizedEmail,
      role: normalizedRole,
      name: name || `${normalizedRole.toUpperCase()} User`,
      phone: phone || '',
      walletAddress,
      passwordHash,
      encryptionKey,
      createdAt: new Date().toISOString()
    };

    state.users.push(newUser);

    if (User) {
      try {
        await User.findOneAndUpdate({ userId }, newUser, { upsert: true, new: true });
      } catch (dbErr) {
        console.warn('[authController] Warning syncing user to MongoDB:', dbErr.message);
      }
    }

    // Keep patients / doctors lists in sync if applicable
    if (normalizedRole === 'patient') {
      const existingPat = state.patients.find(p => p.patientId === userId || p.email === normalizedEmail);
      if (!existingPat) {
        state.patients.push({
          patientId: userId,
          adharNo: adharNo || 'XXXXXXXXXXXX',
          name: newUser.name,
          email: normalizedEmail,
          age: req.body.age || '30',
          phNo: phone || '',
          address: req.body.address || 'N/A',
          city: req.body.city || 'N/A',
          reportFile: 'medical_record.docx',
          ethereumAddress: walletAddress,
          type: 'patient'
        });
      }
    } else if (normalizedRole === 'doctor') {
      const existingDoc = state.doctors.find(d => d.doctorId === userId || d.email === normalizedEmail);
      if (!existingDoc) {
        state.doctors.push({
          doctorId: userId,
          licenseId: licenseId || `DOC-${Date.now()}`,
          name: newUser.name,
          email: normalizedEmail,
          age: req.body.age || '40',
          phNo: phone || '',
          ethereumAddress: walletAddress,
          type: 'doctor'
        });
      }
    }

    saveState(state);

    // 5. Generate JWT containing { userId, role, walletAddress }
    const tokenPayload = {
      userId: newUser.userId,
      email: newUser.email,
      role: newUser.role,
      walletAddress: newUser.walletAddress
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      userId: newUser.userId,
      role: newUser.role,
      walletAddress: newUser.walletAddress,
      user: {
        userId: newUser.userId,
        email: newUser.email,
        role: newUser.role,
        walletAddress: newUser.walletAddress,
        name: newUser.name
      }
    });
  } catch (error) {
    console.error('[authController.register] Error:', error);
    return res.status(500).json({
      error: 'Registration failed due to server error',
      details: error.message
    });
  }
}

/**
 * POST /api/auth/login
 * Request body: { email, password }
 * - Finds user by email
 * - bcrypt.compare
 * - Returns JWT with { userId, role, walletAddress }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields: email and password are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const state = loadState();

    // Find user in state.users
    let user = state.users.find(u => u.email.toLowerCase() === normalizedEmail);

    // If not found in users, check patients or doctors fallback
    if (!user) {
      const pat = state.patients.find(p => (p.email && p.email.toLowerCase() === normalizedEmail) || p.patientId === email);
      if (pat) {
        // Create user entry for this patient
        const passwordHash = await bcrypt.hash(password === 'secret99' ? 'secret99' : password, BCRYPT_SALT_ROUNDS);
        user = {
          userId: pat.patientId,
          email: pat.email || `${pat.patientId}@ehr.com`,
          role: 'patient',
          name: pat.name,
          walletAddress: pat.ethereumAddress || blockchainService.deriveAddress(pat.patientId),
          passwordHash
        };
        state.users.push(user);
        saveState(state);
      } else {
        const doc = state.doctors.find(d => (d.email && d.email.toLowerCase() === normalizedEmail) || d.doctorId === email);
        if (doc) {
          const passwordHash = await bcrypt.hash(password === 'doctor99' ? 'doctor99' : password, BCRYPT_SALT_ROUNDS);
          user = {
            userId: doc.doctorId,
            email: doc.email || `${doc.doctorId}@hospital.org`,
            role: 'doctor',
            name: doc.name,
            walletAddress: doc.ethereumAddress || blockchainService.deriveAddress(doc.doctorId),
            passwordHash
          };
          state.users.push(user);
          saveState(state);
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    // Verify password with bcrypt.compare
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    // Sign JWT containing { userId, role, walletAddress }
    const tokenPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    if (!user.encryptionKey) {
      user.encryptionKey = encryptionService.generateUserKey();
      saveState(state);
    }

    return res.json({
      message: 'Login successful',
      token,
      userId: user.userId,
      role: user.role,
      walletAddress: user.walletAddress,
      user: {
        userId: user.userId,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        name: user.name,
        encryptionKey: user.encryptionKey
      }
    });
  } catch (error) {
    console.error('[authController.login] Error:', error);
    return res.status(500).json({
      error: 'Login failed due to server error',
      details: error.message
    });
  }
}

module.exports = {
  register,
  login,
  VALID_ROLES
};

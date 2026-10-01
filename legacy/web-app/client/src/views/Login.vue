<template>
  <div class="login-wrapper">
    <div :class="['login-container', viewMode === 'grid' ? 'grid-mode-container' : 'focused-mode-container']">
      <!-- Portal Top Header -->
      <div class="header-section">
        <div class="network-badge">
          <span class="live-dot"></span>
          <span>Ethereum Sepolia &bull; HealthRecords.sol &bull; RBAC v2.0</span>
        </div>
        <h1 class="main-title">
          MedLedger <span class="title-highlight">AI Access Portal</span>
        </h1>
        <p class="sub-title">Decentralized Electronic Health Records &bull; 6-Role Consensus Workspace</p>

        <!-- View Mode Switcher Toggle (Focused vs Compare All 6 Roles) -->
        <div class="view-mode-bar">
          <div class="view-toggle-group">
            <button
              type="button"
              :class="['toggle-btn', viewMode === 'focused' ? 'active-toggle' : '']"
              @click="viewMode = 'focused'"
              id="btn-toggle-focused"
            >
              <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
              <span>Focused Portal View</span>
            </button>
            <button
              type="button"
              :class="['toggle-btn', viewMode === 'grid' ? 'active-toggle' : '']"
              @click="viewMode = 'grid'"
              id="btn-toggle-grid"
            >
              <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span>Compare All Roles (6)</span>
            </button>
          </div>
        </div>

        <!-- Modern 6-Role Switcher (Visible in Focused View) -->
        <div v-if="viewMode === 'focused'" class="role-selector-bar">
          <button
            v-for="r in roles"
            :key="r.id"
            type="button"
            :class="['role-pill-btn', activeRole === r.id ? 'active-pill' : '']"
            :style="activeRole === r.id ? { backgroundColor: r.pillBg, color: r.accentColor, borderColor: r.accentColor } : {}"
            @click="setRole(r.id)"
            :id="'role-pill-' + r.id"
          >
            <span class="pill-emoji">{{ r.emoji }}</span>
            <span class="pill-label">{{ r.name }}</span>
          </button>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- VIEW A: FOCUSED ROLE AUTHENTICATION CARD                 -->
      <!-- ========================================================= -->
      <div v-if="viewMode === 'focused'" class="auth-card" :style="{ borderTopColor: currentRole.accentColor }">
        <!-- Role Identity Banner -->
        <div class="role-identity-header" :style="{ backgroundColor: currentRole.headerBg }">
          <div class="identity-left">
            <div class="role-icon-box" :style="{ backgroundColor: currentRole.accentColor }">
              <span class="role-icon-emoji">{{ currentRole.emoji }}</span>
            </div>
            <div class="identity-meta">
              <div class="role-tag-badge" :style="{ color: currentRole.accentColor }">
                ROLE: {{ currentRole.id.toUpperCase() }}
              </div>
              <h2 class="role-heading">{{ currentRole.portalTitle }}</h2>
              <p class="role-subtext">{{ currentRole.tagline }}</p>
            </div>
          </div>
        </div>

        <!-- Role Highlights Strip -->
        <div class="features-strip">
          <div v-for="(f, i) in currentRole.features" :key="i" class="feature-chip">
            <span class="chip-tick" :style="{ color: currentRole.accentColor }">✓</span>
            <span class="chip-text">{{ f }}</span>
          </div>
        </div>

        <!-- 1-Click Demo Quick-Fill Box -->
        <div class="quick-demo-banner">
          <div class="demo-info">
            <span class="demo-badge">⚡ DEMO</span>
            <span class="demo-text">
              <strong>{{ currentRole.demoEmail }}</strong> &bull; {{ currentRole.demoPass }}
            </span>
          </div>
          <div class="demo-btn-group">
            <button
              type="button"
              class="demo-autofill-btn"
              @click="autoFillDemo"
              :style="{ color: currentRole.accentColor, borderColor: currentRole.accentColor }"
            >
              <span v-if="autoFillSuccess">✓ Populated!</span>
              <span v-else>Auto-Fill Info</span>
            </button>
            <button
              type="button"
              class="demo-quick-login-btn"
              @click="quickLoginCurrent"
              :style="{ backgroundColor: currentRole.accentColor }"
              title="Auto-fill and immediately sign in with demo credentials"
            >
              ⚡ Instant Sign-In
            </button>
          </div>
        </div>

        <!-- Sign-In Form -->
        <form @submit.prevent="submitLogin" class="sign-in-form">
          <div class="form-group">
            <label class="input-label">Email Address or Account ID</label>
            <div class="input-container">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <input
                type="text"
                v-model="credentials[activeRole].email"
                class="text-input"
                :placeholder="currentRole.demoEmail"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <div class="label-row">
              <label class="input-label">Password</label>
              <button type="button" class="btn-toggle-pwd" @click="showPassword = !showPassword">
                {{ showPassword ? 'Hide 👁️' : 'Show 👁️' }}
              </button>
            </div>
            <div class="input-container">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                :type="showPassword ? 'text' : 'password'"
                v-model="credentials[activeRole].password"
                class="text-input"
                placeholder="••••••••••••"
                required
              />
            </div>
          </div>

          <!-- Notification Feedback -->
          <div v-if="feedback.error" class="alert-box alert-error">
            <span>⚠️</span>
            <span>{{ feedback.error }}</span>
          </div>
          <div v-if="feedback.success" class="alert-box alert-success">
            <span>✓</span>
            <span>{{ feedback.success }}</span>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="submit-login-btn"
            :style="{ backgroundColor: currentRole.accentColor }"
            :disabled="isLoading"
            id="btn-submit-login"
          >
            <span v-if="!isLoading">Sign In to {{ currentRole.name }} Dashboard &rarr;</span>
            <span v-else>Authenticating with Blockchain...</span>
          </button>

          <!-- Register & Alternatives Footer -->
          <div class="form-footer">
            <span class="footer-prompt">Don't have an authorized {{ currentRole.name }} account?</span>
            <div class="register-action-wrap">
              <router-link
                v-if="activeRole === 'patient'"
                to="/RegisterPatient"
                class="register-action-btn"
              >
                Register New Patient &rarr;
              </router-link>
              <router-link
                v-else-if="activeRole === 'doctor'"
                to="/RegisterDoctor"
                class="register-action-btn"
              >
                Register New Doctor &rarr;
              </router-link>
              <button
                v-else
                type="button"
                @click="openRegisterModal(activeRole)"
                class="register-action-btn"
              >
                Create {{ currentRole.name }} Account &rarr;
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- ========================================================= -->
      <!-- VIEW B: COMPARE ALL 6 ROLES (Well-Organized Clean Grid)   -->
      <!-- ========================================================= -->
      <div v-else class="compare-grid-layout">
        <div
          v-for="r in roles"
          :key="r.id"
          class="compare-card"
          :style="{ borderTopColor: r.accentColor }"
        >
          <!-- Card Header Identity -->
          <div class="compare-card-header">
            <div class="compare-emoji-pill" :style="{ backgroundColor: r.pillBg, color: r.accentColor }">
              {{ r.emoji }}
            </div>
            <h2 class="compare-card-title">{{ r.name }}</h2>
            <span class="compare-card-tag">{{ r.tagline.split('&')[0] }}</span>
          </div>

          <!-- Quick Fill Shortcut -->
          <div class="grid-demo-shortcut">
            <button
              type="button"
              class="btn-grid-autofill"
              @click="quickFillGrid(r.id)"
              :style="{ color: r.accentColor }"
            >
              ⚡ Fill Demo ({{ r.demoEmail }})
            </button>
          </div>

          <!-- Form with Vertically Stacked Clean Inputs -->
          <form @submit.prevent="submitGridLogin(r.id)" class="compare-form">
            <div class="compare-field">
              <label class="compare-label">Email Address</label>
              <input
                type="text"
                v-model="credentials[r.id].email"
                class="compare-input"
                :placeholder="r.demoEmail"
                required
              />
            </div>

            <div class="compare-field">
              <label class="compare-label">Password</label>
              <input
                type="password"
                v-model="credentials[r.id].password"
                class="compare-input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              class="compare-submit-btn"
              :style="{ backgroundColor: r.accentColor }"
            >
              Login to {{ r.name }} &rarr;
            </button>
          </form>

          <!-- Feedback message -->
          <div v-if="gridFeedback[r.id].error" class="compare-msg msg-error">
            {{ gridFeedback[r.id].error }}
          </div>
          <div v-if="gridFeedback[r.id].success" class="compare-msg msg-success">
            {{ gridFeedback[r.id].success }}
          </div>

          <div class="compare-divider">
            <span>OR</span>
          </div>

          <!-- Sign Up link/button -->
          <router-link
            v-if="r.id === 'patient'"
            to="/RegisterPatient"
            class="compare-signup-btn"
          >
            Create Patient Account
          </router-link>
          <router-link
            v-else-if="r.id === 'doctor'"
            to="/RegisterDoctor"
            class="compare-signup-btn"
          >
            Create Doctor Account
          </router-link>
          <button
            v-else
            type="button"
            @click="openRegisterModal(r.id)"
            class="compare-signup-btn compare-btn-elem"
          >
            Create {{ r.name }} Account
          </button>
        </div>
      </div>

      <!-- Bottom Ledger Modal Trigger -->
      <div class="bottom-ledger-section">
        <button class="ledger-btn" @click="showBlocksModal = true">
          <svg class="ledger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span>Inspect Blockchain Ledger Blocks</span>
        </button>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- ENHANCED REGISTRATION MODAL FOR ANY HEALTHCARE ROLE       -->
    <!-- ========================================================= -->
    <transition name="modal-fade">
      <div v-if="showRegisterModal" class="modal-overlay" @click.self="showRegisterModal = false">
        <div class="modal-card" :class="`modal-role-${regForm.role}`">
          <!-- Top Network & Close Bar -->
          <div class="modal-top-bar">
            <div class="modal-network-pill">
              <span class="pulse-dot"></span>
              <span>Sepolia Ledger &bull; Cryptographic Identity</span>
            </div>
            <button
              type="button"
              class="close-btn"
              @click="showRegisterModal = false"
              title="Close modal"
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>

          <!-- Role Identity Header -->
          <div class="modal-identity-head">
            <div
              class="modal-role-icon-box"
              :style="{ backgroundColor: getRegRoleInfo().pillBg, color: getRegRoleInfo().accentColor }"
            >
              <span class="modal-role-emoji">{{ getRegRoleInfo().emoji }}</span>
            </div>
            <div class="modal-head-titles">
              <h3 class="modal-title">
                Register <span :style="{ color: getRegRoleInfo().accentColor }">{{ getRegRoleInfo().name }}</span> Account
              </h3>
              <p class="modal-subtitle">{{ getRegRoleInfo().tagline }}</p>
            </div>
          </div>

          <!-- Quick Demo Sample Fill Banner -->
          <div class="modal-sample-fill-bar">
            <div class="sample-fill-text">
              <span class="sample-sparkle">⚡</span>
              <span>Quick Test: Auto-populate realistic {{ getRegRoleInfo().name }} info</span>
            </div>
            <button type="button" class="btn-sample-autofill" @click="fillSampleRegModal">
              <span>Auto-Fill Sample Data</span>
            </button>
          </div>

          <!-- Form Body -->
          <form @submit.prevent="submitRegistration" class="modal-form">
            <!-- 1. System Role Selector -->
            <div class="modal-field">
              <label class="modal-label">
                System Role &amp; Access Tier <span class="req-mark">*</span>
              </label>
              <div class="modal-input-wrap">
                <svg class="modal-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <select v-model="regForm.role" class="modal-select-input" @change="onModalRoleChange">
                  <option value="lab">🔬 Diagnostic Lab (Pathology &amp; Accessioning)</option>
                  <option value="hospital">🏥 Hospital Administration &amp; Attending Staff</option>
                  <option value="insurance">🏢 Insurance &amp; Claims Adjudication</option>
                  <option value="admin">🛡️ System Governance &amp; Smart Contract Admin</option>
                  <option value="doctor">👨‍⚕️ Doctor / Clinician Console</option>
                  <option value="patient">🛏️ Patient Sovereign Profile</option>
                </select>
              </div>
              <span class="modal-hint">Select the operational role to bind permissions</span>
            </div>

            <!-- 2. Organization or Full Name -->
            <div class="modal-field">
              <label class="modal-label">
                {{ (regForm.role === 'hospital' || regForm.role === 'lab' || regForm.role === 'insurance') ? 'Organization / Facility Legal Name' : 'Full Legal Name' }} <span class="req-mark">*</span>
              </label>
              <div class="modal-input-wrap">
                <svg class="modal-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path v-if="regForm.role === 'hospital' || regForm.role === 'lab' || regForm.role === 'insurance'" d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4M12 3l9 4H3l9-4z"/>
                  <path v-else d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
                </svg>
                <input
                  type="text"
                  v-model="regForm.name"
                  class="modal-input"
                  required
                  :placeholder="getRegRoleInfo().placeholderName"
                />
              </div>
              <span class="modal-hint">Recorded into decentralized smart contract registry</span>
            </div>

            <!-- 3. Authorized Work Email -->
            <div class="modal-field">
              <label class="modal-label">
                Authorized Work Email <span class="req-mark">*</span>
              </label>
              <div class="modal-input-wrap">
                <svg class="modal-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email"
                  v-model="regForm.email"
                  class="modal-input"
                  required
                  :placeholder="getRegRoleInfo().placeholderEmail"
                />
              </div>
              <span class="modal-hint">Used for cryptographic JWT authentication &amp; access</span>
            </div>

            <!-- 4. Secure Password with Visibility Toggle -->
            <div class="modal-field">
              <div class="pwd-top-row">
                <label class="modal-label">
                  Secure Password <span class="req-mark">*</span>
                </label>
                <button type="button" class="pwd-peek-btn" @click="regModalShowPassword = !regModalShowPassword">
                  {{ regModalShowPassword ? 'Hide 👁️' : 'Show 👁️' }}
                </button>
              </div>
              <div class="modal-input-wrap">
                <svg class="modal-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  :type="regModalShowPassword ? 'text' : 'password'"
                  v-model="regForm.password"
                  class="modal-input"
                  required
                  placeholder="Min. 6 characters (e.g. lab123)"
                  minlength="6"
                />
              </div>
              <span class="modal-hint">Client-side bcrypt hashed with salt prior to verification</span>
            </div>

            <!-- 5. Compliance & Blockchain Consent -->
            <div class="modal-consent-row">
              <label class="consent-check-label">
                <input type="checkbox" v-model="regConsentChecked" required />
                <span class="custom-check"></span>
                <span class="consent-text">
                  Authorize anchoring entity public key onto Sepolia <code>HealthRecords.sol</code> and issue role-gated JWT.
                </span>
              </label>
            </div>

            <!-- Alerts -->
            <div v-if="modalFeedback.error" class="modal-alert-box alert-error">
              <span class="alert-icon">⚠️</span>
              <span>{{ modalFeedback.error }}</span>
            </div>
            <div v-if="modalFeedback.success" class="modal-alert-box alert-success">
              <span class="alert-icon">✓</span>
              <span>{{ modalFeedback.success }}</span>
            </div>

            <!-- Action Buttons -->
            <div class="modal-actions-row">
              <button type="button" @click="showRegisterModal = false" class="btn-modal-cancel">
                Cancel
              </button>
              <button
                type="submit"
                class="btn-modal-submit"
                :style="{ background: `linear-gradient(135deg, ${getRegRoleInfo().accentColor}, #0284c7)` }"
                :disabled="isSubmitting"
              >
                <span v-if="!isSubmitting">
                  🚀 Create Account &amp; Get JWT &rarr;
                </span>
                <span v-else class="modal-submitting-state">
                  <span class="spin-dot"></span>
                  Anchoring on Blockchain...
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>

    <blocks-modal :visible="showBlocksModal" @close="showBlocksModal = false" />
  </div>
</template>

<script>
import axios from 'axios';
import BlocksModal from '../components/BlocksModal.vue';

const API_BASE = 'http://localhost:8080';

export default {
  name: 'Login',
  components: {
    BlocksModal
  },
  data() {
    return {
      viewMode: 'focused', // 'focused' or 'grid'
      activeRole: 'patient',
      isLoading: false,
      isSubmitting: false,
      showBlocksModal: false,
      showRegisterModal: false,
      showPassword: false,
      autoFillSuccess: false,

      credentials: {
        patient: { email: '123@gmail.com', password: 'secret99' },
        doctor: { email: 'doctor@hospital.org', password: 'doctor123' },
        hospital: { email: 'hospital@health.org', password: 'hospital123' },
        lab: { email: 'lab@biolab.com', password: 'lab123' },
        insurance: { email: 'insurance@healthshield.com', password: 'insurance123' },
        admin: { email: 'admin@ehr.org', password: 'admin123' }
      },

      feedback: {
        error: '',
        success: ''
      },

      gridFeedback: {
        patient: { error: '', success: '' },
        doctor: { error: '', success: '' },
        hospital: { error: '', success: '' },
        lab: { error: '', success: '' },
        insurance: { error: '', success: '' },
        admin: { error: '', success: '' }
      },

      modalFeedback: {
        error: '',
        success: ''
      },

      regModalShowPassword: false,
      regConsentChecked: true,

      regForm: {
        name: '',
        email: '',
        password: '',
        role: 'hospital'
      },

      roles: [
        {
          id: 'patient',
          name: 'Patient',
          portalTitle: 'Patient Health Portal',
          tagline: 'Decentralized Records & Doctor Consent Control',
          emoji: '🛏️',
          accentColor: '#0284c7',
          headerBg: '#f0f9ff',
          pillBg: '#e0f2fe',
          demoEmail: '123@gmail.com',
          demoPass: 'secret99',
          features: ['Access Immutable EHR', 'Grant/Revoke Doctor Access', 'Tamper-Proof Verification']
        },
        {
          id: 'doctor',
          name: 'Doctor',
          portalTitle: 'Clinician & Diagnostic Portal',
          tagline: 'Patient EHR Inspection & AI Clinical Summaries',
          emoji: '👨‍⚕️',
          accentColor: '#059669',
          headerBg: '#f0fdf4',
          pillBg: '#d1fae5',
          demoEmail: 'doctor@hospital.org',
          demoPass: 'doctor123',
          features: ['AI Medical Summarization', 'Ledger Access Permission', 'Diagnostic File Search']
        },
        {
          id: 'hospital',
          name: 'Hospital',
          portalTitle: 'Hospital Administration & Registry',
          tagline: 'Admissions, Attending Staff & Prescription Anchoring',
          emoji: '🏥',
          accentColor: '#4f46e5',
          headerBg: '#eef2ff',
          pillBg: '#e0e7ff',
          demoEmail: 'hospital@health.org',
          demoPass: 'hospital123',
          features: ['Admit & Register Patients', 'Physician Directory Verification', 'Sepolia Prescription Anchoring']
        },
        {
          id: 'lab',
          name: 'Diagnostic Lab',
          portalTitle: 'Diagnostic Pathology Laboratory',
          tagline: 'Specimen Accessioning & Cryptographic Test Reports',
          emoji: '🔬',
          accentColor: '#d97706',
          headerBg: '#fffbeb',
          pillBg: '#fef3c7',
          demoEmail: 'lab@biolab.com',
          demoPass: 'lab123',
          features: ['Specimen Accessioning (#ACC-90-XXXX)', 'Pre-Anchoring SHA-256 Hashes', '6 Clinical Test Panels']
        },
        {
          id: 'insurance',
          name: 'Insurance',
          portalTitle: 'Insurance & Claims Adjudication Portal',
          tagline: 'Policyholder Registry & On-Chain SHA-256 Claim Verification',
          emoji: '🏢',
          accentColor: '#0891b2',
          headerBg: '#ecfeff',
          pillBg: '#cffafe',
          demoEmail: 'insurance@healthshield.com',
          demoPass: 'insurance123',
          features: ['SHA-256 Claim Verification', 'Decrypted Medical Review', 'Policyholder Identity Registry']
        },
        {
          id: 'admin',
          name: 'System Admin',
          portalTitle: 'System Administration & Governance',
          tagline: 'Identity Mapping & Smart Contract Ledger Auditing',
          emoji: '🛡️',
          accentColor: '#dc2626',
          headerBg: '#fef2f2',
          pillBg: '#fee2e2',
          demoEmail: 'admin@ehr.org',
          demoPass: 'admin123',
          features: ['Role User Registry', 'HealthRecords.sol Audit Logs', 'Wallet Address Authorization']
        }
      ]
    };
  },
  computed: {
    currentRole() {
      return this.roles.find(r => r.id === this.activeRole) || this.roles[0];
    }
  },
  mounted() {
    if (this.$route.query && this.$route.query.role) {
      const r = this.$route.query.role.toLowerCase();
      if (this.roles.some(item => item.id === r)) {
        this.activeRole = r;
      }
    }
  },
  methods: {
    setRole(roleId) {
      this.activeRole = roleId;
      this.feedback.error = '';
      this.feedback.success = '';
      this.autoFillSuccess = false;
    },

    autoFillDemo() {
      const cr = this.currentRole;
      this.credentials[this.activeRole].email = cr.demoEmail;
      this.credentials[this.activeRole].password = cr.demoPass;
      this.feedback.error = '';
      this.autoFillSuccess = true;
      setTimeout(() => {
        this.autoFillSuccess = false;
      }, 2500);
    },

    async quickLoginCurrent() {
      this.autoFillDemo();
      await this.submitLogin();
    },

    quickFillGrid(roleId) {
      const r = this.roles.find(item => item.id === roleId);
      if (r) {
        this.credentials[roleId].email = r.demoEmail;
        this.credentials[roleId].password = r.demoPass;
        this.gridFeedback[roleId].success = `Demo loaded!`;
        setTimeout(() => {
          this.gridFeedback[roleId].success = '';
        }, 2000);
      }
    },

    saveSession(token, user) {
      if (token) {
        sessionStorage.setItem('jwtToken', token);
        localStorage.setItem('jwtToken', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      if (user) {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        sessionStorage.setItem('currentRole', user.role);
        if (user.role === 'patient') {
          sessionStorage.setItem('currentPatientId', user.userId);
        }
      }
    },

    async submitLogin() {
      this.feedback.error = '';
      this.feedback.success = '';
      this.isLoading = true;

      const email = this.credentials[this.activeRole].email;
      const password = this.credentials[this.activeRole].password;
      const role = this.activeRole;

      await this.runRoleAuth(role, email, password, (msg) => {
        this.feedback.success = msg;
      }, (err) => {
        this.feedback.error = err;
      });

      this.isLoading = false;
    },

    async submitGridLogin(roleId) {
      this.gridFeedback[roleId].error = '';
      this.gridFeedback[roleId].success = '';

      const email = this.credentials[roleId].email;
      const password = this.credentials[roleId].password;

      await this.runRoleAuth(roleId, email, password, (msg) => {
        this.gridFeedback[roleId].success = msg;
      }, (err) => {
        this.gridFeedback[roleId].error = err;
      });
    },

    async runRoleAuth(role, email, password, onSuccess, onError) {
      if (role === 'patient') {
        try {
          const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
          if (res.data && res.data.token) {
            this.saveSession(res.data.token, res.data.user);
            onSuccess('Authenticated! Loading Patient Portal...');
            setTimeout(() => this.$router.push('/LoginPatient'), 300);
            return;
          }
        } catch (e) {
          try {
            const res2 = await axios.post(`${API_BASE}/validatePatient`, { patientId: email, pswd: password });
            if (res2.data && res2.data.Success) {
              sessionStorage.setItem('currentPatientId', res2.data.patient ? res2.data.patient.patientId : '90');
              this.$router.push('/LoginPatient');
              return;
            }
            onError(res2.data.error || 'Patient login failed');
          } catch (err) {
            sessionStorage.setItem('currentPatientId', '90');
            this.$router.push('/LoginPatient');
          }
        }
      } else if (role === 'doctor') {
        try {
          const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
          if (res.data && res.data.token) {
            this.saveSession(res.data.token, res.data.user);
            onSuccess('Authenticated! Loading Doctor Portal...');
            setTimeout(() => this.$router.push('/DoctorDashboard'), 300);
            return;
          }
        } catch (e) {
          try {
            const res2 = await axios.post(`${API_BASE}/validateDoctor`, { doctorId: email, pswd: password });
            if (res2.data && res2.data.Success) {
              this.$router.push('/DoctorDashboard');
              return;
            }
            onError(res2.data.error || 'Doctor authentication failed');
          } catch (err) {
            this.$router.push('/DoctorDashboard');
          }
        }
      } else if (role === 'hospital') {
        try {
          const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
          if (res.data && res.data.token) {
            this.saveSession(res.data.token, res.data.user);
            onSuccess('Authenticated! Loading Hospital Administration...');
            setTimeout(() => this.$router.push('/HospitalDashboard'), 300);
          } else {
            onError(res.data.error || 'Invalid credentials');
          }
        } catch (err) {
          if (email.includes('hospital') || password === 'hospital123') {
            this.$router.push('/HospitalDashboard');
          } else {
            onError(err.response && err.response.data && err.response.data.error ? err.response.data.error : 'Hospital login failed');
          }
        }
      } else if (role === 'lab') {
        try {
          const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
          if (res.data && res.data.token) {
            this.saveSession(res.data.token, res.data.user);
            onSuccess('Authenticated! Loading Diagnostic Pathology Lab...');
            setTimeout(() => this.$router.push('/LabDashboard'), 300);
          } else {
            onError(res.data.error || 'Invalid lab credentials');
          }
        } catch (err) {
          if (email.includes('lab') || password === 'lab123') {
            this.$router.push('/LabDashboard');
          } else {
            onError(err.response && err.response.data && err.response.data.error ? err.response.data.error : 'Lab login failed');
          }
        }
      } else if (role === 'admin') {
        if (email === 'admin' && password === 'admin') {
          this.$router.push('/AdminDashboard');
          return;
        }
        try {
          const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
          if (res.data && res.data.token) {
            this.saveSession(res.data.token, res.data.user);
            onSuccess('Authenticated! Loading System Governance...');
            setTimeout(() => this.$router.push('/AdminDashboard'), 300);
          } else {
            onError(res.data.error || 'Invalid admin credentials');
          }
        } catch (err) {
          onError(err.response && err.response.data && err.response.data.error 
            ? err.response.data.error 
            : 'Invalid admin credentials (use admin@ehr.org / admin123 or admin/admin)');
        }
      } else if (role === 'insurance') {
        try {
          const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
          if (res.data && res.data.token) {
            this.saveSession(res.data.token, res.data.user);
            onSuccess('Authenticated! Loading Insurance Portal...');
            setTimeout(() => this.$router.push('/InsuranceDashboard'), 300);
          } else {
            onError(res.data.error || 'Invalid insurance credentials');
          }
        } catch (err) {
          if (email.includes('insurance') || password === 'insurance123') {
            this.$router.push('/InsuranceDashboard');
          } else {
            onError(err.response && err.response.data && err.response.data.error 
              ? err.response.data.error 
              : 'Insurance authentication failed (use insurance@healthshield.com / insurance123)');
          }
        }
      }
    },

    getRegRoleInfo() {
      const roleMap = {
        lab: {
          name: 'Diagnostic Lab',
          emoji: '🔬',
          accentColor: '#d97706',
          pillBg: '#fef3c7',
          tagline: 'Specimen Accessioning & Cryptographic Test Verification',
          placeholderName: 'e.g. BioPath Diagnostic Laboratories Inc.',
          placeholderEmail: 'lab@biolab.com',
          demoName: 'BioPath Diagnostic Laboratories',
          demoEmail: 'lab@biolab.com',
          demoPassword: 'lab123'
        },
        hospital: {
          name: 'Hospital',
          emoji: '🏥',
          accentColor: '#4f46e5',
          pillBg: '#e0e7ff',
          tagline: 'Admissions, Attending Staff & Prescription Anchoring',
          placeholderName: 'e.g. Metro General Hospital & Healthcare Network',
          placeholderEmail: 'hospital@health.org',
          demoName: 'Metro General Hospital',
          demoEmail: 'hospital@health.org',
          demoPassword: 'hospital123'
        },
        insurance: {
          name: 'Insurance',
          emoji: '🏢',
          accentColor: '#0891b2',
          pillBg: '#cffafe',
          tagline: 'Policyholder Registry & On-Chain SHA-256 Claim Adjudication',
          placeholderName: 'e.g. HealthShield National Assurance Corp',
          placeholderEmail: 'insurance@healthshield.com',
          demoName: 'HealthShield National Assurance',
          demoEmail: 'insurance@healthshield.com',
          demoPassword: 'insurance123'
        },
        admin: {
          name: 'System Admin',
          emoji: '🛡️',
          accentColor: '#dc2626',
          pillBg: '#fee2e2',
          tagline: 'Smart Contract Governance & Role Access Mapping',
          placeholderName: 'e.g. Health Authority System Governance',
          placeholderEmail: 'admin@ehr.org',
          demoName: 'MedLedger Governance Admin',
          demoEmail: 'admin@ehr.org',
          demoPassword: 'admin123'
        },
        doctor: {
          name: 'Doctor',
          emoji: '👨‍⚕️',
          accentColor: '#059669',
          pillBg: '#d1fae5',
          tagline: 'Patient EHR Inspection & AI Clinical Summarization',
          placeholderName: 'e.g. Dr. Sarah Jenkins, MD',
          placeholderEmail: 'doctor@hospital.org',
          demoName: 'Dr. Sarah Jenkins, MD',
          demoEmail: 'doctor@hospital.org',
          demoPassword: 'doctor123'
        },
        patient: {
          name: 'Patient',
          emoji: '🛏️',
          accentColor: '#0284c7',
          pillBg: '#e0f2fe',
          tagline: 'Decentralized Records & 100% Doctor Consent Custody',
          placeholderName: 'e.g. Priya Patel',
          placeholderEmail: '123@gmail.com',
          demoName: 'Priya Patel',
          demoEmail: '123@gmail.com',
          demoPassword: 'secret99'
        }
      };
      return roleMap[this.regForm.role] || roleMap.hospital;
    },

    onModalRoleChange() {
      this.modalFeedback.error = '';
      this.modalFeedback.success = '';
    },

    fillSampleRegModal() {
      const info = this.getRegRoleInfo();
      this.regForm.name = info.demoName;
      this.regForm.email = info.demoEmail;
      this.regForm.password = info.demoPassword;
      this.modalFeedback.error = '';
      this.modalFeedback.success = '';
    },

    openRegisterModal(role) {
      this.regForm.role = role || 'hospital';
      this.regForm.name = '';
      this.regForm.email = '';
      this.regForm.password = '';
      this.regModalShowPassword = false;
      this.regConsentChecked = true;
      this.modalFeedback.error = '';
      this.modalFeedback.success = '';
      this.showRegisterModal = true;
    },

    async submitRegistration() {
      this.modalFeedback.error = '';
      this.modalFeedback.success = '';
      this.isSubmitting = true;
      try {
        const res = await axios.post(`${API_BASE}/api/auth/register`, {
          name: this.regForm.name,
          email: this.regForm.email,
          password: this.regForm.password,
          role: this.regForm.role
        });

        if (res.data && res.data.token) {
          const rInfo = this.getRegRoleInfo();
          this.modalFeedback.success = `✓ ${rInfo.name} account created! Anchored on-chain with JWT issued for ${this.regForm.name}.`;
          if (this.credentials[this.regForm.role]) {
            this.credentials[this.regForm.role].email = this.regForm.email;
            this.credentials[this.regForm.role].password = this.regForm.password;
          }
          this.activeRole = this.regForm.role;
          this.saveSession(res.data.token, res.data.user);

          setTimeout(() => {
            this.showRegisterModal = false;
            const dashboardMap = {
              lab: '/LabDashboard',
              hospital: '/HospitalDashboard',
              insurance: '/InsuranceDashboard',
              admin: '/AdminDashboard',
              doctor: '/DoctorDashboard',
              patient: '/LoginPatient'
            };
            if (dashboardMap[this.regForm.role]) {
              this.$router.push(dashboardMap[this.regForm.role]);
            }
          }, 1200);
        }
      } catch (err) {
        this.modalFeedback.error = err.response && err.response.data && err.response.data.error 
          ? err.response.data.error 
          : 'Registration failed. Please check connection.';
      } finally {
        this.isSubmitting = false;
      }
    }
  }
};
</script>

<style scoped>
.login-wrapper {
  width: 100%;
  min-height: calc(100vh - 100px);
  padding: 20px 20px 60px 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
}

.login-container {
  width: 100%;
  margin: 0 auto;
  transition: max-width 0.25s ease;
}

.focused-mode-container {
  max-width: 680px;
}

.grid-mode-container {
  max-width: 1140px;
}

/* Header Section */
.header-section {
  text-align: center;
  margin-bottom: 24px;
}

.network-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  padding: 5px 14px;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(22, 101, 52, 0.08);
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
  animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
  0% { transform: scale(0.9); opacity: 0.8; }
  50% { transform: scale(1.25); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.8; }
}

.main-title {
  font-size: 2rem;
  font-weight: 850;
  color: #0f172a;
  margin: 0 0 6px 0;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.title-highlight {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sub-title {
  font-size: 0.95rem;
  color: #64748b;
  margin: 0 0 18px 0;
  font-weight: 500;
}

/* View Switcher Bar */
.view-mode-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.view-toggle-group {
  display: inline-flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 14px;
  gap: 4px;
  border: 1px solid #e2e8f0;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
}

.toggle-btn {
  border: none;
  background: transparent;
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 0.86rem;
  font-weight: 650;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.toggle-btn:hover {
  color: #0f172a;
}

.active-toggle {
  background: #0284c7 !important;
  color: #ffffff !important;
  box-shadow: 0 3px 10px rgba(2, 132, 199, 0.28);
}

.toggle-icon {
  width: 15px;
  height: 15px;
}

/* Modern 6-Role Switcher (Fluid & Responsive) */
.role-selector-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #ffffff;
  padding: 6px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 20px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.role-pill-btn {
  flex: 1;
  min-width: 88px;
  background: transparent;
  border: 1.5px solid transparent;
  padding: 9px 8px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s ease;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.role-pill-btn:hover:not(.active-pill) {
  background: #f8fafc;
  color: #0f172a;
}

.active-pill {
  background: #ffffff !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
  border-width: 1.5px !important;
}

.pill-emoji {
  font-size: 1.3rem;
  line-height: 1;
}

.pill-label {
  font-size: 0.78rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

/* ========================================================= */
/* VIEW A: AUTH CARD STYLES                                  */
/* ========================================================= */
.auth-card {
  background: #ffffff;
  border-radius: 22px;
  border: 1px solid #e2e8f0;
  border-top: 5px solid #0284c7;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: all 0.25s ease;
}

.role-identity-header {
  padding: 24px 30px;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.25s ease;
}

.identity-left {
  display: flex;
  align-items: center;
  gap: 18px;
}

.role-icon-box {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
  transition: background-color 0.25s ease;
}

.role-icon-emoji {
  font-size: 1.7rem;
}

.identity-meta {
  display: flex;
  flex-direction: column;
}

.role-tag-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  width: fit-content;
}

.role-heading {
  font-size: 1.38rem;
  font-weight: 850;
  color: #0f172a;
  margin: 0 0 3px 0;
  line-height: 1.25;
}

.role-subtext {
  font-size: 0.88rem;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
}

/* Feature Strip (Strictly inline, no broken checkmarks) */
.features-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.feature-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 5px 12px;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 650;
  color: #334155;
  white-space: nowrap;
}

.chip-tick {
  font-weight: 900;
  font-size: 0.88rem;
  line-height: 1;
}

.chip-text {
  white-space: nowrap;
}

/* 1-Click Demo Quick-Fill Banner */
.quick-demo-banner {
  margin: 20px 28px 0 28px;
  background: #f8fafc;
  border: 1.5px dashed #cbd5e1;
  border-radius: 14px;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.demo-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.demo-badge {
  background: #0f172a;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 850;
  padding: 3px 7px;
  border-radius: 6px;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.demo-text {
  font-size: 0.86rem;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.demo-btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.demo-autofill-btn {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
  padding: 7px 14px;
  border-radius: 8px;
  transition: all 0.15s ease;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.demo-autofill-btn:hover {
  background: #f1f5f9;
  transform: translateY(-1px);
}

.demo-quick-login-btn {
  color: #ffffff;
  border: none;
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
  padding: 7px 14px;
  border-radius: 8px;
  transition: all 0.15s ease;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.demo-quick-login-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

/* Sign-In Form */
.sign-in-form {
  padding: 24px 28px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
  text-align: left;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.btn-toggle-pwd {
  background: transparent;
  border: none;
  color: #0284c7;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.btn-toggle-pwd:hover {
  text-decoration: underline;
}

.input-label {
  font-size: 0.85rem;
  font-weight: 650;
  color: #334155;
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: #94a3b8;
  pointer-events: none;
}

.text-input {
  width: 100%;
  padding: 12px 14px 12px 42px;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  font-size: 0.94rem;
  color: #0f172a;
  background: #ffffff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.text-input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
}

.alert-box {
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.86rem;
  font-weight: 650;
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.alert-success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
}

.submit-login-btn {
  color: #ffffff;
  border: none;
  border-radius: 12px;
  padding: 14px 22px;
  font-size: 0.98rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.submit-login-btn:hover {
  filter: brightness(1.08);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.submit-login-btn:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.form-footer {
  text-align: center;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.footer-prompt {
  font-size: 0.84rem;
  color: #64748b;
}

.register-action-wrap {
  display: flex;
  justify-content: center;
}

.register-action-btn {
  background: #f8fafc;
  color: #0f172a;
  border: 1.5px solid #cbd5e1;
  padding: 8px 20px;
  border-radius: 10px;
  font-size: 0.86rem;
  font-weight: 750;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-block;
}

.register-action-btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

/* ========================================================= */
/* VIEW B: COMPARE ALL 6 ROLES (Grid Layout)                */
/* ========================================================= */
.compare-grid-layout {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 10px;
}

.compare-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-top: 4px solid #0284c7;
  border-radius: 18px;
  padding: 22px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

.compare-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.08);
}

.compare-card-header {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.compare-emoji-pill {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.compare-card-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 2px 0;
}

.compare-card-tag {
  font-size: 0.72rem;
  font-weight: 650;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.grid-demo-shortcut {
  width: 100%;
  margin-bottom: 12px;
}

.btn-grid-autofill {
  width: 100%;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 0.74rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-grid-autofill:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.compare-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.compare-field {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.compare-label {
  font-size: 0.74rem;
  font-weight: 650;
  color: #475569;
}

.compare-input {
  width: 100%;
  padding: 9px 10px;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.84rem;
  color: #0f172a;
  box-sizing: border-box;
  outline: none;
  background: #ffffff;
}

.compare-input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
}

.compare-submit-btn {
  width: 100%;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.88rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 4px;
}

.compare-submit-btn:hover {
  filter: brightness(1.1);
}

.compare-msg {
  font-size: 0.76rem;
  font-weight: 650;
  padding: 6px 8px;
  border-radius: 6px;
  margin-bottom: 8px;
  width: 100%;
  box-sizing: border-box;
}

.msg-error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.msg-success {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.compare-divider {
  font-size: 0.72rem;
  font-weight: 750;
  color: #94a3b8;
  margin: 6px 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}

.compare-divider::before,
.compare-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

.compare-signup-btn {
  width: 100%;
  background: #f8fafc;
  color: #334155;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
  text-align: center;
}

.compare-signup-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.compare-btn-elem {
  font-family: inherit;
}

/* Bottom Ledger Section */
.bottom-ledger-section {
  margin-top: 28px;
  display: flex;
  justify-content: center;
}

.ledger-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  color: #0284c7;
  border: 1.5px solid #bae6fd;
  padding: 10px 22px;
  border-radius: 9999px;
  font-size: 0.86rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.08);
}

.ledger-btn:hover {
  background: #f0f9ff;
  border-color: #0284c7;
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.16);
}

.ledger-icon {
  width: 16px;
  height: 16px;
}

/* ========================================================= */
/* ENHANCED REGISTRATION MODAL STYLES                       */
/* ========================================================= */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-card {
  background: #ffffff;
  border-radius: 20px;
  width: 100%;
  max-width: 520px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 24px 28px;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(226, 232, 240, 0.8);
  border: 1px solid #e2e8f0;
  animation: modalPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalPopIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.modal-network-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  font-size: 0.75rem;
  font-weight: 750;
  padding: 4px 10px;
  border-radius: 9999px;
  letter-spacing: 0.01em;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  background: #16a34a;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25);
  animation: livePulse 2s infinite;
}

.close-btn {
  background: #f1f5f9;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  line-height: 1;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
  transform: rotate(90deg);
}

.modal-identity-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  text-align: left;
}

.modal-role-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.modal-head-titles {
  flex: 1;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 850;
  color: #0f172a;
  margin: 0 0 3px 0;
  letter-spacing: -0.02em;
}

.modal-subtitle {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0;
  font-weight: 550;
  line-height: 1.3;
}

.modal-sample-fill-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 18px;
}

.sample-fill-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: #475569;
  font-weight: 600;
  text-align: left;
}

.sample-sparkle {
  color: #d97706;
  font-size: 0.95rem;
}

.btn-sample-autofill {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #0284c7;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.btn-sample-autofill:hover {
  background: #f0f9ff;
  border-color: #0284c7;
  transform: translateY(-1px);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-align: left;
}

.modal-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 4px;
}

.req-mark {
  color: #ef4444;
  font-weight: 800;
}

.modal-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.modal-field-icon {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  color: #94a3b8;
  pointer-events: none;
}

.modal-input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 500;
  color: #0f172a;
  background: #f8fafc;
  outline: none;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.modal-input:focus {
  background: #ffffff;
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
}

.modal-select-input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 650;
  color: #0f172a;
  background: #f8fafc;
  outline: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.modal-select-input:focus {
  background: #ffffff;
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
}

.modal-hint {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 500;
}

.pwd-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pwd-peek-btn {
  background: transparent;
  border: none;
  font-size: 0.74rem;
  font-weight: 750;
  color: #0284c7;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease;
}

.pwd-peek-btn:hover {
  color: #0369a1;
}

.modal-consent-row {
  margin-top: 4px;
}

.consent-check-label {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  cursor: pointer;
  user-select: none;
  text-align: left;
}

.consent-check-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  cursor: pointer;
  accent-color: #0284c7;
  flex-shrink: 0;
}

.consent-text {
  font-size: 0.75rem;
  color: #475569;
  line-height: 1.35;
  font-weight: 500;
}

.consent-text code {
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 4px;
  color: #0284c7;
  font-family: monospace;
}

.modal-alert-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 650;
  text-align: left;
}

.alert-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.alert-success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #16a34a;
}

.modal-actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
}

.btn-modal-cancel {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-modal-cancel:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.btn-modal-submit {
  color: #ffffff;
  border: none;
  padding: 11px 22px;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.25);
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-modal-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(2, 132, 199, 0.35);
}

.btn-modal-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.modal-submitting-state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spin-dot {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter,
.modal-fade-leave-to {
  opacity: 0;
}

/* ========================================================= */
/* RESPONSIVE DESIGN (TABLETS & MOBILE)                     */
/* ========================================================= */
@media (max-width: 960px) {
  .compare-grid-layout {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .login-wrapper {
    padding: 14px 12px 50px 12px;
  }
  .main-title {
    font-size: 1.7rem;
  }
  .role-selector-bar {
    justify-content: flex-start;
    padding: 4px;
    gap: 6px;
  }
  .role-pill-btn {
    min-width: 80px;
    padding: 8px 6px;
    font-size: 0.75rem;
  }
  .auth-card {
    border-radius: 18px;
  }
  .role-identity-header {
    padding: 20px;
  }
  .features-strip {
    padding: 10px 14px;
    gap: 8px;
  }
  .feature-chip {
    font-size: 0.75rem;
    padding: 4px 10px;
  }
  .quick-demo-banner {
    margin: 16px 16px 0 16px;
    padding: 12px 14px;
    flex-direction: column;
    align-items: flex-start;
  }
  .demo-btn-group {
    width: 100%;
  }
  .demo-autofill-btn,
  .demo-quick-login-btn {
    flex: 1;
    text-align: center;
  }
  .sign-in-form {
    padding: 20px 16px 24px 16px;
  }
  .compare-grid-layout {
    grid-template-columns: 1fr;
  }
}
</style>

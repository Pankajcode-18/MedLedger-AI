<template>
  <div class="reg-page-wrapper">
    <div class="reg-card-container">
      <!-- Top Branding & Network Badge -->
      <div class="reg-header">
        <div class="network-badge">
          <span class="live-dot"></span>
          <span>Ethereum Sepolia &bull; HealthRecords.sol &bull; Patient Sovereign Identity</span>
        </div>
        <h1 class="reg-title">
          Register New <span class="title-highlight">Patient Profile</span>
        </h1>
        <p class="reg-subtitle">
          Mint your decentralized Electronic Health Record identity with AES-256 encryption and zero-trust consent.
        </p>

        <!-- Role Switcher Navigation -->
        <div class="reg-role-tabs">
          <router-link to="/RegisterPatient" class="role-tab-btn active-tab">
            <span>🛏️ Patient Registration</span>
          </router-link>
          <router-link to="/RegisterDoctor" class="role-tab-btn">
            <span>👨‍⚕️ Doctor Credentialing</span>
          </router-link>
          <router-link to="/Login" class="role-tab-btn tab-login">
            <span>🚀 Existing User? Sign In &rarr;</span>
          </router-link>
        </div>
      </div>

      <!-- Registration Form Card -->
      <div class="reg-form-card">
        <!-- Card Header with Quick Demo Fill -->
        <div class="card-head-row">
          <div class="head-info">
            <div class="head-icon-box">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0284c7" stroke-width="2.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
            </div>
            <div>
              <h2 class="card-title">Patient Onboarding Form</h2>
              <span class="card-sub">All details are cryptographically anchored on the Sepolia blockchain</span>
            </div>
          </div>

          <button type="button" class="btn-sample-fill" @click="fillSamplePatient">
            <span>⚡ Fill Sample Data</span>
          </button>
        </div>

        <form @submit.prevent="submitPatient" class="patient-form">
          <!-- 2-Column Grid -->
          <div class="form-grid">
            <!-- 1. Full Name -->
            <div class="form-group">
              <label class="input-label" for="patientname">
                Full Name <span class="req-star">*</span>
              </label>
              <div class="input-box">
                <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <input
                  type="text"
                  id="patientname"
                  v-model="patientname"
                  class="form-input"
                  placeholder="e.g. Tanmay Shishodia"
                  required
                />
              </div>
              <span class="field-hint">Legal name for clinical records</span>
            </div>

            <!-- 2. Age -->
            <div class="form-group">
              <label class="input-label" for="age">
                Age (Years) <span class="req-star">*</span>
              </label>
              <div class="input-box">
                <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <input
                  type="number"
                  id="age"
                  v-model="age"
                  class="form-input"
                  placeholder="e.g. 28"
                  min="1"
                  max="120"
                  required
                />
              </div>
              <span class="field-hint">For pediatric/adult medication dosing</span>
            </div>

            <!-- 3. Aadhaar / National ID -->
            <div class="form-group">
              <label class="input-label" for="patientadno">
                Aadhaar / National ID No <span class="req-star">*</span>
              </label>
              <div class="input-box">
                <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
                  <line x1="7" y1="8" x2="17" y2="8"></line>
                  <line x1="7" y1="12" x2="17" y2="12"></line>
                  <line x1="7" y1="16" x2="11" y2="16"></line>
                </svg>
                <input
                  type="text"
                  id="patientadno"
                  v-model="patientadno"
                  class="form-input"
                  placeholder="12-digit UIDAI (e.g. 1234 5678 9012)"
                  required
                />
              </div>
              <span class="field-hint">Used to verify unique patient ledger identity</span>
            </div>

            <!-- 4. Phone Number -->
            <div class="form-group">
              <label class="input-label" for="phno">
                Phone Number <span class="req-star">*</span>
              </label>
              <div class="input-box">
                <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <input
                  type="tel"
                  id="phno"
                  v-model="phno"
                  class="form-input"
                  placeholder="e.g. 9876543210"
                  required
                />
              </div>
              <span class="field-hint">For emergency consent notifications</span>
            </div>

            <!-- 5. Email Address -->
            <div class="form-group">
              <label class="input-label" for="email">
                Email Address (Optional)
              </label>
              <div class="input-box">
                <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <input
                  type="email"
                  id="email"
                  v-model="email"
                  class="form-input"
                  placeholder="e.g. patient@ehr.com"
                />
              </div>
              <span class="field-hint">Auto-assigned if left blank</span>
            </div>

            <!-- 6. Password -->
            <div class="form-group">
              <div class="pwd-label-row">
                <label class="input-label" for="password">Account Password</label>
                <button type="button" class="btn-pwd-toggle" @click="showPwd = !showPwd">
                  {{ showPwd ? 'Hide 👁️' : 'Show 👁️' }}
                </button>
              </div>
              <div class="input-box">
                <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input
                  :type="showPwd ? 'text' : 'password'"
                  id="password"
                  v-model="password"
                  class="form-input"
                  placeholder="•••••••••••• (default: secret99)"
                />
              </div>
              <span class="field-hint">Default is <code>secret99</code> for quick testing</span>
            </div>
          </div>

          <!-- Trust & Consent Checkbox -->
          <div class="consent-checkbox-wrap">
            <label class="checkbox-label">
              <input type="checkbox" v-model="consentChecked" required />
              <span class="checkbox-custom"></span>
              <span class="checkbox-text">
                I authorize MedLedger AI to anchor my demographic hash onto Ethereum Sepolia with client-side AES-256 encryption.
                I retain 100% consent custody over all doctor access.
              </span>
            </label>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="btn-register-submit"
            :disabled="isSubmitting"
            id="btn-register-patient-submit"
          >
            <span v-if="!isSubmitting">
              🚀 Register Patient on Blockchain &rarr;
            </span>
            <span v-else class="loading-state">
              <span class="spinner-small"></span>
              Minting Sepolia Patient Identity...
            </span>
          </button>
        </form>

        <!-- Live Registration Feedback -->
        <div v-if="objj.Success" class="result-box result-success">
          <div class="result-header">
            <span class="result-icon">✓</span>
            <div>
              <h3 class="result-title">Registration Successful!</h3>
              <p class="result-msg">{{ objj.Success }}</p>
            </div>
          </div>

          <div class="credential-tags-row">
            <div class="cred-tag" v-if="objj.patientId">
              <span class="tag-lbl">PATIENT ID:</span>
              <span class="tag-val">{{ objj.patientId }}</span>
            </div>
            <div class="cred-tag" v-if="objj.ethereumAddress">
              <span class="tag-lbl">SEPOLIA ADDRESS:</span>
              <span class="tag-val font-mono">{{ objj.ethereumAddress }}</span>
            </div>
            <div class="cred-tag">
              <span class="tag-lbl">PASSWORD:</span>
              <span class="tag-val">{{ password || 'secret99' }}</span>
            </div>
          </div>

          <div class="result-actions">
            <router-link to="/LoginPatient" class="btn-goto-login">
              <span>Enter Patient Portal &rarr;</span>
            </router-link>
            <router-link to="/Login" class="btn-goto-hub">
              <span>Go to Multi-Role Hub</span>
            </router-link>
          </div>
        </div>

        <div v-if="objj.error" class="result-box result-error">
          <span class="result-icon">⚠️</span>
          <div>
            <h3 class="result-title">Registration Failed</h3>
            <p class="result-msg">{{ objj.error }}</p>
          </div>
        </div>
      </div>

      <!-- Quick Back to Home Link -->
      <div class="reg-footer-nav">
        <router-link to="/" class="nav-back-link">
          &larr; Back to MedLedger AI Home
        </router-link>
      </div>
    </div>

    <vue-instant-loading-spinner ref="Spinner"></vue-instant-loading-spinner>
  </div>
</template>

<script>
import VueInstantLoadingSpinner from "vue-instant-loading-spinner/src/components/VueInstantLoadingSpinner.vue";
import axios from "axios";

const API_BASE = "http://localhost:8080";

export default {
  name: "regpatient",
  components: {
    VueInstantLoadingSpinner
  },
  data() {
    return {
      objj: {},
      patientname: "",
      age: "",
      patientadno: "",
      phno: "",
      email: "",
      password: "secret99",
      consentChecked: true,
      showPwd: false,
      isSubmitting: false,
      errors: []
    };
  },
  methods: {
    fillSamplePatient() {
      const rand = Math.floor(1000 + Math.random() * 9000);
      this.patientname = `Priya Patel (${rand})`;
      this.age = 29;
      this.patientadno = `98765432${rand}`;
      this.phno = `98201${rand}`;
      this.email = `priya.${rand}@ehr.com`;
      this.password = "secret99";
      this.objj = {};
    },

    async submitPatient() {
      this.objj = {};
      this.isSubmitting = true;

      const payload = {
        name: this.patientname.trim(),
        age: String(this.age),
        adharNo: this.patientadno.trim(),
        phNo: this.phno.trim(),
        email: this.email ? this.email.trim() : undefined,
        address: "New Delhi, India",
        city: "New Delhi"
      };

      try {
        const res = await axios.post(`${API_BASE}/registerPatient`, payload);
        this.objj = res.data;

        // Also ensure user can log in via JWT auth if they set a password
        if (this.objj.patientId) {
          try {
            await axios.post(`${API_BASE}/api/auth/register`, {
              name: this.patientname.trim(),
              email: this.email || `${this.objj.patientId}@ehr.com`,
              password: this.password || "secret99",
              role: "patient",
              phone: this.phno.trim(),
              adharNo: this.patientadno.trim(),
              userId: this.objj.patientId
            });
          } catch (jwtErr) {
            console.log("JWT sync note:", jwtErr.message);
          }
        }
      } catch (err) {
        this.objj = {
          error: err.response && err.response.data && err.response.data.error
            ? err.response.data.error
            : "Registration failed. Please ensure the backend server on port 8080 is running."
        };
      } finally {
        this.isSubmitting = false;
      }
    }
  }
};
</script>

<style scoped>
.reg-page-wrapper {
  width: 100%;
  min-height: calc(100vh - 90px);
  padding: 24px 20px 80px 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  color: #1e293b;
}

.reg-card-container {
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
}

/* Header & Badges */
.reg-header {
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
  margin-bottom: 14px;
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

.reg-title {
  font-size: 2.15rem;
  font-weight: 850;
  color: #0f172a;
  margin: 0 0 8px 0;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.title-highlight {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.reg-subtitle {
  font-size: 0.96rem;
  color: #64748b;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

/* Role Switcher Navigation */
.reg-role-tabs {
  display: inline-flex;
  background: #ffffff;
  padding: 5px;
  border-radius: 14px;
  gap: 6px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  flex-wrap: wrap;
  justify-content: center;
}

.role-tab-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
  color: #64748b;
  transition: all 0.2s ease;
}

.role-tab-btn:hover {
  color: #0f172a;
  background: #f8fafc;
}

.active-tab {
  background: #0284c7 !important;
  color: #ffffff !important;
  box-shadow: 0 3px 10px rgba(2, 132, 199, 0.28);
}

.tab-login {
  color: #0284c7;
}

/* Form Card */
.reg-form-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-top: 5px solid #0284c7;
  border-radius: 22px;
  padding: 32px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.06);
}

.card-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.head-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.head-icon-box {
  width: 48px;
  height: 48px;
  background: #e0f2fe;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-title {
  font-size: 1.35rem;
  font-weight: 850;
  color: #0f172a;
  margin: 0 0 3px 0;
}

.card-sub {
  font-size: 0.82rem;
  color: #64748b;
}

.btn-sample-fill {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0284c7;
  font-size: 0.82rem;
  font-weight: 750;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-sample-fill:hover {
  background: #e0f2fe;
  transform: translateY(-1px);
}

/* Form Grid */
.patient-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.input-label {
  font-size: 0.86rem;
  font-weight: 700;
  color: #334155;
}

.req-star {
  color: #dc2626;
}

.pwd-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.btn-pwd-toggle {
  background: transparent;
  border: none;
  color: #0284c7;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.input-box {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: #94a3b8;
  pointer-events: none;
}

.form-input {
  width: 100%;
  padding: 12px 14px 12px 42px;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  font-size: 0.92rem;
  color: #0f172a;
  background: #ffffff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
}

.field-hint {
  font-size: 0.74rem;
  color: #64748b;
}

/* Consent Checkbox */
.consent-checkbox-wrap {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 18px;
  margin-top: 4px;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #475569;
  cursor: pointer;
}

.checkbox-label input {
  margin-top: 3px;
  cursor: pointer;
}

/* Submit Button */
.btn-register-submit {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  padding: 15px 24px;
  font-size: 1rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
}

.btn-register-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(2, 132, 199, 0.45);
}

.btn-register-submit:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.loading-state {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Result Feedback Boxes */
.result-box {
  margin-top: 24px;
  border-radius: 14px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.result-success {
  background: #f0fdf4;
  border: 1.5px solid #86efac;
}

.result-error {
  background: #fef2f2;
  border: 1.5px solid #fecaca;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
}

.result-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.result-icon {
  font-size: 1.6rem;
  line-height: 1;
}

.result-title {
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0 0 4px 0;
  color: #14532d;
}

.result-error .result-title {
  color: #991b1b;
}

.result-msg {
  font-size: 0.88rem;
  line-height: 1.5;
  color: #166534;
  margin: 0;
}

.result-error .result-msg {
  color: #b91c1c;
}

/* Credential Pills */
.credential-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cred-tag {
  background: #ffffff;
  border: 1px solid #bbf7d0;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tag-lbl {
  font-weight: 800;
  color: #15803d;
}

.tag-val {
  color: #0f172a;
  font-weight: 700;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.result-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-goto-login {
  background: #0284c7;
  color: #ffffff !important;
  font-size: 0.88rem;
  font-weight: 750;
  padding: 10px 18px;
  border-radius: 10px;
  text-decoration: none;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
  transition: all 0.2s ease;
}

.btn-goto-login:hover {
  background: #0369a1;
  transform: translateY(-1px);
}

.btn-goto-hub {
  background: #ffffff;
  color: #334155 !important;
  border: 1px solid #cbd5e1;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 10px 18px;
  border-radius: 10px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-goto-hub:hover {
  background: #f1f5f9;
}

/* Footer Nav */
.reg-footer-nav {
  text-align: center;
  margin-top: 24px;
}

.nav-back-link {
  color: #64748b;
  font-size: 0.88rem;
  font-weight: 650;
  text-decoration: none;
  transition: color 0.2s ease;
}

.nav-back-link:hover {
  color: #0284c7;
}

/* =========================================
   RESPONSIVE DESIGN (MOBILE & TABLET)
   ========================================= */
@media (max-width: 768px) {
  .reg-card-container {
    max-width: 100%;
  }
  .reg-title {
    font-size: 1.8rem;
  }
  .reg-form-card {
    padding: 22px 18px;
    border-radius: 18px;
  }
  .form-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .card-head-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .btn-sample-fill {
    width: 100%;
    text-align: center;
  }
  .credential-tags-row {
    flex-direction: column;
  }
  .result-actions {
    flex-direction: column;
    width: 100%;
  }
  .btn-goto-login,
  .btn-goto-hub {
    width: 100%;
    text-align: center;
    box-sizing: border-box;
  }
}
</style>

<template>
  <div class="about-page-wrapper">
    <!-- Background Gradient Accents -->
    <div class="glow-orb glow-orb-top"></div>
    <div class="glow-orb glow-orb-bottom"></div>

    <div class="about-container">
      <!-- 1. HERO SECTION -->
      <section class="about-hero">
        <div class="network-badge">
          <span class="live-dot"></span>
          <span>ETHEREUM SEPOLIA &bull; HEALTHRECORDS.SOL &bull; GPT-4O CLINICAL AI</span>
        </div>

        <h1 class="hero-title">
          Pioneering the Future of <br />
          <span class="title-highlight">Decentralized Healthcare</span>
        </h1>

        <p class="hero-subtitle">
          MedLedger AI transforms Electronic Health Records by merging immutable blockchain consensus with client-side AES-256 encryption and a GPT-4o diagnostic clinical intelligence engine. Where care comes first, and patients retain 100% data sovereignty.
        </p>

        <!-- Quick Action CTA Buttons -->
        <div class="hero-actions-row">
          <router-link to="/Login" class="btn-action-primary">
            <span>🚀 Enter 6 Role Portals</span>
            <span class="arrow">&rarr;</span>
          </router-link>

          <button type="button" class="btn-action-secondary" @click="showBlocksModal = true">
            <span>⛓️ Inspect Blockchain Ledger</span>
          </button>

          <router-link to="/RegisterPatient" class="btn-action-outline">
            <span>🛏️ Register New Patient</span>
          </router-link>
        </div>
      </section>

      <!-- 2. EXECUTIVE METRICS BAR -->
      <section class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon-box">🛡️</div>
          <div class="metric-info">
            <span class="metric-val">100%</span>
            <span class="metric-title">Patient Consent Custody</span>
            <span class="metric-desc">Zero unapproved disclosures; instant permission revocation</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box">⚡</div>
          <div class="metric-info">
            <span class="metric-val">&lt; 0.2s</span>
            <span class="metric-title">Cryptographic Verification</span>
            <span class="metric-desc">Tamper-proof SHA-256 proof on Ethereum Sepolia ledger</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box">🔒</div>
          <div class="metric-info">
            <span class="metric-val">AES-256</span>
            <span class="metric-title">Client-Side Encryption</span>
            <span class="metric-desc">Zero-knowledge enclave storage; plaintext never touches server</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box">🤖</div>
          <div class="metric-info">
            <span class="metric-val">GPT-4o</span>
            <span class="metric-title">Clinical Intelligence</span>
            <span class="metric-desc">NLP diagnostic triage, SOAP notes &amp; drug-drug interactions</span>
          </div>
        </div>
      </section>

      <!-- 3. PLATFORM ARCHITECTURE: 4 CORE PILLARS -->
      <section class="pillars-section">
        <div class="section-head">
          <span class="section-tag">ENGINEERING FOUNDATION</span>
          <h2 class="section-title">The Four Architectural Pillars</h2>
          <p class="section-sub">
            Built from the ground up to solve the security, interoperability, and latency challenges of legacy healthcare databases.
          </p>
        </div>

        <div class="pillars-grid">
          <!-- Pillar 1 -->
          <div class="pillar-card">
            <div class="pillar-header">
              <div class="pillar-num">01</div>
              <div class="pillar-icon-box bg-blue">🔐</div>
            </div>
            <h3 class="pillar-title">Client-Side AES-256-GCM Cryptography</h3>
            <p class="pillar-desc">
              All electronic health documents, lab panels, and physician notes undergo symmetric military-grade AES-256-GCM encryption in the user's browser before transmission. Server nodes and database clusters store only ciphertext.
            </p>
            <ul class="pillar-bullets">
              <li>✓ Zero plaintext exposure to database operators</li>
              <li>✓ Authenticated encryption with integrity authentication tags</li>
              <li>✓ Cryptographic keys held only by authorized actors</li>
            </ul>
          </div>

          <!-- Pillar 2 -->
          <div class="pillar-card">
            <div class="pillar-header">
              <div class="pillar-num">02</div>
              <div class="pillar-icon-box bg-emerald">📜</div>
            </div>
            <h3 class="pillar-title">Sepolia Smart Contract Consent (RBAC)</h3>
            <p class="pillar-desc">
              Patient authorization is enforced by <code>HealthRecords.sol</code> on Ethereum Sepolia. Patients grant and revoke access to individual doctors, diagnostic labs, or hospital organizations with on-chain cryptographic proofs.
            </p>
            <ul class="pillar-bullets">
              <li>✓ Real-time <code>grantAccess()</code> &amp; <code>revokeAccess()</code></li>
              <li>✓ Role-based access control with zero administrative backdoors</li>
              <li>✓ Instant revocation: revoking access disables decryption keys immediately</li>
            </ul>
          </div>

          <!-- Pillar 3 -->
          <div class="pillar-card">
            <div class="pillar-header">
              <div class="pillar-num">03</div>
              <div class="pillar-icon-box bg-amber">⛓️</div>
            </div>
            <h3 class="pillar-title">Immutable Ledger &amp; SHA-256 Anchoring</h3>
            <p class="pillar-desc">
              Every medical consultation, pathology panel, and prescription anchors an immutable SHA-256 digital fingerprint to the distributed ledger. If even a single comma in a medical record is altered, verification fails immediately.
            </p>
            <ul class="pillar-bullets">
              <li>✓ Mathematically chained blocks guarantee zero tampering</li>
              <li>✓ Distributed consensus eliminates single points of failure</li>
              <li>✓ Permanent audit trails with timestamped proof-of-existence</li>
            </ul>
          </div>

          <!-- Pillar 4 -->
          <div class="pillar-card">
            <div class="pillar-header">
              <div class="pillar-num">04</div>
              <div class="pillar-icon-box bg-purple">🤖</div>
            </div>
            <h3 class="pillar-title">GPT-4o Clinical Intelligence Suite</h3>
            <p class="pillar-desc">
              A private, de-identified clinical NLP engine assists physicians with multi-page longitudinal chart summarization, critical lab triage, drug-drug interaction matrix validation, and automated SOAP clinical documentation.
            </p>
            <ul class="pillar-bullets">
              <li>✓ De-identification pipeline strips 18 HIPAA identifiers</li>
              <li>✓ Real-time medication contraindication screening</li>
              <li>✓ Structured SOAP notes (Subjective, Objective, Assessment, Plan)</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 4. THE 6-ROLE HEALTHCARE ECOSYSTEM -->
      <section class="ecosystem-section">
        <div class="section-head">
          <span class="section-tag">UNIFIED COLLABORATION</span>
          <h2 class="section-title">Designed for All 6 Healthcare Stakeholders</h2>
          <p class="section-sub">
            MedLedger AI breaks down organizational silos while preserving strict boundary privacy.
          </p>
        </div>

        <div class="roles-showcase-grid">
          <!-- Patient -->
          <div class="role-showcase-card border-patient">
            <div class="role-avatar-row">
              <span class="role-emoji-lg">🛏️</span>
              <div>
                <h4 class="role-name">Patient Profile</h4>
                <span class="role-sub">Data Sovereign Owner</span>
              </div>
            </div>
            <p class="role-text">
              View your complete medical history across all clinics. Authorize attending doctors, view access logs, and revoke permissions at any time.
            </p>
            <router-link to="/LoginPatient" class="role-link text-patient">Enter Patient Portal &rarr;</router-link>
          </div>

          <!-- Doctor -->
          <div class="role-showcase-card border-doctor">
            <div class="role-avatar-row">
              <span class="role-emoji-lg">👨‍⚕️</span>
              <div>
                <h4 class="role-name">Doctor &amp; Clinician</h4>
                <span class="role-sub">Diagnostic Authority</span>
              </div>
            </div>
            <p class="role-text">
              Inspect patient EHRs with verified permission, generate AI diagnostic summaries, write Sepolia-anchored prescriptions, and review drug interactions.
            </p>
            <router-link to="/DoctorDashboard" class="role-link text-doctor">Enter Physician Console &rarr;</router-link>
          </div>

          <!-- Hospital -->
          <div class="role-showcase-card border-hospital">
            <div class="role-avatar-row">
              <span class="role-emoji-lg">🏥</span>
              <div>
                <h4 class="role-name">Hospital Admin</h4>
                <span class="role-sub">Institutional Operations</span>
              </div>
            </div>
            <p class="role-text">
              Admit and register patients, verify physician credentials, anchor departmental prescriptions, and oversee facility-wide compliance logs.
            </p>
            <router-link to="/HospitalDashboard" class="role-link text-hospital">Enter Hospital Admin &rarr;</router-link>
          </div>

          <!-- Lab -->
          <div class="role-showcase-card border-lab">
            <div class="role-avatar-row">
              <span class="role-emoji-lg">🔬</span>
              <div>
                <h4 class="role-name">Diagnostic Lab</h4>
                <span class="role-sub">Pathology &amp; Accessioning</span>
              </div>
            </div>
            <p class="role-text">
              Accession specimens with barcode IDs, upload clinical pathology test panels, and anchor immutable SHA-256 report proofs before distribution.
            </p>
            <router-link to="/LabDashboard" class="role-link text-lab">Enter Lab Portal &rarr;</router-link>
          </div>

          <!-- Insurance -->
          <div class="role-showcase-card border-insurance">
            <div class="role-avatar-row">
              <span class="role-emoji-lg">🏢</span>
              <div>
                <h4 class="role-name">Insurance Adjudicator</h4>
                <span class="role-sub">Claims &amp; Fraud Prevention</span>
              </div>
            </div>
            <p class="role-text">
              Adjudicate reimbursement claims by mathematically comparing submitted documentation against the on-chain SHA-256 medical record hash.
            </p>
            <router-link to="/InsuranceDashboard" class="role-link text-insurance">Enter Claims Portal &rarr;</router-link>
          </div>

          <!-- Admin -->
          <div class="role-showcase-card border-admin">
            <div class="role-avatar-row">
              <span class="role-emoji-lg">🛡️</span>
              <div>
                <h4 class="role-name">System Governance</h4>
                <span class="role-sub">Smart Contract Audit</span>
              </div>
            </div>
            <p class="role-text">
              Audit the cryptographic state of <code>HealthRecords.sol</code>, monitor node consensus, inspect RBAC identity mappings, and inspect block height.
            </p>
            <router-link to="/AdminDashboard" class="role-link text-admin">Enter Governance Portal &rarr;</router-link>
          </div>
        </div>
      </section>

      <!-- 5. COMPLIANCE & SECURITY STRIP -->
      <section class="compliance-banner">
        <div class="compliance-head">
          <span class="comp-icon">🛡️</span>
          <div>
            <h3 class="comp-title">Enterprise Security &amp; Regulatory Compliance</h3>
            <p class="comp-sub">Engineered to comply with the strictest healthcare privacy frameworks globally.</p>
          </div>
        </div>

        <div class="compliance-badges">
          <div class="comp-badge">
            <span class="badge-dot"></span>
            <strong>HIPAA Safe Harbor</strong>
            <span>§ 164.312 Enclave Cryptography</span>
          </div>
          <div class="comp-badge">
            <span class="badge-dot"></span>
            <strong>GDPR Article 17</strong>
            <span>Patient Right-to-be-Forgotten &amp; Consent</span>
          </div>
          <div class="comp-badge">
            <span class="badge-dot"></span>
            <strong>Zero Single Point of Failure</strong>
            <span>Multi-Node Distributed Consensus</span>
          </div>
          <div class="comp-badge">
            <span class="badge-dot"></span>
            <strong>AES-256-GCM</strong>
            <span>Client-Side Authenticated Ciphers</span>
          </div>
        </div>
      </section>

      <!-- 6. INTERACTIVE FAQ ACCORDION -->
      <section class="faq-section">
        <div class="section-head">
          <span class="section-tag">FREQUENTLY ASKED QUESTIONS</span>
          <h2 class="section-title">Understanding MedLedger AI</h2>
          <p class="section-sub">Clear answers to key questions about security, patient ownership, and blockchain mechanics.</p>
        </div>

        <div class="faq-list">
          <div
            v-for="(faq, fIdx) in faqs"
            :key="fIdx"
            class="faq-card"
            :class="{ 'faq-open': activeFaq === fIdx }"
            @click="toggleFaq(fIdx)"
          >
            <div class="faq-question-row">
              <span class="faq-q-text">{{ faq.q }}</span>
              <span class="faq-chevron">{{ activeFaq === fIdx ? '−' : '+' }}</span>
            </div>
            <div v-if="activeFaq === fIdx" class="faq-answer">
              <p>{{ faq.a }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 7. BOTTOM CALL TO ACTION -->
      <section class="bottom-cta-banner">
        <div class="cta-inner">
          <h2 class="cta-title">Ready to Experience Sovereign Healthcare?</h2>
          <p class="cta-desc">
            Sign in to any of the 6 roles or inspect the real-time cryptographic ledger right now.
          </p>
          <div class="cta-btn-group">
            <router-link to="/Login" class="btn-cta-white">
              <span>Sign In to Your Workspace &rarr;</span>
            </router-link>
            <button type="button" class="btn-cta-glass" @click="showBlocksModal = true">
              <span>Inspect Blockchain Ledger Blocks</span>
            </button>
            <router-link to="/" class="btn-cta-back">
              <span>&larr; Back to MedLedger AI Home</span>
            </router-link>
          </div>
        </div>
      </section>
    </div>

    <!-- Blockchain Blocks Modal -->
    <blocks-modal :visible="showBlocksModal" @close="showBlocksModal = false" />
  </div>
</template>

<script>
import BlocksModal from '../components/BlocksModal.vue';

export default {
  name: 'About',
  components: {
    BlocksModal
  },
  data() {
    return {
      showBlocksModal: false,
      activeFaq: 0,
      faqs: [
        {
          q: 'How does MedLedger AI differ from traditional hospital EHR systems?',
          a: 'Traditional hospital EHR systems store patient data in centralized vendor silos with fragmented access and vulnerable single points of failure. MedLedger AI stores cryptographic hashes on a decentralized blockchain ledger, encrypts records client-side with AES-256-GCM, and puts 100% consent control into the patient’s hands.'
        },
        {
          q: 'Can a doctor view my records without my explicit permission?',
          a: 'No. The smart contract HealthRecords.sol enforces zero-trust role-based access control. A doctor cannot decrypt or view any record unless the patient has explicitly granted them access. Furthermore, the patient can revoke access at any time with a single click, instantly cutting off authorization.'
        },
        {
          q: 'Are actual medical documents stored on the public blockchain?',
          a: 'No. Storing multi-megabyte PDFs or DICOM images directly on-chain is inefficient and compromises privacy. MedLedger AI encrypts the file client-side with AES-256-GCM and stores the ciphertext securely in encrypted GridFS storage, while only the immutable SHA-256 cryptographic verification fingerprint and access rules are anchored on the blockchain.'
        },
        {
          q: 'How does the GPT-4o Clinical AI protect patient privacy?',
          a: 'Before any clinical text is processed by the AI engine, a strict de-identification pipeline strips all 18 HIPAA Safe Harbor identifiers (including patient name, Aadhaar/SSN, phone, address, and dates). The clinical model analyzes only anonymized symptomology and medication terms.'
        },
        {
          q: 'How do Insurance companies verify claims without seeing unneeded private records?',
          a: 'Insurance adjudicators receive the specific claim document alongside its cryptographic SHA-256 hash. They query the blockchain smart contract to verify that the doctor’s anchored diagnosis matches the exact hash without requiring full access to the patient’s lifetime medical dossier.'
        }
      ]
    };
  },
  methods: {
    toggleFaq(idx) {
      this.activeFaq = this.activeFaq === idx ? null : idx;
    }
  }
};
</script>

<style scoped>
/* ========================================================= */
/* ABOUT MEDLEDGER AI - PREMIUM ENTERPRISE PRESENTATION      */
/* ========================================================= */

.about-page-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background: #f8fafc;
  overflow-x: hidden;
  padding: 40px 16px 80px 16px;
  box-sizing: border-box;
}

/* Background Ambient Glows */
.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  z-index: 0;
}

.glow-orb-top {
  top: -60px;
  right: 5%;
  width: 450px;
  height: 450px;
  background: radial-gradient(circle, rgba(2, 132, 199, 0.12) 0%, rgba(99, 102, 241, 0.04) 70%, transparent 100%);
}

.glow-orb-bottom {
  bottom: 10%;
  left: -100px;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(14, 165, 233, 0.04) 70%, transparent 100%);
}

.about-container {
  position: relative;
  z-index: 1;
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 60px;
}

/* 1. HERO SECTION */
.about-hero {
  text-align: center;
  padding: 30px 16px 10px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.network-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #e0f2fe;
  border: 1px solid #bae6fd;
  color: #0284c7;
  font-size: 0.75rem;
  font-weight: 750;
  padding: 6px 14px;
  border-radius: 9999px;
  letter-spacing: 0.04em;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.08);
}

.live-dot {
  width: 8px;
  height: 8px;
  background: #0284c7;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25);
  animation: pulseLive 2s infinite;
}

@keyframes pulseLive {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.6; }
}

.hero-title {
  font-size: 2.8rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.15;
  margin: 0 0 18px 0;
  letter-spacing: -0.03em;
}

.title-highlight {
  background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  font-size: 1.1rem;
  color: #475569;
  line-height: 1.6;
  max-width: 820px;
  margin: 0 0 32px 0;
  font-weight: 500;
}

.hero-actions-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.btn-action-primary {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: #ffffff;
  padding: 13px 26px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 800;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 16px rgba(2, 132, 199, 0.3);
  transition: all 0.2s ease;
}

.btn-action-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(2, 132, 199, 0.4);
}

.btn-action-secondary {
  background: #ffffff;
  color: #0284c7;
  border: 1.5px solid #bae6fd;
  padding: 12px 22px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.btn-action-secondary:hover {
  background: #f0f9ff;
  border-color: #0284c7;
  transform: translateY(-2px);
}

.btn-action-outline {
  background: transparent;
  color: #334155;
  border: 1.5px solid #cbd5e1;
  padding: 12px 22px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-action-outline:hover {
  background: #ffffff;
  border-color: #94a3b8;
  color: #0f172a;
}

/* 2. METRICS GRID */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.metric-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 22px 20px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  text-align: left;
}

.metric-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.07);
  border-color: #cbd5e1;
}

.metric-icon-box {
  font-size: 1.8rem;
  line-height: 1;
  flex-shrink: 0;
}

.metric-info {
  display: flex;
  flex-direction: column;
}

.metric-val {
  font-size: 1.6rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.metric-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: #0284c7;
  margin: 4px 0 3px 0;
}

.metric-desc {
  font-size: 0.76rem;
  color: #64748b;
  line-height: 1.35;
}

/* 3. SECTION HEADINGS */
.section-head {
  text-align: center;
  max-width: 760px;
  margin: 0 auto 36px auto;
}

.section-tag {
  display: inline-block;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 4px 12px;
  border-radius: 9999px;
  margin-bottom: 10px;
}

.section-title {
  font-size: 2.1rem;
  font-weight: 850;
  color: #0f172a;
  margin: 0 0 10px 0;
  letter-spacing: -0.02em;
}

.section-sub {
  font-size: 0.95rem;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}

/* 4. PILLARS GRID */
.pillars-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.pillar-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 28px;
  text-align: left;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
}

.pillar-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
  border-color: #cbd5e1;
}

.pillar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.pillar-num {
  font-size: 1.6rem;
  font-weight: 900;
  color: #94a3b8;
  font-family: monospace;
}

.pillar-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.bg-blue { background: #e0f2fe; }
.bg-emerald { background: #d1fae5; }
.bg-amber { background: #fef3c7; }
.bg-purple { background: #f3e8ff; }

.pillar-title {
  font-size: 1.25rem;
  font-weight: 850;
  color: #0f172a;
  margin: 0 0 10px 0;
  letter-spacing: -0.01em;
}

.pillar-desc {
  font-size: 0.88rem;
  color: #475569;
  line-height: 1.55;
  margin: 0 0 16px 0;
  flex: 1;
}

.pillar-bullets {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid #f1f5f9;
  padding-top: 14px;
}

.pillar-bullets li {
  font-size: 0.8rem;
  font-weight: 650;
  color: #334155;
}

/* 5. 6-ROLE ECOSYSTEM */
.roles-showcase-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.role-showcase-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  text-align: left;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.role-showcase-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.07);
}

.border-patient { border-top: 5px solid #0284c7; }
.border-doctor { border-top: 5px solid #059669; }
.border-hospital { border-top: 5px solid #4f46e5; }
.border-lab { border-top: 5px solid #d97706; }
.border-insurance { border-top: 5px solid #0891b2; }
.border-admin { border-top: 5px solid #dc2626; }

.role-avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.role-emoji-lg {
  font-size: 1.8rem;
  line-height: 1;
}

.role-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 850;
  color: #0f172a;
}

.role-sub {
  font-size: 0.72rem;
  font-weight: 650;
  color: #64748b;
}

.role-text {
  font-size: 0.84rem;
  color: #475569;
  line-height: 1.5;
  margin: 0 0 16px 0;
  flex: 1;
}

.role-link {
  font-size: 0.82rem;
  font-weight: 800;
  text-decoration: none;
  display: inline-block;
  transition: transform 0.15s ease;
}

.role-link:hover {
  transform: translateX(3px);
}

.text-patient { color: #0284c7; }
.text-doctor { color: #059669; }
.text-hospital { color: #4f46e5; }
.text-lab { color: #d97706; }
.text-insurance { color: #0891b2; }
.text-admin { color: #dc2626; }

/* 6. COMPLIANCE STRIP */
.compliance-banner {
  background: #0f172a;
  color: #ffffff;
  border-radius: 20px;
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.15);
}

.compliance-head {
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
}

.comp-icon {
  font-size: 2.2rem;
}

.comp-title {
  margin: 0 0 4px 0;
  font-size: 1.3rem;
  font-weight: 850;
  color: #ffffff;
}

.comp-sub {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

.compliance-badges {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.comp-badge {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
}

.badge-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  margin-bottom: 4px;
}

.comp-badge strong {
  font-size: 0.85rem;
  color: #ffffff;
}

.comp-badge span {
  font-size: 0.72rem;
  color: #94a3b8;
}

/* 7. FAQ ACCORDION */
.faq-list {
  max-width: 820px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 22px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.faq-card:hover {
  border-color: #cbd5e1;
}

.faq-card.faq-open {
  border-color: #bae6fd;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.08);
}

.faq-question-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.faq-q-text {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.faq-chevron {
  font-size: 1.3rem;
  font-weight: 700;
  color: #0284c7;
  line-height: 1;
}

.faq-answer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.faq-answer p {
  margin: 0;
  font-size: 0.86rem;
  color: #475569;
  line-height: 1.55;
}

/* 8. BOTTOM CTA */
.bottom-cta-banner {
  background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%);
  border-radius: 20px;
  padding: 44px 32px;
  color: #ffffff;
  box-shadow: 0 16px 40px rgba(2, 132, 199, 0.25);
  text-align: center;
}

.cta-inner {
  max-width: 680px;
  margin: 0 auto;
}

.cta-title {
  font-size: 1.9rem;
  font-weight: 900;
  margin: 0 0 10px 0;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.cta-desc {
  font-size: 0.95rem;
  color: #e0f2fe;
  line-height: 1.5;
  margin: 0 0 28px 0;
}

.cta-btn-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-cta-white {
  background: #ffffff;
  color: #0284c7;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 0.92rem;
  font-weight: 850;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  transition: all 0.2s ease;
}

.btn-cta-white:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
}

.btn-cta-glass {
  background: rgba(255, 255, 255, 0.18);
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  color: #ffffff;
  padding: 11px 22px;
  border-radius: 12px;
  font-size: 0.92rem;
  font-weight: 750;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
}

.btn-cta-glass:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.btn-cta-back {
  background: transparent;
  color: #ffffff;
  padding: 11px 18px;
  border-radius: 12px;
  font-size: 0.88rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-cta-back:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* ========================================================= */
/* RESPONSIVE DESIGN FOR TABLET & MOBILE                    */
/* ========================================================= */
@media (max-width: 960px) {
  .hero-title {
    font-size: 2.2rem;
  }
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .pillars-grid {
    grid-template-columns: 1fr;
  }
  .roles-showcase-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .compliance-badges {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 1.8rem;
  }
  .hero-subtitle {
    font-size: 0.92rem;
  }
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  .roles-showcase-grid {
    grid-template-columns: 1fr;
  }
  .compliance-badges {
    grid-template-columns: 1fr;
  }
  .cta-title {
    font-size: 1.5rem;
  }
  .bottom-cta-banner {
    padding: 32px 18px;
  }
  .cta-btn-group {
    flex-direction: column;
    width: 100%;
  }
  .btn-cta-white,
  .btn-cta-glass,
  .btn-cta-back {
    width: 100%;
    box-sizing: border-box;
  }
}
</style>

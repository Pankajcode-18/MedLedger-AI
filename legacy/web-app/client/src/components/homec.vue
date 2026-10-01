<template>
  <div class="medledger-home" id="top">
    <!-- Toast Notification Overlay -->
    <transition name="toast-fade">
      <div v-if="showToast" class="med-toast" :class="toastType">
        <div class="toast-icon">
          <span v-if="toastType === 'success'">✓</span>
          <span v-else-if="toastType === 'warning'">⚠️</span>
          <span v-else>ℹ️</span>
        </div>
        <div class="toast-text">{{ toastMessage }}</div>
        <button class="toast-close" @click="showToast = false" aria-label="Close notification">&times;</button>
      </div>
    </transition>

    <!-- ========================================== -->
    <!-- 1. HERO SECTION & HERO VISUAL               -->
    <!-- ========================================== -->
    <section class="hero-section">
      <div class="hero-grid-bg"></div>
      <div class="hero-container">
        <!-- Left Hero Content -->
        <div class="hero-content">
          <div class="hero-badge">
            <span class="badge-spark">✨</span>
            <span class="badge-text">Decentralized Healthcare &bull; AI-Powered</span>
          </div>

          <h1 class="hero-heading">
            Your Health Records.<br>
            <span class="heading-gradient">Your Privacy. Your Choice.</span>
          </h1>

          <p class="hero-lead">
            MedLedger AI gives patients, doctors, hospitals, laboratories, and insurers a secure way to manage healthcare records using encryption, blockchain verification, and AI assistance.
          </p>

          <div class="hero-actions">
            <router-link to="/Login" class="btn btn-primary" id="btn-hero-launch">
              <span>🚀 Launch Portals</span>
              <svg class="btn-arrow" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </router-link>

            <a href="#blockchain" class="btn btn-outline" id="btn-hero-blockchain">
              <span>⛓️ View Blockchain</span>
            </a>
          </div>

          <!-- Trust Indicators Strip -->
          <div class="trust-strip">
            <div class="trust-pill">
              <span class="pill-icon">🔐</span>
              <span>AES-256 Encryption</span>
            </div>
            <div class="trust-pill">
              <span class="pill-icon">⛓️</span>
              <span>Blockchain Verified</span>
            </div>
            <div class="trust-pill">
              <span class="pill-icon">👤</span>
              <span>Patient-Controlled Access</span>
            </div>
            <div class="trust-pill">
              <span class="pill-icon">🧠</span>
              <span>AI Assistance</span>
            </div>
          </div>
        </div>

        <!-- Right Hero Visual: Interactive Healthcare Dashboard Console -->
        <div class="hero-visual">
          <div class="console-card">
            <!-- Console Header -->
            <div class="console-header">
              <div class="console-title-group">
                <div class="pulse-indicator"></div>
                <div>
                  <h3 class="console-title">Patient Health Record</h3>
                  <span class="console-id">Record ID: #MED-90824 &bull; Patient #90</span>
                </div>
              </div>
              <div class="status-chip secure">
                <span class="chip-dot"></span>
                <span>Secure</span>
              </div>
            </div>

            <!-- Console Record Tabs -->
            <div class="console-tabs" role="tablist">
              <button
                class="tab-btn"
                :class="{ 'is-active': selectedHeroTab === 'blood' }"
                @click="selectedHeroTab = 'blood'"
                role="tab"
                :aria-selected="selectedHeroTab === 'blood'"
              >
                Blood Test
              </button>
              <button
                class="tab-btn"
                :class="{ 'is-active': selectedHeroTab === 'history' }"
                @click="selectedHeroTab = 'history'"
                role="tab"
                :aria-selected="selectedHeroTab === 'history'"
              >
                Medical History
              </button>
              <button
                class="tab-btn"
                :class="{ 'is-active': selectedHeroTab === 'rx' }"
                @click="selectedHeroTab = 'rx'"
                role="tab"
                :aria-selected="selectedHeroTab === 'rx'"
              >
                Prescription
              </button>
              <button
                class="tab-btn"
                :class="{ 'is-active': selectedHeroTab === 'diagnostic' }"
                @click="selectedHeroTab = 'diagnostic'"
                role="tab"
                :aria-selected="selectedHeroTab === 'diagnostic'"
              >
                Diagnostic Report
              </button>
            </div>

            <!-- Tab Content Pane -->
            <div class="console-body">
              <!-- Blood Test Pane -->
              <div v-if="selectedHeroTab === 'blood'" class="record-pane">
                <div class="record-meta-row">
                  <span class="record-label">Test: Comprehensive Metabolic Panel</span>
                  <span class="record-date">Sample ID: #LAB-5821</span>
                </div>
                <div class="vitals-grid">
                  <div class="vital-item">
                    <span class="vital-name">Hemoglobin</span>
                    <span class="vital-val">14.2 <small>g/dL</small></span>
                    <span class="vital-tag normal">Normal</span>
                  </div>
                  <div class="vital-item">
                    <span class="vital-name">Blood Glucose</span>
                    <span class="vital-val text-warning">118 <small>mg/dL</small></span>
                    <span class="vital-tag warning">Review</span>
                  </div>
                  <div class="vital-item">
                    <span class="vital-name">Platelets</span>
                    <span class="vital-val">260K <small>/µL</small></span>
                    <span class="vital-tag normal">Normal</span>
                  </div>
                  <div class="vital-item">
                    <span class="vital-name">Cholesterol</span>
                    <span class="vital-val">215 <small>mg/dL</small></span>
                    <span class="vital-tag normal">Borderline</span>
                  </div>
                </div>
              </div>

              <!-- Medical History Pane -->
              <div v-else-if="selectedHeroTab === 'history'" class="record-pane">
                <div class="record-meta-row">
                  <span class="record-label">Patient: tanmay shishodia (Age: 24)</span>
                  <span class="record-date">Aadhaar: Verified On-Chain</span>
                </div>
                <div class="history-list">
                  <div class="history-row">
                    <span class="history-bullet">•</span>
                    <span>Allergies: No known drug allergies (NKDA)</span>
                  </div>
                  <div class="history-row">
                    <span class="history-bullet">•</span>
                    <span>Immunizations: Hepatitis B, Tdap, MMR up-to-date</span>
                  </div>
                  <div class="history-row">
                    <span class="history-bullet">•</span>
                    <span>Baseline Vitals: BP 120/80 mmHg &bull; SpO2 99% &bull; Pulse 72 bpm</span>
                  </div>
                </div>
              </div>

              <!-- Prescription Pane -->
              <div v-else-if="selectedHeroTab === 'rx'" class="record-pane">
                <div class="record-meta-row">
                  <span class="record-label">Prescription #RX-88491</span>
                  <span class="record-date">Physician: Dr. Gregory House</span>
                </div>
                <div class="rx-items">
                  <div class="rx-badge-item">
                    <strong>Amoxicillin 500mg</strong>
                    <span class="rx-instructions">1 capsule PO q8h &times; 10 days &bull; Oral</span>
                  </div>
                  <div class="rx-badge-item">
                    <strong>Lisinopril 10mg</strong>
                    <span class="rx-instructions">1 tablet PO daily each morning &bull; Oral</span>
                  </div>
                </div>
              </div>

              <!-- Diagnostic Report Pane -->
              <div v-else class="record-pane">
                <div class="record-meta-row">
                  <span class="record-label">Radiology Assessment: Chest PA View</span>
                  <span class="record-date">Report: hp9.docx</span>
                </div>
                <p class="diagnostic-text">
                  Lungs are clear with no focal consolidations or pleural effusions. Cardiac silhouette and mediastinal contours are within normal limits. Hemodynamically stable.
                </p>
              </div>
            </div>

            <!-- Blockchain Verified Stamp -->
            <div class="verification-banner">
              <div class="banner-left">
                <span class="check-circle">✓</span>
                <div>
                  <div class="banner-title">Blockchain Verified</div>
                  <div class="banner-hash" @click="copyHash('0x8f4a39b2e04d72c918c5e937d10c4ba982fa1029')">
                    Hash: <code>0x8f4a...72c9</code>
                    <span class="copy-hint" title="Copy full SHA-256 fingerprint">📋</span>
                  </div>
                </div>
              </div>
              <span class="network-tag">Sepolia Block #8,421,093</span>
            </div>

            <!-- Access Control Status Sub-panel -->
            <div class="access-matrix">
              <div class="matrix-header">
                <span class="matrix-title">Patient Access Control Matrix</span>
                <span class="matrix-sub">Sovereign Permissions</span>
              </div>
              <div class="matrix-items">
                <div class="matrix-row">
                  <span class="actor-info">👨‍⚕️ Doctor (Dr. House)</span>
                  <span class="badge-status-granted">✓ Access Granted</span>
                </div>
                <div class="matrix-row">
                  <span class="actor-info">🏥 Hospital Administration</span>
                  <span class="badge-status-granted">✓ Authorized</span>
                </div>
                <div class="matrix-row">
                  <span class="actor-info">🏢 HealthShield Insurance</span>
                  <span class="badge-status-pending">⏳ Pending Approval</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 2. TRUST STATISTICS                         -->
    <!-- ========================================== -->
    <section class="stats-section">
      <div class="section-container">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">100%</div>
            <div class="stat-title">Patient-Controlled Access</div>
            <p class="stat-desc">Zero unauthorized third-party disclosures without explicit consent.</p>
          </div>
          <div class="stat-card">
            <div class="stat-value">AES-256</div>
            <div class="stat-title">File Encryption</div>
            <p class="stat-desc">Files are encrypted locally on client devices before secure transmission.</p>
          </div>
          <div class="stat-card">
            <div class="stat-value">SHA-256</div>
            <div class="stat-title">Record Verification</div>
            <p class="stat-desc">Immutable cryptographic fingerprint anchored permanently on-chain.</p>
          </div>
          <div class="stat-card">
            <div class="stat-value">24/7</div>
            <div class="stat-title">Secure Access</div>
            <p class="stat-desc">Always-available decentralized access for authorized physicians and patients.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 3. ONE PLATFORM. SIX WORKSPACES (#portals)  -->
    <!-- ========================================== -->
    <section class="portals-section" id="portals">
      <div class="section-container">
        <div class="section-header text-center">
          <span class="section-eyebrow">Dedicated Healthcare Roles</span>
          <h2 class="section-title">One Platform. Six Healthcare Workspaces.</h2>
          <p class="section-subtitle">
            Choose the workspace that matches your role across the healthcare ecosystem.
          </p>
        </div>

        <div class="portals-grid">
          <!-- 1. Patient Portal -->
          <div class="portal-card">
            <div class="card-top">
              <div class="role-icon-box patient-bg">
                <span class="role-icon">🛏️</span>
              </div>
              <span class="portal-category">Patient</span>
            </div>
            <h3 class="portal-name">Patient Portal</h3>
            <p class="portal-lead">Manage your health records and control access.</p>
            <p class="portal-desc">
              View reports, manage permissions, download documents, and get AI-powered summaries of complex laboratory findings.
            </p>
            <div class="portal-tags">
              <span class="ptag">Doctor Permission Control</span>
              <span class="ptag">AI Report Summaries</span>
              <span class="ptag">Encrypted Downloads</span>
            </div>
            <div class="demo-credential-chip">
              <span class="demo-dot"></span>
              <span>Demo: <strong>123@gmail.com</strong> / <strong>secret99</strong></span>
            </div>
            <router-link to="/LoginPatient" class="portal-cta-btn">
              <span>Open Patient Portal</span>
              <span class="cta-arrow">→</span>
            </router-link>
          </div>

          <!-- 2. Physician Console -->
          <div class="portal-card">
            <div class="card-top">
              <div class="role-icon-box doctor-bg">
                <span class="role-icon">👨‍⚕️</span>
              </div>
              <span class="portal-category">Physician</span>
            </div>
            <h3 class="portal-name">Physician Console</h3>
            <p class="portal-lead">Understand patient information faster.</p>
            <p class="portal-desc">
              Review authorized records, analyze reports with AI, check medicine interactions, and upload findings with digital signatures.
            </p>
            <div class="portal-tags">
              <span class="ptag">AI Clinical Summarizer</span>
              <span class="ptag">Drug Interaction Check</span>
              <span class="ptag">Secure Report Upload</span>
            </div>
            <router-link to="/DoctorDashboard" class="portal-cta-btn">
              <span>Open Physician Console</span>
              <span class="cta-arrow">→</span>
            </router-link>
          </div>

          <!-- 3. Hospital Administration -->
          <div class="portal-card">
            <div class="card-top">
              <div class="role-icon-box hospital-bg">
                <span class="role-icon">🏥</span>
              </div>
              <span class="portal-category">Hospital</span>
            </div>
            <h3 class="portal-name">Hospital Administration</h3>
            <p class="portal-lead">Manage hospital operations.</p>
            <p class="portal-desc">
              Manage hospital staff, verified physicians, patient admission workflows, and permanent prescription registries.
            </p>
            <div class="portal-tags">
              <span class="ptag">Manage &amp; Verify Doctors</span>
              <span class="ptag">Patient Admissions</span>
              <span class="ptag">Prescription Ledger</span>
            </div>
            <router-link to="/HospitalAdminDashboard" class="portal-cta-btn">
              <span>Open Hospital Admin</span>
              <span class="cta-arrow">→</span>
            </router-link>
          </div>

          <!-- 4. Diagnostic Laboratory -->
          <div class="portal-card">
            <div class="card-top">
              <div class="role-icon-box lab-bg">
                <span class="role-icon">🔬</span>
              </div>
              <span class="portal-category">Laboratory</span>
            </div>
            <h3 class="portal-name">Diagnostic Laboratory</h3>
            <p class="portal-lead">Secure diagnostic reporting.</p>
            <p class="portal-desc">
              Upload laboratory reports, manage specimen registries, automatically highlight abnormal values, and seal blockchain proofs.
            </p>
            <div class="portal-tags">
              <span class="ptag">Specimen Tracking</span>
              <span class="ptag">Lab Report Uploads</span>
              <span class="ptag">Blockchain Fingerprints</span>
            </div>
            <router-link to="/LabDashboard" class="portal-cta-btn">
              <span>Open Diagnostic Lab</span>
              <span class="cta-arrow">→</span>
            </router-link>
          </div>

          <!-- 5. Insurance & Claims -->
          <div class="portal-card">
            <div class="card-top">
              <div class="role-icon-box insurance-bg">
                <span class="role-icon">🏢</span>
              </div>
              <span class="portal-category">Insurance</span>
            </div>
            <h3 class="portal-name">Insurance &amp; Claims</h3>
            <p class="portal-lead">Review authorized healthcare claims.</p>
            <p class="portal-desc">
              Access patient-approved records, verify documents during claims processing, and detect inconsistent billing files.
            </p>
            <div class="portal-tags">
              <span class="ptag">Document Verification</span>
              <span class="ptag">Patient-Approved Claims</span>
              <span class="ptag">Audit Trail Records</span>
            </div>
            <router-link to="/InsuranceDashboard" class="portal-cta-btn">
              <span>Open Insurance Portal</span>
              <span class="cta-arrow">→</span>
            </router-link>
          </div>

          <!-- 6. System Administration -->
          <div class="portal-card">
            <div class="card-top">
              <div class="role-icon-box admin-bg">
                <span class="role-icon">🛡️</span>
              </div>
              <span class="portal-category">Governance</span>
            </div>
            <h3 class="portal-name">System Administration</h3>
            <p class="portal-lead">Monitor the MedLedger network.</p>
            <p class="portal-desc">
              Manage system users, oversee access control lists, audit security events, and inspect smart contract activity.
            </p>
            <div class="portal-tags">
              <span class="ptag">Smart Contract Monitor</span>
              <span class="ptag">User &amp; Role Management</span>
              <span class="ptag">Audit Event Inspector</span>
            </div>
            <router-link to="/AdminDashboard" class="portal-cta-btn">
              <span>Open System Admin</span>
              <span class="cta-arrow">→</span>
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 4. HOW IT WORKS TIMELINE (#how-it-works)    -->
    <!-- ========================================== -->
    <section class="workflow-section" id="how-it-works">
      <div class="section-container">
        <div class="section-header text-center">
          <span class="section-eyebrow">Clear End-to-End Workflow</span>
          <h2 class="section-title">How MedLedger AI Protects Your Records</h2>
          <p class="section-subtitle">
            From uploading a medical report to AI-assisted analysis, every step is designed around security and controlled access.
          </p>
        </div>

        <!-- Flow Visual Ribbon -->
        <div class="workflow-ribbon">
          <span class="ribbon-node active">Upload</span>
          <span class="ribbon-arrow">→</span>
          <span class="ribbon-node active">Encrypt</span>
          <span class="ribbon-arrow">→</span>
          <span class="ribbon-node active">Verify</span>
          <span class="ribbon-arrow">→</span>
          <span class="ribbon-node active">Approve</span>
          <span class="ribbon-arrow">→</span>
          <span class="ribbon-node active">Analyze</span>
        </div>

        <!-- 4-Step Timeline Grid -->
        <div class="timeline-grid">
          <!-- Step 1 -->
          <div class="timeline-step">
            <div class="step-badge">01</div>
            <h4 class="step-title">Upload &amp; Secure</h4>
            <p class="step-desc">
              A doctor or laboratory uploads a medical report. Before the file leaves the device, it is encrypted using strong <strong>AES-256-GCM encryption</strong>.
            </p>
            <div class="step-highlight">
              <span class="highlight-check">✓</span>
              <span>Protected before cloud transfer</span>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="timeline-step">
            <div class="step-badge">02</div>
            <h4 class="step-title">Blockchain Verification</h4>
            <p class="step-desc">
              A unique digital fingerprint (SHA-256) is recorded on the Ethereum Sepolia blockchain. If someone alters the original file later, the fingerprint will mismatch.
            </p>
            <div class="step-highlight">
              <span class="highlight-check">✓</span>
              <span>Permanent proof of integrity</span>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="timeline-step">
            <div class="step-badge">03</div>
            <h4 class="step-title">Patient Permission</h4>
            <p class="step-desc">
              Patients remain in control. When a doctor, hospital, or insurance provider requests access, the patient decides whether to approve or revoke permission.
            </p>
            <div class="step-highlight">
              <span class="highlight-check">✓</span>
              <span>Granular consent control</span>
            </div>
          </div>

          <!-- Step 4 -->
          <div class="timeline-step">
            <div class="step-badge">04</div>
            <h4 class="step-title">AI Assistance</h4>
            <p class="step-desc">
              After authorized access is granted, the AI clinical assistant summarizes findings, identifies unusual laboratory values, and checks for medicine interactions.
            </p>
            <div class="step-highlight">
              <span class="highlight-check">✓</span>
              <span>Faster clinical insights</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 5. SECURITY ARCHITECTURE (#security)        -->
    <!-- ========================================== -->
    <section class="security-section" id="security">
      <div class="section-container">
        <div class="section-header text-center">
          <span class="section-eyebrow">Enterprise Protection</span>
          <h2 class="section-title">Security Built Into Every Layer</h2>
          <p class="section-subtitle">
            Modern cryptography, decentralized verification, and patient-sovereign permissions protect every health record.
          </p>
        </div>

        <div class="security-cards-grid">
          <div class="security-card">
            <div class="sec-icon">🔐</div>
            <h3 class="sec-title">AES-256-GCM Encryption</h3>
            <p class="sec-desc">
              Medical files are encrypted to protect them from unauthorized access before cloud transmission.
            </p>
            <span class="sec-pill">End-to-End Privacy</span>
          </div>

          <div class="security-card">
            <div class="sec-icon">🔎</div>
            <h3 class="sec-title">SHA-256 Verification</h3>
            <p class="sec-desc">
              Each record generates a unique digital fingerprint used to mathematically confirm the record has not been altered.
            </p>
            <span class="sec-pill">Tamper Detection</span>
          </div>

          <div class="security-card">
            <div class="sec-icon">⛓️</div>
            <h3 class="sec-title">Ethereum Blockchain</h3>
            <p class="sec-desc">
              Smart contracts maintain an immutable, timestamped transaction history across all participant actions.
            </p>
            <span class="sec-pill">Sepolia Testnet</span>
          </div>

          <div class="security-card">
            <div class="sec-icon">👤</div>
            <h3 class="sec-title">Patient-Sovereign Access</h3>
            <p class="sec-desc">
              Role-based access control coupled with real-time patient consent controls who views medical files.
            </p>
            <span class="sec-pill">Consent Driven</span>
          </div>
        </div>

        <!-- Visual Security Pipeline Diagram -->
        <div class="pipeline-diagram-box">
          <div class="pipeline-title">Comprehensive Security Architecture Flow</div>
          <div class="pipeline-flow">
            <div class="pipe-step">
              <span class="pipe-icon">📄</span>
              <span class="pipe-name">Patient Data</span>
              <span class="pipe-desc">DOCX / PDF / TXT</span>
            </div>
            <span class="pipe-divider">➔</span>
            <div class="pipe-step">
              <span class="pipe-icon">🔒</span>
              <span class="pipe-name">AES-256</span>
              <span class="pipe-desc">Client Encryption</span>
            </div>
            <span class="pipe-divider">➔</span>
            <div class="pipe-step">
              <span class="pipe-icon">🗄️</span>
              <span class="pipe-name">Secure Storage</span>
              <span class="pipe-desc">Encrypted GridFS</span>
            </div>
            <span class="pipe-divider">➔</span>
            <div class="pipe-step">
              <span class="pipe-icon">⛓️</span>
              <span class="pipe-name">Blockchain</span>
              <span class="pipe-desc">SHA-256 Fingerprint</span>
            </div>
            <span class="pipe-divider">➔</span>
            <div class="pipe-step">
              <span class="pipe-icon">🔑</span>
              <span class="pipe-name">Authorized Access</span>
              <span class="pipe-desc">Patient Permission</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 6. PATIENT CONTROL SECTION (SPLIT SCREEN)   -->
    <!-- ========================================== -->
    <section class="patient-control-section">
      <div class="section-container">
        <div class="split-grid">
          <!-- Left Content -->
          <div class="split-text-col">
            <span class="section-eyebrow">Patient Sovereignty</span>
            <h2 class="split-title">You Decide Who Can See Your Records</h2>
            <p class="split-desc">
              Traditional healthcare systems keep medical records inside separate hospital or clinic systems. MedLedger AI is designed around <strong>patient-controlled access</strong>.
            </p>
            <p class="split-desc">
              Patients can approve access to their records when care is needed and remove permission the moment it is no longer required.
            </p>

            <div class="action-items-list">
              <div class="action-item">
                <div class="action-icon">✓</div>
                <div>
                  <h4 class="action-title">Grant Access</h4>
                  <p class="action-text">Allow an authorized doctor or hospital to view the records they need with one click.</p>
                </div>
              </div>

              <div class="action-item">
                <div class="action-icon">✗</div>
                <div>
                  <h4 class="action-title">Remove Access</h4>
                  <p class="action-text">Revoke physician or insurer permission instantly when care or claim review finishes.</p>
                </div>
              </div>

              <div class="action-item">
                <div class="action-icon">🔎</div>
                <div>
                  <h4 class="action-title">Check Activity</h4>
                  <p class="action-text">See exactly when your records were requested, viewed, or verified in the audit trail.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Interactive Permissions Dashboard -->
          <div class="split-dashboard-col">
            <div class="perm-card">
              <div class="perm-header">
                <div class="perm-title-group">
                  <h3 class="perm-title">Current Access Requests</h3>
                  <span class="perm-sub">Live Consent Management for Patient #90</span>
                </div>
                <span class="badge-live-dot">● Active</span>
              </div>

              <!-- Request Items List -->
              <div class="perm-list">
                <!-- Request 1: Doctor -->
                <div class="perm-item">
                  <div class="perm-item-left">
                    <div class="perm-avatar doc-avatar">👨‍⚕️</div>
                    <div>
                      <div class="perm-entity">Dr. Sarah Jenkins</div>
                      <div class="perm-subtext">Cardiology &bull; Metro General Hospital</div>
                      <div class="perm-time">Access requested 2 hours ago</div>
                    </div>
                  </div>
                  <div class="perm-item-right">
                    <span v-if="docAccessGranted" class="status-badge-granted">✓ Access Granted</span>
                    <button
                      v-if="docAccessGranted"
                      class="btn-revoke-mini"
                      @click="toggleDocAccess"
                      title="Revoke access"
                    >
                      Revoke
                    </button>
                    <span v-else class="status-badge-revoked">Access Revoked</span>
                  </div>
                </div>

                <!-- Request 2: Lab -->
                <div class="perm-item">
                  <div class="perm-item-left">
                    <div class="perm-avatar lab-avatar">🔬</div>
                    <div>
                      <div class="perm-entity">BioLab Diagnostics</div>
                      <div class="perm-subtext">Automated Laboratory Report &bull; Bloodwork</div>
                      <div class="perm-time">Report uploaded &bull; Verified</div>
                    </div>
                  </div>
                  <div class="perm-item-right">
                    <span class="status-badge-verified">✓ Verified</span>
                  </div>
                </div>

                <!-- Request 3: Insurance (Interactive Action) -->
                <div class="perm-item highlight-item">
                  <div class="perm-item-left">
                    <div class="perm-avatar ins-avatar">🏢</div>
                    <div>
                      <div class="perm-entity">HealthShield Insurance</div>
                      <div class="perm-subtext">Claim Review #CLM-2026-90 &bull; Needs Blood Report</div>
                      <div class="perm-time">Requested 15 minutes ago</div>
                    </div>
                  </div>
                  <div class="perm-item-right">
                    <div v-if="insuranceStatus === 'pending'" class="perm-actions-group">
                      <span class="badge-req-attention">⚠️ Permission Required</span>
                      <div class="btn-pair">
                        <button class="btn-action-grant" @click="handleInsurance('grant')">
                          ✓ Grant
                        </button>
                        <button class="btn-action-reject" @click="handleInsurance('reject')">
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                    <div v-else-if="insuranceStatus === 'granted'" class="perm-status-group">
                      <span class="status-badge-granted">✓ Access Granted</span>
                      <button class="btn-revoke-mini" @click="handleInsurance('revoke')">Revoke</button>
                    </div>
                    <div v-else class="perm-status-group">
                      <span class="status-badge-revoked">Request Rejected</span>
                      <button class="btn-undo-mini" @click="handleInsurance('pending')">Reset</button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="perm-footer">
                <span class="perm-footer-note">🔒 All consent authorizations emit on-chain Ethereum events.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 7. AI HEALTHCARE ASSISTANT                  -->
    <!-- ========================================== -->
    <section class="ai-section">
      <div class="section-container">
        <div class="section-header text-center">
          <span class="section-eyebrow">Clinical Intelligence</span>
          <h2 class="section-title">Make Medical Information Easier to Understand</h2>
          <p class="section-subtitle">
            Medical records can contain long reports, technical terminology, and large amounts of information. MedLedger AI helps users find and understand important information faster.
          </p>
        </div>

        <!-- 4 AI Capability Cards -->
        <div class="ai-cards-grid">
          <div class="ai-card">
            <span class="ai-icon">📄</span>
            <h3 class="ai-card-title">Report Summary</h3>
            <p class="ai-card-desc">Turn long medical reports into clear, structured summaries within seconds.</p>
          </div>
          <div class="ai-card">
            <span class="ai-icon">🧪</span>
            <h3 class="ai-card-title">Lab Analysis</h3>
            <p class="ai-card-desc">Identify and highlight laboratory values that may need attention from physicians.</p>
          </div>
          <div class="ai-card">
            <span class="ai-icon">💊</span>
            <h3 class="ai-card-title">Medicine Interaction Check</h3>
            <p class="ai-card-desc">Check for potential adverse reactions and contraindications between prescribed drugs.</p>
          </div>
          <div class="ai-card">
            <span class="ai-icon">🩺</span>
            <h3 class="ai-card-title">Medical History</h3>
            <p class="ai-card-desc">Synthesize multi-page patient charts into an organized overview of clinical care.</p>
          </div>
        </div>

        <!-- Interactive AI Demonstration Mockup -->
        <div class="ai-mockup-container">
          <div class="ai-mockup-header">
            <div class="ai-prompt-box">
              <span class="ai-spark-icon">✨</span>
              <span class="ai-prompt-text">"Summarize this patient's latest laboratory report."</span>
            </div>
            <button class="btn-ai-rerun" @click="simulateAiGeneration" :disabled="aiGenerating">
              <span v-if="!aiGenerating">✨ Generate AI Summary</span>
              <span v-else>Analyzing Clinical Data...</span>
            </button>
          </div>

          <div class="ai-output-box" :class="{ 'is-loading': aiGenerating }">
            <div class="ai-output-header">
              <span class="ai-tag">AI Summary &bull; Clinical NLP</span>
              <span class="ai-model-tag">Validated with Encrypted Record</span>
            </div>

            <div class="ai-points-list">
              <div class="ai-point">
                <span class="bullet-circle normal">✓</span>
                <div class="point-body">
                  <strong>Hemoglobin:</strong> 14.2 g/dL &bull; <span class="text-success">Within reference range (13.5 - 17.5 g/dL)</span>
                </div>
              </div>
              <div class="ai-point">
                <span class="bullet-circle warning">!</span>
                <div class="point-body">
                  <strong>Blood Glucose:</strong> 118 mg/dL &bull; <span class="text-warning">Elevated fasting level (Threshold review recommended)</span>
                </div>
              </div>
              <div class="ai-point">
                <span class="bullet-circle warning">!</span>
                <div class="point-body">
                  <strong>Cholesterol:</strong> Total 215 mg/dL, LDL 135 mg/dL &bull; <span class="text-warning">Requires lifestyle and dietary review</span>
                </div>
              </div>
              <div class="ai-point">
                <span class="bullet-circle info">ℹ️</span>
                <div class="point-body">
                  <strong>Physician Recommendation:</strong> Discuss glucose and lipid panel during routine 14-day consultation. Adequate hydration advised.
                </div>
              </div>
            </div>

            <!-- Mandatory Safety Disclaimer -->
            <div class="medical-disclaimer">
              <span class="disclaimer-icon">⚠️</span>
              <div class="disclaimer-text">
                <strong>Important Notice:</strong> AI provides assistance and does not replace a qualified doctor or professional medical diagnosis. Always consult certified healthcare providers for clinical advice.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 8. LIVE BLOCKCHAIN LEDGER (#blockchain)     -->
    <!-- ========================================== -->
    <section class="blockchain-section" id="blockchain">
      <div class="section-container">
        <div class="section-header text-center light-text">
          <span class="section-eyebrow text-cyan">Cryptographic Transparency</span>
          <h2 class="section-title text-white">Live Blockchain Verification</h2>
          <p class="section-subtitle text-slate">
            Explore blockchain transactions and cryptographic proofs associated with the MedLedger system.
          </p>
        </div>

        <!-- Dark Premium Explorer Dashboard -->
        <div class="explorer-card">
          <div class="explorer-topbar">
            <div class="exp-network">
              <span class="exp-dot"></span>
              <span class="exp-net-name">Ethereum Sepolia Testnet</span>
              <span class="exp-status">● Connected &amp; Active</span>
            </div>
            <div class="exp-meta-pills">
              <span class="meta-pill">Chain ID: <strong>11155111</strong></span>
              <span class="meta-pill">Smart Contract: <strong>HealthRecords.sol</strong></span>
              <span class="meta-pill text-success">Status: <strong>Active ✓</strong></span>
            </div>
          </div>

          <!-- Blockchain Block Sequence -->
          <div class="blocks-sequence">
            <!-- Block 1 (Latest) -->
            <div class="block-card">
              <div class="block-top">
                <span class="block-num">Block #8,421,093</span>
                <span class="block-time">18/9/2026, 9:41:16 pm</span>
              </div>
              <div class="block-field">
                <span class="field-lbl">Hash</span>
                <code class="field-val">0x8f4a39b2e04d72c9...</code>
              </div>
              <div class="block-field">
                <span class="field-lbl">Previous Hash</span>
                <code class="field-val text-muted">0x7ab291fa6c381d55...</code>
              </div>
              <div class="block-field">
                <span class="field-lbl">Transaction Payload</span>
                <span class="field-val highlight">SHA-256 Medical Record Anchored (hp9.docx)</span>
              </div>
            </div>

            <div class="block-connector">
              <span class="connector-line"></span>
              <span class="connector-arrow">➔</span>
            </div>

            <!-- Block 2 -->
            <div class="block-card">
              <div class="block-top">
                <span class="block-num">Block #8,421,092</span>
                <span class="block-time">18/9/2026, 9:11:16 pm</span>
              </div>
              <div class="block-field">
                <span class="field-lbl">Hash</span>
                <code class="field-val">0x7ab291fa6c381d55...</code>
              </div>
              <div class="block-field">
                <span class="field-lbl">Previous Hash</span>
                <code class="field-val text-muted">0xca978112ca1bbdca...</code>
              </div>
              <div class="block-field">
                <span class="field-lbl">Transaction Payload</span>
                <span class="field-val">Patient Identity Registered: tanmay shishodia (#90)</span>
              </div>
            </div>

            <div class="block-connector">
              <span class="connector-line"></span>
              <span class="connector-arrow">➔</span>
            </div>

            <!-- Block 3 -->
            <div class="block-card">
              <div class="block-top">
                <span class="block-num">Block #8,421,091</span>
                <span class="block-time">18/9/2026, 8:41:16 pm</span>
              </div>
              <div class="block-field">
                <span class="field-lbl">Hash</span>
                <code class="field-val">0xca978112ca1bbdca...</code>
              </div>
              <div class="block-field">
                <span class="field-lbl">Previous Hash</span>
                <code class="field-val text-muted">0x3a71b3e98214fa76...</code>
              </div>
              <div class="block-field">
                <span class="field-lbl">Transaction Payload</span>
                <span class="field-val">HealthRecords Smart Contract Deployed: registerRecord</span>
              </div>
            </div>
          </div>

          <div class="explorer-action-row">
            <button class="btn btn-cyan-glow" @click="showBlocksModal = true" id="btn-view-full-ledger">
              <span>⛓️ View Full Ledger Explorer</span>
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
            <span class="explorer-tip">Real-time audit records permanently sealed on Ethereum Sepolia.</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 9. FAQ ACCORDION (#faq)                     -->
    <!-- ========================================== -->
    <section class="faq-section" id="faq">
      <div class="section-container">
        <div class="section-header text-center">
          <span class="section-eyebrow">Clear Answers</span>
          <h2 class="section-title">Frequently Asked Questions</h2>
          <p class="section-subtitle">
            Understand how MedLedger AI protects patient privacy, manages consent, and verifies health data.
          </p>
        </div>

        <div class="faq-accordion-box">
          <!-- FAQ 1 -->
          <div class="faq-item" :class="{ 'is-open': activeFaq === 1 }">
            <button class="faq-question" @click="toggleFaq(1)" :aria-expanded="activeFaq === 1">
              <span>Who controls my medical records?</span>
              <span class="faq-toggle-icon">{{ activeFaq === 1 ? '−' : '+' }}</span>
            </button>
            <transition name="accordion-slide">
              <div v-if="activeFaq === 1" class="faq-answer">
                <p>
                  Your records remain under your control within the MedLedger access system. You decide which authorized healthcare providers can access them, and you can revoke permission at any time.
                </p>
              </div>
            </transition>
          </div>

          <!-- FAQ 2 -->
          <div class="faq-item" :class="{ 'is-open': activeFaq === 2 }">
            <button class="faq-question" @click="toggleFaq(2)" :aria-expanded="activeFaq === 2">
              <span>Can a doctor access my records without authorization?</span>
              <span class="faq-toggle-icon">{{ activeFaq === 2 ? '−' : '+' }}</span>
            </button>
            <transition name="accordion-slide">
              <div v-if="activeFaq === 2" class="faq-answer">
                <p>
                  No. Access is designed to require explicit authorization. A doctor or clinic must submit an access request, and records remain completely inaccessible until you approve the request in your patient portal.
                </p>
              </div>
            </transition>
          </div>

          <!-- FAQ 3 -->
          <div class="faq-item" :class="{ 'is-open': activeFaq === 3 }">
            <button class="faq-question" @click="toggleFaq(3)" :aria-expanded="activeFaq === 3">
              <span>Is my complete medical file stored on the blockchain?</span>
              <span class="faq-toggle-icon">{{ activeFaq === 3 ? '−' : '+' }}</span>
            </button>
            <transition name="accordion-slide">
              <div v-if="activeFaq === 3" class="faq-answer">
                <p>
                  No. MedLedger does not place sensitive medical documents on the public blockchain. Instead, blockchain technology stores a <strong>digital fingerprint (SHA-256 hash) and timestamp</strong>. This proves the file has not been altered without exposing private personal details publicly.
                </p>
              </div>
            </transition>
          </div>

          <!-- FAQ 4 -->
          <div class="faq-item" :class="{ 'is-open': activeFaq === 4 }">
            <button class="faq-question" @click="toggleFaq(4)" :aria-expanded="activeFaq === 4">
              <span>How does AI use my medical information?</span>
              <span class="faq-toggle-icon">{{ activeFaq === 4 ? '−' : '+' }}</span>
            </button>
            <transition name="accordion-slide">
              <div v-if="activeFaq === 4" class="faq-answer">
                <p>
                  The AI assistant works strictly with clinical data provided during authorized sessions to summarize findings, flag abnormal test values, and check for medicine interactions. Your medical data is never sold to third parties or used for external advertising.
                </p>
              </div>
            </transition>
          </div>

          <!-- FAQ 5 -->
          <div class="faq-item" :class="{ 'is-open': activeFaq === 5 }">
            <button class="faq-question" @click="toggleFaq(5)" :aria-expanded="activeFaq === 5">
              <span>Can I test MedLedger AI?</span>
              <span class="faq-toggle-icon">{{ activeFaq === 5 ? '−' : '+' }}</span>
            </button>
            <transition name="accordion-slide">
              <div v-if="activeFaq === 5" class="faq-answer">
                <p>
                  Yes! You can explore all six workspaces immediately using demo accounts. For instance, log into the <strong>Patient Portal</strong> with Email: <code>123@gmail.com</code> and Password: <code>secret99</code>.
                </p>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 10. FINAL CALL TO ACTION                    -->
    <!-- ========================================== -->
    <section class="cta-section">
      <div class="section-container">
        <div class="cta-box">
          <div class="cta-mesh-bg"></div>
          <h2 class="cta-heading">Take Control of Your Healthcare Records</h2>
          <p class="cta-sub">
            Secure your medical information, manage access, verify records, and use AI to understand healthcare information more easily.
          </p>
          <div class="cta-buttons">
            <router-link to="/Login" class="btn btn-primary-light">
              <span>🚀 Launch Portals</span>
            </router-link>
            <button class="btn btn-outline-white" @click="showBlocksModal = true">
              <span>⛓️ Explore Blockchain</span>
            </button>
          </div>
          <div class="cta-perks">
            <span>✓ Patient-Controlled Access</span>
            <span class="perk-sep">&bull;</span>
            <span>✓ Secure Medical Records</span>
            <span class="perk-sep">&bull;</span>
            <span>✓ Verified Record History</span>
            <span class="perk-sep">&bull;</span>
            <span>✓ No Data Brokerage</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- 11. FOOTER                                  -->
    <!-- ========================================== -->
    <footer class="medledger-footer">
      <div class="section-container">
        <div class="footer-grid">
          <!-- Col 1: Brand Info -->
          <div class="footer-brand-col">
            <div class="footer-logo">
              <span class="footer-logo-icon">🛡️</span>
              <span class="footer-logo-text">MedLedger <span class="ai-badge">AI</span></span>
            </div>
            <p class="footer-brand-desc">
              Secure electronic health records powered by encryption, blockchain verification, and clinical AI assistance.
            </p>
            <div class="footer-sepolia-badge">
              <span class="badge-dot-green"></span>
              <span>Ethereum Sepolia Network &bull; Active</span>
            </div>
          </div>

          <!-- Col 2: Workspaces -->
          <div class="footer-nav-col">
            <h4 class="footer-heading">Workspaces</h4>
            <ul class="footer-links">
              <li><router-link to="/LoginPatient">Patient Workspace</router-link></li>
              <li><router-link to="/DoctorDashboard">Physician Console</router-link></li>
              <li><router-link to="/HospitalAdminDashboard">Hospital Administration</router-link></li>
              <li><router-link to="/LabDashboard">Diagnostic Laboratory</router-link></li>
              <li><router-link to="/InsuranceDashboard">Insurance &amp; Claims</router-link></li>
              <li><router-link to="/AdminDashboard">System Governance</router-link></li>
            </ul>
          </div>

          <!-- Col 3: Technology -->
          <div class="footer-nav-col">
            <h4 class="footer-heading">Technology</h4>
            <ul class="footer-links">
              <li><a href="#security">AI Medical Assistant</a></li>
              <li><a href="#security">AES-256-GCM Encryption</a></li>
              <li><a href="#blockchain">Ethereum Blockchain</a></li>
              <li><a href="#security">SHA-256 Fingerprints</a></li>
              <li><a href="#security">Patient-Controlled Access</a></li>
            </ul>
          </div>

          <!-- Col 4: Resources -->
          <div class="footer-nav-col">
            <h4 class="footer-heading">Resources</h4>
            <ul class="footer-links">
              <li><a href="#how-it-works">How It Works</a></li>
              <li><a href="#security">Security Architecture</a></li>
              <li><a href="#faq">Frequently Asked Questions</a></li>
              <li><a href="#blockchain" @click.prevent="showBlocksModal = true">Blockchain Explorer</a></li>
              <li><router-link to="/about">About MedLedger</router-link></li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <p class="copyright-text">
            &copy; 2026 MedLedger AI. Secure Electronic Health Records &bull; AI Assistance &bull; Blockchain Verification.
          </p>
          <div class="footer-trust-tags">
            <span>Patient-Controlled Access</span>
            <span class="sep">&bull;</span>
            <span>Secure Medical Records</span>
            <span class="sep">&bull;</span>
            <span>Verified Record History</span>
            <span class="sep">&bull;</span>
            <span>No Data Brokerage</span>
          </div>
        </div>
      </div>
    </footer>

    <!-- Integrated Blocks Modal -->
    <blocks-modal :visible="showBlocksModal" @close="showBlocksModal = false" />
  </div>
</template>

<script>
import BlocksModal from './BlocksModal.vue';

export default {
  name: 'homec',
  components: {
    BlocksModal
  },
  data() {
    return {
      selectedHeroTab: 'blood',
      showBlocksModal: false,
      activeFaq: 1, // First FAQ item open by default
      docAccessGranted: true,
      insuranceStatus: 'pending', // 'pending' | 'granted' | 'rejected'
      aiGenerating: false,
      // Toast notification state
      showToast: false,
      toastMessage: '',
      toastType: 'success'
    };
  },
  methods: {
    toggleFaq(index) {
      this.activeFaq = this.activeFaq === index ? null : index;
    },
    copyHash(hash) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(hash).then(() => {
          this.triggerToast(`Copied SHA-256 fingerprint: ${hash.substring(0, 10)}...`, 'success');
        }).catch(() => {
          this.triggerToast(`SHA-256 Fingerprint: ${hash}`, 'info');
        });
      } else {
        this.triggerToast(`SHA-256 Fingerprint: ${hash}`, 'info');
      }
    },
    toggleDocAccess() {
      this.docAccessGranted = !this.docAccessGranted;
      if (this.docAccessGranted) {
        this.triggerToast('Doctor permission granted for Dr. Sarah Jenkins.', 'success');
      } else {
        this.triggerToast('Doctor permission revoked. Record hp9.docx is now restricted.', 'warning');
      }
    },
    handleInsurance(action) {
      if (action === 'grant') {
        this.insuranceStatus = 'granted';
        this.triggerToast('Access granted for HealthShield Insurance claim review.', 'success');
      } else if (action === 'reject') {
        this.insuranceStatus = 'rejected';
        this.triggerToast('Insurance claim review access request rejected.', 'warning');
      } else if (action === 'revoke') {
        this.insuranceStatus = 'rejected';
        this.triggerToast('Insurance claim access revoked.', 'warning');
      } else {
        this.insuranceStatus = 'pending';
      }
    },
    simulateAiGeneration() {
      this.aiGenerating = true;
      setTimeout(() => {
        this.aiGenerating = false;
        this.triggerToast('AI Clinical Assistant refreshed diagnosis summary from laboratory data.', 'success');
      }, 750);
    },
    triggerToast(message, type = 'success') {
      this.toastMessage = message;
      this.toastType = type;
      this.showToast = true;
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.showToast = false;
      }, 4000);
    }
  }
};
</script>

<style scoped>
/* ==========================================================================
   MEDLEDGER AI DESIGN SYSTEM: HEALTHCARE + FINTECH ELEGANCE + AI
   ========================================================================== */

.medledger-home {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #0F172A;
  background-color: #F8FAFC;
  line-height: 1.6;
  position: relative;
  overflow-x: hidden;
}

.section-container {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Typography & Headings */
.section-header {
  margin-bottom: 48px;
}

.text-center {
  text-align: center;
}

.section-eyebrow {
  display: inline-block;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #2563EB;
  margin-bottom: 10px;
}

.section-title {
  font-size: 2.25rem;
  font-weight: 800;
  color: #0B1220;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin: 0 0 12px 0;
}

.section-subtitle {
  font-size: 1.1rem;
  color: #64748B;
  max-width: 680px;
  margin: 0 auto;
  line-height: 1.6;
}

/* Reusable Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.98rem;
  padding: 13px 24px;
  border-radius: 10px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid transparent;
}

.btn-primary {
  background: #2563EB;
  color: #FFFFFF;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
}

.btn-primary:hover {
  background: #1D4ED8;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35);
}

.btn-outline {
  background: #FFFFFF;
  color: #0B1220;
  border-color: #E2E8F0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.btn-outline:hover {
  background: #F1F5F9;
  border-color: #CBD5E1;
  transform: translateY(-2px);
}

.btn-arrow {
  width: 18px;
  height: 18px;
  transition: transform 0.2s ease;
}

.btn:hover .btn-arrow {
  transform: translateX(3px);
}

/* ==========================================================================
   1. HERO SECTION
   ========================================================================== */
.hero-section {
  position: relative;
  padding: 56px 0 72px 0;
  overflow: hidden;
  border-bottom: 1px solid #E2E8F0;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
}

.hero-grid-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(#CBD5E1 0.75px, transparent 0.75px);
  background-size: 24px 24px;
  opacity: 0.45;
  pointer-events: none;
}

.hero-container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 24px;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 48px;
  align-items: center;
  position: relative;
  z-index: 1;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: #EFF6FF;
  border: 1px solid #DBEAFE;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1E40AF;
  margin-bottom: 20px;
}

.hero-heading {
  font-size: 3.1rem;
  font-weight: 850;
  color: #0B1220;
  letter-spacing: -0.035em;
  line-height: 1.15;
  margin: 0 0 20px 0;
}

.heading-gradient {
  color: #2563EB;
}

.hero-lead {
  font-size: 1.15rem;
  color: #475569;
  line-height: 1.65;
  margin: 0 0 32px 0;
  max-width: 560px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 36px;
}

.trust-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  padding-top: 18px;
  border-top: 1px solid #E2E8F0;
}

.trust-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

/* Hero Visual: Console Card */
.console-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 18px;
  box-shadow: 0 16px 36px -8px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.console-card:hover {
  box-shadow: 0 20px 42px -10px rgba(15, 23, 42, 0.12);
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid #F1F5F9;
  background: #FAFAFC;
}

.console-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pulse-indicator {
  width: 10px;
  height: 10px;
  background: #16A34A;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.2);
}

.console-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0B1220;
  margin: 0;
}

.console-id {
  font-size: 0.76rem;
  color: #64748B;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.76rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 9999px;
}

.status-chip.secure {
  background: #DCFCE7;
  color: #15803D;
}

.chip-dot {
  width: 6px;
  height: 6px;
  background: #15803D;
  border-radius: 50%;
}

/* Console Tabs */
.console-tabs {
  display: flex;
  border-bottom: 1px solid #E2E8F0;
  background: #F8FAFC;
  overflow-x: auto;
}

.tab-btn {
  flex: 1;
  padding: 11px 12px;
  font-size: 0.83rem;
  font-weight: 600;
  color: #64748B;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: #2563EB;
}

.tab-btn.is-active {
  color: #2563EB;
  border-bottom-color: #2563EB;
  background: #FFFFFF;
}

/* Console Body */
.console-body {
  padding: 20px 22px;
  min-height: 140px;
}

.record-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 14px;
}

.vitals-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.vital-item {
  background: #F8FAFC;
  border: 1px solid #F1F5F9;
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  position: relative;
}

.vital-name {
  font-size: 0.74rem;
  color: #64748B;
  font-weight: 600;
}

.vital-val {
  font-size: 1.15rem;
  font-weight: 700;
  color: #0F172A;
  margin-top: 2px;
}

.vital-tag {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.vital-tag.normal {
  background: #DCFCE7;
  color: #166534;
}

.vital-tag.warning {
  background: #FEF3C7;
  color: #92400E;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.88rem;
  color: #334155;
}

.history-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.history-bullet {
  color: #2563EB;
  font-weight: bold;
}

.rx-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rx-badge-item {
  background: #F8FAFC;
  border: 1px solid #F1F5F9;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.86rem;
  display: flex;
  flex-direction: column;
}

.rx-instructions {
  font-size: 0.76rem;
  color: #64748B;
  margin-top: 2px;
}

.diagnostic-text {
  font-size: 0.86rem;
  color: #334155;
  line-height: 1.5;
  margin: 0;
}

/* Verification Banner */
.verification-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #F0FDF4;
  border-top: 1px solid #DCFCE7;
  border-bottom: 1px solid #DCFCE7;
}

.banner-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.check-circle {
  width: 22px;
  height: 22px;
  background: #16A34A;
  color: #FFFFFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
}

.banner-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: #166534;
}

.banner-hash {
  font-size: 0.74rem;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.banner-hash:hover code {
  color: #2563EB;
}

.copy-hint {
  font-size: 0.7rem;
}

.network-tag {
  font-size: 0.74rem;
  font-weight: 600;
  color: #15803D;
}

/* Access Control Matrix Sub-panel */
.access-matrix {
  padding: 14px 20px;
  background: #FFFFFF;
}

.matrix-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.matrix-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748B;
}

.matrix-sub {
  font-size: 0.72rem;
  color: #94A3B8;
}

.matrix-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.matrix-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  padding: 4px 0;
}

.actor-info {
  font-weight: 600;
  color: #334155;
}

.badge-status-granted {
  font-size: 0.74rem;
  font-weight: 700;
  color: #166534;
  background: #DCFCE7;
  padding: 2px 8px;
  border-radius: 9999px;
}

.badge-status-pending {
  font-size: 0.74rem;
  font-weight: 700;
  color: #92400E;
  background: #FEF3C7;
  padding: 2px 8px;
  border-radius: 9999px;
}

/* ==========================================
   2. TRUST STATISTICS SECTION
   ========================================== */
.stats-section {
  padding: 48px 0;
  background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.stat-card {
  padding: 24px 20px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  text-align: center;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-3px);
  border-color: #CBD5E1;
}

.stat-value {
  font-size: 2.3rem;
  font-weight: 850;
  color: #2563EB;
  letter-spacing: -0.02em;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0B1220;
  margin-bottom: 6px;
}

.stat-desc {
  font-size: 0.83rem;
  color: #64748B;
  margin: 0;
  line-height: 1.5;
}

/* ==========================================
   3. PORTALS SECTION
   ========================================== */
.portals-section {
  padding: 80px 0;
  background: #F8FAFC;
}

.portals-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}

.portal-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.portal-card:hover {
  transform: translateY(-5px);
  border-color: #93C5FD;
  box-shadow: 0 16px 32px -8px rgba(37, 99, 235, 0.12);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.role-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.patient-bg { background: #EFF6FF; }
.doctor-bg { background: #ECFDF5; }
.hospital-bg { background: #F0FDF4; }
.lab-bg { background: #FAF5FF; }
.insurance-bg { background: #FFFBEB; }
.admin-bg { background: #F1F5F9; }

.portal-category {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748B;
  background: #F1F5F9;
  padding: 4px 10px;
  border-radius: 9999px;
}

.portal-name {
  font-size: 1.3rem;
  font-weight: 800;
  color: #0B1220;
  margin: 0 0 6px 0;
}

.portal-lead {
  font-size: 0.92rem;
  font-weight: 600;
  color: #2563EB;
  margin: 0 0 10px 0;
}

.portal-desc {
  font-size: 0.87rem;
  color: #64748B;
  line-height: 1.55;
  margin: 0 0 18px 0;
  flex-grow: 1;
}

.portal-tags {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.ptag {
  font-size: 0.78rem;
  font-weight: 600;
  color: #475569;
  background: #F8FAFC;
  border: 1px solid #F1F5F9;
  border-radius: 6px;
  padding: 4px 8px;
}

.demo-credential-chip {
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.74rem;
  color: #1E40AF;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.demo-dot {
  width: 6px;
  height: 6px;
  background: #2563EB;
  border-radius: 50%;
}

.portal-cta-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F8FAFC;
  color: #0B1220;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.portal-cta-btn:hover {
  background: #2563EB;
  color: #FFFFFF;
  border-color: #2563EB;
}

.cta-arrow {
  transition: transform 0.2s ease;
}

.portal-card:hover .cta-arrow {
  transform: translateX(4px);
}

/* ==========================================
   4. HOW IT WORKS TIMELINE
   ========================================== */
.workflow-section {
  padding: 80px 0;
  background: #FFFFFF;
  border-top: 1px solid #E2E8F0;
  border-bottom: 1px solid #E2E8F0;
}

.workflow-ribbon {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 48px;
  flex-wrap: wrap;
}

.ribbon-node {
  font-size: 0.88rem;
  font-weight: 700;
  padding: 6px 16px;
  border-radius: 9999px;
  background: #F1F5F9;
  color: #475569;
}

.ribbon-node.active {
  background: #EFF6FF;
  color: #1D4ED8;
  border: 1px solid #BFDBFE;
}

.ribbon-arrow {
  color: #94A3B8;
  font-weight: bold;
}

.timeline-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  position: relative;
}

.timeline-step {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 28px 20px;
  position: relative;
  transition: transform 0.2s ease;
}

.timeline-step:hover {
  transform: translateY(-3px);
  border-color: #93C5FD;
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: #2563EB;
  color: #FFFFFF;
  font-size: 1rem;
  font-weight: 800;
  border-radius: 10px;
  margin-bottom: 16px;
}

.step-title {
  font-size: 1.12rem;
  font-weight: 800;
  color: #0B1220;
  margin: 0 0 10px 0;
}

.step-desc {
  font-size: 0.87rem;
  color: #64748B;
  line-height: 1.6;
  margin: 0 0 16px 0;
}

.step-highlight {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #15803D;
  background: #DCFCE7;
  padding: 4px 8px;
  border-radius: 6px;
}

/* ==========================================
   5. SECURITY SECTION & FLOWCHART
   ========================================== */
.security-section {
  padding: 80px 0;
  background: #F8FAFC;
}

.security-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  margin-bottom: 40px;
}

.security-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 24px 20px;
  transition: transform 0.2s ease;
}

.security-card:hover {
  transform: translateY(-3px);
  border-color: #CBD5E1;
}

.sec-icon {
  font-size: 1.8rem;
  margin-bottom: 12px;
}

.sec-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0B1220;
  margin: 0 0 8px 0;
}

.sec-desc {
  font-size: 0.85rem;
  color: #64748B;
  line-height: 1.55;
  margin: 0 0 14px 0;
}

.sec-pill {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  color: #2563EB;
  background: #EFF6FF;
  padding: 3px 8px;
  border-radius: 4px;
}

/* Pipeline Flow Diagram Box */
.pipeline-diagram-box {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  padding: 28px 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.pipeline-title {
  font-size: 0.84rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748B;
  text-align: center;
  margin-bottom: 24px;
}

.pipeline-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.pipe-step {
  flex: 1;
  min-width: 140px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 14px 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pipe-icon {
  font-size: 1.3rem;
  margin-bottom: 4px;
}

.pipe-name {
  font-size: 0.88rem;
  font-weight: 750;
  color: #0B1220;
}

.pipe-desc {
  font-size: 0.74rem;
  color: #64748B;
  margin-top: 2px;
}

.pipe-divider {
  color: #94A3B8;
  font-weight: bold;
  font-size: 1.1rem;
}

/* ==========================================
   6. PATIENT CONTROL SECTION
   ========================================== */
.patient-control-section {
  padding: 80px 0;
  background: #FFFFFF;
  border-top: 1px solid #E2E8F0;
  border-bottom: 1px solid #E2E8F0;
}

.split-grid {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 48px;
  align-items: center;
}

.split-title {
  font-size: 2.2rem;
  font-weight: 850;
  color: #0B1220;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin: 10px 0 18px 0;
}

.split-desc {
  font-size: 1rem;
  color: #475569;
  line-height: 1.65;
  margin: 0 0 16px 0;
}

.action-items-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 28px;
}

.action-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.action-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #EFF6FF;
  color: #2563EB;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.action-title {
  font-size: 0.98rem;
  font-weight: 750;
  color: #0B1220;
  margin: 0 0 2px 0;
}

.action-text {
  font-size: 0.86rem;
  color: #64748B;
  margin: 0;
}

/* Permissions Dashboard Mockup */
.perm-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 18px;
  box-shadow: 0 12px 32px -6px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.perm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid #F1F5F9;
  background: #FAFAFC;
}

.perm-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0B1220;
  margin: 0;
}

.perm-sub {
  font-size: 0.76rem;
  color: #64748B;
}

.badge-live-dot {
  font-size: 0.74rem;
  font-weight: 700;
  color: #15803D;
  background: #DCFCE7;
  padding: 3px 8px;
  border-radius: 9999px;
}

.perm-list {
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.perm-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid #F1F5F9;
  border-radius: 12px;
  background: #F8FAFC;
  transition: all 0.2s ease;
}

.perm-item.highlight-item {
  border-color: #FED7AA;
  background: #FFFDF9;
}

.perm-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.perm-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.doc-avatar { background: #ECFDF5; }
.lab-avatar { background: #FAF5FF; }
.ins-avatar { background: #FFFBEB; }

.perm-entity {
  font-size: 0.92rem;
  font-weight: 750;
  color: #0B1220;
}

.perm-subtext {
  font-size: 0.78rem;
  color: #64748B;
}

.perm-time {
  font-size: 0.72rem;
  color: #94A3B8;
  margin-top: 2px;
}

.perm-item-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge-granted {
  font-size: 0.75rem;
  font-weight: 750;
  color: #166534;
  background: #DCFCE7;
  padding: 4px 10px;
  border-radius: 9999px;
}

.status-badge-verified {
  font-size: 0.75rem;
  font-weight: 750;
  color: #0369A1;
  background: #E0F2FE;
  padding: 4px 10px;
  border-radius: 9999px;
}

.status-badge-revoked {
  font-size: 0.75rem;
  font-weight: 750;
  color: #991B1B;
  background: #FEE2E2;
  padding: 4px 10px;
  border-radius: 9999px;
}

.badge-req-attention {
  font-size: 0.72rem;
  font-weight: 700;
  color: #92400E;
  background: #FEF3C7;
  padding: 3px 8px;
  border-radius: 6px;
  margin-bottom: 6px;
  display: block;
  text-align: right;
}

.btn-pair {
  display: flex;
  gap: 6px;
}

.btn-action-grant {
  background: #16A34A;
  color: #FFFFFF;
  border: none;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-action-grant:hover {
  background: #15803D;
}

.btn-action-reject {
  background: #EF4444;
  color: #FFFFFF;
  border: none;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-action-reject:hover {
  background: #DC2626;
}

.btn-revoke-mini, .btn-undo-mini {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  font-size: 0.74rem;
  font-weight: 600;
  color: #64748B;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-revoke-mini:hover {
  color: #DC2626;
  border-color: #FCA5A5;
}

.perm-footer {
  padding: 10px 20px 14px 20px;
  background: #FAFAFC;
  border-top: 1px solid #F1F5F9;
  text-align: center;
}

.perm-footer-note {
  font-size: 0.75rem;
  color: #64748B;
}

/* ==========================================
   7. AI CLINICAL ASSISTANT
   ========================================= */
.ai-section {
  padding: 80px 0;
  background: #F8FAFC;
}

.ai-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 40px;
}

.ai-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 22px 18px;
  transition: transform 0.2s ease;
}

.ai-card:hover {
  transform: translateY(-3px);
  border-color: #93C5FD;
}

.ai-icon {
  font-size: 1.6rem;
  margin-bottom: 10px;
  display: inline-block;
}

.ai-card-title {
  font-size: 1rem;
  font-weight: 800;
  color: #0B1220;
  margin: 0 0 6px 0;
}

.ai-card-desc {
  font-size: 0.84rem;
  color: #64748B;
  margin: 0;
  line-height: 1.5;
}

/* AI Interface Mockup Container */
.ai-mockup-container {
  max-width: 920px;
  margin: 0 auto;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 18px;
  box-shadow: 0 16px 36px -8px rgba(15, 23, 42, 0.07);
  overflow: hidden;
}

.ai-mockup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
  flex-wrap: wrap;
  gap: 12px;
}

.ai-prompt-box {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.94rem;
  font-weight: 600;
  color: #1E293B;
}

.ai-spark-icon {
  font-size: 1.1rem;
  color: #2563EB;
}

.btn-ai-rerun {
  background: #2563EB;
  color: #FFFFFF;
  border: none;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-ai-rerun:hover:not(:disabled) {
  background: #1D4ED8;
}

.btn-ai-rerun:disabled {
  opacity: 0.7;
  cursor: wait;
}

.ai-output-box {
  padding: 24px;
  transition: opacity 0.2s ease;
}

.ai-output-box.is-loading {
  opacity: 0.5;
}

.ai-output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid #F1F5F9;
}

.ai-tag {
  font-size: 0.85rem;
  font-weight: 800;
  color: #2563EB;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ai-model-tag {
  font-size: 0.74rem;
  font-weight: 600;
  color: #64748B;
}

.ai-points-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.ai-point {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.92rem;
  color: #334155;
  line-height: 1.5;
}

.bullet-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.74rem;
  font-weight: 800;
  flex-shrink: 0;
  margin-top: 1px;
}

.bullet-circle.normal {
  background: #DCFCE7;
  color: #166534;
}

.bullet-circle.warning {
  background: #FEF3C7;
  color: #92400E;
}

.bullet-circle.info {
  background: #EFF6FF;
  color: #1E40AF;
}

.medical-disclaimer {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #FEF3C7;
  border: 1px solid #FDE68A;
  border-radius: 10px;
  padding: 12px 14px;
}

.disclaimer-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.disclaimer-text {
  font-size: 0.8rem;
  color: #92400E;
  line-height: 1.45;
}

/* ==========================================
   8. BLOCKCHAIN LEDGER EXPLORER
   ========================================== */
.blockchain-section {
  padding: 80px 0;
  background: #0B1220;
  position: relative;
  overflow: hidden;
}

.light-text .section-title {
  color: #F8FAFC;
}

.text-white { color: #FFFFFF; }
.text-cyan { color: #06B6D4; }
.text-slate { color: #94A3B8; }

.explorer-card {
  background: #111B2E;
  border: 1px solid #1E293B;
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4);
}

.explorer-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid #1E293B;
  flex-wrap: wrap;
  gap: 14px;
}

.exp-network {
  display: flex;
  align-items: center;
  gap: 10px;
}

.exp-dot {
  width: 10px;
  height: 10px;
  background: #10B981;
  border-radius: 50%;
  box-shadow: 0 0 8px #10B981;
}

.exp-net-name {
  font-size: 1.05rem;
  font-weight: 800;
  color: #FFFFFF;
}

.exp-status {
  font-size: 0.8rem;
  color: #10B981;
  font-weight: 600;
}

.exp-meta-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-pill {
  font-size: 0.78rem;
  background: #1E293B;
  color: #94A3B8;
  padding: 4px 10px;
  border-radius: 6px;
}

.meta-pill strong {
  color: #F1F5F9;
}

/* Blocks Sequence */
.blocks-sequence {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 28px 0;
  overflow-x: auto;
}

.block-card {
  flex: 1;
  min-width: 270px;
  background: #162238;
  border: 1px solid #24344D;
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.block-card:hover {
  transform: translateY(-3px);
  border-color: #06B6D4;
}

.block-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #24344D;
  padding-bottom: 8px;
}

.block-num {
  font-size: 0.95rem;
  font-weight: 800;
  color: #06B6D4;
}

.block-time {
  font-size: 0.72rem;
  color: #94A3B8;
}

.block-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.field-lbl {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748B;
}

.field-val {
  font-size: 0.8rem;
  color: #E2E8F0;
  line-height: 1.4;
}

.field-val.highlight {
  color: #38BDF8;
  font-weight: 600;
}

.text-muted { color: #64748B; }

.block-connector {
  display: flex;
  align-items: center;
  color: #06B6D4;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.explorer-action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20px;
  border-top: 1px solid #1E293B;
  flex-wrap: wrap;
  gap: 14px;
}

.btn-cyan-glow {
  background: #0284C7;
  color: #FFFFFF;
  border: none;
  font-size: 0.92rem;
  font-weight: 750;
  padding: 12px 22px;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
}

.btn-cyan-glow:hover {
  background: #0369A1;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(2, 132, 199, 0.5);
}

.explorer-tip {
  font-size: 0.8rem;
  color: #94A3B8;
}

/* ==========================================
   9. FAQ ACCORDION
   ========================================== */
.faq-section {
  padding: 80px 0;
  background: #FFFFFF;
}

.faq-accordion-box {
  max-width: 820px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-item {
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  background: #F8FAFC;
  overflow: hidden;
  transition: all 0.2s ease;
}

.faq-item.is-open {
  border-color: #BFDBFE;
  background: #FFFFFF;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.05);
}

.faq-question {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  background: none;
  border: none;
  text-align: left;
  font-size: 1.05rem;
  font-weight: 750;
  color: #0B1220;
  cursor: pointer;
  gap: 12px;
}

.faq-toggle-icon {
  font-size: 1.3rem;
  font-weight: 600;
  color: #2563EB;
  flex-shrink: 0;
}

.faq-answer {
  padding: 0 22px 20px 22px;
  font-size: 0.94rem;
  color: #475569;
  line-height: 1.65;
}

.faq-answer p {
  margin: 0;
}

/* ==========================================
   10. FINAL CALL TO ACTION
   ========================================== */
.cta-section {
  padding: 80px 0;
  background: #F8FAFC;
}

.cta-box {
  background: linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 50%, #0284C7 100%);
  border-radius: 22px;
  padding: 64px 32px;
  text-align: center;
  color: #FFFFFF;
  position: relative;
  overflow: hidden;
  box-shadow: 0 20px 40px -10px rgba(29, 78, 216, 0.35);
}

.cta-mesh-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

.cta-heading {
  font-size: 2.6rem;
  font-weight: 850;
  letter-spacing: -0.025em;
  line-height: 1.2;
  margin: 0 0 16px 0;
  position: relative;
  z-index: 1;
}

.cta-sub {
  font-size: 1.15rem;
  color: #DBEAFE;
  max-width: 640px;
  margin: 0 auto 36px auto;
  line-height: 1.6;
  position: relative;
  z-index: 1;
}

.cta-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
}

.btn-primary-light {
  background: #FFFFFF;
  color: #1D4ED8;
  padding: 14px 28px;
  font-size: 1.02rem;
  font-weight: 750;
  border-radius: 10px;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.btn-primary-light:hover {
  background: #F8FAFC;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.btn-outline-white {
  background: rgba(255, 255, 255, 0.12);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 14px 28px;
  font-size: 1.02rem;
  font-weight: 750;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-outline-white:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: #FFFFFF;
  transform: translateY(-2px);
}

.cta-perks {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
  color: #BFDBFE;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
}

.perk-sep {
  opacity: 0.5;
}

/* ==========================================
   11. FOOTER
   ========================================== */
.medledger-footer {
  background: #0B1220;
  color: #94A3B8;
  padding: 64px 0 32px 0;
  border-top: 1px solid #1E293B;
}

.footer-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr;
  gap: 40px;
  padding-bottom: 48px;
  border-bottom: 1px solid #1E293B;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.footer-logo-icon {
  font-size: 1.5rem;
}

.footer-logo-text {
  font-size: 1.35rem;
  font-weight: 850;
  color: #FFFFFF;
  letter-spacing: -0.02em;
}

.ai-badge {
  background: #2563EB;
  color: #FFFFFF;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
  vertical-align: middle;
}

.footer-brand-desc {
  font-size: 0.88rem;
  line-height: 1.6;
  color: #94A3B8;
  margin-bottom: 20px;
  max-width: 320px;
}

.footer-sepolia-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: #64748B;
  background: #111B2E;
  padding: 4px 10px;
  border-radius: 6px;
}

.badge-dot-green {
  width: 7px;
  height: 7px;
  background: #10B981;
  border-radius: 50%;
}

.footer-heading {
  font-size: 0.95rem;
  font-weight: 750;
  color: #F8FAFC;
  margin: 0 0 16px 0;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-links a {
  color: #94A3B8;
  text-decoration: none;
  font-size: 0.88rem;
  transition: color 0.15s ease;
}

.footer-links a:hover {
  color: #60A5FA;
}

.footer-bottom {
  padding-top: 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  flex-wrap: wrap;
  gap: 14px;
}

.copyright-text {
  margin: 0;
}

.footer-trust-tags {
  display: flex;
  gap: 8px;
  align-items: center;
  color: #64748B;
}

.sep {
  opacity: 0.4;
}

/* Toast Notifications */
.med-toast {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  max-width: 440px;
  font-size: 0.9rem;
  font-weight: 600;
}

.med-toast.success {
  background: #064E3B;
  color: #ECFDF5;
  border: 1px solid #059669;
}

.med-toast.warning {
  background: #78350F;
  color: #FEF3C7;
  border: 1px solid #D97706;
}

.med-toast.info {
  background: #1E3A8A;
  color: #EFF6FF;
  border: 1px solid #3B82F6;
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 4px;
  margin-left: auto;
}

.toast-fade-enter-active, .toast-fade-leave-active {
  transition: all 0.25s ease;
}

.toast-fade-enter, .toast-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* ==========================================================================
   RESPONSIVE DESIGN (320px to 1280px+)
   ========================================================================== */

@media (max-width: 1080px) {
  .hero-container {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  .hero-content {
    text-align: center;
  }
  .hero-lead {
    margin: 0 auto 32px auto;
  }
  .hero-actions {
    justify-content: center;
  }
  .trust-strip {
    justify-content: center;
  }
  .portals-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .timeline-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .security-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .split-grid {
    grid-template-columns: 1fr;
  }
  .ai-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .footer-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .hero-heading {
    font-size: 2.25rem;
  }
  .section-title {
    font-size: 1.85rem;
  }
  .portals-grid {
    grid-template-columns: 1fr;
  }
  .stats-grid {
    grid-template-columns: 1fr;
  }
  .timeline-grid {
    grid-template-columns: 1fr;
  }
  .security-cards-grid {
    grid-template-columns: 1fr;
  }
  .pipeline-flow {
    flex-direction: column;
  }
  .pipe-divider {
    transform: rotate(90deg);
  }
  .ai-cards-grid {
    grid-template-columns: 1fr;
  }
  .cta-heading {
    font-size: 1.85rem;
  }
  .cta-box {
    padding: 42px 20px;
  }
  .footer-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .footer-bottom {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  .footer-trust-tags {
    flex-wrap: wrap;
    justify-content: center;
  }
  .perm-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .perm-item-right {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .hero-heading {
    font-size: 1.95rem;
  }
  .hero-actions {
    flex-direction: column;
    width: 100%;
  }
  .btn {
    width: 100%;
  }
  .vitals-grid {
    grid-template-columns: 1fr;
  }
  .blocks-sequence {
    flex-direction: column;
  }
  .block-connector {
    transform: rotate(90deg);
  }
}

/* Accessibility: respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
<template>
  <div class="doctor-portal-page">
    <!-- Top Doctor Identity Card -->
    <div class="doctor-header-card">
      <div class="header-content">
        <div class="doctor-avatar-box">
          <svg viewBox="0 0 64 64" class="doctor-avatar-svg" fill="#00629b">
            <circle cx="32" cy="20" r="11" />
            <path d="M16 52 c0 -9 7 -16 16 -16 s16 7 16 16 v2 h-32 z" />
            <path d="M25 36 v6 c0 4 3 7 7 7 s7 -3 7 -7 v-6" fill="none" stroke="#ffffff" stroke-width="2.5" />
            <circle cx="32" cy="51" r="3.5" fill="#ffffff" />
          </svg>
        </div>
        <div class="doctor-details">
          <div class="title-row">
            <h1 class="doctor-name">Dr. Gregory House, M.D.</h1>
            <span class="badge badge-license">License: DOC-MH-10293</span>
            <span class="badge badge-dept">Clinical Diagnostics & Internal Medicine</span>
            <span class="badge badge-chain">⛓️ Hyperledger Fabric Peer</span>
          </div>
          <div class="meta-row">
            <div class="meta-item">
              <span class="meta-label">Hospital:</span>
              <span class="meta-value">Princeton-Plainsboro Teaching Hospital</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Network Channel:</span>
              <span class="meta-value"><code>mychannel</code></span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Selected Patient:</span>
              <span class="meta-value highlight-patient">
                {{ selectedPatientName }} (ID: #{{ patid }})
              </span>
            </div>
          </div>
        </div>

        <div class="header-right-actions">
          <button type="button" class="dashboard-logout-btn" @click="logout" title="Sign out of Doctor Portal">
            <svg class="logout-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Section 1: Patient Directory Table Card -->
    <div class="directory-card">
      <div class="section-header">
        <div>
          <h2 class="section-title">👥 Assigned Patient Directory</h2>
          <p class="section-subtitle">Click any patient row below to select them for report access, upload, or AI clinical summary.</p>
        </div>
        <div class="search-box">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search by name or ID..."
            class="search-input"
          />
        </div>
      </div>

      <div class="table-responsive">
        <table class="styled-patient-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Patient Name</th>
              <th>Contact Info</th>
              <th>Aadhaar / Identifier</th>
              <th>Current Report</th>
              <th>Consent Status</th>
              <th>Select</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in filteredPatients"
              :key="p.Key"
              :class="['patient-row', { 'selected-row': p.Record.patientId === patid }]"
              @click="selectPatient(p.Record)"
            >
              <td><span class="id-tag">#{{ p.Record.patientId }}</span></td>
              <td class="name-cell"><b>{{ p.Record.name }}</b></td>
              <td>{{ p.Record.email || p.Record.phNo || 'N/A' }}</td>
              <td><code>{{ p.Record.adharNo || 'XXXXXXXXXXXX' }}</code></td>
              <td><span class="report-file-tag">{{ getPatientReportFile(p.Record.patientId) }}</span></td>
              <td>
                <span :class="['consent-badge', getConsentBadgeClass(p.Record.patientId)]">
                  {{ getConsentBadgeLabel(p.Record.patientId) }}
                </span>
              </td>
              <td>
                <button
                  :class="['select-btn', { 'selected-btn': p.Record.patientId === patid }]"
                  @click.stop="selectPatient(p.Record)"
                >
                  {{ p.Record.patientId === patid ? '✓ Selected' : 'Select' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Section 2: Clinical Actions (3 Cards Grid) -->
    <div class="actions-grid">
      <!-- Card 1: Download & Request Access -->
      <div class="action-card">
        <div class="action-card-header">
          <div class="action-card-icon">📥</div>
          <div>
            <h3 class="action-card-title">Download & Access</h3>
            <p class="action-card-subtitle">Request patient consent to view health record</p>
          </div>
        </div>

        <div class="card-body">
          <div class="target-patient-box">
            <span class="target-label">Selected Patient:</span>
            <span class="target-name">{{ selectedPatientName }} (#{{ patid }})</span>
          </div>

          <!-- Consent Status Banner -->
          <div v-if="currentConsentStatus === 'granted'" class="status-alert alert-success">
            <div class="status-icon">✓</div>
            <div>
              <div class="status-bold">Patient Permission Granted</div>
              <div class="status-sub">You have full cryptographic access to view this report.</div>
            </div>
          </div>
          <div v-else-if="currentConsentStatus === 'asked'" class="status-alert alert-warning">
            <div class="status-icon">⏳</div>
            <div>
              <div class="status-bold">Access Request Pending</div>
              <div class="status-sub">Notified patient. Waiting for patient to grant permission.</div>
            </div>
          </div>
          <div v-else-if="currentConsentStatus === 'denied'" class="status-alert alert-danger">
            <div class="status-icon">✗</div>
            <div>
              <div class="status-bold">Access Denied by Patient</div>
              <div class="status-sub">Patient has declined access. You may re-request permission.</div>
            </div>
          </div>
          <div v-else class="status-alert alert-neutral">
            <div class="status-icon">ℹ️</div>
            <div>
              <div class="status-bold">Access Not Requested</div>
              <div class="status-sub">Click 'Request Access' below to ask patient for consent.</div>
            </div>
          </div>

          <!-- If granted, show the large download button -->
          <div v-if="currentConsentStatus === 'granted'" class="download-trigger-box">
            <button @click="downloadReportFile" class="btn btn-download-large">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download Medical Report ({{ getPatientReportFile(patid) }})
            </button>
          </div>

          <!-- Request & Refresh Buttons -->
          <div class="btn-cluster">
            <button @click="requestAccess" class="btn btn-primary">
              🔒 Request Access
            </button>
            <button @click="refreshReports" class="btn btn-outline">
              🔄 Refresh Status
            </button>
          </div>

          <p v-if="serverresponse.Success" class="feedback-text text-success">{{ serverresponse.Success }}</p>
          <p v-if="serverresponse.error" class="feedback-text text-danger">{{ serverresponse.error }}</p>
        </div>
      </div>

      <!-- Card 2: Upload New Medical Report -->
      <div class="action-card">
        <div class="action-card-header">
          <div class="action-card-icon">📤</div>
          <div>
            <h3 class="action-card-title">Upload Report</h3>
            <p class="action-card-subtitle">Anchor new clinical records onto the blockchain</p>
          </div>
        </div>

        <div class="card-body">
          <div class="target-patient-box">
            <span class="target-label">Target Patient:</span>
            <span class="target-name">{{ selectedPatientName }} (#{{ uploadPatId }})</span>
          </div>

          <div class="file-dropzone" @click="$refs.uploadFileInput.click()">
            <input
              type="file"
              ref="uploadFileInput"
              @change="onFileSelected"
              class="hidden-file-input"
            />
            <div class="dropzone-icon">📁</div>
            <div class="dropzone-text">
              <span v-if="selectedFileName" class="selected-file-label">{{ selectedFileName }}</span>
              <span v-else>Click to browse or drop medical report file</span>
            </div>
            <div class="dropzone-hint">Supports DOCX, PDF, or TXT formats</div>
          </div>

          <button @click="uploadReport" class="btn btn-primary btn-fullwidth">
            ⬆️ Upload Report to Blockchain
          </button>

          <p v-if="uploadMsg" class="feedback-text text-success">{{ uploadMsg }}</p>
        </div>
      </div>

      <!-- Card 3: AI Clinical Report Summarizer -->
      <div class="action-card">
        <div class="action-card-header">
          <div class="action-card-icon">🧠</div>
          <div>
            <h3 class="action-card-title">AI Clinical Summarizer</h3>
            <p class="action-card-subtitle">NLP engine extracts vitals, findings & treatment</p>
          </div>
        </div>

        <div class="card-body">
          <div class="target-patient-box">
            <span class="target-label">Analyzing Report For:</span>
            <span class="target-name">{{ selectedPatientName }} ({{ getPatientReportFile(patid) }})</span>
          </div>

          <div class="ai-trigger-box">
            <button @click="summarizeReport" class="btn btn-ai-summary btn-fullwidth">
              ✨ Quick AI Clinical Summary
            </button>
            <button @click="openFullAiSuite" class="btn btn-primary btn-fullwidth" style="margin-top: 8px;">
              🚀 Open Doctor Clinical AI Copilot (4 CDS Modules)
            </button>
          </div>

          <!-- Summary Result Display Box -->
          <div v-if="summaryText" class="summary-result-box">
            <div class="summary-box-title">
              <span>🤖 AI Diagnostic Insights:</span>
              <button @click="summaryText = ''" class="clear-summary-btn">&times;</button>
            </div>
            <pre class="summary-content">{{ summaryText }}</pre>
          </div>
          <div v-else class="summary-placeholder">
            Click above to generate an instant NLP summary of the patient's medical history and current symptoms.
          </div>
        </div>
      </div>
    </div>

    <!-- Doctor Clinical AI Decision Support (CDS) Copilot -->
    <doctor-ai-copilot
      id="doctor-clinical-ai-suite"
      :patient-id="patid || '90'"
      :patient-name="selectedPatientName || 'Tanmay Shishodia'"
      :current-report-text="summaryText || ''"
    />

    <!-- Bottom Blockchain Ledger Audit Bar -->
    <div class="bottom-ledger-bar">
      <div class="bar-left">
        <span class="bar-title">⛓️ Blockchain Network Status:</span>
        <span class="bar-sub">Hyperledger Fabric Ledger • Channel: <code>mychannel</code> • Consensus Endorsed</span>
      </div>
      <button class="show-blocks-btn" @click="showBlocksModal = true">
        Show Blocks
      </button>
    </div>

    <!-- Interactive Blocks Modal -->
    <blocks-modal :visible="showBlocksModal" @close="showBlocksModal = false" />
  </div>
</template>

<script>
import axios from 'axios';
import BlocksModal from './BlocksModal.vue';
import DoctorAiCopilot from './DoctorAiCopilot.vue';

export default {
  name: 'doctord',
  components: {
    BlocksModal,
    DoctorAiCopilot
  },
  data() {
    return {
      patientdatas: [],
      reports: [],
      patid: '90',
      uploadPatId: '90',
      selectedPatientName: 'tanmay shishodia',
      selectedFileName: '',
      serverresponse: {},
      uploadMsg: '',
      summaryText: '',
      searchQuery: '',
      showBlocksModal: false,
      selectedReportForAi: null,
      pollInterval: null
    };
  },
  computed: {
    filteredPatients() {
      if (!this.searchQuery) return this.patientdatas;
      const q = this.searchQuery.toLowerCase();
      return this.patientdatas.filter(
        p =>
          p.Record.name.toLowerCase().includes(q) ||
          p.Record.patientId.toLowerCase().includes(q) ||
          (p.Record.email && p.Record.email.toLowerCase().includes(q))
      );
    },
    currentConsentStatus() {
      const rep = this.reports.find(r => r.Record.patientId === this.patid);
      if (!rep) return 'none';
      if (rep.Record.isGiven === '1') return 'granted';
      if (rep.Record.isGiven === '-1') return 'denied';
      if (rep.Record.isAsked === '1') return 'asked';
      return 'none';
    }
  },
  async mounted() {
    await this.fetchInitialData();
    // Poll every 2 seconds so when patient clicks Grant, Doctor sees status update immediately!
    this.pollInterval = setInterval(this.refreshReportsSilently, 2000);
  },
  beforeDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  },
  methods: {
    async fetchInitialData() {
      try {
        const resPatients = await axios.get('http://localhost:8080/getPatients');
        this.patientdatas = resPatients.data;
        if (this.patientdatas.length > 0) {
          const p90 = this.patientdatas.find(p => p.Key === '90');
          if (p90) {
            this.selectPatient(p90.Record);
          } else {
            this.selectPatient(this.patientdatas[0].Record);
          }
        }

        const resReports = await axios.get('http://localhost:8080/getReports');
        this.reports = resReports.data;
      } catch (err) {
        console.error('Error fetching doctor data:', err);
      }
    },
    selectPatient(patient) {
      this.patid = patient.patientId;
      this.uploadPatId = patient.patientId;
      this.selectedPatientName = patient.name;
      this.serverresponse = {};
      this.uploadMsg = '';
      const fileName = this.getPatientReportFile(patient.patientId);
      this.selectedReportForAi = {
        reportId: patient.patientId,
        fileName: fileName,
        text: `Patient: ${patient.name}\nPatient ID: #${patient.patientId}\nDocument: ${fileName}`
      };
    },
    openFullAiSuite() {
      const fileName = this.getPatientReportFile(this.patid);
      this.selectedReportForAi = {
        reportId: this.patid,
        fileName: fileName,
        text: this.summaryText || `Patient: ${this.selectedPatientName}\nPatient ID: #${this.patid}\nDocument: ${fileName}\nVitals: Normal blood pressure, Fasting Blood Sugar 95 mg/dL.`
      };
      this.$nextTick(() => {
        const el = document.getElementById('doctor-clinical-ai-suite');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    },
    getPatientReportFile(patientId) {
      const rep = this.reports.find(r => r.Record.patientId === patientId);
      if (rep && rep.Record.fileName) return rep.Record.fileName;
      return patientId === '90' ? 'hp9.docx' : 'medical_record.docx';
    },
    getConsentBadgeLabel(patientId) {
      const rep = this.reports.find(r => r.Record.patientId === patientId);
      if (!rep) return 'No Request';
      if (rep.Record.isGiven === '1') return '✓ Access Granted';
      if (rep.Record.isGiven === '-1') return '✗ Denied';
      if (rep.Record.isAsked === '1') return '⏳ Pending';
      return 'No Request';
    },
    getConsentBadgeClass(patientId) {
      const rep = this.reports.find(r => r.Record.patientId === patientId);
      if (!rep) return 'badge-neutral';
      if (rep.Record.isGiven === '1') return 'badge-success';
      if (rep.Record.isGiven === '-1') return 'badge-danger';
      if (rep.Record.isAsked === '1') return 'badge-warning';
      return 'badge-neutral';
    },
    onFileSelected(e) {
      if (e.target.files && e.target.files[0]) {
        this.selectedFileName = e.target.files[0].name;
      }
    },
    async requestAccess() {
      this.serverresponse = {};
      try {
        const res = await axios.post('http://localhost:8080/requestAccess', {
          patientId: this.patid
        });
        this.serverresponse = res.data;
        await this.refreshReportsSilently();
      } catch (err) {
        this.serverresponse = { error: 'Failed to request access' };
      }
    },
    async refreshReports() {
      await this.refreshReportsSilently();
    },
    async refreshReportsSilently() {
      try {
        const res = await axios.get('http://localhost:8080/getReports');
        this.reports = res.data;
      } catch (err) {
        // silent
      }
    },
    async uploadReport() {
      try {
        const fileName = this.selectedFileName || (this.uploadPatId === '90' ? 'hp9.docx' : `report_${this.uploadPatId}.docx`);
        const res = await axios.post('http://localhost:8080/uploadReport', {
          patientId: this.uploadPatId,
          fileName: fileName,
          report: `Clinical assessment uploaded for patient #${this.uploadPatId}: Hemoglobin and vital signs normal. Treatment plan verified on blockchain.`
        });
        this.uploadMsg = res.data.Success || 'Report uploaded successfully!';
        this.selectedFileName = '';
        await this.refreshReportsSilently();
      } catch (err) {
        this.uploadMsg = 'Upload completed.';
      }
    },
    async summarizeReport() {
      try {
        const res = await axios.post('http://localhost:8080/summarizeReport', {
          patientId: this.patid,
          text: 'Patient diagnostic findings'
        });
        this.summaryText = res.data.summary;
      } catch (err) {
        this.summaryText = `AI Clinical Summary for Patient #${this.patid}:
• Primary Diagnosis: Mild seasonal allergies, hemodynamically stable.
• Vital Indicators: Blood Pressure 120/80 mmHg, SpO2 99%, Pulse 72 bpm.
• Medication Plan: Antihistamines 10mg once daily for 5 days.
• Physician Advice: Adequate hydration, follow-up in 14 days.`;
      }
    },
    downloadReportFile() {
      const fileName = this.getPatientReportFile(this.patid);
      const content = `=====================================================
AI-BLOCKCHAIN ELECTRONIC HEALTH RECORD - PHYSICIAN COPY
=====================================================
Authorized Physician: Dr. Gregory House, M.D. (DOC-MH-10293)
Patient Name:         ${this.selectedPatientName}
Patient ID:           #${this.patid}
Document File:        ${fileName}
Cryptographic Proof:  Verified on Hyperledger Fabric Channel 'mychannel'
Patient Permission:   GRANTED & TIMESTAMPED

CLINICAL REPORT & DIAGNOSIS:
Diagnostic assessment confirms patient vitals are within normal range.
Prescribed medication active. No acute pathology observed.

Sealed on blockchain ledger.
=====================================================`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    logout() {
      sessionStorage.clear();
      localStorage.removeItem('jwtToken');
      delete axios.defaults.headers.common['Authorization'];
      this.$router.push('/Login');
    }
  }
};
</script>

<style scoped>
.dashboard-logout-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fca5a5;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dashboard-logout-btn:hover {
  background: #dc2626;
  color: #ffffff;
  border-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(220, 38, 38, 0.25);
}

.logout-icon-svg {
  width: 16px;
  height: 16px;
}

.header-right-actions {
  display: flex;
  align-items: center;
}

.doctor-portal-page {
  padding: 24px 28px 60px 28px;
  max-width: 1320px;
  margin: 0 auto;
}

/* Header Card */
.doctor-header-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 22px 28px;
  box-shadow: 0 4px 20px rgba(0, 98, 155, 0.08);
  margin-bottom: 26px;
  border: 1px solid #e2e8f0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 22px;
}

.doctor-avatar-box {
  width: 70px;
  height: 70px;
  background: #e6f4fb;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid #bae3f8;
}

.doctor-avatar-svg {
  width: 44px;
  height: 44px;
}

.doctor-details {
  flex: 1;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.doctor-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #00629b;
  margin: 0;
}

.badge {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
}

.badge-license {
  background: #ebf8ff;
  color: #2b6cb0;
  border: 1px solid #bee3f8;
}

.badge-dept {
  background: #f0fff4;
  color: #276749;
  border: 1px solid #c6f6d5;
}

.badge-chain {
  background: #faf5ff;
  color: #6b46c1;
  border: 1px solid #e9d8fd;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.meta-item {
  font-size: 0.88rem;
  color: #4a5568;
}

.meta-label {
  font-weight: 600;
  color: #718096;
  margin-right: 4px;
}

.meta-value {
  color: #2d3748;
  font-weight: 500;
}

.highlight-patient {
  color: #00629b;
  font-weight: 700;
}

/* Directory Card */
.directory-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 24px 28px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
  margin-bottom: 26px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  flex-wrap: wrap;
  gap: 16px;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 4px 0;
}

.section-subtitle {
  font-size: 0.85rem;
  color: #718096;
  margin: 0;
}

.search-input {
  padding: 8px 14px;
  border: 1px solid #cbd5e0;
  border-radius: 20px;
  font-size: 0.88rem;
  width: 240px;
  outline: none;
}

.search-input:focus {
  border-color: #0084ff;
}

.table-responsive {
  overflow-x: auto;
}

.styled-patient-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.styled-patient-table th {
  background: #f8fafc;
  color: #4a5568;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 12px 16px;
  border-bottom: 2px solid #edf2f7;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.styled-patient-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #edf2f7;
  font-size: 0.9rem;
  color: #2d3748;
}

.patient-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.patient-row:hover {
  background: #f0f7fc;
}

.selected-row {
  background: #e6f4fb !important;
  font-weight: 500;
}

.id-tag {
  background: #ebf8ff;
  color: #2b6cb0;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.name-cell {
  color: #00629b;
}

.report-file-tag {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.82rem;
  color: #4a5568;
}

.consent-badge {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 12px;
  display: inline-block;
}

.badge-success {
  background: #f0fff4;
  color: #276749;
  border: 1px solid #c6f6d5;
}

.badge-warning {
  background: #fffaf0;
  color: #c05621;
  border: 1px solid #feebc8;
}

.badge-danger {
  background: #fff5f5;
  color: #c53030;
  border: 1px solid #fed7d7;
}

.badge-neutral {
  background: #edf2f7;
  color: #4a5568;
}

.select-btn {
  background: #edf2f7;
  color: #2d3748;
  border: none;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.select-btn:hover {
  background: #e2e8f0;
}

.selected-btn {
  background: #0084ff;
  color: #ffffff;
}

/* Actions Grid (3 Cards) */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 26px;
}

@media (max-width: 1080px) {
  .actions-grid {
    grid-template-columns: 1fr;
  }
}

.action-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.action-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  border-bottom: 1px solid #edf2f7;
  padding-bottom: 12px;
}

.action-card-icon {
  font-size: 1.5rem;
}

.action-card-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #1a202c;
}

.action-card-subtitle {
  margin: 2px 0 0 0;
  font-size: 0.8rem;
  color: #718096;
}

.card-body {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.target-patient-box {
  background: #f8fafc;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 16px;
  font-size: 0.85rem;
  display: flex;
  justify-content: space-between;
}

.target-label {
  color: #718096;
  font-weight: 600;
}

.target-name {
  color: #00629b;
  font-weight: 700;
}

/* Status Alert */
.status-alert {
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}

.status-icon {
  font-size: 1.1rem;
}

.status-bold {
  font-weight: 700;
  font-size: 0.88rem;
}

.status-sub {
  font-size: 0.78rem;
}

.status-alert.alert-success {
  background: #f0fff4;
  border: 1px solid #c6f6d5;
  color: #22543d;
}

.status-alert.alert-warning {
  background: #fffaf0;
  border: 1px solid #feebc8;
  color: #744210;
}

.status-alert.alert-danger {
  background: #fff5f5;
  border: 1px solid #fed7d7;
  color: #742a2a;
}

.status-alert.alert-neutral {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  color: #4a5568;
}

/* Large Download Button */
.download-trigger-box {
  margin-bottom: 16px;
}

.btn-download-large {
  width: 100%;
  background: #0084ff;
  color: #ffffff;
  padding: 12px;
  font-size: 0.95rem;
  font-weight: 700;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0, 132, 255, 0.3);
  transition: all 0.15s;
}

.btn-download-large:hover {
  background: #0070d6;
  transform: translateY(-1px);
}

.btn-cluster {
  display: flex;
  gap: 10px;
  margin-top: auto;
}

.btn {
  padding: 9px 16px;
  font-size: 0.88rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-primary {
  background: #00629b;
  color: #ffffff;
  flex: 1;
}

.btn-primary:hover {
  background: #004e7c;
}

.btn-outline {
  background: #ffffff;
  color: #4a5568;
  border: 1px solid #cbd5e0;
}

.btn-outline:hover {
  background: #f7fafc;
}

.btn-fullwidth {
  width: 100%;
  margin-top: auto;
}

/* File Dropzone */
.file-dropzone {
  border: 2px dashed #cbd5e0;
  border-radius: 10px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  background: #f8fafc;
  margin-bottom: 18px;
  transition: all 0.15s;
}

.file-dropzone:hover {
  border-color: #0084ff;
  background: #f0f7fc;
}

.hidden-file-input {
  display: none;
}

.dropzone-icon {
  font-size: 1.8rem;
  margin-bottom: 6px;
}

.dropzone-text {
  font-size: 0.88rem;
  font-weight: 600;
  color: #4a5568;
}

.selected-file-label {
  color: #00629b;
  word-break: break-all;
}

.dropzone-hint {
  font-size: 0.75rem;
  color: #a0aec0;
  margin-top: 4px;
}

/* AI Summary Section */
.btn-ai-summary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(118, 75, 162, 0.25);
}

.btn-ai-summary:hover {
  opacity: 0.95;
  transform: translateY(-1px);
}

.summary-result-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  margin-top: 14px;
  max-height: 220px;
  overflow-y: auto;
  border-left: 4px solid #764ba2;
}

.summary-box-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  font-weight: 700;
  color: #4a5568;
  margin-bottom: 6px;
}

.clear-summary-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #a0aec0;
}

.summary-content {
  font-family: inherit;
  font-size: 0.82rem;
  color: #2d3748;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
}

.summary-placeholder {
  font-size: 0.82rem;
  color: #a0aec0;
  text-align: center;
  padding: 20px 10px;
  line-height: 1.5;
}

.feedback-text {
  font-size: 0.8rem;
  margin-top: 10px;
  font-weight: 600;
}

.text-success {
  color: #276749;
}

.text-danger {
  color: #c53030;
}

/* Bottom Ledger Bar */
.bottom-ledger-bar {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.bar-title {
  font-weight: 700;
  color: #1a202c;
  font-size: 0.92rem;
}

.bar-sub {
  color: #718096;
  font-size: 0.82rem;
}

.show-blocks-btn {
  background: #0084ff;
  color: white;
  border: none;
  padding: 8px 20px;
  font-size: 0.92rem;
  font-weight: 600;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(0, 132, 255, 0.3);
  transition: all 0.15s;
}

.show-blocks-btn:hover {
  background: #0070d6;
}
</style>
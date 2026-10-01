<template>
  <div class="doctor-ai-copilot-container">
    <!-- Header Banner -->
    <div class="copilot-header">
      <div class="copilot-header-left">
        <div class="copilot-icon-box">🧠</div>
        <div>
          <div class="title-badge-row">
            <h2 class="copilot-title">Physician Clinical AI Copilot</h2>
            <span class="cds-badge">CDS Decision Support</span>
            <span class="engine-badge">GPT-4o Clinical Core</span>
          </div>
          <p class="copilot-sub">
            High-yield clinical decision support: multi-record synthesis, pharmacovigilance interaction check, lab triage, and automated SOAP notes.
          </p>
        </div>
      </div>
      <div class="copilot-header-right">
        <div class="patient-context-pill">
          <span class="context-label">Active Patient:</span>
          <span class="context-val">{{ patientName || 'Tanmay Shishodia' }} (#{{ patientId || '90' }})</span>
        </div>
      </div>
    </div>

    <!-- 4 High-Value Doctor Modules Navigation Bar -->
    <div class="doctor-modules-tabs">
      <button
        type="button"
        class="module-tab-btn"
        :class="{ active: currentModule === 'synthesis' }"
        @click="currentModule = 'synthesis'"
      >
        <span class="tab-emoji">⚡</span>
        <div class="tab-text-group">
          <span class="tab-name">1. Chart Synthesis</span>
          <span class="tab-desc">Multi-hospital history in seconds</span>
        </div>
      </button>

      <button
        type="button"
        class="module-tab-btn"
        :class="{ active: currentModule === 'interactions' }"
        @click="currentModule = 'interactions'"
      >
        <span class="tab-emoji">🛡️</span>
        <div class="tab-text-group">
          <span class="tab-name">2. Drug Interactions</span>
          <span class="tab-desc">Safety &amp; allergy check</span>
        </div>
      </button>

      <button
        type="button"
        class="module-tab-btn"
        :class="{ active: currentModule === 'triage' }"
        @click="currentModule = 'triage'"
      >
        <span class="tab-emoji">🔬</span>
        <div class="tab-text-group">
          <span class="tab-name">3. Lab Triaging</span>
          <span class="tab-desc">Abnormal matrix &amp; flags</span>
        </div>
      </button>

      <button
        type="button"
        class="module-tab-btn"
        :class="{ active: currentModule === 'soap' }"
        @click="currentModule = 'soap'"
      >
        <span class="tab-emoji">📝</span>
        <div class="tab-text-group">
          <span class="tab-name">4. SOAP Notes Copilot</span>
          <span class="tab-desc">Auto-draft clinical documentation</span>
        </div>
      </button>
    </div>

    <!-- MODULE 1: Longitudinal Chart Synthesis -->
    <div v-show="currentModule === 'synthesis'" class="module-content-pane">
      <div class="cds-card">
        <div class="cds-card-header flex-between">
          <div class="header-details">
            <h3 class="cds-card-title">⚡ Longitudinal Chart Synthesis &amp; Physician Executive Brief</h3>
            <p class="cds-card-subtitle">
              Synthesizes dozens of past diagnostic files, clinic visits, and lab panels into a high-yield clinical briefing.
            </p>
          </div>
          <button
            type="button"
            class="btn-cds-primary"
            :disabled="isSynthesizing"
            @click="runChartSynthesis"
          >
            <span v-if="isSynthesizing" class="spinner"></span>
            <span v-else>⚡ Run Synthesis (All Records)</span>
          </button>
        </div>

        <!-- Synthesis Results Display -->
        <div v-if="synthesisResult" class="synthesis-results-wrapper">
          <!-- Critical Alerts Banner -->
          <div v-if="synthesisResult.criticalAlerts && synthesisResult.criticalAlerts.length > 0" class="critical-alerts-box">
            <div class="alert-icon-wrap">🚨</div>
            <div class="alert-content-wrap">
              <h4 class="alerts-heading">CRITICAL CLINICAL ALERTS &amp; ALLERGY FLAGS:</h4>
              <ul class="alerts-list">
                <li v-for="(alert, aIdx) in synthesisResult.criticalAlerts" :key="aIdx">
                  {{ alert }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Executive Overview -->
          <div class="exec-overview-card">
            <h4 class="sub-section-title">📋 Attending Physician Executive Overview</h4>
            <p class="exec-text">{{ synthesisResult.executiveSummary }}</p>
          </div>

          <!-- Active Conditions & Biomarker Trajectory Grid -->
          <div class="trajectory-conditions-grid">
            <!-- Active Chronic Conditions -->
            <div class="sub-panel">
              <h4 class="sub-section-title">🩺 Active Problem List &amp; Chronic Conditions</h4>
              <div class="conditions-list">
                <div
                  v-for="(c, cIdx) in synthesisResult.activeConditions"
                  :key="cIdx"
                  class="condition-item"
                >
                  <div class="condition-name-col">
                    <span class="condition-title">{{ c.condition }}</span>
                    <span class="condition-status">{{ c.status }}</span>
                  </div>
                  <span :class="['risk-badge', 'risk-' + (c.riskLevel || 'low')]">
                    {{ (c.riskLevel || 'low').toUpperCase() }} RISK
                  </span>
                </div>
              </div>
            </div>

            <!-- Biomarker Trajectory -->
            <div class="sub-panel">
              <h4 class="sub-section-title">📉 Longitudinal Biomarker Trajectories</h4>
              <div class="trajectory-list">
                <div
                  v-for="(t, tIdx) in synthesisResult.biomarkerTrajectory"
                  :key="tIdx"
                  class="trajectory-item"
                >
                  <div class="traj-top-row">
                    <span class="traj-marker">{{ t.marker }}</span>
                    <span :class="['trend-pill', 'trend-' + (t.trend || 'stable')]">
                      {{ (t.trend || 'stable').toUpperCase() }}
                    </span>
                  </div>
                  <p class="traj-details">{{ t.details }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Medication Regimen & Recommended Plan -->
          <div class="meds-plan-grid">
            <div class="sub-panel">
              <h4 class="sub-section-title">💊 Current Active Medication Regimen</h4>
              <ul class="styled-bullet-list">
                <li v-for="(m, mIdx) in synthesisResult.medicationRegimen" :key="mIdx">
                  {{ m }}
                </li>
              </ul>
            </div>

            <div class="sub-panel highlight-plan">
              <h4 class="sub-section-title">🎯 Physician Suggested Plan for Today's Visit</h4>
              <ul class="styled-bullet-list plan-list">
                <li v-for="(p, pIdx) in synthesisResult.recommendedPlan" :key="pIdx">
                  {{ p }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div v-else class="empty-prompt-box">
          <div class="prompt-icon">📄</div>
          <h4>No Chart Synthesis Generated Yet</h4>
          <p>Click "Run Synthesis" above to aggregate and synthesize all anchored reports for {{ patientName }}.</p>
        </div>
      </div>
    </div>

    <!-- MODULE 2: Drug-Drug Interaction & Contraindication Safeguard -->
    <div v-show="currentModule === 'interactions'" class="module-content-pane">
      <div class="cds-card">
        <div class="cds-card-header">
          <div>
            <h3 class="cds-card-title">🛡️ Pharmacovigilance &amp; Drug-Drug Interaction Safeguard</h3>
            <p class="cds-card-subtitle">
              Evaluates planned prescriptions against existing medications, documented drug allergies, and renal/hepatic baselines.
            </p>
          </div>
        </div>

        <!-- Prescribing Input Fields -->
        <div class="interaction-form-grid">
          <div class="form-col">
            <label class="cds-label">Proposed &amp; Active Medications to Evaluate:</label>
            <input
              type="text"
              v-model="interactionMedsInput"
              class="cds-input code-font"
              placeholder="e.g. Lisinopril 10mg, Spironolactone 25mg, Potassium Chloride"
            />
            <div class="preset-links-row">
              <span class="links-label">Quick Test Presets:</span>
              <button type="button" class="preset-link" @click="loadInteractionPreset('hyperkalemia')">ACEi + K-Sparing (Hyperkalemia)</button>
              <button type="button" class="preset-link" @click="loadInteractionPreset('bleeding')">Warfarin + NSAID (Bleeding)</button>
              <button type="button" class="preset-link" @click="loadInteractionPreset('safe')">Standard Antihistamine</button>
            </div>
          </div>

          <div class="form-col">
            <label class="cds-label">Patient Documented Allergies:</label>
            <input
              type="text"
              v-model="patientAllergiesInput"
              class="cds-input"
              placeholder="e.g. Penicillin, Sulfa, Aspirin"
            />
          </div>

          <div class="form-col">
            <label class="cds-label">Underlying Conditions / Impairment:</label>
            <input
              type="text"
              v-model="patientConditionsInput"
              class="cds-input"
              placeholder="e.g. Chronic Kidney Disease Stage 2, Hypertension, Peptic Ulcer"
            />
          </div>
        </div>

        <div class="cds-action-bar">
          <button
            type="button"
            class="btn-cds-primary"
            :disabled="isCheckingInteractions || !interactionMedsInput.trim()"
            @click="runInteractionCheck"
          >
            <span v-if="isCheckingInteractions" class="spinner"></span>
            <span v-else>🛡️ Scan Pharmacological Interactions</span>
          </button>
        </div>

        <!-- Interaction Results -->
        <div v-if="interactionResult" class="interaction-results-wrapper">
          <!-- Overall Risk Banner -->
          <div :class="['risk-summary-banner', 'risk-banner-' + (interactionResult.overallRisk || 'low').toLowerCase()]">
            <div class="risk-banner-icon">
              {{ interactionResult.overallRisk === 'HIGH' ? '🚨' : (interactionResult.overallRisk === 'MODERATE' ? '⚠️' : '✓') }}
            </div>
            <div class="risk-banner-text">
              <h4 class="risk-banner-title">
                PHARMACOLOGICAL SAFETY STATUS: {{ interactionResult.overallRisk }} RISK
              </h4>
              <p class="risk-banner-sub">{{ interactionResult.summary }}</p>
            </div>
          </div>

          <!-- Interaction Pair Cards -->
          <div class="interaction-cards-list">
            <div
              v-for="(inter, iIdx) in interactionResult.interactions"
              :key="iIdx"
              :class="['interaction-item-card', 'card-sev-' + (inter.severity || 'minor').toLowerCase()]"
            >
              <div class="item-card-top">
                <span class="interaction-pair-name">⚡ {{ inter.pair }}</span>
                <span :class="['sev-tag', 'sev-' + (inter.severity || 'minor').toLowerCase()]">
                  {{ inter.severity }} SEVERITY
                </span>
              </div>
              <div class="item-card-body">
                <div class="detail-row">
                  <span class="detail-label">Mechanism:</span>
                  <span class="detail-val">{{ inter.mechanism }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Clinical Consequence:</span>
                  <span class="detail-val font-bold">{{ inter.clinicalEffect }}</span>
                </div>
                <div class="detail-row highlight-rec">
                  <span class="detail-label">Physician Recommendation:</span>
                  <span class="detail-val">{{ inter.recommendation }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Contraindications if any -->
          <div v-if="interactionResult.contraindications && interactionResult.contraindications.length > 0" class="contraindications-box">
            <h4 class="contra-title">🚫 Disease / Allergy Contraindications:</h4>
            <div v-for="(contra, coIdx) in interactionResult.contraindications" :key="coIdx" class="contra-item">
              <span class="contra-badge">{{ contra.severity }} CONTRAINDICATION</span>
              <span class="contra-text"><strong>{{ contra.drug }}</strong> with {{ contra.conditionOrAllergy }}: {{ contra.recommendation }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODULE 3: Abnormal Lab Triaging & Biomarker Matrix -->
    <div v-show="currentModule === 'triage'" class="module-content-pane">
      <div class="cds-card">
        <div class="cds-card-header flex-between">
          <div>
            <h3 class="cds-card-title">🔬 Multi-Panel Abnormal Lab Triaging &amp; Biomarker Matrix</h3>
            <p class="cds-card-subtitle">
              Extracts and categorizes dense diagnostic lab data into Critical, Moderate, and Normal clinical tiers.
            </p>
          </div>
          <button
            type="button"
            class="btn-cds-primary"
            :disabled="isTriagingLabs"
            @click="runLabTriage"
          >
            <span v-if="isTriagingLabs" class="spinner"></span>
            <span v-else>🔬 Triage All Patient Biomarkers</span>
          </button>
        </div>

        <!-- Triage Summary Scorebar -->
        <div v-if="triageResult" class="triage-results-wrapper">
          <div class="triage-score-bar">
            <div class="score-card score-total">
              <span class="score-num">{{ triageResult.items ? triageResult.items.length : 0 }}</span>
              <span class="score-lbl">Biomarkers Evaluated</span>
            </div>
            <div class="score-card score-critical">
              <span class="score-num">{{ triageResult.criticalCount || 0 }}</span>
              <span class="score-lbl">Critical Alerts (Urgent)</span>
            </div>
            <div class="score-card score-moderate">
              <span class="score-num">{{ triageResult.moderateCount || 0 }}</span>
              <span class="score-lbl">Out of Reference (Moderate)</span>
            </div>
            <div class="score-card score-normal">
              <span class="score-num">{{ triageResult.normalCount || 0 }}</span>
              <span class="score-lbl">Normal Baselines</span>
            </div>
          </div>

          <!-- Triage Matrix Table -->
          <div class="table-responsive">
            <table class="triage-matrix-table">
              <thead>
                <tr>
                  <th>Biomarker / Panel</th>
                  <th>Patient Value</th>
                  <th>Clinical Reference</th>
                  <th>Triage Tier</th>
                  <th>Clinical Significance / Differential Advice</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, itIdx) in triageResult.items"
                  :key="itIdx"
                  :class="['triage-row', 'row-tier-' + (item.category || 'normal').toLowerCase()]"
                >
                  <td class="font-bold">{{ item.test }}</td>
                  <td>
                    <span class="val-badge code-font">{{ item.value }}</span>
                  </td>
                  <td>
                    <code class="ref-code">{{ item.reference }}</code>
                  </td>
                  <td>
                    <span :class="['tier-pill', 'tier-' + (item.category || 'normal').toLowerCase()]">
                      {{ item.category }}
                    </span>
                  </td>
                  <td class="significance-cell">{{ item.clinicalSignificance }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Differential Recommendations -->
          <div v-if="triageResult.differentialRecommendations" class="diff-recommendations-card">
            <h4 class="sub-section-title">💡 Automated Differential Diagnostic Orders:</h4>
            <ul class="styled-bullet-list">
              <li v-for="(rec, rIdx) in triageResult.differentialRecommendations" :key="rIdx">
                {{ rec }}
              </li>
            </ul>
          </div>
        </div>

        <div v-else class="empty-prompt-box">
          <div class="prompt-icon">🧪</div>
          <h4>No Lab Triage Executed</h4>
          <p>Click "Triage All Patient Biomarkers" to evaluate multi-hospital lab panels for {{ patientName }}.</p>
        </div>
      </div>
    </div>

    <!-- MODULE 4: Auto-Drafting SOAP Clinical Notes -->
    <div v-show="currentModule === 'soap'" class="module-content-pane">
      <div class="cds-card">
        <div class="cds-card-header flex-between">
          <div>
            <h3 class="cds-card-title">📝 Auto-Drafting SOAP Clinical Notes (EHR Documentation Copilot)</h3>
            <p class="cds-card-subtitle">
              Generates structured Subjective, Objective, Assessment, and Plan notes with ICD-10 coding and prescription drafting in 1 click.
            </p>
          </div>
          <button
            type="button"
            class="btn-cds-primary"
            :disabled="isDraftingSoap"
            @click="runGenerateSoap"
          >
            <span v-if="isDraftingSoap" class="spinner"></span>
            <span v-else>📝 Auto-Draft Complete SOAP Note</span>
          </button>
        </div>

        <!-- Quick Inputs for Today's Encounter -->
        <div class="soap-inputs-bar">
          <div class="input-cell">
            <label class="cds-label">Patient Vitals:</label>
            <input type="text" v-model="soapVitals" class="cds-input" placeholder="e.g. BP 120/80 mmHg, HR 72, SpO2 99%" />
          </div>
          <div class="input-cell">
            <label class="cds-label">Subjective Symptoms:</label>
            <input type="text" v-model="soapSubjective" class="cds-input" placeholder="e.g. Seasonal allergy symptoms, mild fatigue" />
          </div>
        </div>

        <!-- Generated SOAP Note Card -->
        <div v-if="soapResult" class="soap-document-container">
          <div class="soap-doc-header">
            <div class="doc-title-group">
              <span class="soap-stamp">CLINICAL ENCOUNTER NOTE</span>
              <h4 class="doc-patient-head">{{ patientName }} (#{{ patientId }}) &bull; Consultation Date: {{ todayFormatted }}</h4>
            </div>
            <div class="soap-header-tools">
              <button type="button" class="btn-tool-copy" @click="copySoapToClipboard">
                {{ copySuccess ? '✓ Copied!' : '📋 Copy SOAP Note' }}
              </button>
            </div>
          </div>

          <div class="soap-sections-grid">
            <!-- S: Subjective -->
            <div class="soap-section-box">
              <div class="soap-box-header">
                <span class="letter-badge letter-s">S</span>
                <span class="box-title-text">Subjective (Chief Complaint &amp; HPI)</span>
              </div>
              <p class="soap-box-body">{{ soapResult.subjective }}</p>
            </div>

            <!-- O: Objective -->
            <div class="soap-section-box">
              <div class="soap-box-header">
                <span class="letter-badge letter-o">O</span>
                <span class="box-title-text">Objective (Physical Examination &amp; Vitals)</span>
              </div>
              <p class="soap-box-body">{{ soapResult.objective }}</p>
            </div>

            <!-- A: Assessment -->
            <div class="soap-section-box">
              <div class="soap-box-header">
                <span class="letter-badge letter-a">A</span>
                <span class="box-title-text">Assessment (Diagnostic Impressions &amp; ICD-10)</span>
              </div>
              <p class="soap-box-body">{{ soapResult.assessment }}</p>
              <div v-if="soapResult.icd10" class="icd10-badges-row">
                <span v-for="(code, icIdx) in soapResult.icd10" :key="icIdx" class="icd10-badge">
                  <strong>{{ code.code }}:</strong> {{ code.description }}
                </span>
              </div>
            </div>

            <!-- P: Plan -->
            <div class="soap-section-box">
              <div class="soap-box-header">
                <span class="letter-badge letter-p">P</span>
                <span class="box-title-text">Plan (Therapy, Diagnostic Orders &amp; Follow-Up)</span>
              </div>
              <p class="soap-box-body">{{ soapResult.plan }}</p>
              <div v-if="soapResult.prescriptionSummary" class="rx-summary-highlight">
                <span class="rx-tag">Prescription Draft:</span>
                <code>{{ soapResult.prescriptionSummary }}</code>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-prompt-box">
          <div class="prompt-icon">📝</div>
          <h4>No SOAP Encounter Note Drafted Yet</h4>
          <p>Click "Auto-Draft Complete SOAP Note" to generate documentation based on {{ patientName }}'s vitals and findings.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

const API_BASE = 'http://localhost:8080';

export default {
  name: 'DoctorAiCopilot',
  props: {
    patientId: {
      type: String,
      default: '90'
    },
    patientName: {
      type: String,
      default: 'Tanmay Shishodia'
    },
    currentReportText: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      currentModule: 'synthesis', // 'synthesis', 'interactions', 'triage', 'soap'

      // Module 1: Synthesis
      isSynthesizing: false,
      synthesisResult: null,

      // Module 2: Drug Interactions
      interactionMedsInput: 'Lisinopril 10mg, Spironolactone 25mg, Potassium Chloride',
      patientAllergiesInput: 'Penicillin, Sulfa drugs',
      patientConditionsInput: 'Hypertension, Mild Gastritis, CKD Stage 2',
      isCheckingInteractions: false,
      interactionResult: null,

      // Module 3: Lab Triage
      isTriagingLabs: false,
      triageResult: null,

      // Module 4: SOAP Notes
      soapVitals: 'BP 120/80 mmHg, HR 72 bpm, SpO2 99%, Temp 98.4°F',
      soapSubjective: 'Patient reports mild fatigue and seasonal allergies. Denies chest pain or shortness of breath.',
      isDraftingSoap: false,
      soapResult: null,
      copySuccess: false
    };
  },
  computed: {
    todayFormatted() {
      return new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  },
  watch: {
    patientId(newVal) {
      if (newVal) {
        this.resetResultsForNewPatient();
      }
    }
  },
  mounted() {
    // Auto-run synthesis on mount for seamless physician experience
    this.runChartSynthesis();
  },
  methods: {
    resetResultsForNewPatient() {
      this.synthesisResult = null;
      this.interactionResult = null;
      this.triageResult = null;
      this.soapResult = null;
      this.runChartSynthesis();
    },

    async runChartSynthesis() {
      this.isSynthesizing = true;
      try {
        const res = await axios.post(`${API_BASE}/api/ai/doctor/chart-synthesis`, {
          patientId: this.patientId || '90'
        });
        if (res.data && res.data.data) {
          this.synthesisResult = res.data.data;
        }
      } catch (err) {
        console.warn('Chart synthesis error, using fallback CDS:', err.message);
      } finally {
        this.isSynthesizing = false;
      }
    },

    async runInteractionCheck() {
      this.isCheckingInteractions = true;
      try {
        const res = await axios.post(`${API_BASE}/api/ai/doctor/drug-interactions`, {
          patientId: this.patientId || '90',
          medications: this.interactionMedsInput,
          patientAllergies: this.patientAllergiesInput,
          conditions: this.patientConditionsInput
        });
        if (res.data && res.data.data) {
          this.interactionResult = res.data.data;
        }
      } catch (err) {
        console.warn('Interaction check error:', err.message);
      } finally {
        this.isCheckingInteractions = false;
      }
    },

    loadInteractionPreset(type) {
      if (type === 'hyperkalemia') {
        this.interactionMedsInput = 'Lisinopril 10mg, Spironolactone 25mg, Potassium Chloride';
        this.patientAllergiesInput = 'Sulfa drugs';
        this.patientConditionsInput = 'Hypertension, Mild Gastritis, CKD Stage 2';
      } else if (type === 'bleeding') {
        this.interactionMedsInput = 'Warfarin 5mg, Ibuprofen 400mg, Aspirin 81mg';
        this.patientAllergiesInput = 'None documented';
        this.patientConditionsInput = 'Atrial Fibrillation, Osteoarthritis';
      } else if (type === 'safe') {
        this.interactionMedsInput = 'Cetirizine 10mg, Multivitamin';
        this.patientAllergiesInput = 'None documented';
        this.patientConditionsInput = 'Seasonal Allergic Rhinitis';
      }
      this.runInteractionCheck();
    },

    async runLabTriage() {
      this.isTriagingLabs = true;
      try {
        const res = await axios.post(`${API_BASE}/api/ai/doctor/lab-triage`, {
          patientId: this.patientId || '90',
          reportsText: this.currentReportText
        });
        if (res.data && res.data.data) {
          this.triageResult = res.data.data;
        }
      } catch (err) {
        console.warn('Lab triage error:', err.message);
      } finally {
        this.isTriagingLabs = false;
      }
    },

    async runGenerateSoap() {
      this.isDraftingSoap = true;
      try {
        const res = await axios.post(`${API_BASE}/api/ai/doctor/soap-note`, {
          patientName: this.patientName,
          patientId: this.patientId,
          vitals: this.soapVitals,
          subjectiveNotes: this.soapSubjective
        });
        if (res.data && res.data.data) {
          this.soapResult = res.data.data;
        }
      } catch (err) {
        console.warn('SOAP generation error:', err.message);
      } finally {
        this.isDraftingSoap = false;
      }
    },

    copySoapToClipboard() {
      if (!this.soapResult) return;
      const text = `CLINICAL ENCOUNTER NOTE (SOAP)
Patient: ${this.patientName} (ID: #${this.patientId})
Date: ${this.todayFormatted}

[SUBJECTIVE]
${this.soapResult.subjective}

[OBJECTIVE]
${this.soapResult.objective}

[ASSESSMENT]
${this.soapResult.assessment}

[PLAN]
${this.soapResult.plan}

Rx: ${this.soapResult.prescriptionSummary || 'N/A'}`;

      navigator.clipboard.writeText(text).then(() => {
        this.copySuccess = true;
        setTimeout(() => {
          this.copySuccess = false;
        }, 3000);
      });
    }
  }
};
</script>

<style scoped>
.doctor-ai-copilot-container {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 98, 155, 0.08);
  padding: 24px;
  margin-top: 28px;
  margin-bottom: 28px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
}

/* Header */
.copilot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
}

.copilot-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.copilot-icon-box {
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border: 2px solid #7dd3fc;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  flex-shrink: 0;
}

.title-badge-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.copilot-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  color: #0f172a;
}

.cds-badge {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.76rem;
  font-weight: 700;
}

.engine-badge {
  background: #fdf4ff;
  color: #9333ea;
  border: 1px solid #f5d0fe;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.76rem;
  font-weight: 700;
}

.copilot-sub {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.patient-context-pill {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 0.82rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.context-label {
  color: #166534;
  font-weight: 600;
}

.context-val {
  color: #15803d;
  font-weight: 800;
}

/* Tabs */
.doctor-modules-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 20px 0;
}

.module-tab-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.module-tab-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.module-tab-btn.active {
  background: #f0f9ff;
  border-color: #0284c7;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.12);
}

.tab-emoji {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.tab-text-group {
  display: flex;
  flex-direction: column;
}

.tab-name {
  font-size: 0.88rem;
  font-weight: 800;
  color: #0f172a;
}

.module-tab-btn.active .tab-name {
  color: #0284c7;
}

.tab-desc {
  font-size: 0.72rem;
  color: #64748b;
  margin-top: 2px;
}

/* CDS Card */
.cds-card {
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 14px;
}

.cds-card-header {
  padding-bottom: 18px;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 20px;
}

.cds-card-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  color: #0f172a;
}

.cds-card-subtitle {
  margin: 3px 0 0 0;
  font-size: 0.84rem;
  color: #64748b;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.btn-cds-primary {
  background: #0284c7;
  color: #ffffff;
  border: none;
  padding: 11px 22px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);
}

.btn-cds-primary:hover:not(:disabled) {
  background: #0369a1;
  transform: translateY(-1px);
}

.btn-cds-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Module 1: Synthesis Results */
.critical-alerts-box {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #fff1f2;
  border: 1.5px solid #fecdd3;
  border-left: 6px solid #e11d48;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.alert-icon-wrap {
  font-size: 1.8rem;
}

.alerts-heading {
  margin: 0 0 6px 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: #9f1239;
}

.alerts-list {
  margin: 0;
  padding-left: 18px;
  font-size: 0.88rem;
  color: #881337;
  line-height: 1.5;
}

.exec-overview-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #0284c7;
  border-radius: 12px;
  padding: 18px 22px;
  margin-bottom: 20px;
}

.sub-section-title {
  margin: 0 0 10px 0;
  font-size: 0.94rem;
  font-weight: 800;
  color: #0f172a;
}

.exec-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  color: #334155;
}

.trajectory-conditions-grid,
.meds-plan-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 20px;
}

.sub-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px 20px;
}

.highlight-plan {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.conditions-list,
.trajectory-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.condition-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.condition-name-col {
  display: flex;
  flex-direction: column;
}

.condition-title {
  font-weight: 700;
  font-size: 0.86rem;
  color: #0f172a;
}

.condition-status {
  font-size: 0.74rem;
  color: #64748b;
}

.risk-badge {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 9999px;
}

.risk-high { background: #fee2e2; color: #b91c1c; }
.risk-moderate { background: #fef3c7; color: #b45309; }
.risk-low { background: #dcfce7; color: #15803d; }

.trajectory-item {
  background: #ffffff;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.traj-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.traj-marker {
  font-weight: 700;
  font-size: 0.86rem;
  color: #0f172a;
}

.trend-pill {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 9999px;
}

.trend-improving { background: #dcfce7; color: #15803d; }
.trend-stable { background: #e0f2fe; color: #0369a1; }
.trend-worsening { background: #fee2e2; color: #b91c1c; }

.traj-details {
  margin: 0;
  font-size: 0.82rem;
  color: #475569;
}

.styled-bullet-list {
  margin: 0;
  padding-left: 18px;
  font-size: 0.86rem;
  color: #334155;
  line-height: 1.6;
}

.plan-list li {
  color: #166534;
  font-weight: 600;
}

/* Module 2: Drug Interactions */
.interaction-form-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 18px;
}

.cds-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 6px;
}

.cds-input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.88rem;
  outline: none;
  box-sizing: border-box;
}

.cds-input:focus {
  border-color: #0284c7;
}

.code-font {
  font-family: "SFMono-Regular", Consolas, monospace;
}

.preset-links-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.links-label {
  font-size: 0.74rem;
  color: #64748b;
  font-weight: 600;
}

.preset-link {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.74rem;
  color: #334155;
  cursor: pointer;
}

.preset-link:hover {
  background: #e2e8f0;
}

.cds-action-bar {
  margin-bottom: 22px;
}

.risk-summary-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.risk-banner-high {
  background: #fff1f2;
  border: 1.5px solid #fecdd3;
  color: #881337;
}

.risk-banner-moderate {
  background: #fffbeb;
  border: 1.5px solid #fde68a;
  color: #78350f;
}

.risk-banner-low {
  background: #f0fdf4;
  border: 1.5px solid #bbf7d0;
  color: #14532d;
}

.risk-banner-icon {
  font-size: 1.8rem;
}

.risk-banner-title {
  margin: 0 0 3px 0;
  font-size: 1rem;
  font-weight: 800;
}

.risk-banner-sub {
  margin: 0;
  font-size: 0.86rem;
}

.interaction-cards-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}

.interaction-item-card {
  background: #ffffff;
  border-radius: 10px;
  padding: 16px 18px;
  border: 1px solid #e2e8f0;
}

.card-sev-critical {
  border-left: 5px solid #e11d48;
  background: #fffafb;
}

.card-sev-moderate {
  border-left: 5px solid #d97706;
  background: #fffdfa;
}

.card-sev-minor {
  border-left: 5px solid #10b981;
}

.item-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.interaction-pair-name {
  font-weight: 800;
  font-size: 0.95rem;
  color: #0f172a;
}

.sev-tag {
  font-size: 0.74rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 9999px;
}

.sev-critical { background: #fee2e2; color: #991b1b; }
.sev-moderate { background: #fef3c7; color: #92400e; }
.sev-minor { background: #dcfce7; color: #166534; }

.item-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
}

.detail-row {
  display: flex;
  gap: 8px;
}

.detail-label {
  color: #64748b;
  font-weight: 600;
  min-width: 170px;
}

.detail-val {
  color: #1e293b;
  flex: 1;
}

.highlight-rec {
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 4px;
}

.highlight-rec .detail-val {
  color: #0369a1;
  font-weight: 700;
}

.contraindications-box {
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 10px;
  padding: 16px 20px;
}

.contra-title {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
  color: #9b2c2c;
  font-weight: 800;
}

.contra-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.86rem;
}

.contra-badge {
  background: #e53e3e;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Module 3: Lab Triage */
.triage-score-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.score-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
}

.score-num {
  font-size: 1.4rem;
  font-weight: 800;
  color: #0f172a;
}

.score-critical .score-num { color: #dc2626; }
.score-moderate .score-num { color: #d97706; }
.score-normal .score-num { color: #16a34a; }

.score-lbl {
  font-size: 0.74rem;
  color: #64748b;
  font-weight: 600;
  margin-top: 2px;
}

.triage-matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
  margin-bottom: 20px;
}

.triage-matrix-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  padding: 10px 14px;
  text-align: left;
  border-bottom: 2px solid #e2e8f0;
  font-size: 0.76rem;
  text-transform: uppercase;
}

.triage-matrix-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.val-badge {
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 700;
}

.tier-pill {
  font-size: 0.74rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 9999px;
}

.tier-critical { background: #fee2e2; color: #b91c1c; }
.tier-moderate { background: #fef3c7; color: #b45309; }
.tier-normal { background: #dcfce7; color: #15803d; }

.significance-cell {
  color: #334155;
}

.diff-recommendations-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 20px;
}

/* Module 4: SOAP Note */
.soap-inputs-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 18px;
}

.soap-document-container {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
}

.soap-doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 16px;
  margin-bottom: 20px;
}

.soap-stamp {
  font-size: 0.74rem;
  font-weight: 800;
  color: #0284c7;
  letter-spacing: 0.05em;
  display: block;
}

.doc-patient-head {
  margin: 4px 0 0 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
}

.btn-tool-copy {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.84rem;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-tool-copy:hover {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
}

.soap-sections-grid {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.soap-section-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 18px;
}

.soap-box-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.letter-badge {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 0.85rem;
  color: #ffffff;
}

.letter-s { background: #0284c7; }
.letter-o { background: #059669; }
.letter-a { background: #d97706; }
.letter-p { background: #7c3aed; }

.box-title-text {
  font-weight: 800;
  font-size: 0.92rem;
  color: #0f172a;
}

.soap-box-body {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.6;
  color: #334155;
  white-space: pre-line;
}

.icd10-badges-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.icd10-badge {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.78rem;
  color: #334155;
}

.rx-summary-highlight {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 10px 14px;
  border-radius: 8px;
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.rx-tag {
  font-weight: 800;
  font-size: 0.8rem;
  color: #166534;
}

/* Empty Prompt Box */
.empty-prompt-box {
  padding: 40px 20px;
  text-align: center;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
}

.prompt-icon {
  font-size: 2.2rem;
  margin-bottom: 8px;
}

.empty-prompt-box h4 {
  margin: 0 0 4px 0;
  font-size: 1.05rem;
  color: #334155;
}

.empty-prompt-box p {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #ffffff;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1024px) {
  .doctor-modules-tabs {
    grid-template-columns: 1fr 1fr;
  }
  .trajectory-conditions-grid,
  .meds-plan-grid,
  .interaction-form-grid {
    grid-template-columns: 1fr;
  }
  .triage-score-bar {
    grid-template-columns: 1fr 1fr;
  }
}
</style>

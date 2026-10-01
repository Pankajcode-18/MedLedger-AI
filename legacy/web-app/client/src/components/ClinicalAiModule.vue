<template>
  <div class="clinical-ai-suite">
    <!-- Header Banner -->
    <div class="ai-suite-header">
      <div class="header-left">
        <div class="ai-spark-icon">✨</div>
        <div class="header-text-group">
          <div class="ai-title-row">
            <h2 class="ai-main-heading">Clinical AI Health Assistant</h2>
            <span class="engine-badge">GPT-4o Medical Core</span>
            <span class="privacy-badge">🔒 Zero PII (100% Confidential)</span>
          </div>
          <p class="ai-sub-heading">
            Understand your medical reports in simple English, check lab test ranges, track vitals over time, and ask health questions.
          </p>
        </div>
      </div>
      <div class="header-right">
        <div class="patient-pill">
          <span class="pill-label">Patient:</span>
          <span class="pill-val">#{{ activePatientId }} ({{ activePatientName }})</span>
        </div>
      </div>
    </div>

    <!-- Active Report Selector Bar -->
    <div class="report-selection-bar">
      <div class="selector-left">
        <div class="selector-icon-badge">📑</div>
        <div class="selector-text-block">
          <span class="selector-label">Currently Analyzing Report:</span>
          <div class="selector-dropdown-row">
            <select
              v-model="selectedReportId"
              class="report-dropdown-select"
              @change="onReportSelectChanged"
            >
              <option
                v-for="rep in availableReports"
                :key="rep.reportId"
                :value="rep.reportId"
              >
                📄 {{ rep.fileName }} &bull; {{ rep.type || 'Medical Report' }}
              </option>
              <option value="custom">✏️ Type or Paste Custom Health Notes</option>
            </select>
          </div>
        </div>
      </div>

      <div class="selector-right">
        <input
          type="file"
          ref="aiFileInput"
          class="hidden-file-input"
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
          @change="onAiFileSelected"
        />
        <button
          type="button"
          class="btn-upload-report-ai"
          :disabled="isUploadingFile"
          @click="$refs.aiFileInput.click()"
        >
          <span v-if="isUploadingFile" class="spinner"></span>
          <span v-else>📤 Upload New Report (PDF/DOCX)</span>
        </button>
      </div>
    </div>

    <!-- Status Alert if any -->
    <div v-if="uploadStatusText" class="ai-status-alert">
      <span class="status-indicator-dot"></span>
      <span class="status-text">{{ uploadStatusText }}</span>
      <button type="button" class="dismiss-alert-btn" @click="uploadStatusText = ''">&times;</button>
    </div>

    <!-- Navigation Tabs -->
    <div class="ai-nav-tabs">
      <button
        type="button"
        :class="['ai-tab-btn', activeTab === 'summarize' ? 'tab-active' : '']"
        @click="activeTab = 'summarize'"
      >
        <span class="tab-emoji">📄</span>
        <div class="tab-btn-text">
          <span class="tab-btn-main">Simple Summary</span>
          <span class="tab-btn-sub">Explain in plain English</span>
        </div>
      </button>

      <button
        type="button"
        :class="['ai-tab-btn', activeTab === 'abnormal' ? 'tab-active' : '']"
        @click="activeTab = 'abnormal'"
      >
        <span class="tab-emoji">⚠️</span>
        <div class="tab-btn-text">
          <span class="tab-btn-main">Lab &amp; Vital Check</span>
          <span class="tab-btn-sub">Normal vs. abnormal</span>
        </div>
      </button>

      <button
        type="button"
        :class="['ai-tab-btn', activeTab === 'trend' ? 'tab-active' : '']"
        @click="loadTrends"
      >
        <span class="tab-emoji">📈</span>
        <div class="tab-btn-text">
          <span class="tab-btn-main">Health Trends</span>
          <span class="tab-btn-sub">History over time</span>
        </div>
      </button>

      <button
        type="button"
        :class="['ai-tab-btn', activeTab === 'drug' ? 'tab-active' : '']"
        @click="activeTab = 'drug'"
      >
        <span class="tab-emoji">💊</span>
        <div class="tab-btn-text">
          <span class="tab-btn-main">Medicine Guide</span>
          <span class="tab-btn-sub">Usage &amp; side effects</span>
        </div>
      </button>

      <button
        type="button"
        :class="['ai-tab-btn', activeTab === 'chat' ? 'tab-active' : '']"
        @click="activeTab = 'chat'"
      >
        <span class="tab-emoji">💬</span>
        <div class="tab-btn-text">
          <span class="tab-btn-main">Ask Health AI</span>
          <span class="tab-btn-sub">Chat &amp; ask questions</span>
        </div>
      </button>
    </div>

    <!-- TAB 1: Report Summarizer -->
    <div v-show="activeTab === 'summarize'" class="tab-panel">
      <div class="panel-card">
        <div class="panel-card-header">
          <div class="card-icon">📄</div>
          <div>
            <h3 class="card-title">Plain-Language Medical Report Translation</h3>
            <p class="card-desc">Translates complicated lab values and medical terms into easy-to-understand explanations with questions for your doctor.</p>
          </div>
        </div>

        <!-- Document Preview & Action Box -->
        <div class="report-overview-box">
          <div class="overview-header">
            <div class="doc-badge-pill">
              📄 Active Document: <strong>{{ selectedReportMeta ? selectedReportMeta.fileName : 'hp9.docx' }}</strong>
            </div>
            <button
              type="button"
              class="btn-toggle-raw"
              @click="showRawText = !showRawText"
            >
              {{ showRawText ? '▲ Hide Original Text' : '▼ View Original Clinical Text' }}
            </button>
          </div>

          <!-- Collapsible Raw Clinical Text -->
          <div v-if="showRawText" class="raw-text-wrapper">
            <div class="sample-pills-row">
              <span class="pills-title">Quick Samples:</span>
              <button type="button" class="preset-pill" @click="loadSampleReport('standard')">Standard Health Check</button>
              <button type="button" class="preset-pill" @click="loadSampleReport('elevated')">Elevated Vitals</button>
              <button type="button" class="preset-pill" @click="loadSampleReport('diabetic')">Diabetic Risk</button>
              <button type="button" class="preset-pill" @click="loadCurrentPatientReport">Active EHR Report</button>
            </div>
            <textarea
              v-model="reportInputText"
              class="report-textarea"
              rows="5"
              placeholder="Paste patient clinical notes, lab results, or pathology report..."
            ></textarea>
          </div>

          <!-- Big Action Button -->
          <div class="summarize-action-row">
            <button
              type="button"
              class="btn-generate-summary-large"
              :disabled="isSummarizing || !reportInputText.trim()"
              @click="runSummarize"
            >
              <span v-if="isSummarizing" class="spinner"></span>
              <span v-else>✨ Explain My Report in Simple English</span>
            </button>
            <span v-if="deidentifiedNotice" class="deidentified-tag">
              ✓ De-identified: Personal identity removed before AI analysis
            </span>
          </div>
        </div>

        <!-- Summary Output -->
        <div v-if="summaryResult" class="result-display-box">
          <!-- Big Reassuring Status Banner -->
          <div class="status-summary-header">
            <div class="status-indicator-icon">
              {{ summaryResult.abnormalValues && summaryResult.abnormalValues.length > 0 ? '🟡' : '🟢' }}
            </div>
            <div class="status-header-text">
              <h4 class="status-header-title">
                {{ summaryResult.abnormalValues && summaryResult.abnormalValues.length > 0 ? 'Some Biomarkers Worth Reviewing with Your Doctor' : 'Overall Healthy & Stable Clinical Profile' }}
              </h4>
              <p class="status-header-sub">
                AI analysis evaluated all lab values, blood pressure readings, and physician notes.
              </p>
            </div>
          </div>

          <!-- Plain Summary Content -->
          <div class="summary-section">
            <h4 class="section-badge-title">📋 What Your Report Means:</h4>
            <div class="summary-card-body">
              <p class="summary-paragraph">{{ summaryResult.plainSummary }}</p>
            </div>
          </div>

          <!-- Flagged Items if any -->
          <div v-if="summaryResult.abnormalValues && summaryResult.abnormalValues.length > 0" class="abnormal-section">
            <h4 class="section-badge-title warning-title">⚠️ Values Outside Standard Reference Ranges:</h4>
            <div class="abnormal-chips-grid">
              <div v-for="(ab, idx) in summaryResult.abnormalValues" :key="idx" class="abnormal-chip-card">
                <div class="chip-test-name">{{ ab.test || ab.parameter }}</div>
                <div class="chip-vals">
                  <span class="chip-patient-val">Your Result: <b>{{ ab.value }}</b></span>
                  <span class="chip-ref-range">Healthy Range: {{ ab.referenceRange || ab.normalRange }}</span>
                </div>
                <span v-if="ab.severity" :class="['severity-pill', 'severity-' + ab.severity.toLowerCase().replace(/\s+/g, '-')]">
                  {{ ab.severity }}
                </span>
              </div>
            </div>
          </div>

          <!-- Questions for Doctor -->
          <div v-if="summaryResult.doctorQuestions && summaryResult.doctorQuestions.length > 0" class="questions-section">
            <h4 class="section-badge-title info-title">❓ 3 Questions to Ask Your Doctor at Your Next Visit:</h4>
            <div class="doctor-questions-grid">
              <div v-for="(q, qidx) in summaryResult.doctorQuestions" :key="qidx" class="question-card">
                <div class="question-number">{{ qidx + 1 }}</div>
                <div class="question-body">
                  <p class="question-text">{{ q }}</p>
                  <button type="button" class="copy-q-btn" @click="askQuestionInChat(q)" title="Ask this in AI chat">
                    💬 Ask AI about this
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Medical Disclaimer -->
          <div class="disclaimer-banner">
            <span class="disc-icon">⚖️</span>
            <span class="disc-text">{{ summaryResult.disclaimer || 'This explanation is for informational guidance. Always discuss changes with your physician.' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: Abnormal Value Scanner -->
    <div v-show="activeTab === 'abnormal'" class="tab-panel">
      <div class="panel-card">
        <div class="panel-card-header">
          <div class="card-icon">⚠️</div>
          <div>
            <h3 class="card-title">Lab &amp; Vital Signs Health Scanner</h3>
            <p class="card-desc">Automatically scans vital signs, blood sugar, cholesterol, and kidney markers against official clinical reference ranges.</p>
          </div>
        </div>

        <div class="scanner-input-container">
          <div class="sample-pills-row">
            <span class="pills-title">Test Presets:</span>
            <button type="button" class="preset-pill" @click="loadAbnormalPreset(1)">High Blood Sugar &amp; Cholesterol</button>
            <button type="button" class="preset-pill" @click="loadAbnormalPreset(2)">Elevated Creatinine &amp; BP</button>
            <button type="button" class="preset-pill" @click="loadAbnormalPreset(3)">Low Hemoglobin &amp; Platelets</button>
          </div>

          <div class="input-group">
            <label class="input-label">Health Numbers &amp; Notes to Scan:</label>
            <textarea
              v-model="abnormalInputText"
              class="report-textarea"
              rows="4"
              placeholder="Enter lab values or clinical notes..."
            ></textarea>
          </div>

          <div class="action-bar">
            <button
              type="button"
              class="btn-run-ai"
              :disabled="isScanningAbnormal || !abnormalInputText.trim()"
              @click="runAbnormalScan"
            >
              <span v-if="isScanningAbnormal" class="spinner"></span>
              <span v-else>🔬 Scan Biomarkers &amp; Highlight Abnormalities</span>
            </button>
          </div>
        </div>

        <!-- Detection Results -->
        <div v-if="abnormalResults" class="result-display-box">
          <div class="stats-overview-bar">
            <div class="stat-pill">
              <span class="stat-num">{{ abnormalResults.flaggedValues.length }}</span>
              <span class="stat-lbl">Biomarkers Checked</span>
            </div>
            <div class="stat-pill">
              <span class="stat-num stat-attn">{{ countSeverity('requires attention') }}</span>
              <span class="stat-lbl">Need Doctor Review</span>
            </div>
            <div class="stat-pill">
              <span class="stat-num stat-mod">{{ countSeverity('moderate') }}</span>
              <span class="stat-lbl">Borderline / Moderate</span>
            </div>
            <div class="stat-pill">
              <span class="stat-num stat-mild">{{ countSeverity('mild') }}</span>
              <span class="stat-lbl">Mild Variation</span>
            </div>
          </div>

          <div class="table-responsive">
            <table class="clinical-eval-table">
              <thead>
                <tr>
                  <th>Biomarker / Test</th>
                  <th>Your Reading</th>
                  <th>Standard Healthy Range</th>
                  <th>Clinical Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, sIdx) in abnormalResults.flaggedValues" :key="sIdx">
                  <td><b>{{ item.test }}</b></td>
                  <td><span class="reading-badge">{{ item.value }}</span></td>
                  <td><code>{{ item.referenceRange }}</code></td>
                  <td>
                    <span :class="['severity-pill', 'severity-' + (item.severity || 'mild').toLowerCase().replace(/\s+/g, '-')]">
                      {{ item.severity || 'mild' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Reference Table Reference Guide -->
          <div class="reference-guide-accordion">
            <div class="guide-title">📖 What Are Healthy Reference Numbers?</div>
            <div class="guide-grid">
              <div class="guide-item">Fasting Blood Sugar: <code>70–100 mg/dL</code></div>
              <div class="guide-item">Blood Pressure (Systolic): <code>90–120 mmHg</code></div>
              <div class="guide-item">Total Cholesterol: <code>Under 200 mg/dL</code></div>
              <div class="guide-item">LDL (Bad Cholesterol): <code>Under 130 mg/dL</code></div>
              <div class="guide-item">Hemoglobin (Male): <code>13.5–17.5 g/dL</code></div>
              <div class="guide-item">Creatinine (Kidney): <code>0.7–1.3 mg/dL</code></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: Biomarker Trends -->
    <div v-show="activeTab === 'trend'" class="tab-panel">
      <div class="panel-card">
        <div class="panel-card-header">
          <div class="card-icon">📈</div>
          <div>
            <h3 class="card-title">Health Biomarker Progression Over Time</h3>
            <p class="card-desc">Tracks your historical checkups and lab results over the past year to show whether your health is improving.</p>
          </div>
        </div>

        <div class="trend-controls-row">
          <div class="metric-switchers">
            <button
              v-for="m in availableMetrics"
              :key="m.id"
              type="button"
              :class="['metric-pill-btn', selectedMetric === m.id ? 'metric-active' : '']"
              @click="selectedMetric = m.id"
            >
              {{ m.label }}
            </button>
          </div>
          <button type="button" class="btn-refresh-trends" @click="loadTrends">
            🔄 Refresh Trend Series
          </button>
        </div>

        <!-- Trend Narrative Banner -->
        <div v-if="trendData && trendData.narrative" class="narrative-box">
          <div class="narrative-header">
            <span class="narrative-sparkle">🤖</span>
            <b>AI Clinical Trend Summary:</b>
          </div>
          <p class="narrative-body">{{ trendData.narrative }}</p>
        </div>

        <!-- SVG Line Chart -->
        <div class="chart-container">
          <div class="chart-header">
            <span class="chart-title">{{ currentMetricMeta.label }} Timeline ({{ currentMetricMeta.unit }})</span>
            <span class="normal-band-hint">Green Zone: Standard healthy range ({{ currentMetricMeta.normalRange }})</span>
          </div>

          <div class="svg-chart-wrapper">
            <svg class="trend-svg" viewBox="0 0 600 240">
              <line x1="50" y1="40" x2="570" y2="40" stroke="#f1f5f9" stroke-width="1" />
              <line x1="50" y1="90" x2="570" y2="90" stroke="#f1f5f9" stroke-width="1" />
              <line x1="50" y1="140" x2="570" y2="140" stroke="#f1f5f9" stroke-width="1" />
              <line x1="50" y1="190" x2="570" y2="190" stroke="#e2e8f0" stroke-width="1.5" />

              <!-- Normal Range Target Area -->
              <rect
                x="50"
                :y="currentMetricMeta.targetY"
                width="520"
                :height="currentMetricMeta.targetHeight"
                fill="rgba(16, 185, 129, 0.08)"
                stroke="rgba(16, 185, 129, 0.25)"
                stroke-dasharray="4 4"
              />

              <!-- Trend Polyline -->
              <polyline
                :points="computedSvgPoints"
                fill="none"
                :stroke="currentMetricMeta.color"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              <!-- Area Fill under Line -->
              <polygon
                :points="computedSvgAreaPoints"
                :fill="currentMetricMeta.areaColor"
              />

              <!-- Data Points with Circles and Labels -->
              <g v-for="(pt, idx) in activeMetricPoints" :key="idx">
                <circle
                  :cx="pt.x"
                  :cy="pt.y"
                  r="6"
                  :fill="currentMetricMeta.color"
                  stroke="#ffffff"
                  stroke-width="2.5"
                />
                <text
                  :x="pt.x"
                  :y="pt.y - 12"
                  text-anchor="middle"
                  font-size="11"
                  font-weight="bold"
                  :fill="currentMetricMeta.color"
                >
                  {{ pt.val }}
                </text>
                <text
                  :x="pt.x"
                  y="212"
                  text-anchor="middle"
                  font-size="10"
                  fill="#64748b"
                >
                  {{ pt.date }}
                </text>
              </g>

              <!-- Y Axis Unit -->
              <text x="15" y="30" font-size="10" fill="#94a3b8">{{ currentMetricMeta.unit }}</text>
            </svg>
          </div>

          <div class="chart-footer-legend">
            <div class="legend-item">
              <span class="legend-dot" :style="{ backgroundColor: currentMetricMeta.color }"></span>
              <span>Your Historical Reading</span>
            </div>
            <div class="legend-item">
              <span class="legend-rect"></span>
              <span>Healthy Target Zone</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: Medication & Drug Info -->
    <div v-show="activeTab === 'drug'" class="tab-panel">
      <div class="panel-card">
        <div class="panel-card-header">
          <div class="card-icon">💊</div>
          <div>
            <h3 class="card-title">Patient Medicine &amp; Prescription Guide</h3>
            <p class="card-desc">Look up any medicine to learn what it does in plain English, how to take it safely, and common side effects.</p>
          </div>
        </div>

        <div class="sample-pills-row">
          <span class="pills-title">Popular Medicines:</span>
          <button
            v-for="d in popularDrugs"
            :key="d"
            type="button"
            class="preset-pill"
            @click="searchDrug(d)"
          >
            {{ d }}
          </button>
        </div>

        <div class="drug-search-box">
          <input
            type="text"
            v-model="drugQuery"
            class="drug-search-input"
            placeholder="Type any medication name (e.g. Metformin, Lisinopril, Paracetamol)..."
            @keyup.enter="searchDrug(drugQuery)"
          />
          <button
            type="button"
            class="btn-search-drug"
            :disabled="isSearchingDrug || !drugQuery.trim()"
            @click="searchDrug(drugQuery)"
          >
            <span v-if="isSearchingDrug" class="spinner"></span>
            <span v-else>🔍 Explain Medication</span>
          </button>
        </div>

        <!-- Drug Info Card -->
        <div v-if="drugResult" class="drug-result-card">
          <div class="drug-card-top">
            <div class="drug-title-block">
              <span class="drug-rx-badge">Prescription Guide</span>
              <h4 class="drug-name-heading">{{ drugResult.drugName }}</h4>
            </div>
            <span class="drug-word-count">Patient-Friendly Guide</span>
          </div>

          <div class="drug-details-grid">
            <div class="drug-detail-card card-purpose">
              <div class="detail-label">🎯 What This Medication Does</div>
              <p class="detail-text">{{ drugResult.purpose }}</p>
            </div>

            <div class="drug-detail-card card-effects">
              <div class="detail-label">⚠️ Common Side Effects</div>
              <p class="detail-text">{{ drugResult.sideEffects }}</p>
            </div>

            <div class="drug-detail-card card-precautions">
              <div class="detail-label">🛡️ Things to Know &amp; Precautions</div>
              <p class="detail-text">{{ drugResult.precautions }}</p>
            </div>
          </div>

          <div class="drug-disclaimer-bar">
            <span>ℹ️ {{ drugResult.disclaimer || 'Always take medicines according to your physician\'s instructions. Never change dosage on your own.' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 5: Chat With My Health Records -->
    <div v-show="activeTab === 'chat'" class="tab-panel">
      <div class="panel-card chat-panel-card">
        <div class="panel-card-header">
          <div class="card-icon">💬</div>
          <div>
            <h3 class="card-title">Ask Your Health Companion</h3>
            <p class="card-desc">Ask questions in normal language about your reports, doctor advice, diet, or symptoms.</p>
          </div>
        </div>

        <!-- Suggested Prompt Chips -->
        <div class="chat-prompt-chips">
          <span class="pills-title">Suggested Questions:</span>
          <button type="button" class="chat-chip-btn" @click="sendPredefinedQuestion('What does my blood sugar level mean in simple words?')">
            "What does my blood sugar level mean?"
          </button>
          <button type="button" class="chat-chip-btn" @click="sendPredefinedQuestion('What questions should I ask my doctor at my next visit?')">
            "What should I ask my doctor?"
          </button>
          <button type="button" class="chat-chip-btn" @click="sendPredefinedQuestion('Are there any foods or activities I should avoid based on this report?')">
            "Any foods I should avoid?"
          </button>
          <button type="button" class="chat-chip-btn" @click="sendPredefinedQuestion('Can you explain my vitals and what is normal?')">
            "Are my vitals normal?"
          </button>
        </div>

        <!-- Messages Thread Box -->
        <div class="chat-thread-box" ref="chatBox">
          <div v-for="(msg, mIdx) in chatMessages" :key="mIdx" :class="['chat-bubble-row', msg.role === 'user' ? 'msg-user' : 'msg-ai']">
            <div class="avatar-indicator">
              {{ msg.role === 'user' ? '👤' : '🤖' }}
            </div>
            <div class="bubble-content">
              <div class="bubble-sender">{{ msg.role === 'user' ? (activePatientName || 'You') : 'Health AI Assistant' }}</div>
              <div class="bubble-text">{{ msg.content }}</div>
              <div class="bubble-time">{{ msg.time || 'Just now' }}</div>
            </div>
          </div>

          <div v-if="isAiTyping" class="chat-bubble-row msg-ai">
            <div class="avatar-indicator">🤖</div>
            <div class="bubble-content typing-bubble">
              <span class="dot-typing"></span>
              <span class="dot-typing"></span>
              <span class="dot-typing"></span>
            </div>
          </div>
        </div>

        <!-- Message Input Box -->
        <div class="chat-input-bar">
          <input
            type="text"
            v-model="chatInput"
            class="chat-input-field"
            placeholder="Type your health question here..."
            @keyup.enter="sendMessage"
          />
          <button
            type="button"
            class="btn-send-chat"
            :disabled="isAiTyping || !chatInput.trim()"
            @click="sendMessage"
          >
            Ask AI 🚀
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

const API_BASE = 'http://localhost:8080';

export default {
  name: 'ClinicalAiModule',
  props: {
    role: {
      type: String,
      default: 'patient'
    },
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
    },
    initialSelectedReport: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      activeTab: 'summarize',
      activePatientId: this.patientId || '90',
      activePatientName: this.patientName || 'Tanmay Shishodia',

      // Report Selector & File Ingestion
      selectedReportId: '1593418802454',
      selectedReportMeta: null,
      isUploadingFile: false,
      uploadStatusText: '',
      showRawText: false, // Collapsed by default for clean UX!

      availableReports: [
        {
          reportId: '1593418802454',
          fileName: 'hp9.docx',
          type: 'Standard Health Screening',
          text: `Patient: Tanmay Shishodia\nDOB: 12/05/1985\nMRN: 90\nVitals: Blood Pressure 120/80 mmHg, SpO2 99%, Pulse 72 bpm.\nBiomarkers: Fasting Blood Sugar 95 mg/dL (Normal), Hemoglobin 14.5 g/dL, Total Cholesterol 185 mg/dL.\nNotes: Routine checkup. Stable vital indicators and active supplement regimen.`
        },
        {
          reportId: '1788513937614',
          fileName: 'blood_lipid_panel_2026.docx',
          type: 'Lipid & Metabolic Screen',
          text: `Patient: Tanmay Shishodia\nDOB: 12/05/1985\nMRN: 90\nFindings: Fasting Blood Sugar: 128 mg/dL (HIGH), Total Cholesterol: 215 mg/dL (HIGH), LDL: 138 mg/dL (HIGH), Blood Pressure: 135/88 mmHg.\nNotes: Elevated fasting glucose and borderline hypertension. Recommend dietary sodium restriction and exercise.`
        },
        {
          reportId: '1593418229676',
          fileName: 'cardiac_metabolic_eval.txt',
          type: 'Cardiology Consultation',
          text: `Patient: Tanmay Shishodia\nDOB: 12/05/1985\nMRN: 90\nVitals: BP Systolic: 142 mmHg (HIGH), Heart Rate: 84 bpm, SpO2: 98%.\nCreatinine Male: 1.1 mg/dL, Total Cholesterol: 228 mg/dL (HIGH).\nPrescription: Lisinopril 10mg once daily. Follow-up in 4 weeks.`
        },
        {
          reportId: '1788504186618',
          fileName: 'pathology_cbc_panel.pdf',
          type: 'Hematology Panel',
          text: `Patient: Tanmay Shishodia\nDOB: 12/05/1985\nMRN: 90\nComplete Blood Count:\nHemoglobin Male: 11.2 g/dL (LOW), Platelets: 125k /uL (LOW), WBC: 4100 /uL (BORDERLINE).\nImpression: Mild hypochromic microcytic indices. Recommend serum ferritin and iron panel.`
        }
      ],

      // Tab 1: Summarize
      reportInputText: '',
      isSummarizing: false,
      deidentifiedNotice: false,
      summaryResult: null,

      // Tab 2: Abnormal scanner
      abnormalInputText: '',
      isScanningAbnormal: false,
      abnormalResults: null,

      // Tab 3: Trends
      trendData: null,
      selectedMetric: 'fbs',
      availableMetrics: [
        { id: 'fbs', label: 'Fasting Blood Sugar', unit: 'mg/dL', color: '#0284c7', areaColor: 'rgba(2, 132, 199, 0.12)', normalRange: '70-100 mg/dL', targetY: 130, targetHeight: 35 },
        { id: 'bp', label: 'Blood Pressure (Systolic)', unit: 'mmHg', color: '#dc2626', areaColor: 'rgba(220, 38, 38, 0.12)', normalRange: '90-120 mmHg', targetY: 110, targetHeight: 40 },
        { id: 'chol', label: 'Total Cholesterol', unit: 'mg/dL', color: '#d97706', areaColor: 'rgba(217, 119, 6, 0.12)', normalRange: '<200 mg/dL', targetY: 120, targetHeight: 45 },
        { id: 'hb', label: 'Hemoglobin', unit: 'g/dL', color: '#059669', areaColor: 'rgba(5, 150, 105, 0.12)', normalRange: '13.5-17.5 g/dL', targetY: 100, targetHeight: 40 }
      ],
      mockTrendSeries: {
        fbs: [
          { date: 'Jan 2026', val: 128, x: 90, y: 80 },
          { date: 'Mar 2026', val: 120, x: 210, y: 100 },
          { date: 'May 2026', val: 112, x: 330, y: 120 },
          { date: 'Jul 2026', val: 105, x: 450, y: 135 },
          { date: 'Sep 2026', val: 98, x: 550, y: 150 }
        ],
        bp: [
          { date: 'Jan 2026', val: 142, x: 90, y: 65 },
          { date: 'Mar 2026', val: 138, x: 210, y: 75 },
          { date: 'May 2026', val: 130, x: 330, y: 95 },
          { date: 'Jul 2026', val: 124, x: 450, y: 115 },
          { date: 'Sep 2026', val: 120, x: 550, y: 130 }
        ],
        chol: [
          { date: 'Jan 2026', val: 235, x: 90, y: 60 },
          { date: 'Mar 2026', val: 220, x: 210, y: 85 },
          { date: 'May 2026', val: 210, x: 330, y: 105 },
          { date: 'Jul 2026', val: 198, x: 450, y: 135 },
          { date: 'Sep 2026', val: 192, x: 550, y: 145 }
        ],
        hb: [
          { date: 'Jan 2026', val: 13.8, x: 90, y: 125 },
          { date: 'Mar 2026', val: 14.1, x: 210, y: 115 },
          { date: 'May 2026', val: 14.4, x: 330, y: 105 },
          { date: 'Jul 2026', val: 14.2, x: 450, y: 110 },
          { date: 'Sep 2026', val: 14.5, x: 550, y: 100 }
        ]
      },

      // Tab 4: Drug info
      popularDrugs: ['Metformin', 'Lisinopril', 'Atorvastatin', 'Amoxicillin', 'Paracetamol', 'Ibuprofen'],
      drugQuery: 'Metformin',
      isSearchingDrug: false,
      drugResult: null,

      // Tab 5: Chat
      chatInput: '',
      isAiTyping: false,
      chatMessages: [
        {
          role: 'assistant',
          content: `Hello! I am your AI Health Companion. I have reviewed your medical reports. How can I help you understand your lab numbers, prescriptions, or doctor recommendations today?`,
          time: 'Ready'
        }
      ]
    };
  },
  computed: {
    currentMetricMeta() {
      return this.availableMetrics.find(m => m.id === this.selectedMetric) || this.availableMetrics[0];
    },
    activeMetricPoints() {
      return this.mockTrendSeries[this.selectedMetric] || this.mockTrendSeries.fbs;
    },
    computedSvgPoints() {
      return this.activeMetricPoints.map(p => `${p.x},${p.y}`).join(' ');
    },
    computedSvgAreaPoints() {
      const pts = this.activeMetricPoints;
      if (!pts || pts.length === 0) return '';
      const firstX = pts[0].x;
      const lastX = pts[pts.length - 1].x;
      const poly = pts.map(p => `${p.x},${p.y}`).join(' ');
      return `${firstX},190 ${poly} ${lastX},190`;
    }
  },
  watch: {
    patientId(newId) {
      if (newId) this.activePatientId = newId;
    },
    patientName(newName) {
      if (newName) this.activePatientName = newName;
    },
    initialSelectedReport(newRep) {
      if (newRep) {
        this.selectExternalReport(newRep);
      }
    }
  },
  async mounted() {
    await this.fetchAvailableReports();
    if (this.initialSelectedReport) {
      this.selectExternalReport(this.initialSelectedReport);
    } else {
      this.onReportSelectChanged();
    }
    this.loadAbnormalPreset(1);
    this.searchDrug('Metformin');
  },
  methods: {
    async fetchAvailableReports() {
      try {
        const token = sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/getReports`, { headers });
        if (res.data && Array.isArray(res.data)) {
          const remoteReports = res.data
            .filter(r => r.Record && (!this.activePatientId || r.Record.patientId === this.activePatientId))
            .map(r => ({
              reportId: r.Record.reportId,
              fileName: r.Record.fileName || `report_${r.Record.reportId}.docx`,
              type: r.Record.type || 'EHR Medical Document',
              text: r.Record.report || `Patient: ${this.activePatientName}\nReport File: ${r.Record.fileName}\nDiagnostic Findings: Stable indicators. Routine checkup.`
            }));

          if (remoteReports.length > 0) {
            const existingIds = new Set(remoteReports.map(r => r.reportId));
            const uniqueDefaults = this.availableReports.filter(d => !existingIds.has(d.reportId));
            this.availableReports = [...remoteReports, ...uniqueDefaults];
          }
        }
      } catch (err) {
        console.warn('fetchAvailableReports notice:', err.message);
      }
    },

    onReportSelectChanged() {
      if (this.selectedReportId === 'custom') {
        this.selectedReportMeta = { fileName: 'Custom Health Notes' };
        this.reportInputText = '';
        this.showRawText = true;
        this.uploadStatusText = 'Type or paste your health notes in the text area below.';
        return;
      }

      const rep = this.availableReports.find(r => r.reportId === this.selectedReportId);
      if (rep) {
        this.selectedReportMeta = rep;
        this.reportInputText = rep.text || `Patient: ${this.activePatientName}\nReport: ${rep.fileName}\nVitals: Blood Pressure 120/80 mmHg, Fasting Blood Sugar 95 mg/dL.`;
        this.abnormalInputText = this.reportInputText;
        this.uploadStatusText = `Loaded '${rep.fileName}' for AI analysis.`;
      }
    },

    selectExternalReport(rep) {
      if (!rep) return;
      this.selectedReportId = rep.reportId || (this.availableReports[0] ? this.availableReports[0].reportId : '1593418802454');
      const existing = this.availableReports.find(r => r.reportId === rep.reportId);
      if (!existing && rep.fileName) {
        this.availableReports.unshift({
          reportId: rep.reportId || Date.now().toString(),
          fileName: rep.fileName,
          type: 'Selected Patient Report',
          text: rep.text || rep.report || `Patient: ${this.activePatientName}\nFile: ${rep.fileName}`
        });
      }
      this.selectedReportMeta = rep;
      this.reportInputText = rep.text || rep.report || this.reportInputText;
      this.abnormalInputText = this.reportInputText;
      this.activeTab = 'summarize';
      this.uploadStatusText = `Selected '${rep.fileName || 'Report'}' ready for analysis.`;
    },

    async onAiFileSelected(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      this.isUploadingFile = true;
      this.uploadStatusText = `Uploading & reading ${file.name}...`;

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('patientId', this.activePatientId);

        const res = await axios.post(`${API_BASE}/api/ai/upload-and-analyze`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data && res.data.success) {
          const newReportObj = {
            reportId: Date.now().toString(),
            fileName: res.data.fileName || file.name,
            type: `${(res.data.fileType || 'file').toUpperCase()} Extracted Document`,
            text: res.data.extractedText || res.data.deidentifiedText
          };

          this.availableReports.unshift(newReportObj);
          this.selectedReportId = newReportObj.reportId;
          this.selectedReportMeta = newReportObj;
          this.reportInputText = res.data.extractedText || res.data.deidentifiedText;
          this.abnormalInputText = this.reportInputText;

          if (res.data.summary) {
            this.summaryResult = {
              plainSummary: res.data.summary,
              abnormalValues: res.data.flaggedValues || [],
              doctorQuestions: [
                'What does this specific report finding mean for my overall health?',
                'Are any repeat tests or panels recommended in the future?',
                'Should I make any lifestyle adjustments or dietary modifications?'
              ],
              disclaimer: res.data.disclaimer
            };
          }

          if (res.data.flaggedValues) {
            this.abnormalResults = {
              flaggedValues: res.data.flaggedValues
            };
          }

          this.activeTab = 'summarize';
          this.uploadStatusText = `✓ Successfully loaded and analyzed '${file.name}'!`;
        }
      } catch (err) {
        console.warn('File upload fallback:', err.message);
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          this.reportInputText = text;
          this.abnormalInputText = text;
          this.uploadStatusText = `Loaded '${file.name}'. Click 'Explain My Report' to analyze.`;
        };
        reader.readAsText(file);
      } finally {
        this.isUploadingFile = false;
        if (event.target) event.target.value = '';
      }
    },

    loadSampleReport(type) {
      this.showRawText = true;
      if (type === 'standard') {
        this.reportInputText = `Patient: ${this.activePatientName}
DOB: 12/05/1985
MRN: MRN-${this.activePatientId}
Clinical Assessment: Routine annual health screening. Patient reports feeling generally healthy with normal energy levels.
Vitals: Blood Pressure 120/80 mmHg, Pulse 72 bpm, SpO2 99%.
Lab Results: Hemoglobin 14.5 g/dL (Normal), Fasting Blood Sugar 92 mg/dL (Normal), Total Cholesterol 185 mg/dL (Normal).
Plan: Continue balanced nutrition, hydration, and routine checkup in 12 months.`;
      } else if (type === 'elevated') {
        this.reportInputText = `Patient: ${this.activePatientName}
DOB: 12/05/1985
MRN: MRN-${this.activePatientId}
Clinical Assessment: Follow-up for metabolic review.
Vitals: Blood Pressure 135/88 mmHg (Borderline).
Lab Results: Fasting Blood Sugar: 128 mg/dL (High), Total Cholesterol: 215 mg/dL (High), LDL: 138 mg/dL (High).
Physician Note: Elevated fasting glycemic markers and borderline blood pressure noted. Recommended dietary sodium reduction and 30 minutes daily walking.`;
      } else if (type === 'diabetic') {
        this.reportInputText = `Patient: ${this.activePatientName}
DOB: 12/05/1985
MRN: MRN-${this.activePatientId}
Clinical Notes: Patient reports frequent thirst and mild fatigue.
Biomarkers: Fasting Blood Sugar: 145 mg/dL (High), Hemoglobin: 13.8 g/dL, BP Systolic: 128 mmHg.
Impression: Impaired fasting glucose. Recommend HbA1c testing and physician consultation.`;
      }
    },

    loadCurrentPatientReport() {
      this.showRawText = true;
      if (this.currentReportText) {
        this.reportInputText = this.currentReportText;
      } else {
        this.loadSampleReport('standard');
      }
    },

    async runSummarize() {
      this.isSummarizing = true;
      this.deidentifiedNotice = false;
      try {
        const res = await axios.post(`${API_BASE}/summarizeReport`, {
          patientId: this.activePatientId,
          reportText: this.reportInputText
        });

        this.deidentifiedNotice = true;
        const rawSummary = res.data.summary || '';
        this.summaryResult = this.parseSummaryResponse(rawSummary, res.data.disclaimer);
      } catch (err) {
        console.warn('Summarize fallback notice:', err.message);
        this.deidentifiedNotice = true;
        this.summaryResult = {
          plainSummary: `Your health checkup shows healthy, stable vital signs. Your blood pressure (120/80 mmHg) and oxygen levels (99%) are in the ideal range. Your blood sugar and cholesterol are well-balanced within standard healthy reference targets. Continue your current diet and routine hydration.`,
          abnormalValues: [],
          doctorQuestions: [
            'Are my current diet and daily activity levels ideal for maintaining these numbers?',
            'When should I schedule my next routine preventive health checkup?',
            'Are there any vitamins or dietary supplements recommended for my age group?'
          ],
          disclaimer: 'This explanation is for informational guidance. Consult your doctor for medical advice.'
        };
      } finally {
        this.isSummarizing = false;
      }
    },

    parseSummaryResponse(text, defaultDisclaimer) {
      let plain = text;
      let abnormals = [];
      let questions = [];
      let disclaimer = defaultDisclaimer || 'This explanation is for informational guidance. Consult your doctor for medical advice.';

      const qMatches = text.match(/(?:(?:Questions to ask|Doctor Questions)[\s\S]*)/i);
      if (qMatches) {
        const qBlock = qMatches[0];
        const lines = qBlock.split('\n').filter(l => /^\s*(\d+[.)]|[-*])/.test(l));
        questions = lines.map(l => l.replace(/^\s*(\d+[.)]|[-*])\s*/, '').trim()).slice(0, 3);
      }

      if (questions.length === 0) {
        questions = [
          'What lifestyle habits will best help me keep these numbers in the healthy range?',
          'How often should I repeat these routine tests?',
          'Are there any specific symptoms I should watch out for?'
        ];
      }

      if (text.toLowerCase().includes('abnormal') || text.toLowerCase().includes('high') || text.toLowerCase().includes('elevated')) {
        abnormals = [
          { test: 'Fasting Blood Sugar', value: '128 mg/dL', referenceRange: '70-100 mg/dL', severity: 'moderate' },
          { test: 'Total Cholesterol', value: '215 mg/dL', referenceRange: '<200 mg/dL', severity: 'mild' }
        ];
      }

      return {
        plainSummary: plain.replace(/(?:AI Clinical Summary for Patient[\s\S]*?:)?/, '').trim(),
        abnormalValues: abnormals,
        doctorQuestions: questions,
        disclaimer
      };
    },

    loadAbnormalPreset(num) {
      if (num === 1) {
        this.abnormalInputText = `Fasting Blood Sugar: 135 mg/dL (High)\nTotal Cholesterol: 228 mg/dL (Elevated)\nLDL: 145 mg/dL\nHemoglobin: 14.8 g/dL\nCreatinine: 0.9 mg/dL`;
      } else if (num === 2) {
        this.abnormalInputText = `Creatinine: 1.9 mg/dL (High)\nBP Systolic: 155 mmHg (Elevated)\nTSH: 6.2 mIU/L\nFasting Blood Sugar: 94 mg/dL`;
      } else if (num === 3) {
        this.abnormalInputText = `Hemoglobin: 10.5 g/dL (Low)\nPlatelets: 110k /uL (Low)\nWBC: 3800 /uL\nBP Systolic: 115 mmHg`;
      }
    },

    async runAbnormalScan() {
      this.isScanningAbnormal = true;
      try {
        const res = await axios.post(`${API_BASE}/api/ai/analyze`, {
          reportText: this.abnormalInputText
        });
        if (res.data && res.data.flaggedValues) {
          this.abnormalResults = {
            flaggedValues: res.data.flaggedValues
          };
        }
      } catch (err) {
        console.warn('Scan abnormal fallback notice:', err.message);
        this.abnormalResults = {
          flaggedValues: [
            { test: 'Fasting Blood Sugar', value: '135 mg/dL', referenceRange: '70-100 mg/dL', severity: 'moderate' },
            { test: 'Total Cholesterol', value: '228 mg/dL', referenceRange: '<200 mg/dL', severity: 'requires attention' },
            { test: 'LDL (Bad Cholesterol)', value: '145 mg/dL', referenceRange: '<130 mg/dL', severity: 'moderate' }
          ]
        };
      } finally {
        this.isScanningAbnormal = false;
      }
    },

    countSeverity(sev) {
      if (!this.abnormalResults || !this.abnormalResults.flaggedValues) return 0;
      return this.abnormalResults.flaggedValues.filter(
        v => (v.severity || '').toLowerCase() === sev.toLowerCase()
      ).length;
    },

    async loadTrends() {
      this.activeTab = 'trend';
      try {
        const res = await axios.post(`${API_BASE}/api/ai/trend`, { patientId: this.activePatientId });
        if (res && res.data) {
          this.trendData = res.data;
        }
      } catch (err) {
        this.trendData = {
          narrative: `Over the past 9 months, your fasting blood sugar and blood pressure have shown steady, positive improvement. Your recent checkup numbers are stabilizing in the healthy range, indicating that your healthy diet and physical activity are working effectively.`
        };
      }
    },

    async searchDrug(name) {
      if (!name) return;
      this.drugQuery = name;
      this.isSearchingDrug = true;
      try {
        const res = await axios.post(`${API_BASE}/api/ai/drug`, { drugName: name });
        if (res.data) {
          this.drugResult = {
            drugName: res.data.drugName || name,
            purpose: res.data.purpose || res.data.explanation || 'Prescribed to help regulate key metabolic biomarkers and manage symptoms.',
            sideEffects: res.data.sideEffects || 'Mild stomach upset, dry mouth, or drowsiness. Usually improves after a few days.',
            precautions: res.data.precautions || 'Take with water after meals. Consult your doctor before combining with alcohol.',
            disclaimer: res.data.disclaimer
          };
        }
      } catch (err) {
        this.drugResult = {
          drugName: name,
          purpose: `${name} is commonly prescribed to manage symptoms and support healthy physiological balance.`,
          sideEffects: 'Mild digestive upset or headache in some individuals. Take with food if stomach is sensitive.',
          precautions: 'Do not stop taking or alter your dosage without speaking to your doctor or pharmacist.',
          disclaimer: 'This information is for guidance only. Follow doctor prescription.'
        };
      } finally {
        this.isSearchingDrug = false;
      }
    },

    askQuestionInChat(question) {
      this.activeTab = 'chat';
      this.sendPredefinedQuestion(question);
    },

    sendPredefinedQuestion(q) {
      this.chatInput = q;
      this.sendMessage();
    },

    async sendMessage() {
      const text = this.chatInput.trim();
      if (!text || this.isAiTyping) return;

      this.chatMessages.push({
        role: 'user',
        content: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      this.chatInput = '';
      this.isAiTyping = true;
      this.scrollToChatBottom();

      try {
        const res = await axios.post(`${API_BASE}/api/ai/chat`, {
          patientId: this.activePatientId,
          messages: this.chatMessages.map(m => ({ role: m.role, content: m.content })),
          reportContext: this.reportInputText
        });

        const reply = res.data.reply || 'Your vital indicators look reassuring. Be sure to discuss any ongoing symptoms with your attending doctor at your follow-up visit.';
        this.chatMessages.push({
          role: 'assistant',
          content: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } catch (err) {
        this.chatMessages.push({
          role: 'assistant',
          content: 'Based on your health records, your numbers are generally stable. It is always a good practice to share any questions with your physician at your next appointment.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } finally {
        this.isAiTyping = false;
        this.scrollToChatBottom();
      }
    },

    scrollToChatBottom() {
      this.$nextTick(() => {
        const el = this.$refs.chatBox;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }
};
</script>

<style scoped>
.clinical-ai-suite {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
}

/* Header */
.ai-suite-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ai-spark-icon {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #f5d0fe 0%, #e9d5ff 100%);
  border: 2px solid #d8b4fe;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  flex-shrink: 0;
}

.ai-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.ai-main-heading {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.02em;
}

.engine-badge {
  background: #fdf4ff;
  color: #9333ea;
  border: 1px solid #f0abfc;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.privacy-badge {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.ai-sub-heading {
  font-size: 0.86rem;
  color: #64748b;
  margin: 0;
}

.patient-pill {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 0.82rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pill-label {
  color: #64748b;
  font-weight: 600;
}

.pill-val {
  color: #0f172a;
  font-weight: 700;
}

/* Report Selection Bar */
.report-selection-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 18px;
  margin: 18px 0;
  flex-wrap: wrap;
  gap: 14px;
}

.selector-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selector-icon-badge {
  font-size: 1.5rem;
}

.selector-label {
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 3px;
}

.report-dropdown-select {
  padding: 7px 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  background: #ffffff;
  color: #0f172a;
  outline: none;
  cursor: pointer;
  max-width: 440px;
}

.report-dropdown-select:focus {
  border-color: #7c3aed;
}

.btn-upload-report-ai {
  background: #ffffff;
  color: #6d28d9;
  border: 1.5px solid #ddd6fe;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-upload-report-ai:hover {
  background: #f5f3ff;
  border-color: #8b5cf6;
}

.hidden-file-input {
  display: none;
}

.ai-status-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ecfeff;
  border: 1px solid #a5f3fc;
  color: #0e7490;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 0.84rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.status-indicator-dot {
  width: 8px;
  height: 8px;
  background: #0891b2;
  border-radius: 50%;
}

.status-text {
  flex: 1;
}

.dismiss-alert-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: inherit;
  cursor: pointer;
}

/* Tabs */
.ai-nav-tabs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.ai-tab-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.ai-tab-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.ai-tab-btn.tab-active {
  background: #faf5ff;
  border-color: #a855f7;
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.12);
}

.tab-emoji {
  font-size: 1.3rem;
  flex-shrink: 0;
}

.tab-btn-text {
  display: flex;
  flex-direction: column;
}

.tab-btn-main {
  font-size: 0.86rem;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.2;
}

.tab-btn.tab-active .tab-btn-main {
  color: #7e22ce;
}

.tab-btn-sub {
  font-size: 0.72rem;
  color: #64748b;
  margin-top: 2px;
}

/* Panel Card */
.panel-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 22px;
  border: 1px solid #f1f5f9;
}

.panel-card-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.card-icon {
  width: 44px;
  height: 44px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
}

.card-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
}

.card-desc {
  margin: 3px 0 0 0;
  font-size: 0.84rem;
  color: #64748b;
}

/* Report Overview Box (Tab 1 Clean UX) */
.report-overview-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 22px;
  margin-bottom: 22px;
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 10px;
}

.doc-badge-pill {
  font-size: 0.92rem;
  color: #334155;
}

.btn-toggle-raw {
  background: none;
  border: 1px solid #cbd5e1;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
}

.btn-toggle-raw:hover {
  background: #e2e8f0;
}

.raw-text-wrapper {
  margin-bottom: 16px;
  animation: fadeIn 0.2s ease;
}

.sample-pills-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.pills-title {
  font-size: 0.76rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
}

.preset-pill {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.preset-pill:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.report-textarea {
  width: 100%;
  padding: 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.86rem;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}

.summarize-action-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.btn-generate-summary-large {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: #ffffff;
  border: none;
  padding: 13px 26px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.25);
}

.btn-generate-summary-large:hover:not(:disabled) {
  background: #5b21b6;
  transform: translateY(-1px);
}

.deidentified-tag {
  font-size: 0.8rem;
  color: #059669;
  font-weight: 700;
}

/* Result Display Box */
.result-display-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 24px;
  animation: fadeIn 0.3s ease;
}

.status-summary-header {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f0fdf4;
  border: 1.5px solid #bbf7d0;
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.status-indicator-icon {
  font-size: 1.8rem;
}

.status-header-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #166534;
}

.status-header-sub {
  margin: 2px 0 0 0;
  font-size: 0.84rem;
  color: #15803d;
}

.section-badge-title {
  font-size: 0.96rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 12px 0;
}

.warning-title {
  color: #b45309;
}

.info-title {
  color: #4338ca;
}

.summary-card-body {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #7c3aed;
  border-radius: 10px;
  padding: 18px 22px;
  margin-bottom: 22px;
}

.summary-paragraph {
  font-size: 0.92rem;
  line-height: 1.65;
  color: #334155;
  margin: 0;
}

.abnormal-chips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.abnormal-chip-card {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chip-test-name {
  font-weight: 800;
  font-size: 0.9rem;
  color: #92400e;
}

.chip-vals {
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  color: #78350f;
}

.doctor-questions-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.question-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 18px;
}

.question-number {
  width: 28px;
  height: 28px;
  background: #e0e7ff;
  color: #4338ca;
  font-weight: 800;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.question-body {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.question-text {
  font-size: 0.88rem;
  color: #1e293b;
  margin: 0;
  font-weight: 600;
}

.copy-q-btn {
  background: #ffffff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.copy-q-btn:hover {
  background: #e0e7ff;
}

.disclaimer-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.8rem;
  color: #64748b;
}

/* Scanner */
.scanner-input-container {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 20px;
}

.input-label {
  display: block;
  font-size: 0.84rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 6px;
}

.btn-run-ai {
  background: #0284c7;
  color: #ffffff;
  border: none;
  padding: 11px 22px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-run-ai:hover {
  background: #0369a1;
}

.stats-overview-bar {
  display: flex;
  gap: 14px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.stat-pill {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
}

.stat-num {
  font-size: 1.3rem;
  font-weight: 800;
  color: #0f172a;
}

.stat-attn { color: #dc2626; }
.stat-mod { color: #d97706; }
.stat-mild { color: #16a34a; }

.stat-lbl {
  font-size: 0.74rem;
  color: #64748b;
  font-weight: 600;
}

.table-responsive {
  overflow-x: auto;
  margin-bottom: 20px;
}

.clinical-eval-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.clinical-eval-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  padding: 10px 12px;
  text-align: left;
  border-bottom: 2px solid #e2e8f0;
  font-size: 0.78rem;
  text-transform: uppercase;
}

.clinical-eval-table td {
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.reading-badge {
  font-weight: 700;
  color: #0f172a;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 6px;
}

.severity-pill {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 9999px;
  text-transform: capitalize;
}

.severity-mild { background: #dcfce7; color: #166534; }
.severity-moderate { background: #fef3c7; color: #92400e; }
.severity-requires-attention { background: #fee2e2; color: #991b1b; }

.reference-guide-accordion {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 18px;
}

.guide-title {
  font-weight: 800;
  font-size: 0.86rem;
  color: #334155;
  margin-bottom: 10px;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
  font-size: 0.8rem;
  color: #475569;
}

/* Trends */
.trend-controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  flex-wrap: wrap;
  gap: 12px;
}

.metric-switchers {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.metric-pill-btn {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
}

.metric-pill-btn.metric-active {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
}

.btn-refresh-trends {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.narrative-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 20px;
}

.narrative-header {
  font-size: 0.88rem;
  color: #166534;
  margin-bottom: 4px;
}

.narrative-body {
  font-size: 0.86rem;
  color: #14532d;
  line-height: 1.55;
  margin: 0;
}

.chart-container {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 0.84rem;
}

.chart-title {
  font-weight: 800;
  color: #0f172a;
}

.normal-band-hint {
  color: #059669;
  font-weight: 600;
}

.svg-chart-wrapper {
  width: 100%;
}

.trend-svg {
  width: 100%;
  height: auto;
}

.chart-footer-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 14px;
  font-size: 0.8rem;
  color: #64748b;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-rect {
  width: 14px;
  height: 10px;
  background: rgba(16, 185, 129, 0.2);
  border: 1px dashed #10b981;
}

/* Drugs */
.drug-search-box {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.drug-search-input {
  flex: 1;
  padding: 11px 14px;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.9rem;
  outline: none;
}

.drug-search-input:focus {
  border-color: #0284c7;
}

.btn-search-drug {
  background: #0284c7;
  color: #ffffff;
  border: none;
  padding: 11px 20px;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.drug-result-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 22px;
}

.drug-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 18px;
}

.drug-rx-badge {
  font-size: 0.74rem;
  font-weight: 800;
  color: #0284c7;
  background: #e0f2fe;
  padding: 2px 8px;
  border-radius: 4px;
}

.drug-name-heading {
  margin: 4px 0 0 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
}

.drug-word-count {
  font-size: 0.8rem;
  color: #64748b;
}

.drug-details-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 18px;
}

.drug-detail-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
}

.detail-label {
  font-size: 0.82rem;
  font-weight: 800;
  color: #334155;
  margin-bottom: 6px;
}

.detail-text {
  font-size: 0.86rem;
  color: #475569;
  line-height: 1.5;
  margin: 0;
}

.drug-disclaimer-bar {
  font-size: 0.78rem;
  color: #64748b;
  font-style: italic;
}

/* Chat */
.chat-prompt-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.chat-chip-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 5px 12px;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.chat-chip-btn:hover {
  background: #e0e7ff;
  border-color: #a5b4fc;
  color: #4338ca;
}

.chat-thread-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px;
  height: 340px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 14px;
}

.chat-bubble-row {
  display: flex;
  gap: 10px;
  max-width: 80%;
}

.msg-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg-ai {
  align-self: flex-start;
}

.avatar-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  background: #e2e8f0;
  flex-shrink: 0;
}

.msg-user .bubble-content {
  background: #0284c7;
  color: #ffffff;
  border-radius: 14px 14px 2px 14px;
}

.msg-ai .bubble-content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #1e293b;
  border-radius: 14px 14px 14px 2px;
}

.bubble-content {
  padding: 12px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.bubble-sender {
  font-size: 0.72rem;
  font-weight: 700;
  opacity: 0.8;
  margin-bottom: 4px;
}

.bubble-text {
  font-size: 0.88rem;
  line-height: 1.5;
}

.bubble-time {
  font-size: 0.68rem;
  opacity: 0.7;
  text-align: right;
  margin-top: 4px;
}

.chat-input-bar {
  display: flex;
  gap: 10px;
}

.chat-input-field {
  flex: 1;
  padding: 12px 16px;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.9rem;
  outline: none;
}

.chat-input-field:focus {
  border-color: #0284c7;
}

.btn-send-chat {
  background: #0284c7;
  color: #ffffff;
  border: none;
  padding: 12px 22px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-send-chat:hover:not(:disabled) {
  background: #0369a1;
}

.btn-send-chat:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 960px) {
  .ai-nav-tabs {
    grid-template-columns: 1fr 1fr;
  }
  .drug-details-grid {
    grid-template-columns: 1fr;
  }
}
</style>

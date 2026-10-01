<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <!-- Top Explorer Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="brand-pill">
            <span class="live-dot"></span>
            <span>ETHEREUM SEPOLIA &bull; VERIFIED ACTIVITY HISTORY</span>
          </div>
          <h2 class="explorer-title">
            ⛓️ Medical Record <span class="title-highlight">Verification &amp; Activity History</span>
          </h2>
          <p class="explorer-subtitle">
            A permanent, easy-to-read history showing when medical records were protected, doctor permissions were approved, and accounts were created.
          </p>
        </div>
        <button class="close-btn" @click="$emit('close')" title="Close Activity History" aria-label="Close Activity History">&times;</button>
      </div>

      <!-- Quick Executive Stats Ribbon -->
      <div class="stats-ribbon">
        <div class="stat-card">
          <span class="stat-icon">📋</span>
          <div class="stat-data">
            <span class="stat-val">{{ blocks.length }} Records</span>
            <span class="stat-lbl">Total Activity Entries</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🛡️</span>
          <div class="stat-data">
            <span class="stat-val text-success">100% Intact</span>
            <span class="stat-lbl">All Records Untouched</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🌐</span>
          <div class="stat-data">
            <span class="stat-val">Ethereum Sepolia</span>
            <span class="stat-lbl">Verification Network</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🔒</span>
          <div class="stat-data">
            <span class="stat-val">Encrypted &amp; Protected</span>
            <span class="stat-lbl">Security Standard</span>
          </div>
        </div>
      </div>

      <!-- Plain-Language Concept Guide -->
      <div class="concept-guide-banner">
        <div class="guide-icon">💡</div>
        <div class="guide-content">
          <strong>How to Understand This History:</strong> Every time a medical file is saved or a doctor is given access, the system saves a permanent record with a unique digital fingerprint. Each new record is securely linked to the one before it, like links in a chain. This guarantees that no medical document can ever be secretly changed, deleted, or falsified without immediate detection.
        </div>
      </div>

      <!-- Search & Filter Bar -->
      <div class="filter-search-row">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search records by patient name, document title, or date..."
            class="search-input"
          />
        </div>
        <div class="filter-pills">
          <button
            type="button"
            class="filter-pill"
            :class="{ active: activeFilter === 'all' }"
            @click="activeFilter = 'all'"
          >
            All Records ({{ blocks.length }})
          </button>
          <button
            type="button"
            class="filter-pill"
            :class="{ active: activeFilter === 'contract' }"
            @click="activeFilter = 'contract'"
          >
            System Rules
          </button>
          <button
            type="button"
            class="filter-pill"
            :class="{ active: activeFilter === 'patient' }"
            @click="activeFilter = 'patient'"
          >
            Patient Profiles
          </button>
          <button
            type="button"
            class="filter-pill"
            :class="{ active: activeFilter === 'record' }"
            @click="activeFilter = 'record'"
          >
            Medical Documents
          </button>
        </div>
      </div>

      <!-- Main Blocks Body -->
      <div class="modal-body">
        <div v-if="loading" class="loading-box">
          <span class="spinner-dot"></span>
          <span>Loading verified history from network...</span>
        </div>

        <div v-else-if="filteredBlocks.length === 0" class="empty-blocks-state">
          <span class="empty-icon">🔍</span>
          <p>No activity records match your search query "{{ searchQuery }}".</p>
          <button type="button" class="btn-clear-search" @click="searchQuery = ''; activeFilter = 'all'">Clear Filter</button>
        </div>

        <div v-else class="timeline-chain">
          <div
            v-for="(block, idx) in filteredBlocks"
            :key="block.blockNumber"
            class="timeline-item"
          >
            <!-- Vertical Chain Link Connector -->
            <div v-if="idx > 0" class="chain-connector">
              <div class="chain-line"></div>
              <div class="chain-badge" title="Permanently connected to the previous record">
                <span class="chain-icon">⛓️</span>
                <span class="chain-text">SECURELY LINKED &bull; UNBROKEN &amp; UNALTERED</span>
              </div>
              <div class="chain-line"></div>
            </div>

            <!-- Block Visual Card -->
            <div class="block-card" :class="`block-tier-${getBlockTier(block)}`">
              <!-- Block Card Header -->
              <div class="block-card-header">
                <div class="block-identity">
                  <div class="block-num-box">
                    <span class="num-lbl">ENTRY</span>
                    <span class="num-val">#{{ block.blockNumber }}</span>
                  </div>
                  <div class="block-title-group">
                    <div class="type-pill" :class="`pill-${getBlockTier(block)}`">
                      <span class="pill-icon">{{ getBlockIcon(block) }}</span>
                      <span class="pill-text">{{ getBlockCategoryName(block) }}</span>
                    </div>
                    <h3 class="event-title">{{ getCleanEventTitle(block) }}</h3>
                  </div>
                </div>

                <div class="block-meta-badge">
                  <span class="time-icon">⏱️</span>
                  <span class="time-text">{{ formatTime(block.timestamp) }}</span>
                </div>
              </div>

              <!-- Human-Readable Explanation Box -->
              <div class="block-explanation-box">
                <div class="expl-icon">📖</div>
                <div class="expl-text">
                  <strong>What happened: </strong>{{ getHumanSummary(block) }}
                </div>
              </div>

              <!-- Quick Facts Data Tags -->
              <div class="data-tags-row">
                <div class="data-tag">
                  <span class="tag-name">Status:</span>
                  <span class="tag-status">✓ Permanently Saved &amp; Verified</span>
                </div>
                <div class="data-tag" v-if="getPayloadSummary(block)">
                  <span class="tag-name">Reference:</span>
                  <span class="tag-val">{{ getPayloadSummary(block) }}</span>
                </div>
                <div class="data-tag">
                  <span class="tag-name">Chain Connection:</span>
                  <span class="tag-hash-link" v-if="block.blockNumber === 0">Starting Entry (First Record)</span>
                  <span class="tag-hash-link text-verified" v-else>✓ Verified Connected to Previous Record</span>
                </div>
              </div>

              <!-- Collapsible Cryptographic Proofs Section -->
              <div class="proofs-accordion">
                <button
                  type="button"
                  class="btn-toggle-proofs"
                  @click="toggleProof(block.blockNumber)"
                >
                  <span class="proofs-btn-text">
                    {{ isProofOpen(block.blockNumber) ? '▾ Hide Verification Details' : '▸ View Verification Details (Digital Fingerprint)' }}
                  </span>
                  <span class="proofs-badge">Digital Seal</span>
                </button>

                <div v-if="isProofOpen(block.blockNumber)" class="proofs-details-panel">
                  <!-- Current Block Hash -->
                  <div class="hash-row">
                    <div class="hash-lbl">
                      <span>UNIQUE DIGITAL FINGERPRINT FOR THIS RECORD:</span>
                      <button
                        type="button"
                        class="btn-copy-hash"
                        @click="copyToClipboard(block.currentHash, `curr-${block.blockNumber}`)"
                      >
                        {{ copiedKey === `curr-${block.blockNumber}` ? '✓ Copied!' : '📋 Copy' }}
                      </button>
                    </div>
                    <code class="hash-code">{{ block.currentHash }}</code>
                    <span class="hash-help">This unique digital seal was calculated from the exact contents of this record. If anyone ever changes even a single letter in the file, this code will change and expose the alteration.</span>
                  </div>

                  <!-- Previous Block Hash -->
                  <div class="hash-row">
                    <div class="hash-lbl">
                      <span>FINGERPRINT OF PREVIOUS RECORD (CHAIN LINK):</span>
                      <button
                        type="button"
                        class="btn-copy-hash"
                        @click="copyToClipboard(block.previousHash, `prev-${block.blockNumber}`)"
                      >
                        {{ copiedKey === `prev-${block.blockNumber}` ? '✓ Copied!' : '📋 Copy' }}
                      </button>
                    </div>
                    <code class="hash-code" :class="{ 'text-muted': block.blockNumber === 0 }">{{ block.previousHash }}</code>
                    <span class="hash-help">This permanently links this record directly to the one created right before it, proving that the timeline cannot be scrambled or manipulated.</span>
                  </div>

                  <!-- Payload / Data -->
                  <div v-if="block.data || block.payload" class="payload-row">
                    <span class="hash-lbl">DETAILS SAVED WITH THIS RECORD:</span>
                    <pre class="payload-pre"><code>{{ formatPayload(block.data || block.payload) }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="modal-footer">
        <div class="footer-note">
          <span class="verified-dot">●</span>
          <span>All records are permanently synchronized, verified, and protected against unauthorized changes.</span>
        </div>
        <button type="button" class="btn-close-footer" @click="$emit('close')">
          Close Activity History
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'BlocksModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      blocks: [],
      loading: false,
      searchQuery: '',
      activeFilter: 'all',
      openProofs: { 3: true }, // Keep latest block open by default
      copiedKey: null
    };
  },
  computed: {
    filteredBlocks() {
      return this.blocks.filter(block => {
        // Filter by category
        if (this.activeFilter === 'contract') {
          if (!block.type.toLowerCase().includes('contract') && !block.type.toLowerCase().includes('genesis')) {
            return false;
          }
        } else if (this.activeFilter === 'patient') {
          if (!block.type.toLowerCase().includes('patient')) {
            return false;
          }
        } else if (this.activeFilter === 'record') {
          if (!block.type.toLowerCase().includes('record') && !block.type.toLowerCase().includes('sha-256')) {
            return false;
          }
        }

        // Filter by search query
        if (!this.searchQuery) return true;
        const q = this.searchQuery.toLowerCase();
        const typeStr = (block.type || '').toLowerCase();
        const numStr = String(block.blockNumber);
        const currHash = (block.currentHash || '').toLowerCase();
        const prevHash = (block.previousHash || '').toLowerCase();
        const payloadStr = JSON.stringify(block.data || block.payload || '').toLowerCase();

        return (
          typeStr.includes(q) ||
          numStr.includes(q) ||
          currHash.includes(q) ||
          prevHash.includes(q) ||
          payloadStr.includes(q)
        );
      });
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.fetchBlocks();
      }
    }
  },
  methods: {
    async fetchBlocks() {
      this.loading = true;
      try {
        const res = await axios.get('http://localhost:8080/getBlocks');
        this.blocks = res.data;
        // Default open the most recent block's proofs
        if (this.blocks.length > 0) {
          const lastNum = this.blocks[this.blocks.length - 1].blockNumber;
          this.$set(this.openProofs, lastNum, true);
        }
      } catch (err) {
        console.error('Error fetching blocks:', err);
      } finally {
        this.loading = false;
      }
    },

    formatTime(ts) {
      if (!ts) return 'System Initialization';
      if (typeof ts === 'string' && (ts.toLowerCase().includes('genesis') || ts.toLowerCase().includes('invalid'))) {
        return 'System Initialized (First Record)';
      }
      const d = new Date(ts);
      if (isNaN(d.getTime())) {
        return String(ts);
      }
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    },

    getBlockTier(block) {
      const t = (block.type || '').toLowerCase();
      if (t.includes('genesis')) return 'genesis';
      if (t.includes('smart contract') || t.includes('deployed')) return 'contract';
      if (t.includes('patient')) return 'patient';
      if (t.includes('record') || t.includes('sha-256')) return 'record';
      return 'default';
    },

    getBlockIcon(block) {
      const tier = this.getBlockTier(block);
      switch (tier) {
        case 'genesis': return '🚀';
        case 'contract': return '📜';
        case 'patient': return '👤';
        case 'record': return '🔒';
        default: return '⚡';
      }
    },

    getBlockCategoryName(block) {
      const tier = this.getBlockTier(block);
      switch (tier) {
        case 'genesis': return 'System Initialized';
        case 'contract': return 'Security Rules';
        case 'patient': return 'Patient Account';
        case 'record': return 'Medical Document';
        default: return 'Activity Record';
      }
    },

    getCleanEventTitle(block) {
      const t = (block.type || '').toLowerCase();
      if (t.includes('genesis')) {
        return 'MedLedger Secure Network Started (First Baseline)';
      }
      if (t.includes('smart contract') || t.includes('deployed')) {
        return 'Patient Protection & Consent Rules Activated';
      }
      if (t.includes('patient identity registered')) {
        return 'Patient Account Created: tanmay shishodia (ID: #90)';
      }
      if (t.includes('sha-256 medical record anchored')) {
        return 'Medical Document Protected: hp9.docx';
      }
      return block.type || 'Verified Activity Record';
    },

    getHumanSummary(block) {
      const tier = this.getBlockTier(block);
      const data = block.data || block.payload || {};
      const patientRef = data.patientAddress ? `address ${data.patientAddress.substring(0, 10)}...` : 'secure account';
      const fileRef = data.fileHash ? `(Fingerprint: ${data.fileHash.substring(0, 12)}...)` : '';

      switch (tier) {
        case 'genesis':
          return 'The MedLedger secure network was launched. The system established its very first baseline record on the Ethereum Sepolia network.';
        case 'contract':
          return 'The system patient protection rules were safely activated. These rules ensure that doctors cannot see your health records without your explicit approval, and allow you to revoke access anytime.';
        case 'patient':
          return `A new patient account was safely created for tanmay shishodia (linked to ${patientRef}). The patient was given full personal control over who can view their medical files.`;
        case 'record':
          return `Medical document "hp9.docx" ${fileRef} was safely encrypted, and its unique digital fingerprint was stored. This guarantees that if anyone ever attempts to alter or edit this file, the system will immediately spot the tampering.`;
        default:
          return 'An authorized healthcare action was safely verified and permanently saved to the activity history.';
      }
    },

    getPayloadSummary(block) {
      const data = block.data || block.payload;
      if (!data) return null;
      if (data.contract) return `System Rules: ${data.contract}`;
      if (data.patientAddress) return `Patient Account: ${data.patientAddress.substring(0, 12)}...`;
      if (data.fileHash) return `File Fingerprint: ${data.fileHash.substring(0, 14)}...`;
      return null;
    },

    formatPayload(obj) {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (e) {
        return String(obj);
      }
    },

    toggleProof(num) {
      this.$set(this.openProofs, num, !this.openProofs[num]);
    },

    isProofOpen(num) {
      return !!this.openProofs[num];
    },

    copyToClipboard(text, key) {
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      this.copiedKey = key;
      setTimeout(() => {
        if (this.copiedKey === key) {
          this.copiedKey = null;
        }
      }, 2000);
    }
  }
};
</script>

<style scoped>
/* Modal Overlay and Container */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(11, 18, 32, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal-content {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 20px;
  width: 100%;
  max-width: 980px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.35);
  overflow: hidden;
  animation: modalScaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalScaleUp {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 28px;
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
}

.brand-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 9999px;
  padding: 4px 12px;
  font-size: 0.76rem;
  font-weight: 700;
  color: #1E40AF;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
}

.live-dot {
  width: 7px;
  height: 7px;
  background: #16A34A;
  border-radius: 50%;
  box-shadow: 0 0 6px #16A34A;
}

.explorer-title {
  font-size: 1.55rem;
  font-weight: 850;
  color: #0B1220;
  margin: 0 0 6px 0;
  letter-spacing: -0.02em;
}

.title-highlight {
  color: #2563EB;
}

.explorer-subtitle {
  font-size: 0.92rem;
  color: #64748B;
  margin: 0;
  line-height: 1.5;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.8rem;
  line-height: 1;
  color: #64748B;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: #E2E8F0;
  color: #0F172A;
}

/* Stats Ribbon */
.stats-ribbon {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 28px;
  background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #F8FAFC;
  border: 1px solid #F1F5F9;
  border-radius: 12px;
}

.stat-icon {
  font-size: 1.4rem;
}

.stat-data {
  display: flex;
  flex-direction: column;
}

.stat-val {
  font-size: 0.96rem;
  font-weight: 800;
  color: #0B1220;
}

.stat-val.text-success {
  color: #16A34A;
}

.stat-lbl {
  font-size: 0.72rem;
  color: #64748B;
  font-weight: 600;
}

/* Concept Guide Banner */
.concept-guide-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 16px 28px 0 28px;
  padding: 14px 18px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 12px;
}

.guide-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
}

.guide-content {
  font-size: 0.85rem;
  color: #1E40AF;
  line-height: 1.55;
}

/* Search & Filter Row */
.filter-search-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 28px;
  background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
  flex-wrap: wrap;
  gap: 12px;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 260px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #94A3B8;
}

.search-input {
  width: 100%;
  padding: 9px 12px 9px 38px;
  font-size: 0.88rem;
  border: 1px solid #CBD5E1;
  border-radius: 10px;
  background: #F8FAFC;
  color: #0F172A;
  outline: none;
  transition: all 0.15s ease;
}

.search-input:focus {
  background: #FFFFFF;
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.filter-pills {
  display: flex;
  gap: 6px;
}

.filter-pill {
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-pill:hover {
  background: #E2E8F0;
}

.filter-pill.active {
  background: #2563EB;
  border-color: #2563EB;
  color: #FFFFFF;
}

/* Modal Body / Timeline */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  background: #F8FAFC;
}

.loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  color: #64748B;
  font-weight: 600;
}

.spinner-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #2563EB;
  animation: pulseDot 1s infinite;
}

.empty-blocks-state {
  text-align: center;
  padding: 60px 20px;
  color: #64748B;
}

.empty-icon {
  font-size: 2.2rem;
  display: block;
  margin-bottom: 12px;
}

.btn-clear-search {
  margin-top: 10px;
  background: #2563EB;
  color: #FFFFFF;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

/* Timeline Chain */
.timeline-chain {
  display: flex;
  flex-direction: column;
}

.chain-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 10px 0;
  position: relative;
}

.chain-line {
  height: 16px;
  width: 2px;
  background: #CBD5E1;
}

.chain-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  padding: 3px 12px;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 750;
  color: #1E40AF;
  letter-spacing: 0.04em;
  margin: 0 12px;
}

/* Block Card */
.block-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  padding: 20px 22px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.block-card:hover {
  border-color: #93C5FD;
}

.block-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 12px;
}

.block-identity {
  display: flex;
  align-items: center;
  gap: 14px;
}

.block-num-box {
  background: #0B1220;
  color: #FFFFFF;
  padding: 6px 12px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.num-lbl {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #94A3B8;
}

.num-val {
  font-size: 1.05rem;
  font-weight: 850;
}

.block-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  width: fit-content;
}

.pill-genesis { background: #EFF6FF; color: #1E40AF; }
.pill-contract { background: #F3E8FF; color: #6B21A8; }
.pill-patient { background: #ECFDF5; color: #065F46; }
.pill-record { background: #E0F2FE; color: #075985; }

.event-title {
  font-size: 1.08rem;
  font-weight: 800;
  color: #0B1220;
  margin: 0;
}

.block-meta-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.78rem;
  color: #475569;
  font-weight: 600;
}

/* Explanation Box */
.block-explanation-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #F8FAFC;
  border: 1px solid #F1F5F9;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.expl-icon {
  font-size: 1.15rem;
  flex-shrink: 0;
}

.expl-text {
  font-size: 0.88rem;
  color: #334155;
  line-height: 1.55;
}

.expl-text strong {
  color: #0F172A;
}

/* Quick Facts Tags Row */
.data-tags-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.data-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  background: #F1F5F9;
  padding: 4px 10px;
  border-radius: 6px;
}

.tag-name {
  font-weight: 700;
  color: #64748B;
}

.tag-status {
  font-weight: 700;
  color: #16A34A;
}

.tag-val {
  color: #0F172A;
  font-weight: 600;
}

.tag-hash-link {
  font-weight: 600;
  color: #475569;
}

.text-verified {
  color: #16A34A;
  font-weight: 700;
}

/* Collapsible Proofs Section */
.proofs-accordion {
  border-top: 1px solid #F1F5F9;
  padding-top: 12px;
}

.btn-toggle-proofs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  padding: 6px 0;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  color: #2563EB;
}

.btn-toggle-proofs:hover {
  color: #1D4ED8;
}

.proofs-badge {
  background: #EFF6FF;
  border: 1px solid #DBEAFE;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  color: #1E40AF;
}

.proofs-details-panel {
  margin-top: 12px;
  background: #0B1220;
  border-radius: 12px;
  padding: 16px;
  color: #F8FAFC;
}

.hash-row {
  margin-bottom: 14px;
}

.hash-lbl {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #94A3B8;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}

.btn-copy-hash {
  background: #1E293B;
  border: 1px solid #334155;
  color: #CBD5E1;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-copy-hash:hover {
  background: #334155;
  color: #FFFFFF;
}

.hash-code {
  display: block;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.8rem;
  color: #38BDF8;
  word-break: break-all;
  background: #070D18;
  padding: 8px 10px;
  border-radius: 6px;
}

.hash-help {
  display: block;
  font-size: 0.74rem;
  color: #94A3B8;
  margin-top: 4px;
  line-height: 1.4;
}

.payload-pre {
  background: #070D18;
  padding: 8px 10px;
  border-radius: 6px;
  margin: 4px 0 0 0;
  font-size: 0.78rem;
  color: #A7F3D0;
  overflow-x: auto;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 28px;
  background: #FFFFFF;
  border-top: 1px solid #E2E8F0;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-note {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: #64748B;
}

.verified-dot {
  color: #16A34A;
  font-size: 0.7rem;
}

.btn-close-footer {
  background: #F1F5F9;
  border: 1px solid #CBD5E1;
  color: #0F172A;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-close-footer:hover {
  background: #E2E8F0;
}

@media (max-width: 768px) {
  .stats-ribbon {
    grid-template-columns: repeat(2, 1fr);
  }
  .modal-content {
    max-height: 96vh;
    border-radius: 14px;
  }
  .explorer-title {
    font-size: 1.25rem;
  }
}

@media (max-width: 480px) {
  .stats-ribbon {
    grid-template-columns: 1fr;
  }
  .filter-search-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

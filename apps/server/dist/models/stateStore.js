"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stateStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../config/index.js");
const recordVault_js_1 = require("../services/recordVault.js");
class StateStore {
    stateFilePath;
    memoryState;
    constructor() {
        this.stateFilePath = index_js_1.config.stateFilePath;
        this.memoryState = this.loadState();
    }
    loadState() {
        if (fs_1.default.existsSync(this.stateFilePath)) {
            try {
                const raw = fs_1.default.readFileSync(this.stateFilePath, 'utf8');
                const parsed = JSON.parse(raw);
                if (!parsed.patients)
                    parsed.patients = [];
                if (!parsed.doctors)
                    parsed.doctors = [];
                if (!parsed.reports)
                    parsed.reports = [];
                if (!parsed.blocks)
                    parsed.blocks = [];
                if (!parsed.auditLogs)
                    parsed.auditLogs = [];
                if (!parsed.users)
                    parsed.users = [];
                this.openSealedNotes(parsed.reports);
                parsed.vitals = this.openSealedList(parsed.vitalsSealed, 'vitals') ?? parsed.vitals ?? [];
                parsed.chats = this.openSealedList(parsed.chatsSealed, 'chats') ?? parsed.chats ?? [];
                delete parsed.vitalsSealed;
                delete parsed.chatsSealed;
                this.memoryState = parsed;
                return parsed;
            }
            catch (err) {
                console.error('[StateStore] Error reading state.json:', err);
            }
        }
        // Default baseline fallback state
        this.memoryState = {
            patients: [
                {
                    patientId: '90',
                    adharNo: 'XXXXXXXXXXXX',
                    name: 'tanmay shishodia',
                    email: '123@gmail.com',
                    age: '24',
                    phNo: 'XXXXXXXXXX',
                    address: 'XXXXXXXXXX',
                    city: 'XXXXXXX',
                    reportFile: 'hp9.docx',
                    ethereumAddress: '0x495e7483db248DCA08B37121D15917Ae19D93C20',
                    type: 'patient'
                }
            ],
            doctors: [
                {
                    doctorId: '1593418229676',
                    licenseId: 'DOC-MH-10293',
                    name: 'Dr. Gregory House',
                    email: 'house@princeton.edu',
                    age: '45',
                    phNo: '9123456780',
                    ethereumAddress: '0x1593418229676000000000000000000000000000',
                    type: 'doctor'
                }
            ],
            reports: [
                {
                    reportId: '1593418802454',
                    patientId: '90',
                    report: 'Diagnostic Assessment for tanmay shishodia: Patient vitals stable. Blood Pressure 120/80 mmHg, SpO2 99%.',
                    fileName: 'hp9.docx',
                    fileHash: '0x04a21f8828d1556e472ac7c4474fb99ad8fb873121ea69cfdc618d17284d5095',
                    isAsked: '1',
                    isGiven: '0',
                    type: 'report'
                }
            ],
            blocks: [],
            auditLogs: [],
            users: []
        };
        return this.memoryState;
    }
    /** Encrypted-at-rest report fields and the context each is bound to. */
    static SEALED_FIELDS = [
        { field: 'report', sealedAs: 'reportSealed', context: 'notes' },
        { field: 'extractedText', sealedAs: 'extractedTextSealed', context: 'extracted' }
    ];
    /** `${field}:${reportId}` → last sealed value, so unchanged text is not re-encrypted on every save */
    sealedCache = new Map();
    sealNotes(r) {
        const out = { ...r };
        for (const { field, sealedAs, context } of StateStore.SEALED_FIELDS) {
            const plain = r[field];
            delete out[field];
            if (!plain)
                continue;
            const key = `${field}:${r.reportId}`;
            const hit = this.sealedCache.get(key);
            let sealed = hit && hit.plain === plain ? hit.sealed : '';
            if (!sealed) {
                try {
                    sealed = recordVault_js_1.recordVault.sealText(plain, `${context}:${r.reportId}`);
                    this.sealedCache.set(key, { plain, sealed });
                }
                catch (err) {
                    // never fall back to writing plaintext
                    console.error(`[StateStore] Could not encrypt ${field}; it is kept in memory only:`, err.message);
                    continue;
                }
            }
            out[sealedAs] = sealed;
        }
        return out;
    }
    openSealedNotes(reports) {
        for (const r of reports) {
            for (const { field, sealedAs, context } of StateStore.SEALED_FIELDS) {
                const sealed = r[sealedAs];
                if (!sealed)
                    continue;
                try {
                    r[field] = recordVault_js_1.recordVault.openText(sealed, `${context}:${r.reportId}`);
                    this.sealedCache.set(`${field}:${r.reportId}`, { plain: r[field], sealed });
                }
                catch (err) {
                    console.error(`[StateStore] Could not decrypt ${field} of record ${r.reportId}:`, err.message);
                    r[field] = '';
                }
                delete r[sealedAs];
            }
        }
    }
    sealedListCache = new Map();
    sealList(list, context) {
        if (!list || !list.length)
            return undefined;
        const json = JSON.stringify(list);
        const hit = this.sealedListCache.get(context);
        if (hit && hit.json === json)
            return hit.sealed;
        try {
            const sealed = recordVault_js_1.recordVault.sealText(json, `list:${context}`);
            this.sealedListCache.set(context, { json, sealed });
            return sealed;
        }
        catch (err) {
            // never fall back to plaintext on disk
            console.error(`[StateStore] Could not encrypt ${context}; kept in memory only:`, err.message);
            return undefined;
        }
    }
    openSealedList(sealed, context) {
        if (typeof sealed !== 'string' || !sealed)
            return undefined;
        try {
            const json = recordVault_js_1.recordVault.openText(sealed, `list:${context}`);
            this.sealedListCache.set(context, { json, sealed });
            return JSON.parse(json);
        }
        catch (err) {
            console.error(`[StateStore] Could not decrypt ${context}:`, err.message);
            return [];
        }
    }
    /** Re-wraps every note key with the current master key (see scripts/rotate-keys.ts). */
    rewrapSealedNotes() {
        this.sealedCache.clear();
        this.sealedListCache.clear();
        this.saveState();
        return this.memoryState.reports.filter((r) => r.report).length;
    }
    getState() {
        return this.memoryState;
    }
    saveState() {
        try {
            const dir = path_1.default.dirname(this.stateFilePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            // Clinical notes are encrypted at rest; the in-memory copy stays readable for the app.
            const { vitals, chats, ...rest } = this.memoryState;
            const onDisk = { ...rest, reports: this.memoryState.reports.map((r) => this.sealNotes(r)) };
            // measurements and conversations are health data too: stored only encrypted
            const vitalsSealed = this.sealList(vitals, 'vitals');
            const chatsSealed = this.sealList(chats, 'chats');
            if (vitalsSealed)
                onDisk.vitalsSealed = vitalsSealed;
            if (chatsSealed)
                onDisk.chatsSealed = chatsSealed;
            const tmp = `${this.stateFilePath}.${process.pid}.tmp`;
            fs_1.default.writeFileSync(tmp, JSON.stringify(onDisk, null, 2), { encoding: 'utf8', mode: 0o600 });
            fs_1.default.renameSync(tmp, this.stateFilePath);
        }
        catch (err) {
            console.error('[StateStore] Error saving state.json:', err);
        }
    }
    addPatient(patient) {
        this.memoryState.patients.push(patient);
        this.saveState();
    }
    addDoctor(doctor) {
        this.memoryState.doctors.push(doctor);
        this.saveState();
    }
    addReport(report) {
        this.memoryState.reports.push(report);
        this.saveState();
    }
    updateReport(reportId, updates) {
        const r = this.memoryState.reports.find((item) => item.reportId === reportId);
        if (r) {
            Object.assign(r, updates);
            this.saveState();
            return true;
        }
        return false;
    }
    addBlock(block) {
        this.memoryState.blocks.push(block);
        this.saveState();
    }
    addAuditLog(entry) {
        if (!this.memoryState.auditLogs)
            this.memoryState.auditLogs = [];
        this.memoryState.auditLogs.push(entry);
        this.saveState();
    }
}
exports.stateStore = new StateStore();

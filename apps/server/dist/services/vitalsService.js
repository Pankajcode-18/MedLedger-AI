"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vitalsService = exports.VitalValidationError = exports.VITAL_SPECS = void 0;
const crypto_1 = __importDefault(require("crypto"));
const stateStore_js_1 = require("../models/stateStore.js");
exports.VITAL_SPECS = {
    bp: { label: 'Blood pressure', unit: 'mmHg', keys: ['systolic_bp', 'diastolic_bp'], min: 50, max: 260, min2: 30, max2: 160 },
    heart_rate: { label: 'Heart rate', unit: 'bpm', keys: ['heart_rate'], min: 25, max: 250 },
    spo2: { label: 'Oxygen saturation', unit: '%', keys: ['spo2'], min: 50, max: 100 },
    temperature: { label: 'Temperature', unit: '°C', keys: ['temperature'], min: 30, max: 45 },
    weight: { label: 'Weight', unit: 'kg', keys: ['weight'], min: 1, max: 400 },
    fasting_glucose: { label: 'Fasting blood sugar', unit: 'mg/dL', keys: ['fasting_glucose'], min: 20, max: 800 },
    random_glucose: { label: 'Blood sugar (random)', unit: 'mg/dL', keys: ['random_glucose'], min: 20, max: 800 }
};
class VitalValidationError extends Error {
}
exports.VitalValidationError = VitalValidationError;
const list = () => {
    const state = stateStore_js_1.stateStore.getState();
    if (!state.vitals)
        state.vitals = [];
    return state.vitals;
};
exports.vitalsService = {
    forPatient(patientId) {
        return list()
            .filter((v) => v.patientId === patientId)
            .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
    },
    add(input) {
        const spec = exports.VITAL_SPECS[input.type];
        if (!spec)
            throw new VitalValidationError('Unknown measurement type.');
        let value = Number(input.value);
        let value2 = input.value2 === undefined || input.value2 === null ? undefined : Number(input.value2);
        const unit = String(input.unit || '').toLowerCase();
        // unit conversion into the stored unit
        if (input.type === 'temperature' && (unit === 'f' || unit === '°f' || (!unit && value > 50)))
            value = Math.round(((value - 32) * 5) / 9 * 10) / 10;
        if (input.type === 'weight' && (unit === 'lb' || unit === 'lbs'))
            value = Math.round(value * 0.453592 * 10) / 10;
        if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
            throw new VitalValidationError(`${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}.`);
        }
        if (input.type === 'bp') {
            if (value2 === undefined || !Number.isFinite(value2) || value2 < spec.min2 || value2 > spec.max2) {
                throw new VitalValidationError(`Enter both numbers of the blood pressure (for example 120 / 80).`);
            }
            if (value2 >= value)
                throw new VitalValidationError('The first blood-pressure number (systolic) must be higher than the second (diastolic).');
        }
        else {
            value2 = undefined;
        }
        const takenAt = input.takenAt ? new Date(input.takenAt) : new Date();
        if (Number.isNaN(takenAt.getTime()))
            throw new VitalValidationError('The date and time are not valid.');
        if (takenAt.getTime() > Date.now() + 5 * 60_000)
            throw new VitalValidationError('The reading cannot be in the future.');
        if (takenAt.getFullYear() < 1990)
            throw new VitalValidationError('The date is too far in the past.');
        const reading = {
            id: crypto_1.default.randomUUID(),
            patientId: input.patientId,
            type: input.type,
            value: Math.round(value * 10) / 10,
            ...(value2 !== undefined ? { value2: Math.round(value2) } : {}),
            unit: spec.unit,
            takenAt: takenAt.toISOString(),
            ...(input.note ? { note: String(input.note).slice(0, 200) } : {}),
            origin: input.origin,
            enteredBy: input.enteredBy,
            enteredRole: input.enteredRole,
            createdAt: new Date().toISOString()
        };
        list().push(reading);
        stateStore_js_1.stateStore.saveState();
        return reading;
    },
    find(id) {
        return list().find((v) => v.id === id);
    },
    remove(id) {
        const all = list();
        const i = all.findIndex((v) => v.id === id);
        if (i < 0)
            return false;
        all.splice(i, 1);
        stateStore_js_1.stateStore.saveState();
        return true;
    },
    /** Readings as trend points: one per series key (blood pressure → systolic + diastolic). */
    trendPoints(patientId) {
        return this.forPatient(patientId).flatMap((r) => {
            const spec = exports.VITAL_SPECS[r.type];
            const source = r.origin === 'home' ? 'Home reading' : 'Clinic reading';
            const base = { date: r.takenAt, origin: r.origin, source };
            return spec.keys.length === 2
                ? [
                    { ...base, key: spec.keys[0], value: r.value },
                    { ...base, key: spec.keys[1], value: r.value2 }
                ]
                : [{ ...base, key: spec.keys[0], value: r.value }];
        });
    }
};

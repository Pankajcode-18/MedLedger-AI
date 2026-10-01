import crypto from 'crypto';
import { stateStore } from '../models/stateStore.js';
import { IVitalReading, VitalType } from '../types/index.js';

/**
 * Home and clinic measurements. Lab reports only arrive now and then; readings a patient takes
 * at home (blood pressure, sugar, weight…) are what make trend charts useful between visits.
 */

interface VitalSpec {
  label: string;
  unit: string;
  /** trend-series keys this reading feeds (blood pressure feeds two) */
  keys: [string] | [string, string];
  min: number;
  max: number;
  min2?: number;
  max2?: number;
}

export const VITAL_SPECS: Record<VitalType, VitalSpec> = {
  bp: { label: 'Blood pressure', unit: 'mmHg', keys: ['systolic_bp', 'diastolic_bp'], min: 50, max: 260, min2: 30, max2: 160 },
  heart_rate: { label: 'Heart rate', unit: 'bpm', keys: ['heart_rate'], min: 25, max: 250 },
  spo2: { label: 'Oxygen saturation', unit: '%', keys: ['spo2'], min: 50, max: 100 },
  temperature: { label: 'Temperature', unit: '°C', keys: ['temperature'], min: 30, max: 45 },
  weight: { label: 'Weight', unit: 'kg', keys: ['weight'], min: 1, max: 400 },
  fasting_glucose: { label: 'Fasting blood sugar', unit: 'mg/dL', keys: ['fasting_glucose'], min: 20, max: 800 },
  random_glucose: { label: 'Blood sugar (random)', unit: 'mg/dL', keys: ['random_glucose'], min: 20, max: 800 }
};

export class VitalValidationError extends Error {}

const list = (): IVitalReading[] => {
  const state = stateStore.getState();
  if (!state.vitals) state.vitals = [];
  return state.vitals;
};

export interface NewReading {
  patientId: string;
  type: VitalType;
  value: number;
  value2?: number;
  /** "C" or "F" for temperature, "kg" or "lb" for weight; other types have one unit */
  unit?: string;
  takenAt?: string;
  note?: string;
  origin: 'home' | 'clinic';
  enteredBy: string;
  enteredRole: string;
}

export const vitalsService = {
  forPatient(patientId: string): IVitalReading[] {
    return list()
      .filter((v) => v.patientId === patientId)
      .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
  },

  add(input: NewReading): IVitalReading {
    const spec = VITAL_SPECS[input.type];
    if (!spec) throw new VitalValidationError('Unknown measurement type.');

    let value = Number(input.value);
    let value2 = input.value2 === undefined || input.value2 === null ? undefined : Number(input.value2);
    const unit = String(input.unit || '').toLowerCase();

    // unit conversion into the stored unit
    if (input.type === 'temperature' && (unit === 'f' || unit === '°f' || (!unit && value > 50))) value = Math.round(((value - 32) * 5) / 9 * 10) / 10;
    if (input.type === 'weight' && (unit === 'lb' || unit === 'lbs')) value = Math.round(value * 0.453592 * 10) / 10;

    if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
      throw new VitalValidationError(`${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}.`);
    }
    if (input.type === 'bp') {
      if (value2 === undefined || !Number.isFinite(value2) || value2 < (spec.min2 as number) || value2 > (spec.max2 as number)) {
        throw new VitalValidationError(`Enter both numbers of the blood pressure (for example 120 / 80).`);
      }
      if (value2 >= value) throw new VitalValidationError('The first blood-pressure number (systolic) must be higher than the second (diastolic).');
    } else {
      value2 = undefined;
    }

    const takenAt = input.takenAt ? new Date(input.takenAt) : new Date();
    if (Number.isNaN(takenAt.getTime())) throw new VitalValidationError('The date and time are not valid.');
    if (takenAt.getTime() > Date.now() + 5 * 60_000) throw new VitalValidationError('The reading cannot be in the future.');
    if (takenAt.getFullYear() < 1990) throw new VitalValidationError('The date is too far in the past.');

    const reading: IVitalReading = {
      id: crypto.randomUUID(),
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
    stateStore.saveState();
    return reading;
  },

  find(id: string): IVitalReading | undefined {
    return list().find((v) => v.id === id);
  },

  remove(id: string): boolean {
    const all = list();
    const i = all.findIndex((v) => v.id === id);
    if (i < 0) return false;
    all.splice(i, 1);
    stateStore.saveState();
    return true;
  },

  /** Readings as trend points: one per series key (blood pressure → systolic + diastolic). */
  trendPoints(patientId: string): Array<{ key: string; value: number; date: string; origin: 'home' | 'clinic'; source: string }> {
    return this.forPatient(patientId).flatMap((r) => {
      const spec = VITAL_SPECS[r.type];
      const source = r.origin === 'home' ? 'Home reading' : 'Clinic reading';
      const base = { date: r.takenAt, origin: r.origin, source };
      return spec.keys.length === 2
        ? [
            { ...base, key: spec.keys[0], value: r.value },
            { ...base, key: spec.keys[1] as string, value: r.value2 as number }
          ]
        : [{ ...base, key: spec.keys[0], value: r.value }];
    });
  }
};

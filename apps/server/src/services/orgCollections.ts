import crypto from 'crypto';
import { z } from 'zod';
import { stateStore } from '../models/stateStore.js';

/**
 * Records kept by organisations: hospital staff and admissions, lab samples, insurance claims and
 * policyholders, and the organisation register kept by administrators. Each item belongs to the
 * organisation account that created it (`orgId`) and is stored encrypted with the rest of the state.
 */

export type CollectionName = 'staff' | 'admissions' | 'samples' | 'claims' | 'policyholders' | 'organisations';

export interface CollectionItem {
  id: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

const text = (max: number, msg: string) => z.string().trim().min(1, msg).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a phone number with digits only, for example +977 9812345678.')
  .optional()
  .or(z.literal(''));
const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Enter a valid date.')
  .optional();
const money = z.coerce.number().min(0, 'The amount cannot be negative.').max(100_000_000, 'That amount is too large.');

export const SCHEMAS = {
  staff: {
    create: z.object({
      name: text(80, 'Enter the staff member’s name.'),
      role: text(40, 'Enter a role, for example Nurse.'),
      department: text(60, 'Enter the department.'),
      licenceNo: optionalText(40),
      phone,
      status: z.enum(['On duty', 'Off duty', 'On leave']).default('On duty')
    }),
    update: z.object({ status: z.enum(['On duty', 'Off duty', 'On leave']).optional(), phone, department: optionalText(60), role: optionalText(40) })
  },
  admissions: {
    create: z.object({
      patientName: text(80, 'Enter the patient’s name.'),
      patientId: optionalText(64),
      ward: text(40, 'Enter the ward.'),
      bed: text(20, 'Enter the bed number.'),
      doctorName: text(80, 'Enter the doctor in charge.'),
      reason: optionalText(200),
      status: z.enum(['Admitted', 'ICU']).default('Admitted'),
      admittedAt: isoDate
    }),
    update: z.object({ status: z.enum(['Admitted', 'ICU', 'Discharged']).optional(), ward: optionalText(40), bed: optionalText(20) })
  },
  samples: {
    create: z.object({
      patientName: text(80, 'Enter the patient’s name.'),
      patientId: optionalText(64),
      test: text(80, 'Enter the test name.'),
      category: optionalText(40),
      priority: z.enum(['Routine', 'Urgent']).default('Routine'),
      collectedAt: isoDate
    }),
    update: z.object({ status: z.enum(['Received', 'Processing', 'Report ready', 'Uploaded']).optional(), reportId: optionalText(64) })
  },
  claims: {
    create: z.object({
      patientName: text(80, 'Enter the patient’s name.'),
      patientId: optionalText(64),
      policyNo: text(40, 'Enter the policy number.'),
      provider: text(80, 'Enter the hospital or clinic.'),
      service: text(120, 'Enter the treatment or test billed.'),
      amount: money,
      currency: z.enum(['NPR', 'INR']).default('NPR'),
      reportId: optionalText(64)
    }),
    update: z.object({
      status: z.enum(['Submitted', 'Needs information', 'Approved', 'Rejected', 'Paid']).optional(),
      approvedAmount: money.optional(),
      note: optionalText(300)
    })
  },
  policyholders: {
    create: z.object({
      name: text(80, 'Enter the policyholder’s name.'),
      patientId: optionalText(64),
      policyNo: text(40, 'Enter the policy number.'),
      plan: text(60, 'Enter the plan name.'),
      sumInsured: money,
      currency: z.enum(['NPR', 'INR']).default('NPR'),
      validTill: isoDate,
      phone
    }),
    update: z.object({ plan: optionalText(60), sumInsured: money.optional(), validTill: isoDate, phone, status: z.enum(['Active', 'Lapsed']).optional() })
  },
  organisations: {
    create: z.object({
      name: text(100, 'Enter the organisation name.'),
      type: z.enum(['Hospital', 'Clinic', 'Laboratory', 'Insurance', 'Pharmacy']),
      registrationNo: optionalText(40),
      district: optionalText(40),
      country: z.enum(['Nepal', 'India']).default('Nepal'),
      phone
    }),
    update: z.object({ verified: z.boolean().optional(), district: optionalText(40), phone })
  }
} as const;

/** What a status change is allowed to become next (anything not listed is refused). */
const NEXT_STATUS: Partial<Record<CollectionName, Record<string, string[]>>> = {
  admissions: { Admitted: ['ICU', 'Discharged'], ICU: ['Admitted', 'Discharged'], Discharged: [] },
  samples: { Received: ['Processing'], Processing: ['Report ready'], 'Report ready': ['Uploaded'], Uploaded: [] },
  claims: {
    Submitted: ['Needs information', 'Approved', 'Rejected'],
    'Needs information': ['Submitted', 'Approved', 'Rejected'],
    Approved: ['Paid', 'Rejected'],
    Rejected: [],
    Paid: []
  }
};

const INITIAL_STATUS: Partial<Record<CollectionName, string>> = {
  samples: 'Received',
  claims: 'Submitted',
  policyholders: 'Active'
};

const ID_PREFIX: Record<CollectionName, string> = {
  staff: 'STF',
  admissions: 'ADM',
  samples: 'SMP',
  claims: 'CLM',
  policyholders: 'POL',
  organisations: 'ORG'
};

export class CollectionError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const listOf = (name: CollectionName): CollectionItem[] => {
  const state = stateStore.getState() as unknown as Record<string, CollectionItem[] | undefined>;
  if (!state[name]) state[name] = [];
  return state[name] as CollectionItem[];
};

export const orgCollections = {
  list(name: CollectionName, orgId?: string): CollectionItem[] {
    return listOf(name)
      .filter((i) => !orgId || i.orgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  forPatient(name: CollectionName, patientId: string): CollectionItem[] {
    return listOf(name).filter((i) => String(i.patientId || '') === String(patientId));
  },

  find(name: CollectionName, id: string): CollectionItem | undefined {
    return listOf(name).find((i) => i.id === id);
  },

  create(name: CollectionName, orgId: string, input: unknown): CollectionItem {
    const parsed = SCHEMAS[name].create.safeParse(input || {});
    if (!parsed.success) throw new CollectionError(parsed.error.issues[0]?.message || 'Please check the form.');
    const now = new Date().toISOString();
    const item: CollectionItem = {
      id: `${ID_PREFIX[name]}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      orgId,
      ...(INITIAL_STATUS[name] ? { status: INITIAL_STATUS[name] } : {}),
      ...(name === 'organisations' ? { verified: false } : {}),
      ...(parsed.data as Record<string, unknown>),
      createdAt: now,
      updatedAt: now
    };
    if (name === 'admissions' && !item.admittedAt) item.admittedAt = now;
    if (name === 'samples' && !item.collectedAt) item.collectedAt = now;
    listOf(name).push(item);
    stateStore.saveState();
    return item;
  },

  update(name: CollectionName, item: CollectionItem, input: unknown): CollectionItem {
    const parsed = SCHEMAS[name].update.safeParse(input || {});
    if (!parsed.success) throw new CollectionError(parsed.error.issues[0]?.message || 'Please check the change.');
    const changes = Object.fromEntries(Object.entries(parsed.data as Record<string, unknown>).filter(([, v]) => v !== undefined));
    if (!Object.keys(changes).length) throw new CollectionError('Nothing to change.');
    const rules = NEXT_STATUS[name];
    if (rules && typeof changes.status === 'string' && changes.status !== item.status) {
      const allowed = rules[String(item.status)] || [];
      if (!allowed.includes(changes.status)) {
        throw new CollectionError(`This item is "${item.status}" and cannot be changed to "${changes.status}".`, 409);
      }
    }
    if (name === 'claims' && typeof changes.approvedAmount === 'number' && changes.approvedAmount > Number(item.amount)) {
      throw new CollectionError('The approved amount cannot be more than the amount claimed.');
    }
    Object.assign(item, changes, { updatedAt: new Date().toISOString() });
    if (name === 'admissions' && changes.status === 'Discharged') item.dischargedAt = item.updatedAt;
    if (name === 'claims' && changes.status === 'Approved' && item.approvedAmount === undefined) item.approvedAmount = item.amount;
    if (name === 'claims' && changes.status === 'Paid') item.paidAt = item.updatedAt;
    stateStore.saveState();
    return item;
  }
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** Invented sample rows for the demo organisation accounts, added once when their lists are empty. */
const DEMO_ROWS: Array<{ name: CollectionName; orgId: string; rows: Array<Record<string, unknown>> }> = [
  {
    name: 'staff',
    orgId: 'hosp-01',
    rows: [
      { name: 'Dr. Sunita Karki', role: 'Consultant', department: 'Cardiology', licenceNo: 'NMC-23145', phone: '+977 9841234567', status: 'On duty' },
      { name: 'Dr. Bikash Gurung', role: 'Medical Officer', department: 'Emergency', licenceNo: 'NMC-30871', phone: '+977 9851122334', status: 'On duty' },
      { name: 'Ramesh Adhikari', role: 'Staff Nurse', department: 'General Ward', licenceNo: 'NNC-11872', phone: '+977 9803344556', status: 'Off duty' },
      { name: 'Maya Tamang', role: 'Pharmacist', department: 'Pharmacy', licenceNo: 'NPC-4521', phone: '+977 9818899001', status: 'On leave' }
    ]
  },
  {
    name: 'admissions',
    orgId: 'hosp-01',
    rows: [
      { patientName: 'Tanmay Shishodia', patientId: '90', ward: 'General Ward A', bed: '12', doctorName: 'Dr. Anil Sharma', reason: 'Observation – high blood sugar', status: 'Admitted', admittedAt: daysAgo(2) },
      { patientName: 'Hari Prasad Poudel', ward: 'ICU', bed: '3', doctorName: 'Dr. Sunita Karki', reason: 'Chest pain', status: 'ICU', admittedAt: daysAgo(1) },
      { patientName: 'Sabina Rai', ward: 'Maternity', bed: '5', doctorName: 'Dr. Bikash Gurung', reason: 'Delivery', status: 'Discharged', admittedAt: daysAgo(6), dischargedAt: daysAgo(3) }
    ]
  },
  {
    name: 'samples',
    orgId: 'lab-01',
    rows: [
      { patientName: 'Tanmay Shishodia', patientId: '90', test: 'Fasting blood sugar', category: 'Biochemistry', priority: 'Routine', status: 'Processing', collectedAt: daysAgo(0) },
      { patientName: 'Gita Bhandari', test: 'Complete blood count (CBC)', category: 'Haematology', priority: 'Urgent', status: 'Received', collectedAt: daysAgo(0) },
      { patientName: 'Kiran Shrestha', test: 'Lipid profile', category: 'Biochemistry', priority: 'Routine', status: 'Report ready', collectedAt: daysAgo(1) },
      { patientName: 'Tanmay Shishodia', patientId: '90', test: 'HbA1c', category: 'Biochemistry', priority: 'Routine', status: 'Uploaded', collectedAt: daysAgo(5) }
    ]
  },
  {
    name: 'claims',
    orgId: 'ins-01',
    rows: [
      { patientName: 'Tanmay Shishodia', patientId: '90', policyNo: 'SHI-2026-0090', provider: 'Himal Care Hospital', service: 'Blood tests and consultation', amount: 4500, currency: 'NPR', reportId: '1593418802454', status: 'Submitted' },
      { patientName: 'Hari Prasad Poudel', policyNo: 'SHI-2025-0412', provider: 'Himal Care Hospital', service: 'ICU stay, 3 days', amount: 85000, currency: 'NPR', status: 'Needs information', note: 'Discharge summary missing.' },
      { patientName: 'Sabina Rai', policyNo: 'SHI-2026-0133', provider: 'Himal Care Hospital', service: 'Normal delivery', amount: 32000, approvedAmount: 30000, currency: 'NPR', status: 'Approved' },
      { patientName: 'Kiran Shrestha', policyNo: 'SHI-2024-0078', provider: 'Himal Diagnostic Lab', service: 'Lipid profile', amount: 1800, approvedAmount: 1800, currency: 'NPR', status: 'Paid' }
    ]
  },
  {
    name: 'policyholders',
    orgId: 'ins-01',
    rows: [
      { name: 'Tanmay Shishodia', patientId: '90', policyNo: 'SHI-2026-0090', plan: 'Family Health', sumInsured: 500000, currency: 'NPR', validTill: daysAhead(190), phone: '+977 9812345678', status: 'Active' },
      { name: 'Hari Prasad Poudel', policyNo: 'SHI-2025-0412', plan: 'Senior Care', sumInsured: 300000, currency: 'NPR', validTill: daysAhead(40), phone: '+977 9847766554', status: 'Active' },
      { name: 'Sabina Rai', policyNo: 'SHI-2026-0133', plan: 'Mother and Child', sumInsured: 200000, currency: 'NPR', validTill: daysAhead(300), phone: '+977 9860011223', status: 'Active' }
    ]
  },
  {
    name: 'organisations',
    orgId: 'register',
    rows: [
      { name: 'Himal Care Hospital', type: 'Hospital', registrationNo: 'HOS-2071-118', district: 'Kathmandu', country: 'Nepal', phone: '+977 1 4412345', verified: true },
      { name: 'Himal Diagnostic Lab', type: 'Laboratory', registrationNo: 'LAB-2075-042', district: 'Lalitpur', country: 'Nepal', phone: '+977 1 5523456', verified: true },
      { name: 'Suraksha Health Insurance', type: 'Insurance', registrationNo: 'INS-2068-007', district: 'Kathmandu', country: 'Nepal', phone: '+977 1 4234567', verified: true },
      { name: 'Pokhara Family Clinic', type: 'Clinic', registrationNo: 'CLN-2079-311', district: 'Kaski', country: 'Nepal', phone: '+977 61 523456', verified: false },
      { name: 'Sanjeevani Pathology', type: 'Laboratory', registrationNo: 'NABL MC-5821', district: 'Patna', country: 'India', phone: '+91 612 2345678', verified: false }
    ]
  }
];

export function seedDemoCollections(): number {
  let added = 0;
  for (const { name, orgId, rows } of DEMO_ROWS) {
    const list = listOf(name);
    if (list.some((i) => i.orgId === orgId)) continue;
    rows.forEach((row, i) => {
      const created = daysAgo(rows.length - i);
      list.push({
        id: `${ID_PREFIX[name]}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        orgId,
        ...(INITIAL_STATUS[name] ? { status: INITIAL_STATUS[name] } : {}),
        ...row,
        createdAt: created,
        updatedAt: created
      });
      added++;
    });
  }
  if (added) stateStore.saveState();
  return added;
}

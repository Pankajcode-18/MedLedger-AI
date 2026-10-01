import { Response } from 'express';
import { stateStore } from '../models/stateStore.js';
import { AuthenticatedRequest, IUserSettings } from '../types/index.js';

/**
 * Saved settings forms. Each user keeps one small set of values per section
 * (for example "profile", "notifications", "practice"). Values are plain strings,
 * numbers or true/false; they are stored encrypted with the rest of the state.
 */

const SECTION = /^[a-z][a-z0-9-]{1,31}$/;
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const MAX_KEYS = 40;
const MAX_TEXT = 500;

const list = (): IUserSettings[] => {
  const state = stateStore.getState();
  if (!state.settings) state.settings = [];
  return state.settings;
};

/** Checks and copies the submitted values; returns an error message when they are not acceptable. */
export const cleanValues = (input: unknown): { values?: IUserSettings['values']; error?: string } => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Send the settings as a list of named values.' };
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > MAX_KEYS) return { error: `A settings form can hold at most ${MAX_KEYS} values.` };
  const values: IUserSettings['values'] = {};
  for (const [k, v] of entries) {
    if (!KEY.test(k)) return { error: `"${k}" is not a valid setting name.` };
    if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) values[k] = v;
    else if (typeof v === 'string') {
      if (v.length > MAX_TEXT) return { error: `"${k}" is too long (at most ${MAX_TEXT} characters).` };
      values[k] = v.trim();
    } else if (v === null || v === undefined) continue;
    else return { error: `"${k}" must be text, a number or on/off.` };
  }
  return { values };
};

export const settingsService = {
  get(userId: string, section: string): IUserSettings | undefined {
    return list().find((s) => s.userId === userId && s.section === section);
  },
  save(userId: string, section: string, values: IUserSettings['values']): IUserSettings {
    const all = list();
    const now = new Date().toISOString();
    const existing = all.find((s) => s.userId === userId && s.section === section);
    if (existing) {
      existing.values = values;
      existing.updatedAt = now;
    } else {
      all.push({ userId, section, values, updatedAt: now });
    }
    stateStore.saveState();
    return this.get(userId, section) as IUserSettings;
  }
};

export const settingsController = {
  /** GET /api/settings/:section → the saved values, or {} when nothing was saved yet */
  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    const section = String(req.params.section || '');
    if (!SECTION.test(section)) {
      res.status(400).json({ success: false, error: 'Unknown settings section.' });
      return;
    }
    const saved = settingsService.get(String(req.user?.userId), section);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { section, values: saved?.values || {}, updatedAt: saved?.updatedAt || null } });
  },

  /** PUT /api/settings/:section  body: { values: {...} } */
  async save(req: AuthenticatedRequest, res: Response): Promise<void> {
    const section = String(req.params.section || '');
    if (!SECTION.test(section)) {
      res.status(400).json({ success: false, error: 'Unknown settings section.' });
      return;
    }
    const { values, error } = cleanValues((req.body || {}).values);
    if (error || !values) {
      res.status(400).json({ success: false, error });
      return;
    }
    const saved = settingsService.save(String(req.user?.userId), section, values);
    res.status(200).json({ success: true, message: 'Your changes are saved.', data: { section, values: saved.values, updatedAt: saved.updatedAt } });
  }
};

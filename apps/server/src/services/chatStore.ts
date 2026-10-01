import crypto from 'crypto';
import { stateStore } from '../models/stateStore.js';
import { IChatMessageRecord, IChatThread } from '../types/index.js';

/** Saved assistant conversations — encrypted at rest with the rest of the state (see stateStore). */
const MAX_MESSAGES = 200;

const threads = (): IChatThread[] => {
  const s = stateStore.getState();
  if (!s.chats) s.chats = [];
  return s.chats;
};

export const chatStore = {
  get(ownerId: string, patientId: string): IChatThread | undefined {
    return threads().find((t) => t.ownerId === ownerId && t.patientId === patientId);
  },

  append(ownerId: string, patientId: string, messages: Array<Omit<IChatMessageRecord, 'id' | 'createdAt'>>): IChatMessageRecord[] {
    let t = this.get(ownerId, patientId);
    if (!t) {
      t = { ownerId, patientId, messages: [], updatedAt: new Date().toISOString() };
      threads().push(t);
    }
    const added = messages.map((m) => ({ ...m, id: crypto.randomUUID(), createdAt: new Date().toISOString() }));
    t.messages.push(...added);
    if (t.messages.length > MAX_MESSAGES) t.messages.splice(0, t.messages.length - MAX_MESSAGES);
    t.updatedAt = new Date().toISOString();
    stateStore.saveState();
    return added;
  },

  clear(ownerId: string, patientId: string): void {
    const all = threads();
    const i = all.findIndex((t) => t.ownerId === ownerId && t.patientId === patientId);
    if (i >= 0) {
      all.splice(i, 1);
      stateStore.saveState();
    }
  }
};

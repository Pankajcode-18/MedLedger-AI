import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { stateStore } from '../models/stateStore.js';
import { blockchainService } from './blockchainService.js';
import { IAuditLogEntry, UserRole } from '../types/index.js';

export interface ILogAuditParams {
  patientId?: string;
  actorId?: string;
  actorRole?: UserRole | 'system';
  action: string;
  blockchainEventHash?: string;
  details?: Record<string, unknown>;
}

export class AuditService {
  public async logEvent(params: ILogAuditParams): Promise<IAuditLogEntry> {
    const eventHash =
      params.blockchainEventHash ||
      blockchainService.calculateSHA256(`${params.action}-${Date.now()}-${Math.random()}`);

    const entry: IAuditLogEntry = {
      patientId: params.patientId || 'system',
      actorId: params.actorId || 'system',
      actorRole: params.actorRole || 'system',
      action: params.action || 'ACTION_LOGGED',
      timestamp: new Date(),
      blockchainEventHash: eventHash,
      details: params.details || {}
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await AuditLog.create(entry);
      } catch (e) {
        console.warn('[AuditService] MongoDB log notice:', (e as Error).message);
      }
    }

    stateStore.addAuditLog(entry);
    return entry;
  }

  public async getLogsForPatient(patientId: string): Promise<IAuditLogEntry[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const found = await AuditLog.find({ patientId }).sort({ timestamp: -1 }).lean();
        if (found && found.length > 0) return found as unknown as IAuditLogEntry[];
      } catch (e) {
        // fallback to stateStore
      }
    }

    const state = stateStore.getState();
    const logs = state.auditLogs || [];
    return logs.filter((l) => String(l.patientId) === String(patientId));
  }

  /** Every event where the user is either the patient concerned or the person who acted. */
  public async getLogsForUser(userId: string): Promise<IAuditLogEntry[]> {
    const id = String(userId);
    if (mongoose.connection.readyState === 1) {
      try {
        const found = await AuditLog.find({ $or: [{ patientId: id }, { actorId: id }] })
          .sort({ timestamp: -1 })
          .limit(200)
          .lean();
        if (found && found.length > 0) return found as unknown as IAuditLogEntry[];
      } catch (e) {
        // fallback to stateStore
      }
    }

    const state = stateStore.getState();
    return (state.auditLogs || [])
      .filter((l) => String(l.patientId) === id || String(l.actorId) === id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 200);
  }

  public async getAllLogs(): Promise<IAuditLogEntry[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const found = await AuditLog.find().sort({ timestamp: -1 }).limit(200).lean();
        if (found && found.length > 0) return found as unknown as IAuditLogEntry[];
      } catch (e) {
        // fallback
      }
    }

    const state = stateStore.getState();
    return state.auditLogs || [];
  }
}

export const auditService = new AuditService();

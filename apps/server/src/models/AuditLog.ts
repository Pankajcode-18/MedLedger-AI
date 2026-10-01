import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLogDocument extends Document {
  patientId: string;
  actorId: string;
  actorRole: string;
  action: string;
  timestamp: Date;
  blockchainEventHash: string;
  details?: Record<string, unknown>;
}

const AuditLogSchema = new Schema<IAuditLogDocument>({
  patientId: { type: String, default: 'system', index: true },
  actorId: { type: String, default: 'system', index: true },
  actorRole: { type: String, default: 'system' },
  action: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  blockchainEventHash: { type: String, required: true },
  details: { type: Schema.Types.Mixed, default: {} }
});

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);

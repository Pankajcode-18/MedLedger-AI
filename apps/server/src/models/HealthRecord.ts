import mongoose, { Schema, Document } from 'mongoose';

export interface IHealthRecordDocument extends Document {
  reportId: string;
  patientId: string;
  fileName: string;
  fileHash: string;
  iv?: string;
  authTag?: string;
  wrappedKey?: string;
  storageBackend?: string;
  storageRef?: string;
  ciphertextSha256?: string;
  fileType?: string;
  fileSize?: number;
  gridFsFileId?: mongoose.Types.ObjectId;
  blockchainTxHash?: string;
  uploadedBy?: string;
  uploaderRole?: string;
  type?: string;
  isAsked?: string;
  isGiven?: string;
  aiAnalysis?: Record<string, unknown>;
  authorizedUsers?: string[];
  authorizedDoctors?: string[];
  reportDate?: Date;
  createdAt?: Date;
}

const HealthRecordSchema = new Schema<IHealthRecordDocument>({
  reportId: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  fileHash: { type: String, required: true, index: true },
  iv: { type: String, default: '' },
  authTag: { type: String, default: '' },
  wrappedKey: { type: String, default: '' },
  storageBackend: { type: String, default: '' },
  storageRef: { type: String, default: '' },
  ciphertextSha256: { type: String, default: '' },
  fileType: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  gridFsFileId: { type: Schema.Types.ObjectId, required: false },
  blockchainTxHash: { type: String, default: '' },
  uploadedBy: { type: String, default: '' },
  uploaderRole: { type: String, default: '' },
  type: { type: String, default: 'report' },
  isAsked: { type: String, default: '0' },
  isGiven: { type: String, default: '0' },
  aiAnalysis: { type: Schema.Types.Mixed, default: null },
  authorizedUsers: { type: [String], default: [] },
  authorizedDoctors: { type: [String], default: [] },
  reportDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

export const HealthRecord =
  mongoose.models.HealthRecord || mongoose.model<IHealthRecordDocument>('HealthRecord', HealthRecordSchema);

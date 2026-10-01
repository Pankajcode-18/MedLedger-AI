import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDocument extends Document {
  userId: string;
  email: string;
  role: string;
  name: string;
  phone?: string;
  walletAddress?: string;
  passwordHash: string;
  encryptionKey: string;
  passwordChangedAt?: Date;
  disabled?: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUserDocument>({
  userId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  role: {
    type: String,
    required: true,
    enum: ['patient', 'doctor', 'hospital-admin', 'hospital', 'lab', 'insurance', 'admin', 'system-admin']
  },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  walletAddress: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  encryptionKey: { type: String, required: true, trim: true },
  passwordChangedAt: { type: Date },
  disabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

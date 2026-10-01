import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationDocument extends Document {
  recipientId: string;
  senderId: string;
  type: string;
  message: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>({
  recipientId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  type: { type: String, default: 'access_request' },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

export const Notification =
  mongoose.models.Notification || mongoose.model<INotificationDocument>('Notification', NotificationSchema);

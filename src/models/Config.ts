import mongoose, { Schema, Document } from 'mongoose';

export interface IConfig extends Document {
  fromChatId: string;
  toChatId: string;
  userId: string;
  botToken?: string;
  createdAt: Date;
}

const ConfigSchema: Schema = new Schema({
  fromChatId: { type: String, required: true },
  toChatId: { type: String, required: true },
  userId: { type: String, required: true },
  botToken: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Create compound index for unique forwarding pairs
ConfigSchema.index({ fromChatId: 1, toChatId: 1 }, { unique: true });

export default mongoose.model<IConfig>('Config', ConfigSchema);


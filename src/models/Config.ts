import mongoose, { Schema, Document } from 'mongoose';

export interface IConfig extends Document {
  fromChatId: string;
  toChatIds: string[];
  userId: string;
  botToken?: string;
  createdAt: Date;
}

const ConfigSchema: Schema = new Schema({
  fromChatId: { type: String, required: true },
  toChatIds: { type: [String], required: true },
  userId: { type: String, required: true },
  botToken: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IConfig>('Config', ConfigSchema);

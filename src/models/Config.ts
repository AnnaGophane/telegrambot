import mongoose, { Schema } from 'mongoose';
import { IConfig } from '../types/config';

const configSchema = new Schema<IConfig>({
  botToken: { type: String, required: true },
  channelUsername: { type: String, required: true },
  chatId: { type: Schema.Types.Mixed }, // Add this line
});

export interface IConfig extends Document {
  sourceChatId: number;
  forwardToChats: number[];
  createdAt: Date;
  updatedAt: Date;
}

const ConfigSchema: Schema = new Schema({
  sourceChatId: { type: Number, required: true, unique: true },
  forwardToChats: { type: [Number], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Config = mongoose.model<IConfig>('Config', ConfigSchema);

// Keep the Log model as is
export interface ILog extends Document {
  action: string;
  userId: number;
  username: string;
  chatId: number;
  details: string;
  timestamp: Date;
}

const LogSchema: Schema = new Schema({
  action: { type: String, required: true },
  userId: { type: Number, required: true },
  username: { type: String },
  chatId: { type: Number, required: true },
  details: { type: String },
  timestamp: { type: Date, default: Date.now }
});

export const Log = mongoose.model<ILog>('Log', LogSchema);

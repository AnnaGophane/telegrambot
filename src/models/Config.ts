import mongoose, { Schema, Document } from 'mongoose';

export interface IConfig extends Document {
  sourceChatId: number;
  forwardToChats: number[];
}

export interface ILog extends Document {
  action: string;
  userId: number;
  username: string;
  chatId: number;
  details: string;
  timestamp: Date;
}

const configSchema = new Schema<IConfig>({
  sourceChatId: { type: Number, required: true },
  forwardToChats: { type: [Number], default: [] },
});

const logSchema = new Schema<ILog>({
  action: { type: String, required: true },
  userId: { type: Number, required: true },
  username: { type: String, required: true },
  chatId: { type: Number, required: true },
  details: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const Config = mongoose.model<IConfig>('Config', configSchema);
export const Log = mongoose.model<ILog>('Log', logSchema);

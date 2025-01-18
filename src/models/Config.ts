import mongoose, { Schema, Document } from 'mongoose';

export interface IConfig {
  botToken: string;
  channelUsername: string;
  chatId?: string | number;
  forwardToChats?: string[];
}

export interface ILog {
  message: string;
  timestamp: Date;
}

const configSchema = new Schema<IConfig>({
  botToken: { type: String, required: true },
  channelUsername: { type: String, required: true },
  chatId: { type: Schema.Types.Mixed },
  forwardToChats: { type: [String], default: [] },
});

const logSchema = new Schema<ILog>({
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const Config = mongoose.model<IConfig & Document>('Config', configSchema);
export const Log = mongoose.model<ILog & Document>('Log', logSchema);

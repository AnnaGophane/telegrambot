import mongoose, { Schema } from 'mongoose';
import { IConfig } from '../types/config';

const configSchema = new Schema<IConfig>({
  botToken: { type: String, required: true },
  channelUsername: { type: String, required: true },
  chatId: { type: Schema.Types.Mixed }, // Add this line
});

export const ConfigModel = mongoose.model<IConfig>('Config', configSchema);

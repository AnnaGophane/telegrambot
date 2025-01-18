import mongoose, { Schema, Document } from 'mongoose';

export interface IConfig extends Document {
  chatId: number;
  forwardTo: number;
}

const ConfigSchema: Schema = new Schema({
  chatId: { type: Number, required: true },
  forwardTo: { type: Number, required: true }
});

export const Config = mongoose.model<IConfig>('Config', ConfigSchema);

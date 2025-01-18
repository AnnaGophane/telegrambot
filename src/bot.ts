import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import { Config } from './models/Config';

const token = process.env.BOT_TOKEN || '';
export const bot = new TelegramBot(token, { polling: true });

export async function connectToMongoDB() {
  const mongoURI = process.env.MONGODB_URI || '';
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  try {
    // Your message handling logic here
    await bot.sendMessage(chatId, 'Received your message!');
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

import { bot, connectToMongoDB } from './bot';
import dotenv from 'dotenv';

dotenv.config();

async function startBot() {
  try {
    await connectToMongoDB();
    console.log('Bot is running...');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

startBot();

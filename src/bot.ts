import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import { Config, Log, ILog } from './models/Config';
// ... (keep other imports)

// ... (keep the rest of your bot.ts file as is)

// Update the logMessage function to use the correct type
async function logMessage(log: ILog) {
  try {
    await Log.create(log);
    console.log('Log saved successfully');
  } catch (error) {
    console.error('Error saving log:', error);
  }
}

// ... (keep the rest of your bot.ts file as is)

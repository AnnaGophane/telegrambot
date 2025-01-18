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

// Command handlers
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from?.first_name || 'there';
  
  const welcomeMessage = `
Hello ${username}! 👋

I'm an Auto Forward Bot. Here are my commands:

/start - Show this welcome message
/help - Show available commands
/setforward <chat_id> - Set a chat to forward messages to
/status - Check current forward settings
/stop - Stop forwarding messages

Need help? Use /help command for more information.
`;
  
  await bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
Available Commands:

/start - Start the bot and see welcome message
/help - Show this help message
/setforward <chat_id> - Set a chat to forward messages to
  Example: /setforward -1001234567890
/status - Check your current forward settings
/stop - Stop forwarding messages

How to use:
1. Add this bot to the source chat
2. Add this bot to the destination chat
3. Use /setforward with the destination chat ID
4. Messages will be automatically forwarded

Need the chat ID? Forward a message from the chat to @userinfobot
`;
  
  await bot.sendMessage(chatId, helpMessage);
});

bot.onText(/\/setforward (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const forwardTo = match ? parseInt(match[1]) : null;

  if (!forwardTo) {
    await bot.sendMessage(chatId, 'Please provide a valid chat ID.\nExample: /setforward -1001234567890');
    return;
  }

  try {
    await Config.findOneAndUpdate(
      { chatId },
      { chatId, forwardTo },
      { upsert: true }
    );
    await bot.sendMessage(chatId, `✅ Successfully set forwarding to chat ID: ${forwardTo}`);
  } catch (error) {
    console.error('Error setting forward:', error);
    await bot.sendMessage(chatId, '❌ Error setting forward configuration. Please try again.');
  }
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const config = await Config.findOne({ chatId });
    if (config) {
      await bot.sendMessage(chatId, `Current forward settings:\nForwarding to: ${config.forwardTo}`);
    } else {
      await bot.sendMessage(chatId, 'No forward settings configured.\nUse /setforward to set up message forwarding.');
    }
  } catch (error) {
    console.error('Error checking status:', error);
    await bot.sendMessage(chatId, '❌ Error checking status. Please try again.');
  }
});

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    await Config.findOneAndDelete({ chatId });
    await bot.sendMessage(chatId, '✅ Forwarding has been stopped.');
  } catch (error) {
    console.error('Error stopping forward:', error);
    await bot.sendMessage(chatId, '❌ Error stopping forward. Please try again.');
  }
});

// Handle regular messages for forwarding
bot.on('message', async (msg) => {
  // Skip if message is a command
  if (msg.text?.startsWith('/')) return;

  const chatId = msg.chat.id;
  try {
    const config = await Config.findOne({ chatId });
    if (config) {
      await bot.forwardMessage(config.forwardTo, chatId, msg.message_id);
    }
  } catch (error) {
    console.error('Error forwarding message:', error);
  }
});

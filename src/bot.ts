import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import { Config, Log, ILog } from './models/Config';

const token = process.env.BOT_TOKEN || '';
const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
const LOG_CHANNEL = process.env.LOG_CHANNEL || '';

const bot = new Telegraf(token);

// Helper function to check if user is owner
const isOwner = (userId: number): boolean => userId === OWNER_ID;

// Helper function to log actions to database and channel
async function logAction(logData: ILog) {
  try {
    await Log.create(logData);
    console.log('Log saved successfully');

    // Format message for channel
    const message = `
📝 Bot Action Log:
Action: ${logData.action}
User: ${logData.username} (ID: ${logData.userId})
Chat: ${logData.chatId}
Details: ${logData.details}
Time: ${new Date().toISOString()}
`;

    // Send to private channel
    await bot.telegram.sendMessage(LOG_CHANNEL, message);
  } catch (error) {
    console.error('Logging error:', error);
  }
}

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

// Bot commands and middleware setup
bot.command('start', async (ctx) => {
  const sourceChatId = ctx.chat.id;
  const username = ctx.from?.first_name || 'there';
  
  const welcomeMessage = `
Hello ${username}! 👋

I'm a Multi-Channel Auto Forward Bot. Here are my commands:

/start - Show this welcome message
/help - Show available commands
/setforward <chat_id1> <chat_id2> ... - Set chats to forward messages to
/addforward <chat_id> - Add a new chat to forward messages to
/removeforward <chat_id> - Remove a chat from forwarding list
/status - Check current forward settings
/stop - Stop all forwarding
/clone <source_chat_id> - Clone forwarding settings from another chat

Need help? Use /help command for more information.
`;
  
  await ctx.reply(welcomeMessage);
  
  await logAction({
    action: 'start',
    userId: ctx.from?.id || 0,
    username: ctx.from?.username || 'Unknown',
    chatId: sourceChatId,
    details: 'User started the bot'
  });
});

// ... (implement other command handlers similarly)

// Handle regular messages for forwarding
bot.on('message', async (ctx) => {
  // Skip if message is a command
  if (ctx.message.text?.startsWith('/')) return;

  const sourceChatId = ctx.chat.id;
  try {
    const config = await Config.findOne({ sourceChatId });
    if (config) {
      for (const forwardChatId of config.forwardToChats) {
        try {
          await ctx.forwardMessage(forwardChatId);
        } catch (error) {
          console.error(`Failed to forward to ${forwardChatId}:`, error);
        }
      }
      
      await logAction({
        action: 'forward',
        userId: ctx.from?.id || 0,
        username: ctx.from?.username || 'Unknown',
        chatId: sourceChatId,
        details: `Message forwarded to ${config.forwardToChats.length} chats`
      });
    }
  } catch (error) {
    console.error('Error forwarding message:', error);
  }
});

// Start the bot
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

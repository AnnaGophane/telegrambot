import { Telegraf, Context } from 'telegraf';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Config from './models/Config';

config();

const {
  BOT_TOKEN,
  API_ID,
  API_HASH,
  MONGODB_URI,
  APP_URL,
  PORT = 3000
} = process.env;

if (!BOT_TOKEN || !API_ID || !API_HASH || !MONGODB_URI) {
  throw new Error('Missing required environment variables!');
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const bot = new Telegraf(BOT_TOKEN);

if (APP_URL) {
  bot.telegram.setWebhook(`${APP_URL}/bot${BOT_TOKEN}`);
}

// Command handlers
bot.command('start', async (ctx) => {
  await ctx.reply(
    'Welcome to Auto Forwarder! 👋\n\n' +
    'Available commands:\n' +
    '/setforward <from_chat_id> <to_chat_id> - Setup forwarding\n' +
    '/stopforward - Stop forwarding\n' +
    '/status - Check current forwarding status\n' +
    '/listchats - List all chats where bot is admin'
  );
});

bot.command('setforward', async (ctx) => {
  if (!ctx.message || !ctx.from) {
    return ctx.reply('Error: Invalid command context');
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length !== 2) {
    return ctx.reply('Usage: /setforward <from_chat_id> <to_chat_id>');
  }

  const [fromChatId, toChatId] = args;
  const userId = ctx.from.id.toString();

  try {
    await ctx.telegram.getChat(fromChatId);
    await ctx.telegram.getChat(toChatId);

    await Config.create({
      fromChatId,
      toChatId,
      userId
    });

    await ctx.reply(
      `✅ Forwarding setup successfully!\n` +
      `From: ${fromChatId}\n` +
      `To: ${toChatId}`
    );
  } catch (error) {
    await ctx.reply(
      '❌ Error: Make sure the bot is admin in both chats and the chat IDs are correct!'
    );
  }
});

bot.command('stopforward', async (ctx) => {
  if (!ctx.chat || !ctx.from) {
    return ctx.reply('Error: Invalid command context');
  }

  const fromChatId = ctx.chat.id.toString();
  const userId = ctx.from.id.toString();

  try {
    const result = await Config.deleteMany({ fromChatId, userId });
    
    if (result.deletedCount > 0) {
      await ctx.reply('✅ Forwarding stopped successfully!');
    } else {
      await ctx.reply('❌ No active forwarding configuration found!');
    }
  } catch (error) {
    await ctx.reply('❌ Error stopping forward');
  }
});

bot.command('status', async (ctx) => {
  if (!ctx.from) {
    return ctx.reply('Error: Invalid command context');
  }

  const userId = ctx.from.id.toString();
  
  try {
    const configs = await Config.find({ userId });
    
    if (configs.length === 0) {
      return ctx.reply('❌ No active forwarding configurations');
    }

    const configList = configs
      .map(c => `From ${c.fromChatId} → To ${c.toChatId}`)
      .join('\n');

    await ctx.reply(
      '📊 Current forwarding configurations:\n\n' + configList
    );
  } catch (error) {
    await ctx.reply('❌ Error fetching status');
  }
});

bot.on('message', async (ctx) => {
  if (!ctx.message || !ctx.chat) {
    return;
  }

  const fromChatId = ctx.chat.id.toString();
  
  try {
    const configs = await Config.find({ fromChatId });
    
    if (configs.length > 0 && !('text' in ctx.message && ctx.message.text?.startsWith('/'))) {
      for (const config of configs) {
        try {
          await ctx.telegram.copyMessage(
            config.toChatId,
            fromChatId,
            ctx.message.message_id
          );
        } catch (error) {
          console.error(`Forwarding error to ${config.toChatId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error checking configurations:', error);
  }
});

bot.command('listchats', async (ctx) => {
  await ctx.reply(
    'To get chat IDs:\n' +
    '1. Add bot to your channels/groups as admin\n' +
    '2. Send a message in the chat\n' +
    '3. Forward that message to @RawDataBot\n' +
    '4. You\'ll see the chat ID in the forwarded message info'
  );
});

// Export the bot instance
export default bot;


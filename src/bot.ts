import { Telegraf, Context } from 'telegraf';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Config from './models/Config';

// Load environment variables
config();

const {
  BOT_TOKEN,
  API_ID,
  API_HASH,
  MONGODB_URI,
  APP_URL,
  PORT = 3000
} = process.env;

// Validate required environment variables
if (!BOT_TOKEN || !API_ID || !API_HASH || !MONGODB_URI) {
  throw new Error('Missing required environment variables!');
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const bot = new Telegraf(BOT_TOKEN);

// Set webhook for Heroku deployment
if (APP_URL) {
  bot.telegram.setWebhook(`${APP_URL}/bot${BOT_TOKEN}`);
}

// Function to create a new bot instance
function createBot(token: string): Telegraf<Context> {
  const newBot = new Telegraf(token);
  
  // Add all command handlers to the new bot
  newBot.command('start', handleStart);
  newBot.command('setforward', handleSetForward);
  newBot.command('stopforward', handleStopForward);
  newBot.command('status', handleStatus);
  newBot.command('listchats', handleListChats);
  newBot.on('message', handleMessage);

  return newBot;
}

// Command handlers
async function handleStart(ctx: Context) {
  await ctx.reply(
    'Welcome to Auto Forwarder! 👋\n\n' +
    'Available commands:\n' +
    '/setforward <from_chat_id> <to_chat_id> - Setup forwarding\n' +
    '/stopforward - Stop forwarding\n' +
    '/status - Check current forwarding status\n' +
    '/listchats - List all chats where bot is admin\n' +
    '/clonebot <new_bot_token> - Create a clone of this bot'
  );
}

async function handleSetForward(ctx: Context) {
  if ('text' in ctx.message) {
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
        userId,
        botToken: (ctx.telegram as any).token
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
  }
}

async function handleStopForward(ctx: Context) {
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
}

async function handleStatus(ctx: Context) {
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
}

async function handleListChats(ctx: Context) {
  await ctx.reply(
    'To get chat IDs:\n' +
    '1. Add bot to your channels/groups as admin\n' +
    '2. Send a message in the chat\n' +
    '3. Forward that message to @RawDataBot\n' +
    '4. You\'ll see the chat ID in the forwarded message info'
  );
}

async function handleMessage(ctx: Context) {
  if ('chat' in ctx.message) {
    const fromChatId = ctx.message.chat.id.toString();
    
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
  }
}

// Clone bot command handler
bot.command('clonebot', async (ctx) => {
  if ('text' in ctx.message) {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 1) {
      return ctx.reply('Usage: /clonebot <new_bot_token>');
    }

    const newBotToken = args[0];

    try {
      // Validate the new bot token
      const newBot = createBot(newBotToken);
      const me = await newBot.telegram.getMe();

      // Save the new bot token to the database
      await Config.create({
        fromChatId: 'clone',
        toChatId: 'clone',
        userId: ctx.from.id.toString(),
        botToken: newBotToken
      });

      await ctx.reply(`✅ Clone bot created successfully! @${me.username}`);
    } catch (error) {
      await ctx.reply('❌ Error creating clone bot. Please check the token and try again.');
    }
  }
});

// Add command handlers to the main bot
bot.command('start', handleStart);
bot.command('setforward', handleSetForward);
bot.command('stopforward', handleStopForward);
bot.command('status', handleStatus);
bot.command('listchats', handleListChats);
bot.on('message', handleMessage);

// Start all existing bots from the database
async function startAllBots() {
  const configs = await Config.find({ fromChatId: 'clone' });
  for (const config of configs) {
    if (config.botToken) {
      const cloneBot = createBot(config.botToken);
      cloneBot.launch();
      console.log(`Started clone bot: ${config.botToken}`);
    }
  }
}

export { bot, startAllBots };


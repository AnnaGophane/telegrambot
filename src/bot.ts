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

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const bot = new Telegraf(BOT_TOKEN);

if (APP_URL) {
  bot.telegram.setWebhook(`${APP_URL}/bot${BOT_TOKEN}`);
}

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Welcome to Auto Forwarder! 👋\n\n' +
    'Available commands:\n' +
    '/setforward <from_chat_id> <to_chat_id> - Setup forwarding to a single channel\n' +
    '/setmultiforward <from_chat_id> <to_chat_id1> <to_chat_id2> ... - Setup forwarding to multiple channels\n' +
    '/stopforward - Stop forwarding\n' +
    '/status - Check current forwarding status\n' +
    '/listchats - List all chats where bot is admin\n' +
    '/clonebot <new_bot_token> - Create a clone of this bot'
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

    await Config.findOneAndUpdate(
      { fromChatId, userId },
      { fromChatId, toChatIds: [toChatId], userId },
      { upsert: true, new: true }
    );

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

bot.command('setmultiforward', async (ctx) => {
  if (!ctx.message || !ctx.from) {
    return ctx.reply('Error: Invalid command context');
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) {
    return ctx.reply('Usage: /setmultiforward <from_chat_id> <to_chat_id1> <to_chat_id2> ...');
  }

  const [fromChatId, ...toChatIds] = args;
  const userId = ctx.from.id.toString();

  try {
    await ctx.telegram.getChat(fromChatId);
    for (const chatId of toChatIds) {
      await ctx.telegram.getChat(chatId);
    }

    await Config.findOneAndUpdate(
      { fromChatId, userId },
      { fromChatId, toChatIds, userId },
      { upsert: true, new: true }
    );

    await ctx.reply(
      `✅ Multi-channel forwarding setup successfully!\n` +
      `From: ${fromChatId}\n` +
      `To: ${toChatIds.join(', ')}`
    );
  } catch (error) {
    await ctx.reply(
      '❌ Error: Make sure the bot is admin in all chats and the chat IDs are correct!'
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
      .map(c => `From ${c.fromChatId} → To ${c.toChatIds.join(', ')}`)
      .join('\n');

    await ctx.reply(
      '📊 Current forwarding configurations:\n\n' + configList
    );
  } catch (error) {
    await ctx.reply('❌ Error fetching status');
  }
});

bot.on('channel_post', async (ctx) => {
  if (!ctx.channelPost) {
    return;
  }

  const fromChatId = ctx.channelPost.chat.id.toString();
  
  try {
    const configs = await Config.find({ fromChatId });
    
    if (configs.length > 0) {
      for (const config of configs) {
        for (const toChatId of config.toChatIds) {
          try {
            await ctx.telegram.copyMessage(
              toChatId,
              fromChatId,
              ctx.channelPost.message_id
            );
          } catch (error) {
            console.error(`Forwarding error to ${toChatId}:`, error);
          }
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

bot.command('clonebot', async (ctx) => {
  if (!ctx.message || !ctx.from) {
    return ctx.reply('Error: Invalid command context');
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length !== 1) {
    return ctx.reply(
      'Usage: /clonebot <new_bot_token>\n\n' +
      'To get a new bot token:\n' +
      '1. Message @BotFather\n' +
      '2. Use /newbot command\n' +
      '3. Follow instructions to create new bot\n' +
      '4. Copy and use the provided token'
    );
  }

  const newBotToken = args[0];

  try {
    // Validate the new bot token
    const tempBot = new Telegraf(newBotToken);
    const me = await tempBot.telegram.getMe();

    // Save the new bot token to the database
    await Config.create({
      fromChatId: 'clone',
      toChatIds: ['clone'],
      userId: ctx.from.id.toString(),
      botToken: newBotToken
    });

    await ctx.reply(
      `✅ Clone bot created successfully!\n` +
      `Bot username: @${me.username}\n\n` +
      `You can now use all commands with your new bot.`
    );

    // Start the new bot
    tempBot.start();
  } catch (error) {
    await ctx.reply(
      '❌ Error creating clone bot.\n' +
      'Please check if the token is valid and try again.\n\n' +
      'Make sure you\'re using a new token from @BotFather.'
    );
    console.error('Clone bot creation error:', error);
  }
});

export { bot, connectToMongoDB };

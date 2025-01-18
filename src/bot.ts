import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import { Config, Log, ILog } from './models/Config';

const token = process.env.BOT_TOKEN || '';
const OWNER_ID = parseInt(process.env.OWNER_ID || '0'); // Owner's Telegram User ID
const LOG_CHANNEL = process.env.LOG_CHANNEL || ''; // Private channel ID for logging

export const bot = new TelegramBot(token, { polling: true });

// Helper function to check if user is owner
const isOwner = (userId: number): boolean => userId === OWNER_ID;

// Helper function to log actions to database and channel
async function logAction(logData: Partial<ILog>) {
  try {
    // Save to database
    const log = new Log(logData);
    await log.save();

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
    await bot.sendMessage(LOG_CHANNEL, message);
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

// Owner only commands
bot.onText(/\/stats/, async (msg) => {
  const userId = msg.from?.id;
  const chatId = msg.chat.id;

  if (!userId || !isOwner(userId)) {
    await bot.sendMessage(chatId, '⚠️ This command is only available to the bot owner.');
    return;
  }

  try {
    const totalConfigs = await Config.countDocuments();
    const totalLogs = await Log.countDocuments();
    const recentLogs = await Log.find().sort({ timestamp: -1 }).limit(5);

    const statsMessage = `
📊 Bot Statistics:
Total Active Forwards: ${totalConfigs}
Total Actions Logged: ${totalLogs}

Recent Activities:
${recentLogs.map(log => `- ${log.action} by ${log.username || 'Unknown'}`).join('\n')}
`;

    await bot.sendMessage(chatId, statsMessage);
  } catch (error) {
    console.error('Error fetching stats:', error);
    await bot.sendMessage(chatId, '❌ Error fetching statistics.');
  }
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  const userId = msg.from?.id;
  const chatId = msg.chat.id;

  if (!userId || !isOwner(userId)) {
    await bot.sendMessage(chatId, '⚠️ This command is only available to the bot owner.');
    return;
  }

  if (!match) {
    await bot.sendMessage(chatId, 'Please provide a message to broadcast.');
    return;
  }

  const message = match[1];
  try {
    const configs = await Config.find();
    let sent = 0;
    
    for (const config of configs) {
      try {
        await bot.sendMessage(config.chatId, `📢 Broadcast Message:\n\n${message}`);
        sent++;
      } catch (error) {
        console.error(`Failed to send to ${config.chatId}:`, error);
      }
    }

    await bot.sendMessage(chatId, `✅ Broadcast sent to ${sent} chats.`);
    await logAction({
      action: 'broadcast',
      userId,
      username: msg.from?.username || 'Unknown',
      chatId,
      details: `Broadcast sent to ${sent} chats`
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    await bot.sendMessage(chatId, '❌ Error sending broadcast.');
  }
});

// Update existing command handlers to include logging
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from?.first_name || 'there';
  
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
  
  await bot.sendMessage(chatId, welcomeMessage);
  
  await logAction({
    action: 'start',
    userId: msg.from?.id || 0,
    username: msg.from?.username || 'Unknown',
    chatId,
    details: 'User started the bot'
  });
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
Available Commands:

/start - Start the bot and see welcome message
/help - Show this help message
/setforward <chat_id1> <chat_id2> ... - Set chats to forward messages to
  Example: /setforward -1001234567890 -1009876543210
/addforward <chat_id> - Add a new chat to forward messages to
  Example: /addforward -1001234567890
/removeforward <chat_id> - Remove a chat from forwarding list
  Example: /removeforward -1001234567890
/status - Check your current forward settings
/stop - Stop all forwarding
/clone <source_chat_id> - Clone forwarding settings from another chat
  Example: /clone -1001234567890

How to use:
1. Add this bot to the source channel
2. Add this bot to all destination channels
3. Use /setforward with the destination channel IDs
4. Messages will be automatically forwarded to all set channels

Need a chat ID? Forward a message from the chat to @userinfobot
`;
  
  await bot.sendMessage(chatId, helpMessage);
});

bot.onText(/\/setforward (.+)/, async (msg, match) => {
  const sourceChatId = msg.chat.id;
  const forwardToChats = match ? match[1].split(' ').map(id => parseInt(id.trim())) : [];

  if (forwardToChats.length === 0) {
    await bot.sendMessage(sourceChatId, 'Please provide at least one valid chat ID.\nExample: /setforward -1001234567890 -1009876543210');
    return;
  }

  try {
    await Config.findOneAndUpdate(
      { sourceChatId },
      { sourceChatId, forwardToChats },
      { upsert: true }
    );
    await bot.sendMessage(sourceChatId, `✅ Successfully set forwarding to ${forwardToChats.length} chats.`);
    
    await logAction({
      action: 'setforward',
      userId: msg.from?.id || 0,
      username: msg.from?.username || 'Unknown',
      chatId: sourceChatId,
      details: `Set forwarding to ${forwardToChats.join(', ')}`
    });
  } catch (error) {
    console.error('Error setting forward:', error);
    await bot.sendMessage(sourceChatId, '❌ Error setting forward configuration. Please try again.');
  }
});

bot.onText(/\/addforward (.+)/, async (msg, match) => {
  const sourceChatId = msg.chat.id;
  const newForwardChat = match ? parseInt(match[1]) : null;

  if (!newForwardChat) {
    await bot.sendMessage(sourceChatId, 'Please provide a valid chat ID.\nExample: /addforward -1001234567890');
    return;
  }

  try {
    const config = await Config.findOne({ sourceChatId });
    if (config) {
      if (!config.forwardToChats.includes(newForwardChat)) {
        config.forwardToChats.push(newForwardChat);
        await config.save();
        await bot.sendMessage(sourceChatId, `✅ Successfully added ${newForwardChat} to forwarding list.`);
      } else {
        await bot.sendMessage(sourceChatId, `⚠️ Chat ${newForwardChat} is already in the forwarding list.`);
      }
    } else {
      await Config.create({ sourceChatId, forwardToChats: [newForwardChat] });
      await bot.sendMessage(sourceChatId, `✅ Successfully set forwarding to ${newForwardChat}.`);
    }
    
    await logAction({
      action: 'addforward',
      userId: msg.from?.id || 0,
      username: msg.from?.username || 'Unknown',
      chatId: sourceChatId,
      details: `Added ${newForwardChat} to forwarding list`
    });
  } catch (error) {
    console.error('Error adding forward:', error);
    await bot.sendMessage(sourceChatId, '❌ Error updating forward configuration. Please try again.');
  }
});

bot.onText(/\/removeforward (.+)/, async (msg, match) => {
  const sourceChatId = msg.chat.id;
  const removeForwardChat = match ? parseInt(match[1]) : null;

  if (!removeForwardChat) {
    await bot.sendMessage(sourceChatId, 'Please provide a valid chat ID.\nExample: /removeforward -1001234567890');
    return;
  }

  try {
    const config = await Config.findOne({ sourceChatId });
    if (config) {
      const index = config.forwardToChats.indexOf(removeForwardChat);
      if (index > -1) {
        config.forwardToChats.splice(index, 1);
        await config.save();
        await bot.sendMessage(sourceChatId, `✅ Successfully removed ${removeForwardChat} from forwarding list.`);
      } else {
        await bot.sendMessage(sourceChatId, `⚠️ Chat ${removeForwardChat} is not in the forwarding list.`);
      }
    } else {
      await bot.sendMessage(sourceChatId, '⚠️ No forwarding configuration found for this chat.');
    }
    
    await logAction({
      action: 'removeforward',
      userId: msg.from?.id || 0,
      username: msg.from?.username || 'Unknown',
      chatId: sourceChatId,
      details: `Removed ${removeForwardChat} from forwarding list`
    });
  } catch (error) {
    console.error('Error removing forward:', error);
    await bot.sendMessage(sourceChatId, '❌ Error updating forward configuration. Please try again.');
  }
});

bot.onText(/\/status/, async (msg) => {
  const sourceChatId = msg.chat.id;
  
  try {
    const config = await Config.findOne({ sourceChatId });
    if (config) {
      const statusMessage = `
Current forward settings:
Forwarding to ${config.forwardToChats.length} chats:
${config.forwardToChats.join('\n')}
`;
      await bot.sendMessage(sourceChatId, statusMessage);
    } else {
      await bot.sendMessage(sourceChatId, 'No forward settings configured.\nUse /setforward to set up message forwarding.');
    }
  } catch (error) {
    console.error('Error checking status:', error);
    await bot.sendMessage(sourceChatId, '❌ Error checking status. Please try again.');
  }
});

bot.onText(/\/stop/, async (msg) => {
  const sourceChatId = msg.chat.id;
  
  try {
    await Config.findOneAndDelete({ sourceChatId });
    await bot.sendMessage(sourceChatId, '✅ Forwarding has been stopped for all channels.');
    
    await logAction({
      action: 'stop',
      userId: msg.from?.id || 0,
      username: msg.from?.username || 'Unknown',
      chatId: sourceChatId,
      details: 'Stopped all forwarding'
    });
  } catch (error) {
    console.error('Error stopping forward:', error);
    await bot.sendMessage(sourceChatId, '❌ Error stopping forward. Please try again.');
  }
});

// Add the new clone command
bot.onText(/\/clone (.+)/, async (msg, match) => {
  const targetChatId = msg.chat.id;
  const sourceChatId = match ? parseInt(match[1]) : null;

  if (!sourceChatId) {
    await bot.sendMessage(targetChatId, 'Please provide a valid source chat ID.\nExample: /clone -1001234567890');
    return;
  }

  try {
    const sourceConfig = await Config.findOne({ sourceChatId });
    if (sourceConfig) {
      await Config.findOneAndUpdate(
        { sourceChatId: targetChatId },
        { sourceChatId: targetChatId, forwardToChats: sourceConfig.forwardToChats },
        { upsert: true }
      );
      await bot.sendMessage(targetChatId, `✅ Successfully cloned forwarding settings from ${sourceChatId}.\nNow forwarding to ${sourceConfig.forwardToChats.length} chats.`);
      
      await logAction({
        action: 'clone',
        userId: msg.from?.id || 0,
        username: msg.from?.username || 'Unknown',
        chatId: targetChatId,
        details: `Cloned settings from ${sourceChatId}`
      });
    } else {
      await bot.sendMessage(targetChatId, `⚠️ No forwarding configuration found for chat ${sourceChatId}.`);
    }
  } catch (error) {
    console.error('Error cloning forward settings:', error);
    await bot.sendMessage(targetChatId, '❌ Error cloning forward configuration. Please try again.');
  }
});

// Handle regular messages for forwarding
bot.on('message', async (msg) => {
  // Skip if message is a command
  if (msg.text?.startsWith('/')) return;

  const sourceChatId = msg.chat.id;
  try {
    const config = await Config.findOne({ sourceChatId });
    if (config) {
      for (const forwardChatId of config.forwardToChats) {
        try {
          await bot.forwardMessage(forwardChatId, sourceChatId, msg.message_id);
        } catch (error) {
          console.error(`Failed to forward to ${forwardChatId}:`, error);
        }
      }
      
      await logAction({
        action: 'forward',
        userId: msg.from?.id || 0,
        username: msg.from?.username || 'Unknown',
        chatId: sourceChatId,
        details: `Message forwarded to ${config.forwardToChats.length} chats`
      });
    }
  } catch (error) {
    console.error('Error forwarding message:', error);
  }
});

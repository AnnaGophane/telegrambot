import TelegramBot from 'node-telegram-bot-api';

// Replace with your bot token
const token = process.env.BOT_TOKEN || '';
const bot = new TelegramBot(token, { polling: true });

// Example of a function that was causing the error
// Before: bot.sendMessage();
// After: bot.sendMessage(chatId, message);
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  // Always provide required arguments
  await bot.sendMessage(chatId, 'Received your message!');
});

// Error was likely in a similar function call
bot.on('callback_query', async (query) => {
  if (query.message) {
    const chatId = query.message.chat.id;
    // Fix: Always provide both chatId and message text
    await bot.sendMessage(chatId, 'Processing your request...');
  }
});

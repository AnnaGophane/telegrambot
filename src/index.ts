import { bot, startAllBots } from './bot';

// Start the main bot
bot.launch();

// Start all existing clone bots
startAllBots();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

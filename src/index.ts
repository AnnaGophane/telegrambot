import { bot, connectToMongoDB } from './bot';

const startBot = async () => {
  try {
    await connectToMongoDB();
    await bot.launch();
    console.log('Bot started successfully');
  } catch (error) {
    console.error('Error starting bot:', error);
    process.exit(1);
  }
};

startBot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

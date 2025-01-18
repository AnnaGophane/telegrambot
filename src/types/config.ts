export interface IConfig {
  _id?: string;
  botToken: string;
  channelUsername: string;
  chatId?: string | number; // Add this line
}

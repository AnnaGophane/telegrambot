export interface IConfig {
  _id?: string;
  botToken: string;
  channelUsername: string;
  chatId?: string | number;
  forwardToChats?: string[]; // Add this line
}

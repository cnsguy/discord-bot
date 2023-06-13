import { Module } from '../module';
import { Bot, BotEventNames } from '../bot';
import { Message } from 'discord.js';
import { TalkbotDatabase } from './talkbot/database';

export class TalkbotModule extends Module {
  private readonly database: TalkbotDatabase;

  private constructor(private readonly bot: Bot) {
    bot.on(BotEventNames.MessageCreate, (message) => void this.onMessageCreate(message));
    super();
    this.database = new TalkbotDatabase(this.bot.database);
    this.bot = bot;
  }

  public static load(bot: Bot): TalkbotModule {
    return new TalkbotModule(bot);
  }

  public async onMessageCreate(message: Message): Promise<void> {
    const id = this.bot.client.user?.id;

    if (id === undefined || message.content.search(`<@${id}>`) === -1) {
      return;
    }

    const newEntry = message.content.replaceAll(`<@${id}>`, '').trim();

    if (newEntry.length > 0) {
      await this.database.newEntry(newEntry, message.author.id);
    }

    const entry = await this.database.getRandomEntry();
    await message.reply(entry.quote);
  }
}

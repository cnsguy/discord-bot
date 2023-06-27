import { Module } from '../module';
import { Bot, BotEventNames } from '../bot';
import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandAttachmentOption,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { TalkbotDatabase } from './talkbot/database';
import { ManageGuild } from '../permission';

export class TalkbotModule extends Module {
  private readonly database: TalkbotDatabase;

  private constructor(private readonly bot: Bot) {
    super();

    const importSubcommand = new SlashCommandSubcommandBuilder()
      .setName('import')
      .setDescription('Import talkbot entries to the current guild')
      .addAttachmentOption(
        new SlashCommandAttachmentOption().setName('entries').setDescription('Talkbot entries').setRequired(true)
      );

    const talkbotCommand = new SlashCommandBuilder()
      .setName('talkbot')
      .setDescription('Talkbot commands')
      .addSubcommand(importSubcommand)
      .toJSON();

    bot.registerSlashCommand(talkbotCommand, (interaction) => this.talkbotCommand(interaction));
    bot.on(BotEventNames.MessageCreate, (message) => void this.onMessageCreate(message));
    this.database = new TalkbotDatabase(this.bot.database);
    this.bot = bot;
  }

  public static load(bot: Bot): TalkbotModule {
    return new TalkbotModule(bot);
  }

  public async talkbotImportSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await this.bot.checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const url = interaction.options.getAttachment('entries')!.url;
    const response = await fetch(url);
    const decoder = new TextDecoder('utf-8');

    if (response.status != 200) {
      await interaction.reply(`Failed to grab quotes from attachment; server returned error code ${response.status}`);
      return;
    }

    const content = decoder.decode(await response.arrayBuffer());
    let num = 0;

    for (const quote of content.split('\n')) {
      if (quote.length === 0) {
        continue;
      }

      await this.database.newEntry(quote, interaction.user.id, interaction.guildId);
      num += 1;
    }

    await interaction.reply(`Imported ${num} line(s).`);
  }

  public async talkbotCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case 'import':
        return this.talkbotImportSubcommand(interaction);
      default:
        throw new Error(`Invalid subcommand: ${subcommand}`);
    }
  }

  public async onMessageCreate(message: Message): Promise<void> {
    const id = this.bot.client.user?.id;

    if (id === undefined || message.content.search(`<@${id}>`) === -1) {
      return;
    }

    const newEntry = message.content.replaceAll(`<@${id}>`, '').trim();

    if (newEntry.length > 0) {
      await this.database.newEntry(newEntry, message.author.id, message.guildId);
    }

    const entry = await this.database.getRandomEntryForGuild(message.guildId);

    if (entry === undefined) {
      return;
    }

    await message.channel.send(entry.quote);
  }
}

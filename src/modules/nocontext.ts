import { Module } from '../module';
import { Bot } from '../bot';
import {
  ChatInputCommandInteraction,
  SlashCommandAttachmentOption,
  SlashCommandBuilder,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { NoContextDatabase } from './nocontext/database';
import { ManageGuild } from '../permission';

export class NoContextModule extends Module {
  private readonly database: NoContextDatabase;

  private constructor(private readonly bot: Bot) {
    super();

    const addSubcommand = new SlashCommandSubcommandBuilder()
      .setName('add')
      .setDescription('Add a no context quote')
      .addStringOption(
        new SlashCommandStringOption().setName('quote').setDescription('Quote to add').setRequired(true)
      );

    const quoteSubcommand = new SlashCommandSubcommandBuilder()
      .setName('quote')
      .setDescription('Show a no context quote');

    const importSubcommand = new SlashCommandSubcommandBuilder()
      .setName('import')
      .setDescription('Import no context quotes from a file')
      .addAttachmentOption(
        new SlashCommandAttachmentOption()
          .setName('quotes')
          .setDescription('Text file containing the quotes to add')
          .setRequired(true)
      );

    const nocoCommand = new SlashCommandBuilder()
      .setName('noco')
      .setDescription('No context commands')
      .addSubcommand(addSubcommand)
      .addSubcommand(quoteSubcommand)
      .addSubcommand(importSubcommand)
      .toJSON();

    bot.registerSlashCommand(nocoCommand, (interaction) => this.nocoCommand(interaction));
    this.bot = bot;
    this.database = new NoContextDatabase(this.bot.database);
  }

  public static load(bot: Bot): NoContextModule {
    return new NoContextModule(bot);
  }

  private async nocoAddSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.guildId === null) {
      await interaction.reply('This command is only available in a guild');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const quote = interaction.options.getString('quote')!;
    await this.database.newEntry(interaction.guildId, quote);
    await interaction.reply('Quote added.');
  }

  private async nocoQuoteSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.guildId === null) {
      await interaction.reply('This command is only available in a guild');
      return;
    }

    const entry = await this.database.getRandomEntry(interaction.guildId);

    if (entry !== undefined) {
      await interaction.reply(entry.quote);
    } else {
      await interaction.reply('No entries for this server.');
    }
  }

  private async nocoImportSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.guildId === null) {
      await interaction.reply('This command is only available in a guild');
      return;
    }

    if (!(await this.bot.checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const url = interaction.options.getAttachment('quotes')!.url;
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

      await this.database.newEntry(interaction.guildId, quote);
      num += 1;
    }

    await interaction.reply(`Imported ${num} quote(s).`);
  }

  private async nocoCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case 'add':
        return this.nocoAddSubcommand(interaction);
      case 'quote':
        return this.nocoQuoteSubcommand(interaction);
      case 'import':
        return this.nocoImportSubcommand(interaction);
      default:
        throw new Error(`Invalid subcommand: ${subcommand}`);
    }
  }
}

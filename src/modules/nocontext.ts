import { Module } from '../module';
import { Bot } from '../bot';
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { NoContextDatabase } from './nocontext/database';

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

    const nocoCommand = new SlashCommandBuilder()
      .setName('noco')
      .setDescription('No context commands')
      .addSubcommand(addSubcommand)
      .addSubcommand(quoteSubcommand)
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
    await this.database.newEntry(interaction.guildId, interaction.user.id, quote);
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

  private async nocoCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case 'add':
        return this.nocoAddSubcommand(interaction);
      case 'quote':
        return this.nocoQuoteSubcommand(interaction);
      default:
        throw new Error(`Invalid subcommand: ${subcommand}`);
    }
  }
}

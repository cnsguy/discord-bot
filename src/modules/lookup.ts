import { Module } from '../module';
import { Bot } from '../bot';
import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';

export class LookupModule extends Module {
  private constructor(private readonly bot: Bot) {
    super();

    const lookupCommand = new SlashCommandBuilder()
      .setName('lookup')
      .setDescription('Look up IPs associated with a domain name')
      .addStringOption(new SlashCommandStringOption().setName('domain').setDescription('Domain name'))
      .toJSON();

    const reverseLookupCommand = new SlashCommandBuilder()
      .setName('rlookup')
      .setDescription('Look up domain names associated with an IP address')
      .addStringOption(new SlashCommandStringOption().setName('ip').setDescription('IP address'))
      .toJSON();

    bot.registerSlashCommand(lookupCommand, (interaction) => this.lookupCommand(interaction));
    bot.registerSlashCommand(reverseLookupCommand, (interaction) => this.reverseLookupCommand(interaction));
    this.bot = bot;
  }

  public static load(bot: Bot): LookupModule {
    return new LookupModule(bot);
  }

  private async lookupCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply('NYI');
  }

  private async reverseLookupCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply('NYI');
  }
}

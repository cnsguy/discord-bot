import { Module } from '../module';
import { Bot } from '../bot';
import {
  SlashCommandBuilder,
  SlashCommandStringOption,
  ChatInputCommandInteraction,
  SlashCommandIntegerOption,
} from 'discord.js';

export class ChoiceModule extends Module {
  private constructor(bot: Bot) {
    super();

    const choiceCommand = new SlashCommandBuilder()
      .setName('choice')
      .setDescription('Choose a value from the listed choices, separated by the separator argument')
      .addStringOption(
        new SlashCommandStringOption()
          .setName('choices')
          .setDescription('The choices to choose between')
          .setRequired(true)
      )
      .addStringOption(
        new SlashCommandStringOption().setName('separator').setDescription('The separator to use (default: ,)')
      )
      .toJSON();

    bot.registerSlashCommand(choiceCommand, (interaction) => this.choiceCommand(interaction));

    const rollCommand = new SlashCommandBuilder()
      .setName('roll')
      .setDescription('Roll a random value from the specified range')
      .addIntegerOption(new SlashCommandIntegerOption().setName('min').setDescription('The minimum value (default: 0)'))
      .addIntegerOption(
        new SlashCommandIntegerOption().setName('max').setDescription('The maximum value (default: 100)')
      )
      .toJSON();

    bot.registerSlashCommand(rollCommand, (interaction) => this.rollCommand(interaction));
  }

  public static load(bot: Bot): ChoiceModule {
    return new ChoiceModule(bot);
  }

  private async choiceCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const separatorArg = interaction.options.getString('separator') ?? ',';
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const choiceArg = interaction.options.getString('choices')!.split(separatorArg);
    const index = Math.floor(Math.random() * choiceArg.length);
    await interaction.reply(choiceArg[index]);
  }

  private async rollCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    let max = interaction.options.getInteger('max') ?? 100;
    let min = interaction.options.getInteger('min') ?? 0;

    if (min > max) {
      [min, max] = [max, min];
    }

    const value = Math.round(Math.random() * (max - min)) + min;
    await interaction.reply(`You rolled ${value}`);
  }
}

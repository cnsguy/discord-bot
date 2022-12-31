import { Module } from '../module';
import { Bot } from '../bot';
import { ChatInputCommandInteraction } from 'discord.js';
import { Command, Option, CommandOptionType } from '../command';

export class ChoiceModule extends Module {
  private constructor(bot: Bot) {
    const choice = new Command(
      'choice',
      'Random choice between the listed options',
      [
        new Option('choices', 'Choices', CommandOptionType.String),
        new Option('separator', "Separator to split the choices with (default: ',')", CommandOptionType.String, false),
      ],
      async (interaction) => this.choiceCommand(interaction)
    );

    bot.registerCommandEntry(choice);
    super();
  }

  public static load(bot: Bot): ChoiceModule {
    return new ChoiceModule(bot);
  }

  private async choiceCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const choices = interaction.options.get('choices')!.value!.toString();
    const separator = interaction.options.get('separator')?.value?.toString() ?? ',';
    const split = choices.split(separator);
    const index = Math.floor(Math.random() * split.length);
    await interaction.reply(split[index]);
  }
}

import { Module } from '../module';
import { Bot } from '../bot';
import { Command, CommandInteraction } from '../command';

export class ChoiceModule extends Module {
  private constructor(bot: Bot) {
    bot.registerCommand(
      new Command('!choice', 'Random choice between the listed options', '<choices...>', 1, 2, (interaction) =>
        this.choiceCommand(interaction)
      )
    );

    bot.registerCommand(
      new Command('!roll', 'Roll a random value between the specified range', '<min> <max>', 2, 2, (interaction) =>
        this.rollCommand(interaction)
      )
    );

    super();
  }

  public static load(bot: Bot): ChoiceModule {
    return new ChoiceModule(bot);
  }

  private async choiceCommand(interaction: CommandInteraction): Promise<void> {
    const separator = interaction.args[1] ?? ',';
    const choices = interaction.args[0].split(separator);
    const index = Math.floor(Math.random() * choices.length);
    await interaction.reply(choices[index]);
  }

  private async rollCommand(interaction: CommandInteraction): Promise<void> {
    let min = Number(interaction.args[0]);

    if (Number.isNaN(min)) {
      await interaction.reply(`Invalid min: ${min}`);
      return;
    }

    let max = Number(interaction.args[1]);

    if (Number.isNaN(min)) {
      await interaction.reply(`Invalid max: ${max}`);
      return;
    }

    if (min > max) {
      [min, max] = [max, min];
    }

    const value = Math.round(Math.random() * (max - min)) + min;
    await interaction.reply(String(value));
  }
}

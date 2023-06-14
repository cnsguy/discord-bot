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
}

import { Module } from '../module';
import { Bot } from '../bot';
import { Command, CommandInteraction } from '../command';

export class ChoiceModule extends Module {
  private constructor(bot: Bot) {
    const choice = new Command(
      'choice',
      'Random choice between the listed options',
      '<choices...>',
      1,
      null,
      async (interaction) => this.choiceCommand(interaction)
    );

    bot.registerCommand(choice);
    super();
  }

  public static load(bot: Bot): ChoiceModule {
    return new ChoiceModule(bot);
  }

  private async choiceCommand(interaction: CommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const choices = interaction.args;
    const index = Math.floor(Math.random() * choices.length);
    await interaction.reply(choices[index]);
  }
}

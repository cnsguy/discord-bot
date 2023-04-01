import { Module } from '../module';
import { Command, CommandInteraction } from '../command';
import { Bot } from '../bot';

export class LookupModule extends Module {
  private constructor(private readonly bot: Bot) {
    super();
    this.bot = bot;
    this.bot.registerCommand(
      new Command('!lookup', 'Look up DNS info', '-', 0, 0, async (interaction) => this.lookupCommand(interaction))
    );
    this.bot.registerCommand(
      new Command('!rlookup', 'Look up reverse DNS info', '-', 0, 0, async (interaction) =>
        this.reverseLookupCommand(interaction)
      )
    );
  }

  public static load(bot: Bot): LookupModule {
    return new LookupModule(bot);
  }

  private async lookupCommand(interaction: CommandInteraction): Promise<void> {
    await interaction.reply('NYI');
  }

  private async reverseLookupCommand(interaction: CommandInteraction): Promise<void> {
    await interaction.reply('NYI');
  }
}

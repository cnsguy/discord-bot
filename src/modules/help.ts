import { Module } from '../module';
import { Command, CommandInteraction } from '../command';
import { Bot } from '../bot';
import { EmbedBuilder } from 'discord.js';
import { map, joinWith, stringFrom, pipe } from 'iter-tools';

function formatCommandHelp(command: Command): string {
  return `**${command.name}**: ${command.description}`;
}

export class HelpModule extends Module {
  private constructor(private readonly bot: Bot) {
    super();
    this.bot = bot;
    this.bot.registerCommand(
      new Command('help', 'Get help', '-', 0, 0, async (interaction) => this.helpCommand(interaction))
    );
  }

  public static load(bot: Bot): HelpModule {
    return new HelpModule(bot);
  }

  private async helpCommand(interaction: CommandInteraction): Promise<void> {
    const makeHelpText = pipe(
      map((entry: Command) => formatCommandHelp(entry)),
      joinWith('\n'),
      stringFrom
    );

    const helpText = makeHelpText(this.bot.commandMap.values());
    const embed = new EmbedBuilder().setDescription(helpText);
    await interaction.reply({ embeds: [embed] });
  }
}

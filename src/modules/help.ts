import { Module } from '../module';
import { Command, CommandInteraction } from '../command';
import { Bot } from '../bot';
import { EmbedBuilder } from 'discord.js';
import { map, joinWith, stringFrom, pipe } from 'iter-tools';

function formatCommandHelp(name: string, command: Command): string {
  return `**${name}**: ${command.description}`;
}

export class HelpModule extends Module {
  private constructor(private readonly bot: Bot) {
    super();
    this.bot = bot;
    this.bot.registerCommand(
      new Command('!mhelp', 'Get help', '-', 0, 0, async (interaction) => this.helpCommand(interaction))
    );
  }

  public static load(bot: Bot): HelpModule {
    return new HelpModule(bot);
  }

  private async helpCommand(interaction: CommandInteraction): Promise<void> {
    const makeHelpText = pipe(
      map((entry: [string, Command]) => formatCommandHelp(entry[0], entry[1])),
      joinWith('\n'),
      stringFrom
    );

    const helpText = makeHelpText(this.bot.commandMap.entries());
    const embed = new EmbedBuilder().setDescription(helpText);
    await interaction.reply({ embeds: [embed] });
  }
}

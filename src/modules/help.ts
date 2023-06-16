import { Module } from '../module';
import { Bot, SlashCommand } from '../bot';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { map, joinWith, stringFrom, pipe } from 'iter-tools';

function formatCommandHelp(entry: SlashCommand): string {
  return `**${entry.command.name}**: ${entry.command.description}`;
}

export class HelpModule extends Module {
  private constructor(private readonly bot: Bot) {
    super();
    const helpCommand = new SlashCommandBuilder().setName('help').setDescription('Get help').toJSON();
    bot.registerSlashCommand(helpCommand, (interaction) => this.helpCommand(interaction));
    this.bot = bot;
  }

  public static load(bot: Bot): HelpModule {
    return new HelpModule(bot);
  }

  private async helpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const makeHelpText = pipe(
      map((command: SlashCommand) => formatCommandHelp(command)),
      joinWith('\n'),
      stringFrom
    );

    const helpText = makeHelpText(this.bot.slashCommands.values());
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(helpText)] });
  }
}

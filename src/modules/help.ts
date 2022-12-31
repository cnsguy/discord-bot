import { Module } from '../module';
import { Command, CommandEntry, CommandGroup, GroupedCommandGroup } from '../command';
import { Bot } from '../bot';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { map, joinWith, stringFrom, pipe, arrayFrom } from 'iter-tools';

function formatCommandHelp(command: Command): string {
  return `**${command.name}**: ${command.description}`;
}

function formatCommandGroupHelp(group: CommandGroup): string[] {
  const transform = map((command: Command) => `**${group.name}** ${formatCommandHelp(command)}`);
  return arrayFrom(transform(group.commandMap.values()));
}

function formatGroupedCommandGroupHelp(group: GroupedCommandGroup): string[] {
  const transform = pipe(
    map((help: string) => `**${group.name}** ${help}`),
    joinWith('\n'),
    stringFrom
  );

  const transformGroup = pipe(
    map((group: CommandGroup) => transform(formatCommandGroupHelp(group))),
    arrayFrom
  );

  return transformGroup(group.commandGroupMap.values());
}

function formatCommandEntryHelp(entry: CommandEntry): string {
  if (entry instanceof Command) {
    return formatCommandHelp(entry);
  } else if (entry instanceof CommandGroup) {
    return formatCommandGroupHelp(entry).join('\n');
  } else {
    return formatGroupedCommandGroupHelp(entry).join('\n');
  }
}

export class HelpModule extends Module {
  private constructor(private readonly bot: Bot) {
    super();
    this.bot = bot;
    this.bot.registerCommandEntry(
      new Command('help', 'Get help', [], async (interaction) => this.helpCommand(interaction))
    );
  }

  public static load(bot: Bot): HelpModule {
    return new HelpModule(bot);
  }

  private async helpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const makeHelpText = pipe(
      map((entry: CommandEntry) => formatCommandEntryHelp(entry)),
      joinWith('\n'),
      stringFrom
    );

    const helpText = makeHelpText(this.bot.commandMap.values());
    const embed = new EmbedBuilder().setDescription(helpText);
    await interaction.reply({ embeds: [embed] });
  }
}

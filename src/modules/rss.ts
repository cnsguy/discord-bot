import { Module } from '../module';
import { Bot } from '../bot';
import { limitTextLength, escapeLinksForDiscord } from '../util';
import { RSSItemError, RSSItem } from './rss/item';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
  TextBasedChannel,
} from 'discord.js';
import { RSSDatabase } from './rss/database';
import { checkInteractionPermissions, ManageGuild } from '../permission';

function wrapRegexInCode(content: string): string {
  return '```' + content.replace('`', '\\`') + '```';
}

export class RSSModule extends Module {
  private readonly database: RSSDatabase;

  private constructor(private readonly bot: Bot) {
    const rssMonitorLinkCommand = new SlashCommandBuilder()
      .setName('rss-monitor-link')
      .setDescription('Monitor a link for RSS updates')
      .addStringOption(
        new SlashCommandStringOption().setName('link').setDescription('Link to monitor').setRequired(true)
      )
      .addStringOption(new SlashCommandStringOption().setName('title-regex').setDescription('Title regex'))
      .addStringOption(new SlashCommandStringOption().setName('content-regex').setDescription('Content regex'))
      .toJSON();

    const rssMonitorListCommand = new SlashCommandBuilder()
      .setName('rss-monitor-list')
      .setDescription('List all RSS links monitored in the current channel')
      .toJSON();

    const rssUnmonitorIdCommand = new SlashCommandBuilder()
      .setName('rss-unmonitor-id')
      .setDescription('Delete an RSS monitor entry from the database by ID')
      .addIntegerOption(new SlashCommandIntegerOption().setName('id').setDescription('ID to delete').setRequired(true))
      .toJSON();

    const rssUnmonitorAllCommand = new SlashCommandBuilder()
      .setName('rss-unmonitor-all')
      .setDescription('Delete all RSS monitor entries for the current channel')
      .toJSON();

    bot.registerSlashCommand(rssMonitorLinkCommand, (interaction) => this.rssMonitorLinkCommand(interaction));
    bot.registerSlashCommand(rssMonitorListCommand, (interaction) => this.rssMonitorListCommand(interaction));
    bot.registerSlashCommand(rssUnmonitorIdCommand, (interaction) => this.rssUnmonitorIdCommand(interaction));
    bot.registerSlashCommand(rssUnmonitorAllCommand, (interaction) => this.rssUnmonitorAllCommand(interaction));

    super();
    this.bot = bot;
    this.database = new RSSDatabase(this.bot.database);
    setInterval(() => void this.timerTick(), 30000);
  }

  public static load(bot: Bot): RSSModule {
    return new RSSModule(bot);
  }

  private async timerTick(): Promise<void> {
    try {
      const entries = await this.database.getEntries();

      for (const entry of entries) {
        const channel = await this.bot.client.channels.fetch(entry.channelId);

        if (channel === null || !channel.isTextBased()) {
          return;
        }

        let result: RSSItem[];

        try {
          result = await RSSItem.fromLink(entry.link);
        } catch (error) {
          if (!(error instanceof RSSItemError)) {
            throw error;
          }

          console.error(`Failed to get RSS feed from ${entry.link}: ${String(error)}`);
          return;
        }

        for (const item of result) {
          if (
            item.title !== null &&
            entry.titleRegex !== null &&
            !item.title.match(new RegExp(entry.titleRegex, 'i'))
          ) {
            continue;
          }

          if (
            item.content !== null &&
            entry.contentRegex !== null &&
            !item.content.match(new RegExp(entry.contentRegex, 'i'))
          ) {
            continue;
          }

          const sentEntry = await this.database.getSentEntry(entry.channelId, item.link);

          if (sentEntry !== undefined) {
            continue;
          }

          await this.database.newSentEntry(entry.channelId, item.link);
          await this.sendRSSItem(channel, item);
        }
      }
    } catch (error) {
      console.error(`Exception while fetching RSS entries: ${String(error)}`);
    }
  }

  private async sendRSSItem(channel: TextBasedChannel, item: RSSItem): Promise<void> {
    const builder = new EmbedBuilder();
    builder.setURL(item.link);

    if (item.title !== null) {
      builder.setTitle(item.title);
    } else {
      builder.setTitle('New entry');
    }

    if (item.content !== null) {
      const description = limitTextLength(escapeLinksForDiscord(item.content), 256, '...');
      builder.setDescription(description);
    }

    if (item.images.length > 0) {
      builder.setImage(item.images[0]);
    }

    if (item.author !== null) {
      builder.setAuthor({ name: item.author });
    }

    await channel.send({ embeds: [builder] });
  }

  private async rssMonitorLinkCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    if (interaction.channel === null) {
      await interaction.reply('This command is only available in a channel');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const link = interaction.options.getString('link')!;
    const titleRegex = interaction.options.getString('title-regex');
    const contentRegex = interaction.options.getString('content-regex');
    const entry = await this.database.getEntry(interaction.channelId, link, titleRegex, contentRegex);

    if (entry !== undefined) {
      await interaction.reply('An identical rss entry already exists.');
      return;
    }

    const entries = await this.database.getEntriesForChannel(interaction.channelId);

    if (entries.length >= 10) {
      await interaction.reply('Maximum 10 rss entries may exist for a single channel.');
      return;
    }

    try {
      await RSSItem.fromLink(link);
    } catch (error) {
      if (!(error instanceof RSSItemError)) {
        throw error;
      }

      await interaction.reply(`Could not get RSS feed from ${link} - recheck and try again.`);
      return;
    }

    await this.database.newEntry(interaction.channelId, link, titleRegex, contentRegex);
    await interaction.reply('Added.');
  }

  private async rssMonitorListCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.channel === null) {
      await interaction.reply('This command is only available in a channel');
      return;
    }

    const results = await this.database.getEntriesForChannel(interaction.channelId);

    if (results.length === 0) {
      await interaction.reply('There are no entries for this channel.');
      return;
    }

    const entries = results.map((entry, i) => {
      const builder = new EmbedBuilder()
        .addFields({ name: 'ID', value: String(i + 1) })
        .addFields({ name: 'Link', value: entry.link });

      if (entry.titleRegex !== null) {
        builder.addFields({ name: 'Title regex', value: wrapRegexInCode(entry.titleRegex) });
      }

      if (entry.contentRegex !== null) {
        builder.addFields({ name: 'Content regex', value: wrapRegexInCode(entry.contentRegex) });
      }

      return builder;
    });

    await interaction.reply({
      embeds: entries,
    });
  }

  private async rssUnmonitorIdCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    if (interaction.channel === null) {
      await interaction.reply('This command is only available in a channel');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const id = interaction.options.getInteger('id')!;
    const entries = await this.database.getEntriesForChannel(interaction.channelId);

    if (id > entries.length || id < 0) {
      await interaction.reply(`No entry with id ${id} exists.`);
      return;
    }

    await entries[id - 1].delete();
    await interaction.reply('Deleted.');
  }

  private async rssUnmonitorAllCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    if (interaction.channel === null) {
      await interaction.reply('This command is only available in a channel');
      return;
    }

    const entries = await this.database.getEntriesForChannel(interaction.channelId);

    if (entries.length == 0) {
      await interaction.reply('There are no entries for this channel.');
      return;
    }

    for (const entry of entries) {
      await entry.delete();
    }

    await interaction.reply('All entries removed.');
  }
}

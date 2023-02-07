import { Module } from '../module';
import { Bot } from '../bot';
import { limitTextLength, escapeLinksForDiscord } from '../util';
import { RSSItemError, RSSItem } from './rss/item';
import { Command, CommandInteraction } from '../command';
import { EmbedBuilder, TextBasedChannel } from 'discord.js';
import { RSSDatabase } from './rss/database';
import { checkInteractionPermissions, ManageGuild } from '../permission';

function wrapRegexInCode(content: string): string {
  return '```' + content.replace('`', '\\`') + '```';
}

export class RSSModule extends Module {
  private readonly database: RSSDatabase;

  private constructor(private readonly bot: Bot) {
    const rssMonitorLink = new Command(
      'rss-monitor-link',
      'Monitor a link for RSS updates',
      '<link> (<title>) (<content>)',
      1,
      3,
      async (interaction) => this.rssMonitorLinkCommand(interaction)
    );

    const rssMonitorList = new Command(
      'rss-monitor-list',
      'List all currently monitored RSS links in the current channel',
      '-',
      0,
      0,
      async (interaction) => this.rssMonitorListCommand(interaction)
    );

    const rssUnmonitorIds = new Command(
      'rss-unmonitor-ids',
      'Delete rss entries from the database',
      '<entries...>',
      1,
      null,
      async (interaction) => this.rssUnmonitorIdsCommand(interaction)
    );

    const rssUnmonitorAll = new Command(
      'rss-unmonitor-all',
      'Stop monitoring all links for RSS updates in the current channel',
      '-',
      0,
      0,
      async (interaction) => this.rssUnmonitorAllCommand(interaction)
    );

    super();
    this.bot = bot;
    this.database = new RSSDatabase(this.bot.database);

    this.bot.registerCommand(rssMonitorLink);
    this.bot.registerCommand(rssMonitorList);
    this.bot.registerCommand(rssUnmonitorIds);
    this.bot.registerCommand(rssUnmonitorAll);

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

  private async rssMonitorLinkCommand(interaction: CommandInteraction): Promise<void> {
    if (!(await checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    const link = interaction.args[0];
    const titleRegex = interaction.args[1];
    const contentRegex = interaction.args[2];
    const entry = await this.database.getEntry(interaction.channel.id, link, titleRegex, contentRegex);

    if (entry !== undefined) {
      await interaction.reply('An identical rss entry already exists.');
      return;
    }

    const entries = await this.database.getEntriesForChannel(interaction.channel.id);

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

    await this.database.newEntry(interaction.channel.id, link, titleRegex, contentRegex);
    await interaction.reply('Added.');
  }

  private async rssMonitorListCommand(interaction: CommandInteraction): Promise<void> {
    const results = await this.database.getEntriesForChannel(interaction.channel.id);

    if (results.length === 0) {
      await interaction.reply('There are no entries for this channel.');
      return;
    }

    const entries = results.map((entry, i) => {
      const id = i + 1;
      const builder = new EmbedBuilder();

      builder.addFields({ name: 'ID', value: String(id) });
      builder.addFields({ name: 'Link', value: entry.link });

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

  private async rssUnmonitorIdsCommand(interaction: CommandInteraction): Promise<void> {
    if (!(await checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    const ids = interaction.args;
    const entries = await this.database.getEntriesForChannel(interaction.channel.id);
    const selectedEntries = [];

    for (const idPart of ids) {
      const id = Number(idPart.trim());

      if (id < 1 || id > entries.length) {
        await interaction.reply(`Invalid ID: ${id}`);
        return;
      }

      const i = id - 1;
      selectedEntries.push(entries[i]);
    }

    for (const entry of selectedEntries) {
      await entry.delete();
    }

    await interaction.reply('Deleted.');
  }

  private async rssUnmonitorAllCommand(interaction: CommandInteraction): Promise<void> {
    if (!(await checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    const entries = await this.database.getEntriesForChannel(interaction.channel.id);

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

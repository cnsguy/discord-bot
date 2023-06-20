import { Module } from '../module';
import { Bot } from '../bot';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBooleanOption,
  SlashCommandBuilder,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  TextBasedChannel,
} from 'discord.js';
import { FourLeafDatabase, FourLeafMonitorEntry } from './fourleaf/database';
import { ManageGuild } from '../permission';
import { wrapRegexInCode } from '../util';
import { FourLeafPost, getNewPosts } from './fourleaf/post';

function shouldSendPost(entry: FourLeafMonitorEntry, post: FourLeafPost): boolean {
  if (entry.board != post.board) {
    return false;
  }

  if (entry.messageRegex !== null) {
    if (post.message === undefined || !post.message.match(new RegExp(entry.messageRegex, 'i'))) {
      return false;
    }
  }

  if (entry.nameRegex !== null) {
    if (post.name === undefined || !post.name.match(new RegExp(entry.nameRegex, 'i'))) {
      return false;
    }
  }

  if (entry.tripcodeRegex !== null) {
    if (post.trip === undefined || !post.trip.match(new RegExp(entry.tripcodeRegex, 'i'))) {
      return false;
    }
  }

  if (entry.filenameRegex !== null) {
    if (post.filename === undefined || !post.filename.match(new RegExp(entry.filenameRegex, 'i'))) {
      return false;
    }
  }

  if (entry.threadSubjectRegex !== null) {
    if (post.threadSubject === undefined || !post.threadSubject.match(new RegExp(entry.threadSubjectRegex, 'i'))) {
      return false;
    }
  }

  if (entry.minReplies !== null) {
    if (post.numReplies < entry.minReplies) {
      return false;
    }
  }

  if (entry.isOp !== null) {
    if (entry.isOp !== post.isOp) {
      return false;
    }
  }

  return true;
}

export class FourLeafModule extends Module {
  private readonly database: FourLeafDatabase;
  private running: boolean;

  private constructor(private readonly bot: Bot) {
    super();

    const addSubcommand = new SlashCommandSubcommandBuilder()
      .setName('add')
      .setDescription('Add a fourleaf monitor entry')
      .addStringOption(new SlashCommandStringOption().setName('board').setDescription('Board').setRequired(true))
      .addStringOption(new SlashCommandStringOption().setName('message-regex').setDescription('Message content regex'))
      .addStringOption(new SlashCommandStringOption().setName('name-regex').setDescription('Name regex'))
      .addStringOption(new SlashCommandStringOption().setName('tripcode-regex').setDescription('Tripcode regex'))
      .addStringOption(new SlashCommandStringOption().setName('filename-regex').setDescription('Filename regex'))
      .addBooleanOption(new SlashCommandBooleanOption().setName('is-op').setDescription('OP only'))
      .addStringOption(
        new SlashCommandStringOption().setName('thread-subject-regex').setDescription('Thread subject regex')
      )
      .addIntegerOption(
        new SlashCommandIntegerOption().setName('min-replies').setDescription('Minimum number of replies')
      );

    const listSubcommand = new SlashCommandSubcommandBuilder()
      .setName('list')
      .setDescription('List all fourleaf monitor entries in the current channel');

    const deleteIdSubcommand = new SlashCommandSubcommandBuilder()
      .setName('id')
      .setDescription('Delete fourleaf monitor entries from the database by ID')
      .addStringOption(new SlashCommandStringOption().setName('ids').setDescription('IDs to delete').setRequired(true));

    const deleteAllSubcommand = new SlashCommandSubcommandBuilder()
      .setName('all')
      .setDescription('Delete all fourleaf monitor entries for the current channel');

    const deleteSubcommandGroup = new SlashCommandSubcommandGroupBuilder()
      .setName('delete')
      .setDescription('Deletion commands')
      .addSubcommand(deleteIdSubcommand)
      .addSubcommand(deleteAllSubcommand);

    const fourleafCommand = new SlashCommandBuilder()
      .setName('fourleaf')
      .setDescription('FourLeaf commands')
      .addSubcommand(addSubcommand)
      .addSubcommand(listSubcommand)
      .addSubcommandGroup(deleteSubcommandGroup)
      .toJSON();

    bot.registerSlashCommand(fourleafCommand, (interaction) => this.fourleafCommand(interaction));
    this.bot = bot;
    this.database = new FourLeafDatabase(this.bot.database);
    this.running = false;
    setInterval(() => void this.timerTick(), 60000);
  }

  public static load(bot: Bot): FourLeafModule {
    return new FourLeafModule(bot);
  }

  private async timerTick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const entries = await this.database.getEntries();
      const posts = [];
      const boards = new Set(entries.map((entry) => entry.board));

      for (const board of boards) {
        for (const post of await getNewPosts(board)) {
          posts.push(post);
        }
      }

      for (const entry of entries) {
        const channel = await this.bot.client.channels.fetch(entry.channelId);

        if (channel === null || !channel.isTextBased()) {
          return;
        }

        for (const post of posts) {
          if (!shouldSendPost(entry, post)) {
            continue;
          }

          const sentEntry = await this.database.getSentEntry(entry.channelId, post.no);

          if (sentEntry !== undefined) {
            continue;
          }

          try {
            await this.database.newSentEntry(entry.channelId, post.no);
            await this.sendFourLeafPost(channel, post);
          } catch (error) {
            console.error(`Exception while sending a fourleaf entry: ${String(error)}`);
          }
        }
      }
    } catch (error) {
      console.error(`Exception while fetching fourleaf entries: ${String(error)}`);
    }

    this.running = false;
  }

  private async sendFourLeafPost(channel: TextBasedChannel, post: FourLeafPost): Promise<void> {
    await channel.send(`> ============ <${post.url}> ============`);

    if (post.fileUrl !== undefined) {
      await channel.send(post.fileUrl);
    }

    if (post.message !== undefined) {
      await channel.send(post.message);
    }
  }

  private async fourleafAddSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await this.bot.checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    if (interaction.channel === null) {
      await interaction.reply('This command is only available in a channel');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const board = interaction.options.getString('board')!;
    const messageRegex = interaction.options.getString('message-regex');
    const nameRegex = interaction.options.getString('name-regex');
    const tripcodeRegex = interaction.options.getString('tripcode-regex');
    const filenameRegex = interaction.options.getString('filename-regex');
    const threadSubjectRegex = interaction.options.getString('thread-subject-regex');
    const minReplies = interaction.options.getInteger('min-replies');
    const isOp = interaction.options.getBoolean('is-op');

    const entry = await this.database.getEntry(
      interaction.channelId,
      board,
      messageRegex,
      nameRegex,
      tripcodeRegex,
      filenameRegex,
      threadSubjectRegex,
      minReplies,
      isOp
    );

    if (entry !== undefined) {
      await interaction.reply('An identical fourleaf entry already exists.');
      return;
    }

    const entries = await this.database.getEntriesForChannel(interaction.channelId);

    if (entries.length >= 10) {
      await interaction.reply('Maximum 10 fourleaf entries may exist for a single channel.');
      return;
    }

    await this.database.newEntry(
      interaction.channelId,
      board,
      messageRegex,
      nameRegex,
      tripcodeRegex,
      filenameRegex,
      threadSubjectRegex,
      minReplies,
      isOp
    );

    await interaction.reply('Added.');
  }

  private async fourleafListSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
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
        .addFields({ name: 'Board', value: entry.board });

      if (entry.messageRegex !== null) {
        builder.addFields({ name: 'Message regex', value: wrapRegexInCode(entry.messageRegex) });
      }

      if (entry.nameRegex !== null) {
        builder.addFields({ name: 'Name regex', value: wrapRegexInCode(entry.nameRegex) });
      }

      if (entry.tripcodeRegex !== null) {
        builder.addFields({ name: 'Tripcode regex', value: wrapRegexInCode(entry.tripcodeRegex) });
      }

      if (entry.filenameRegex !== null) {
        builder.addFields({ name: 'Filename regex', value: wrapRegexInCode(entry.filenameRegex) });
      }

      if (entry.threadSubjectRegex !== null) {
        builder.addFields({ name: 'Thread subject regex', value: wrapRegexInCode(entry.threadSubjectRegex) });
      }

      if (entry.minReplies !== null) {
        builder.addFields({ name: 'Min replies', value: String(entry.minReplies) });
      }

      if (entry.isOp !== null) {
        builder.addFields({ name: 'Is OP', value: String(entry.isOp) });
      }

      return builder;
    });

    await interaction.reply({
      embeds: entries,
    });
  }

  private async fourleafDeleteIdSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await this.bot.checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    if (interaction.channel === null) {
      await interaction.reply('This command is only available in a channel');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ids = interaction.options.getString('ids')!.split(' ');
    const entries = await this.database.getEntriesForChannel(interaction.channelId);
    const toDelete = [];

    for (const idString of ids) {
      const id = Number(idString);

      if (Number.isNaN(id)) {
        await interaction.reply(`Invalid ID '${idString}'`);
        return;
      }

      if (id > entries.length || id < 0) {
        await interaction.reply(`No entry with id ${id} exists.`);
        return;
      }

      toDelete.push(entries[id - 1]);
    }

    for (const entry of toDelete) {
      await entry.delete();
    }

    await interaction.reply('Deleted.');
  }

  private async fourleafDeleteAllSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await this.bot.checkInteractionPermissions(interaction, [ManageGuild]))) {
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

  private async fourleafCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(true);
    const subcommandGroup = interaction.options.getSubcommandGroup();

    switch (subcommandGroup) {
      case null: {
        switch (subcommand) {
          case 'add':
            return this.fourleafAddSubcommand(interaction);
          case 'list':
            return this.fourleafListSubcommand(interaction);
          default:
            throw new Error(`Invalid subcommand: ${subcommand}`);
        }
      }
      case 'delete': {
        switch (subcommand) {
          case 'id':
            return this.fourleafDeleteIdSubcommand(interaction);
          case 'all':
            return this.fourleafDeleteAllSubcommand(interaction);
          default:
            throw new Error(`Invalid subcommand: ${subcommand}`);
        }
      }
    }
  }
}

import { Module } from '../module';
import { Bot } from '../bot';
import { NoteDatabase, NoteEntry } from './note/database';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandAttachmentOption,
  SlashCommandBuilder,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
  TextBasedChannel,
} from 'discord.js';
import { LimitedBuffer } from '../util';

const MaxNoteListMessageLength = 2000;

async function listNotes(channel: TextBasedChannel, entries: [number, NoteEntry][]): Promise<void> {
  const buffer = new LimitedBuffer(MaxNoteListMessageLength);

  for (const [id, entry] of entries) {
    const transformed = `**[${id}]** ${entry.note}\n`;

    if (!buffer.canWrite(transformed)) {
      await channel.send({ embeds: [new EmbedBuilder().setDescription(buffer.content)] });
      buffer.flush();
    }

    buffer.write(transformed);
  }

  // XXX i really need to think of some better way to do this
  if (buffer.content.length > 0) {
    await channel.send({ embeds: [new EmbedBuilder().setDescription(buffer.content)] });
  }
}

export class NoteModule extends Module {
  private readonly database: NoteDatabase;

  private constructor(private readonly bot: Bot) {
    super();
    const addSubcommand = new SlashCommandSubcommandBuilder()
      .setName('add')
      .setDescription('Add a note to your list')
      .addStringOption(new SlashCommandStringOption().setName('note').setDescription('Note to add').setRequired(true));

    const deleteSubcommand = new SlashCommandSubcommandBuilder()
      .setName('delete')
      .setDescription('Delete a note from your list')
      .addStringOption(new SlashCommandStringOption().setName('ids').setDescription('IDs to delete').setRequired(true));

    const listSubcommand = new SlashCommandSubcommandBuilder().setName('list').setDescription('List your notes');

    const searchSubcommand = new SlashCommandSubcommandBuilder()
      .setName('search')
      .setDescription('Search between your notes via regex')
      .addStringOption(
        new SlashCommandStringOption().setName('regex').setDescription('Search regex').setRequired(true)
      );

    const importSubcommand = new SlashCommandSubcommandBuilder()
      .setName('import')
      .setDescription('Import your notes from IRC')
      .addAttachmentOption(
        new SlashCommandAttachmentOption().setName('notes').setDescription('Notes to import').setRequired(true)
      );

    const noteCommand = new SlashCommandBuilder()
      .setName('note')
      .setDescription('Note commands')
      .addSubcommand(addSubcommand)
      .addSubcommand(deleteSubcommand)
      .addSubcommand(listSubcommand)
      .addSubcommand(searchSubcommand)
      .addSubcommand(importSubcommand)
      .toJSON();

    bot.registerSlashCommand(noteCommand, (interaction) => this.noteCommand(interaction));

    this.bot = bot;
    this.database = new NoteDatabase(this.bot.database);
  }

  public static load(bot: Bot): NoteModule {
    return new NoteModule(bot);
  }

  private async noteAddSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const note = interaction.options.getString('note')!;
    const id = await this.database.getNumEntriesForSenderInGuild(interaction.user.id);
    await this.database.newEntry(note, interaction.user.id);
    await interaction.reply(`**[${id}]** ${note}`);
  }

  private async noteListSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.channel === null) {
      await interaction.reply('This command is only available in a channel');
      return;
    }

    const entries = await this.database.getEntriesForSender(interaction.user.id);

    if (entries.length === 0) {
      await interaction.reply('No notes.');
      return;
    }

    await listNotes(
      interaction.channel,
      entries.map((entry, i) => [i + 1, entry])
    );
  }

  private async noteDeleteSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ids = interaction.options.getString('ids')!.split(' ');
    const entries = await this.database.getEntriesForSender(interaction.user.id);
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

  private async noteSearchSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.channel === null) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const regex = interaction.options.getString('regex')!;
    const entries = await this.database.getEntriesForSender(interaction.user.id);
    const zipped: [number, NoteEntry][] = entries.map((entry, i) => [i, entry]);
    const filtered = zipped.filter(([, entry]) => entry.note.match(new RegExp(regex, 'i')));
    await interaction.reply('Results:');
    await listNotes(interaction.channel, filtered);
  }

  private async noteImportSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const url = interaction.options.getAttachment('notes')!.url;
    const response = await fetch(url);
    const decoder = new TextDecoder('utf-8');

    if (response.status != 200) {
      await interaction.reply(`Failed to grab notes from attachment; server returned error code ${response.status}`);
      return;
    }

    const content = decoder.decode(await response.arrayBuffer());
    let num = 0;

    for (const note of content.split('\n')) {
      if (note.length === 0) {
        continue;
      }

      await this.database.newEntry(note, interaction.user.id);
      num += 1;
    }

    await interaction.reply(`Imported ${num} note(s).`);
  }

  private async noteCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case 'add':
        return this.noteAddSubcommand(interaction);
      case 'delete':
        return this.noteDeleteSubcommand(interaction);
      case 'list':
        return this.noteListSubcommand(interaction);
      case 'search':
        return this.noteSearchSubcommand(interaction);
      case 'import':
        return this.noteImportSubcommand(interaction);
      default:
        throw new Error(`Invalid subcommand: ${subcommand}`);
    }
  }
}

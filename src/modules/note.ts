import { Module } from '../module';
import { Bot } from '../bot';
import { NoteDatabase, NoteEntry } from './note/database';
import {
  ChatInputCommandInteraction,
  SlashCommandAttachmentOption,
  SlashCommandBuilder,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
  TextBasedChannel,
} from 'discord.js';
import { LimitedBuffer } from '../util';

const MaxNoteListMessageLength = 2000;

async function listNotes(channel: TextBasedChannel, entries: [number, NoteEntry][]): Promise<void> {
  const buffer = new LimitedBuffer(MaxNoteListMessageLength);

  for (let i = 0; i < entries.length; ++i) {
    const [id, entry] = entries[i];
    const transformed = `**[${id}]** ${entry.note}\n`;

    if (!buffer.canWrite(transformed)) {
      await channel.send(buffer.content);
      buffer.flush();
    }

    buffer.write(transformed);
  }

  if (buffer.content.length > 0) {
    await channel.send(buffer.content);
  }
}

export class NoteModule extends Module {
  private readonly database: NoteDatabase;

  private constructor(private readonly bot: Bot) {
    const noteAddCommand = new SlashCommandBuilder()
      .setName('note-add')
      .setDescription('Add a note to your list')
      .addStringOption(new SlashCommandStringOption().setName('note').setDescription('Note to add').setRequired(true))
      .toJSON();

    const noteDeleteCommand = new SlashCommandBuilder()
      .setName('note-delete')
      .setDescription('Delete a note from your list')
      .addIntegerOption(
        new SlashCommandIntegerOption().setName('id').setDescription('ID of note to delete').setRequired(true)
      )
      .toJSON();

    const noteListCommand = new SlashCommandBuilder().setName('note-list').setDescription('List your notes').toJSON();

    const noteSearchCommand = new SlashCommandBuilder()
      .setName('note-search')
      .setDescription('Search between your notes via regex')
      .addStringOption(new SlashCommandStringOption().setName('regex').setDescription('Search regex').setRequired(true))
      .toJSON();

    const noteImportCommand = new SlashCommandBuilder()
      .setName('note-import')
      .setDescription('Import your notes from IRC')
      .addAttachmentOption(
        new SlashCommandAttachmentOption().setName('notes').setDescription('Notes to import').setRequired(true)
      )
      .toJSON();

    bot.registerSlashCommand(noteAddCommand, (interaction) => this.noteAddCommand(interaction));
    bot.registerSlashCommand(noteDeleteCommand, (interaction) => this.noteDeleteCommand(interaction));
    bot.registerSlashCommand(noteListCommand, (interaction) => this.noteListCommand(interaction));
    bot.registerSlashCommand(noteSearchCommand, (interaction) => this.noteSearchCommand(interaction));
    bot.registerSlashCommand(noteImportCommand, (interaction) => this.noteImportCommand(interaction));

    super();
    this.bot = bot;
    this.database = new NoteDatabase(this.bot.database);
  }

  public static load(bot: Bot): NoteModule {
    return new NoteModule(bot);
  }

  private async noteAddCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const note = interaction.options.getString('note')!;
    const id = await this.database.getNumEntriesForSenderInGuild(interaction.user.id);
    await this.database.newEntry(note, interaction.user.id);
    await interaction.reply(`**[${id}]** ${note}`);
  }

  private async noteListCommand(interaction: ChatInputCommandInteraction): Promise<void> {
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

  private async noteDeleteCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const id = interaction.options.getInteger('id')!;
    const entries = await this.database.getEntriesForSender(interaction.user.id);

    if (id > entries.length || id < 0) {
      await interaction.reply(`No entry with id ${id} exists.`);
      return;
    }

    await entries[id - 1].delete();
    await interaction.reply('Deleted.');
  }

  private async noteSearchCommand(interaction: ChatInputCommandInteraction): Promise<void> {
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

  private async noteImportCommand(interaction: ChatInputCommandInteraction): Promise<void> {
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
      const match = note.match(/^\[\d+\]\[\d+ \d+\] (.*)\s*$/);

      if (match === null || match[1] === undefined) {
        continue;
      }

      await this.database.newEntry(match[1], interaction.user.id);
      num += 1;
    }

    await interaction.reply(`Imported ${num} note(s).`);
  }
}

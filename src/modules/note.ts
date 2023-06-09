import { Module } from '../module';
import { Bot } from '../bot';
import { NoteDatabase, NoteEntry } from './note/database';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
  TextBasedChannel,
} from 'discord.js';
import { LimitedBuffer } from '../util';

const MaxNoteListMessageLength = 2000;

async function sendEmbed(channel: TextBasedChannel | null, message: string): Promise<void> {
  if (channel === null) {
    return;
  }

  const embed = new EmbedBuilder();
  embed.setDescription(message);
  await channel.send({ embeds: [embed] });
}

async function listNotes(channel: TextBasedChannel, entries: NoteEntry[]): Promise<void> {
  const buffer = new LimitedBuffer(MaxNoteListMessageLength);

  // XXX FIXME badish
  for (let i = 0; i < entries.length; ++i) {
    const entry = entries[i];
    const id = i + 1;
    const transformed = `**[${id}]** ${entry.note}\n`;

    if (!buffer.canWrite(transformed)) {
      await sendEmbed(channel, buffer.content);
      buffer.flush();
    }

    buffer.write(transformed);
  }

  // XXX FIXME bad
  if (buffer.content.length > 0) {
    await sendEmbed(channel, buffer.content);
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
      .addIntegerOption(
        new SlashCommandIntegerOption().setName('regex').setDescription('Search regex').setRequired(true)
      )
      .toJSON();

    bot.registerSlashCommand(noteAddCommand, (interaction) => this.noteAddCommand(interaction));
    bot.registerSlashCommand(noteDeleteCommand, (interaction) => this.noteDeleteCommand(interaction));
    bot.registerSlashCommand(noteListCommand, (interaction) => this.noteListCommand(interaction));
    bot.registerSlashCommand(noteSearchCommand, (interaction) => this.noteSearchCommand(interaction));

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
    await this.database.newEntry(note, interaction.guild?.id ?? null, interaction.user.id);
    await interaction.reply('Note added.');
  }

  private async noteListCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.channel === null) {
      await interaction.reply('This command is only available in a channel');
      return;
    }

    const entries = await this.database.getEntriesForSenderInGuild(interaction.user.id, interaction.guildId);

    if (entries.length === 0) {
      await interaction.reply('No notes.');
      return;
    }

    await interaction.reply('Notes:');
    await listNotes(interaction.channel, entries);
  }

  private async noteDeleteCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const id = interaction.options.getInteger('id')!;
    const entries = await this.database.getEntriesForSenderInGuild(interaction.user.id, interaction.guildId);

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
    const entries = await this.database.getEntriesForSenderInGuild(interaction.user.id, interaction.guild?.id ?? null);
    const filtered = entries.filter((entry) => entry.note.match(new RegExp(regex, 'i')));
    await interaction.reply('Results:');
    await listNotes(interaction.channel, filtered);
  }
}

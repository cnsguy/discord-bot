import { Module } from '../module';
import { Bot } from '../bot';
import { Command, CommandGroup, Option, CommandOptionType } from '../command';
import { NoteDatabase, NoteEntry } from './note/database';
import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  EmbedBuilder,
  TextBasedChannel,
} from 'discord.js';
import { LimitedBuffer } from '../util';
import { ModalEntry } from '../modal';

const MaxNoteLength = 500;
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
    const noteAdd = new Command('add', 'Add a note to your list', [], async (interaction) =>
      this.noteAddCommand(interaction)
    );

    const noteList = new Command('list', 'List your notes', [], async (interaction) =>
      this.noteListCommand(interaction)
    );

    const noteDelete = new Command(
      'delete',
      'Delete the specified notes by IDs',
      [new Option('ids', 'Note IDs, separated by a comma', CommandOptionType.String)],
      async (interaction) => this.noteDeleteCommand(interaction)
    );

    const noteSearch = new Command(
      'search',
      'Search for a given pattern in your notes',
      [new Option('pattern', 'Search pattern', CommandOptionType.String)],
      async (interaction) => this.noteSearchCommand(interaction)
    );

    super();
    this.bot = bot;
    this.database = new NoteDatabase(this.bot.database);
    this.bot.registerCommandEntry(
      new CommandGroup('note', 'Note commands', [noteAdd, noteList, noteDelete, noteSearch])
    );
    this.bot.registerModalEntry(new ModalEntry('note', async (interaction) => this.noteModalSubmit(interaction)));
  }

  public static load(bot: Bot): NoteModule {
    return new NoteModule(bot);
  }

  private async noteModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const note = interaction.fields.getTextInputValue('note');
    await this.database.newEntry(note, interaction.guildId, interaction.user.id);
    await interaction.reply('Note added.');
  }

  private async noteAddCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const modal = new ModalBuilder().setCustomId('note').setTitle('Note');
    const noteInput = new TextInputBuilder()
      .setCustomId('note')
      .setLabel('Note content')
      .setMaxLength(MaxNoteLength)
      .setStyle(TextInputStyle.Paragraph);

    const noteRow = new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput);
    modal.addComponents([noteRow]);
    await interaction.showModal(modal);
  }

  private async noteListCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.channel === null) {
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
    const ids = interaction.options.get('ids')!.value!.toString();
    const entries = await this.database.getEntriesForSenderInGuild(interaction.user.id, interaction.guildId);
    const selectedEntries = [];

    for (const idPart of ids.split(',')) {
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

  private async noteSearchCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.channel === null) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const pattern = interaction.options.get('pattern')!.value!.toString();
    const entries = await this.database.getEntriesForSenderInGuild(interaction.user.id, interaction.guildId);
    const filtered = entries.filter((entry) => entry.note.match(new RegExp(pattern, 'i')));
    await interaction.reply('Results:');
    await listNotes(interaction.channel, filtered);
  }
}

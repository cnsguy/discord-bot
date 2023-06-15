import { Module } from '../module';
import { Bot } from '../bot';
import { Command, CommandInteraction } from '../command';
import { NoteDatabase, NoteEntry } from './note/database';
import { TextBasedChannel } from 'discord.js';
import { LimitedBuffer } from '../util';

const MaxNoteListMessageLength = 2000;

async function listNotes(channel: TextBasedChannel, entries: NoteEntry[]): Promise<void> {
  const buffer = new LimitedBuffer(MaxNoteListMessageLength);

  for (let i = 0; i < entries.length; ++i) {
    const entry = entries[i];
    const id = i + 1;
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
    bot.registerCommand(
      new Command('n/n+', 'Add a note to your list', '<note>', 1, 1, (interaction) => this.noteAddCommand(interaction))
    );

    bot.registerCommand(
      new Command('n/nl', 'List your notes', '-', 0, 0, (interaction) => this.noteListCommand(interaction))
    );

    bot.registerCommand(
      new Command('n/n-', 'Delete the specified notes by IDs', '<ids...>', 1, null, (interaction) =>
        this.noteDeleteCommand(interaction)
      )
    );

    bot.registerCommand(
      new Command('n/n?', 'Search for a given pattern in your notes', '<pattern>', 1, 1, (interaction) =>
        this.noteSearchCommand(interaction)
      )
    );

    super();
    this.bot = bot;
    this.database = new NoteDatabase(this.bot.database);
  }

  public static load(bot: Bot): NoteModule {
    return new NoteModule(bot);
  }

  private async noteAddCommand(interaction: CommandInteraction): Promise<void> {
    const note = interaction.args[0];
    await this.database.newEntry(note, interaction.user.id);
    const id = await this.database.getNumEntriesForSenderInGuild(interaction.user.id);
    await interaction.reply(`**[${id}]** ${note}`);
  }

  private async noteListCommand(interaction: CommandInteraction): Promise<void> {
    if (interaction.channel === null) {
      return;
    }

    const entries = await this.database.getEntriesForSender(interaction.user.id);

    if (entries.length === 0) {
      await interaction.reply('No notes.');
      return;
    }

    await interaction.reply('Notes:');
    await listNotes(interaction.channel, entries);
  }

  private async noteDeleteCommand(interaction: CommandInteraction): Promise<void> {
    const ids = interaction.args;
    const entries = await this.database.getEntriesForSender(interaction.user.id);
    const selectedEntries: [number, NoteEntry][] = [];

    for (const idPart of ids) {
      const trimmedIdPart = idPart.trim();
      const id = Number(trimmedIdPart);

      if (Number.isNaN(id) || id < 1 || id > entries.length) {
        await interaction.reply(`Invalid ID: ${trimmedIdPart}`);
        return;
      }

      const i = id - 1;
      selectedEntries.push([id, entries[i]]);
    }

    for (const [id, entry] of selectedEntries) {
      await interaction.reply(`[${id}] ${entry.note}`);
      await entry.delete();
    }
  }

  private async noteSearchCommand(interaction: CommandInteraction): Promise<void> {
    if (interaction.channel === null) {
      return;
    }

    const pattern = interaction.args[0];
    const entries = await this.database.getEntriesForSender(interaction.user.id);
    const filtered = entries.filter((entry) => entry.note.match(new RegExp(pattern, 'i')));
    await listNotes(interaction.channel, filtered);
  }
}

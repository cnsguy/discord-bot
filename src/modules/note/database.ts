import { Database } from 'sqlite';

export class NoteDatabaseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface RawNoteEntry {
  readonly id: number;
  readonly note: string;
  readonly guildId: string | null;
  readonly senderId: string;
}

interface RawNoteCountEntry {
  readonly count: number;
}

export class NoteEntry {
  public constructor(
    public readonly id: number,
    public readonly note: string,
    public readonly guildId: string | null,
    public readonly senderId: string,
    private readonly database: Database
  ) {
    this.id = id;
    this.note = note;
    this.guildId = guildId;
    this.senderId = senderId;
    this.database = database;
  }

  public async delete(): Promise<void> {
    await this.database.run('DELETE FROM note WHERE id = ?', this.id);
  }
}

function processRawNoteEntry(database: Database, entry: RawNoteEntry): NoteEntry {
  return new NoteEntry(entry.id, entry.note, entry.guildId, entry.senderId, database);
}

export class NoteDatabase {
  public constructor(private readonly database: Database) {
    this.database = database;
  }

  public async newEntry(messageContent: string, guildId: string | null, senderId: string): Promise<void> {
    await this.database.run(
      'INSERT INTO note (note, guildId, senderId) VALUES (?, ?, ?)',
      messageContent,
      guildId,
      senderId
    );
  }

  public async getNumEntriesForSenderInGuild(senderId: string, guildId: string | null): Promise<number> {
    const raw: RawNoteCountEntry | undefined = await this.database.get(
      'SELECT COUNT(1) AS count FROM note WHERE senderId = ? AND guildId IS ?',
      senderId,
      guildId
    );

    return raw !== undefined ? raw.count : 0;
  }

  public async getEntriesForSenderInGuild(senderId: string, guildId: string | null): Promise<NoteEntry[]> {
    const raws: RawNoteEntry[] = await this.database.all(
      'SELECT * FROM note WHERE senderId = ? AND guildId IS ?',
      senderId,
      guildId
    );

    return raws.map((entry) => processRawNoteEntry(this.database, entry));
  }

  public async getEntries(): Promise<NoteEntry[]> {
    const raws: RawNoteEntry[] = await this.database.all('SELECT * FROM note');
    return raws.map((entry) => processRawNoteEntry(this.database, entry));
  }

  public async getEntryById(id: number): Promise<NoteEntry | undefined> {
    const raw: RawNoteEntry | undefined = await this.database.get('SELECT * FROM note WHERE id = ?', id);
    return raw !== undefined ? processRawNoteEntry(this.database, raw) : undefined;
  }
}

import { Database } from 'sqlite';

export class NoContextDatabaseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface RawNoContextEntry {
  readonly id: number;
  readonly guildId: string;
  readonly quote: string;
}

export class NoContextEntry {
  public constructor(
    public readonly id: number,
    public readonly guildId: string,
    public readonly quote: string,
    private readonly database: Database
  ) {
    this.id = id;
    this.guildId = guildId;
    this.quote = quote;
    this.database = database;
  }

  public async delete(): Promise<void> {
    await this.database.run('DELETE FROM nocontext WHERE id = ?', this.id);
  }
}

function processRawNoContextEntry(database: Database, entry: RawNoContextEntry): NoContextEntry {
  return new NoContextEntry(entry.id, entry.guildId, entry.quote, database);
}

export class NoContextDatabase {
  public constructor(private readonly database: Database) {
    this.database = database;
  }

  public async newEntry(guildId: string, quote: string): Promise<void> {
    await this.database.run('INSERT OR IGNORE INTO nocontext (guildId, quote) VALUES (?, ?)', guildId, quote);
  }

  public async getRandomEntry(guildId: string): Promise<NoContextEntry | undefined> {
    const raw: RawNoContextEntry | undefined = await this.database.get(
      'SELECT * FROM nocontext WHERE guildId = ? ORDER BY RANDOM() LIMIT 1',
      guildId
    );

    return raw !== undefined ? processRawNoContextEntry(this.database, raw) : undefined;
  }
}

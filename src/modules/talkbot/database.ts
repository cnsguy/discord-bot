import { Database } from 'sqlite';

export class TalkbotDatabaseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface RawContentEntry {
  readonly id: number;
  readonly guildId: string;
  readonly userId: string;
  readonly quote: string;
}

class ContentEntry {
  public constructor(public readonly quote: string) {
    this.quote = quote;
  }
}

export class TalkbotDatabase {
  public constructor(private readonly database: Database) {
    this.database = database;
  }

  public async getRandomEntryForGuild(guildId: string | null): Promise<ContentEntry | undefined> {
    const raw: RawContentEntry | undefined = await this.database.get(
      'SELECT * FROM talkbot WHERE guildId IS ? ORDER BY RANDOM() LIMIT 1',
      guildId
    );

    return raw !== undefined ? new ContentEntry(raw.quote) : undefined;
  }

  public async newEntry(quote: string, userId: string, guildId: string | null): Promise<void> {
    await this.database.run(
      'INSERT OR IGNORE INTO talkbot (userId, guildId, quote) VALUES (?, ?, ?)',
      userId,
      guildId,
      quote
    );
  }
}

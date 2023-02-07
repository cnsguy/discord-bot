import { Database } from 'sqlite';

export class TalkbotDatabaseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface RawContentEntry {
  readonly id: number;
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

  public async getRandomEntry(): Promise<ContentEntry> {
    const raw: RawContentEntry | undefined = await this.database.get('SELECT * FROM talkbot ORDER BY RANDOM() LIMIT 1');

    if (raw === undefined) {
      throw new TalkbotDatabaseError('Failed to get a quote from the talkbot table');
    }

    return new ContentEntry(raw.quote);
  }

  public async newEntry(quote: string, userId: string): Promise<void> {
    await this.database.run('INSERT OR IGNORE INTO talkbot (userId, quote) VALUES (?, ?)', userId, quote);
  }
}

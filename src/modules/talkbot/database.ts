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

interface RawContentEntryId {
  readonly id: number;
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
    const raw: RawContentEntry | undefined = await this.database.get(
      'SELECT * FROM talkbot_content ORDER BY RANDOM() LIMIT 1'
    );

    if (raw === undefined) {
      throw new TalkbotDatabaseError('Failed to get a quote from the talkbot_content table');
    }

    return new ContentEntry(raw.quote);
  }

  public async newEntry(quote: string, userId: string): Promise<void> {
    await this.database.run('INSERT OR IGNORE INTO talkbot_content (quote) VALUES (?)', quote);
    const rawId: RawContentEntryId | undefined = await this.database.get(
      'SELECT id FROM talkbot_content WHERE quote = ?',
      quote
    );

    if (rawId === undefined) {
      throw new TalkbotDatabaseError('newEntry: rawId was undefined');
    }

    await this.database.run(
      'INSERT OR IGNORE INTO talkbot_discord (contentId, userId) VALUES (?, ?)',
      rawId.id,
      userId
    );
  }
}

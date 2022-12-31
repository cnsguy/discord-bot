import { Database } from 'sqlite';

export class RSSDatabaseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface RawRSSEntry {
  readonly id: number;
  readonly channelId: string;
  readonly link: string;
  readonly titleRegex: string | null;
  readonly contentRegex: string | null;
}

interface RSSRawSentEntry {
  readonly id: number;
  readonly channelId: string;
  readonly link: string;
}

class RSSMonitorEntry {
  public constructor(
    public readonly id: number,
    public readonly channelId: string,
    public readonly link: string,
    public readonly titleRegex: string | null,
    public readonly contentRegex: string | null,
    private readonly database: Database
  ) {
    this.id = id;
    this.channelId = channelId;
    this.link = link;
    this.titleRegex = titleRegex;
    this.contentRegex = contentRegex;
    this.database = database;
  }

  public async delete(): Promise<void> {
    await this.database.run('DELETE FROM rss_monitor WHERE id = ?', this.id);
  }
}

class RSSSentEntry {
  public constructor(
    public readonly id: number,
    public readonly channelId: string,
    public readonly link: string,
    private readonly database: Database
  ) {
    this.id = id;
    this.channelId = channelId;
    this.link = link;
    this.database = database;
  }
}

function processRawEntry(database: Database, entry: RawRSSEntry): RSSMonitorEntry {
  return new RSSMonitorEntry(entry.id, entry.channelId, entry.link, entry.titleRegex, entry.contentRegex, database);
}

function processRawSentEntry(database: Database, entry: RSSRawSentEntry): RSSSentEntry {
  return new RSSSentEntry(entry.id, entry.channelId, entry.link, database);
}

export class RSSDatabase {
  public constructor(private readonly database: Database) {
    this.database = database;
  }

  public async newEntry(
    channelId: string,
    link: string,
    titleRegex: string | null,
    contentRegex: string | null
  ): Promise<void> {
    await this.database.run(
      'INSERT INTO rss_monitor (channelId, link, titleRegex, contentRegex) VALUES (?, ?, ?, ?)',
      channelId,
      link,
      titleRegex,
      contentRegex
    );
  }

  public async getEntry(
    channelId: string,
    link: string,
    titleRegex: string | null,
    contentRegex: string | null
  ): Promise<RSSMonitorEntry | undefined> {
    const raw: RawRSSEntry | undefined = await this.database.get(
      'SELECT * FROM rss_monitor WHERE channelId = ? AND link = ? AND titleRegex IS ? AND contentRegex IS ? LIMIT 1',
      channelId,
      link,
      titleRegex,
      contentRegex
    );

    return raw !== undefined ? processRawEntry(this.database, raw) : undefined;
  }

  public async getEntryById(id: number): Promise<RSSMonitorEntry | undefined> {
    const raw: RawRSSEntry | undefined = await this.database.get('SELECT * FROM rss_monitor WHERE id = ?', id);
    return raw !== undefined ? processRawEntry(this.database, raw) : undefined;
  }

  public async getEntries(): Promise<RSSMonitorEntry[]> {
    const raws: RawRSSEntry[] = await this.database.all('SELECT * FROM rss_monitor');
    return raws.map((entry) => processRawEntry(this.database, entry));
  }

  public async getEntriesForChannel(channelId: string): Promise<RSSMonitorEntry[]> {
    const raws: RawRSSEntry[] = await this.database.all('SELECT * FROM rss_monitor WHERE channelId = ?', [channelId]);
    return raws.map((entry) => processRawEntry(this.database, entry));
  }

  public async getSentEntry(channelId: string, link: string): Promise<RSSSentEntry | undefined> {
    const raw: RSSRawSentEntry | undefined = await this.database.get(
      'SELECT * FROM rss_sent WHERE channelId = ? AND link = ? LIMIT 1',
      channelId,
      link
    );

    return raw !== undefined ? processRawSentEntry(this.database, raw) : undefined;
  }

  public async newSentEntry(channelId: string, link: string): Promise<void> {
    await this.database.run('INSERT INTO rss_sent (channelId, link) VALUES (?, ?)', channelId, link);
  }
}

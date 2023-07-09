import { Database } from 'sqlite';

export class DateDatabaseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface RawDateEntry {
  readonly id: number;
  readonly messageContent: string;
  readonly guildId: string | null;
  readonly channelId: string;
  readonly senderId: string;
  readonly nextDate: string;
  readonly repeatInterval: string | null;
}

class DateEntry {
  public constructor(
    public readonly id: number,
    public readonly messageContent: string,
    public readonly guildId: string | null,
    public readonly channelId: string,
    public readonly senderId: string,
    private nextDate: Date,
    public readonly repeatInterval: Date | null,
    private readonly database: Database
  ) {
    this.id = id;
    this.messageContent = messageContent;
    this.guildId = guildId;
    this.channelId = channelId;
    this.senderId = senderId;
    this.nextDate = nextDate;
    this.repeatInterval = repeatInterval;
    this.database = database;
  }

  public get getNextDate(): Date {
    return this.nextDate;
  }

  public async setNextDate(date: Date): Promise<void> {
    this.nextDate = date;
    await this.database.run('UPDATE date SET nextDate = ? WHERE id = ?', this.getNextDate.toISOString(), this.id);
  }

  public async delete(): Promise<void> {
    await this.database.run('DELETE FROM date WHERE id = ?', this.id);
  }
}

function processRawDateEntry(database: Database, entry: RawDateEntry): DateEntry {
  return new DateEntry(
    entry.id,
    entry.messageContent,
    entry.guildId,
    entry.channelId,
    entry.senderId,
    new Date(entry.nextDate),
    entry.repeatInterval ? new Date(entry.repeatInterval) : null,
    database
  );
}

export class ReminderDatabase {
  public constructor(private readonly database: Database) {
    this.database = database;
  }

  public async newEntry(
    messageContent: string,
    guildId: string | null,
    channelId: string,
    senderId: string,
    nextDate: Date,
    repeatInterval: Date | null
  ): Promise<void> {
    await this.database.run(
      'INSERT INTO date (messageContent, guildId, channelId, senderId, nextDate, repeatInterval) VALUES (?, ?, ?, ?, ?, ?)',
      messageContent,
      guildId,
      channelId,
      senderId,
      nextDate.toISOString(),
      repeatInterval ? repeatInterval.toISOString() : null
    );
  }

  public async getEntries(): Promise<DateEntry[]> {
    const raws: RawDateEntry[] = await this.database.all('SELECT * FROM date');
    return raws.map((entry) => processRawDateEntry(this.database, entry));
  }

  public async getEntriesForSenderInGuild(senderId: string, guildId: string | null): Promise<DateEntry[]> {
    const raws: RawDateEntry[] = await this.database.all(
      'SELECT * FROM date WHERE senderId = ? AND guildId IS ?',
      senderId,
      guildId
    );

    return raws.map((entry) => processRawDateEntry(this.database, entry));
  }
}

import { Database } from 'sqlite';

export class ReminderDatabaseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface RawReminderEntry {
  readonly id: number;
  readonly messageContent: string;
  readonly guildId: string | null;
  readonly channelId: string;
  readonly senderId: string;
  readonly nextDate: string;
  readonly repeatInterval: string | null;
}

class ReminderEntry {
  public constructor(
    public readonly id: number,
    public readonly messageContent: string,
    public readonly guildId: string | null,
    public readonly channelId: string,
    public readonly senderId: string,
    private innerNextDate: Date,
    public readonly repeatInterval: Date | null,
    private readonly database: Database
  ) {
    this.id = id;
    this.messageContent = messageContent;
    this.guildId = guildId;
    this.channelId = channelId;
    this.senderId = senderId;
    this.innerNextDate = innerNextDate;
    this.repeatInterval = repeatInterval;
    this.database = database;
  }

  public get nextDate(): Date {
    return this.innerNextDate;
  }

  public async setNextDate(date: Date): Promise<void> {
    this.innerNextDate = date;
    await this.database.run('UPDATE reminder SET nextDate = ? WHERE id = ?', this.nextDate.toISOString(), this.id);
  }

  public async delete(): Promise<void> {
    await this.database.run('DELETE FROM reminder WHERE id = ?', this.id);
  }
}

function processRawReminderEntry(database: Database, entry: RawReminderEntry): ReminderEntry {
  return new ReminderEntry(
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
      'INSERT INTO reminder (messageContent, guildId, channelId, senderId, nextDate, repeatInterval) VALUES (?, ?, ?, ?, ?, ?)',
      messageContent,
      guildId,
      channelId,
      senderId,
      nextDate.toISOString(),
      repeatInterval ? repeatInterval.toISOString() : null
    );
  }

  public async getEntries(): Promise<ReminderEntry[]> {
    const raws: RawReminderEntry[] = await this.database.all('SELECT * FROM reminder');
    return raws.map((entry) => processRawReminderEntry(this.database, entry));
  }

  public async getEntriesForSenderInGuild(senderId: string, guildId: string | null): Promise<ReminderEntry[]> {
    const raws: RawReminderEntry[] = await this.database.all(
      'SELECT * FROM reminder WHERE senderId = ? AND guildId IS ?',
      senderId,
      guildId
    );

    return raws.map((entry) => processRawReminderEntry(this.database, entry));
  }
}

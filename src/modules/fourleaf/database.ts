import { Database } from 'sqlite';

export class FourLeafDatabaseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface RawFourLeafEntry {
  readonly id: number;
  readonly channelId: string;
  readonly board: string;
  readonly messageRegex: string | null;
  readonly messageRegexIgnoreCase: number | null;
  readonly nameRegex: string | null;
  readonly nameRegexIgnoreCase: number | null;
  readonly tripcodeRegex: string | null;
  readonly tripcodeRegexIgnoreCase: number | null;
  readonly filenameRegex: string | null;
  readonly filenameRegexIgnoreCase: number | null;
  readonly threadSubjectRegex: string | null;
  readonly threadSubjectRegexIgnoreCase: number | null;
  readonly minThreadReplies: number | null;
  readonly isOp: number | null;
  readonly extraText: string | null;
}

interface FourLeafRawSentEntry {
  readonly id: number;
  readonly channelId: string;
  readonly postNumber: number;
}

export class FourLeafMonitorEntry {
  public constructor(
    public readonly id: number,
    public readonly channelId: string,
    public readonly board: string,
    public readonly messageRegex: string | null,
    public readonly messageRegexIgnoreCase: boolean | null,
    public readonly nameRegex: string | null,
    public readonly nameRegexIgnoreCase: boolean | null,
    public readonly tripcodeRegex: string | null,
    public readonly tripcodeRegexIgnoreCase: boolean | null,
    public readonly filenameRegex: string | null,
    public readonly filenameRegexIgnoreCase: boolean | null,
    public readonly threadSubjectRegex: string | null,
    public readonly threadSubjectRegexIgnoreCase: boolean | null,
    public readonly minThreadReplies: number | null,
    public readonly isOp: boolean | null,
    public readonly extraText: string | null,
    private readonly database: Database
  ) {
    this.id = id;
    this.channelId = channelId;
    this.board = board;
    this.messageRegex = messageRegex;
    this.messageRegexIgnoreCase = messageRegexIgnoreCase;
    this.nameRegex = nameRegex;
    this.nameRegexIgnoreCase = nameRegexIgnoreCase;
    this.tripcodeRegex = tripcodeRegex;
    this.tripcodeRegexIgnoreCase = tripcodeRegexIgnoreCase;
    this.filenameRegex = filenameRegex;
    this.filenameRegexIgnoreCase = filenameRegexIgnoreCase;
    this.threadSubjectRegex = threadSubjectRegex;
    this.threadSubjectRegexIgnoreCase = threadSubjectRegexIgnoreCase;
    this.minThreadReplies = minThreadReplies;
    this.isOp = isOp;
    this.extraText = extraText;
    this.database = database;
  }

  public async delete(): Promise<void> {
    await this.database.run('DELETE FROM fourleaf_monitor WHERE id = ?', this.id);
  }
}

class FourLeafSentEntry {
  public constructor(
    public readonly id: number,
    public readonly channelId: string,
    public readonly postNumber: number,
    private readonly database: Database
  ) {
    this.id = id;
    this.channelId = channelId;
    this.postNumber = postNumber;
    this.database = database;
  }
}

function processRawEntry(database: Database, entry: RawFourLeafEntry): FourLeafMonitorEntry {
  return new FourLeafMonitorEntry(
    entry.id,
    entry.channelId,
    entry.board,
    entry.messageRegex,
    entry.messageRegexIgnoreCase === 1,
    entry.nameRegex,
    entry.nameRegexIgnoreCase === 1,
    entry.tripcodeRegex,
    entry.tripcodeRegexIgnoreCase === 1,
    entry.filenameRegex,
    entry.filenameRegexIgnoreCase === 1,
    entry.threadSubjectRegex,
    entry.threadSubjectRegexIgnoreCase === 1,
    entry.minThreadReplies,
    entry.isOp !== null ? entry.isOp === 1 : null,
    entry.extraText,
    database
  );
}

function processRawSentEntry(database: Database, entry: FourLeafRawSentEntry): FourLeafSentEntry {
  return new FourLeafSentEntry(entry.id, entry.channelId, entry.postNumber, database);
}

export class FourLeafDatabase {
  public constructor(private readonly database: Database) {
    this.database = database;
  }

  public async newEntry(
    channelId: string,
    board: string,
    messageRegex: string | null,
    messageRegexIgnoreCase: boolean | null,
    nameRegex: string | null,
    nameRegexIgnoreCase: boolean | null,
    tripcodeRegex: string | null,
    tripcodeRegexIgnoreCase: boolean | null,
    filenameRegex: string | null,
    filenameRegexIgnoreCase: boolean | null,
    threadSubjectRegex: string | null,
    threadSubjectRegexIgnoreCase: boolean | null,
    minThreadReplies: number | null,
    isOp: boolean | null,
    extraText: string | null
  ): Promise<void> {
    await this.database.run(
      'INSERT INTO fourleaf_monitor (' +
        'channelId, ' +
        'board, ' +
        'messageRegex, ' +
        'messageRegexIgnoreCase, ' +
        'nameRegex, ' +
        'nameRegexIgnoreCase, ' +
        'tripcodeRegex, ' +
        'tripcodeRegexIgnoreCase, ' +
        'filenameRegex, ' +
        'filenameRegexIgnoreCase, ' +
        'threadSubjectRegex, ' +
        'threadSubjectRegexIgnoreCase, ' +
        'minThreadReplies, ' +
        'isOp, ' +
        'extraText ' +
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      channelId,
      board,
      messageRegex,
      messageRegexIgnoreCase,
      nameRegex,
      nameRegexIgnoreCase,
      tripcodeRegex,
      tripcodeRegexIgnoreCase,
      filenameRegex,
      filenameRegexIgnoreCase,
      threadSubjectRegex,
      threadSubjectRegexIgnoreCase,
      minThreadReplies,
      isOp,
      extraText
    );
  }

  public async getEntry(
    channelId: string,
    board: string,
    messageRegex: string | null,
    messageRegexIgnoreCase: boolean | null,
    nameRegex: string | null,
    nameRegexIgnoreCase: boolean | null,
    tripcodeRegex: string | null,
    tripcodeRegexIgnoreCase: boolean | null,
    filenameRegex: string | null,
    filenameRegexIgnoreCase: boolean | null,
    threadSubjectRegex: string | null,
    threadSubjectRegexIgnoreCase: boolean | null,
    minThreadReplies: number | null,
    isOp: boolean | null,
    extraText: string | null
  ): Promise<FourLeafMonitorEntry | undefined> {
    const raw: RawFourLeafEntry | undefined = await this.database.get(
      'SELECT * FROM fourleaf_monitor WHERE ' +
        'channelId = ? ' +
        'AND board = ? ' +
        'AND messageRegex IS ? ' +
        'AND messageRegexIgnoreCase = ? ' +
        'AND nameRegex IS ? ' +
        'AND nameRegexIgnoreCase = ? ' +
        'AND tripcodeRegex IS ? ' +
        'AND tripcodeRegexIgnoreCase = ? ' +
        'AND filenameRegex IS ? ' +
        'AND filenameRegexIgnoreCase = ? ' +
        'AND threadSubjectRegex IS ? ' +
        'AND threadSubjectRegexIgnoreCase = ? ' +
        'AND minThreadReplies IS ? ' +
        'AND isOp IS ? ' +
        'AND extraText IS ? ' +
        'LIMIT 1',
      channelId,
      board,
      messageRegex,
      messageRegexIgnoreCase,
      nameRegex,
      nameRegexIgnoreCase,
      tripcodeRegex,
      tripcodeRegexIgnoreCase,
      filenameRegex,
      filenameRegexIgnoreCase,
      threadSubjectRegex,
      threadSubjectRegexIgnoreCase,
      minThreadReplies,
      isOp,
      extraText
    );

    return raw !== undefined ? processRawEntry(this.database, raw) : undefined;
  }

  public async getEntryById(id: number): Promise<FourLeafMonitorEntry | undefined> {
    const raw: RawFourLeafEntry | undefined = await this.database.get(
      'SELECT * FROM fourleaf_monitor WHERE id = ?',
      id
    );
    return raw !== undefined ? processRawEntry(this.database, raw) : undefined;
  }

  public async getEntries(): Promise<FourLeafMonitorEntry[]> {
    const raws: RawFourLeafEntry[] = await this.database.all('SELECT * FROM fourleaf_monitor');
    return raws.map((entry) => processRawEntry(this.database, entry));
  }

  public async getEntriesForChannel(channelId: string): Promise<FourLeafMonitorEntry[]> {
    const raws: RawFourLeafEntry[] = await this.database.all('SELECT * FROM fourleaf_monitor WHERE channelId = ?', [
      channelId,
    ]);

    return raws.map((entry) => processRawEntry(this.database, entry));
  }

  public async getSentEntry(channelId: string, postNumber: number): Promise<FourLeafSentEntry | undefined> {
    const raw: FourLeafRawSentEntry | undefined = await this.database.get(
      'SELECT * FROM fourleaf_sent WHERE channelId = ? AND postNumber = ? LIMIT 1',
      channelId,
      postNumber
    );

    return raw !== undefined ? processRawSentEntry(this.database, raw) : undefined;
  }

  public async newSentEntry(channelId: string, postNumber: number): Promise<void> {
    await this.database.run('INSERT INTO fourleaf_sent (channelId, postNumber) VALUES (?, ?)', channelId, postNumber);
  }
}

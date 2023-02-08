import { Guild, MessageCreateOptions, MessagePayload, PermissionsBitField, TextBasedChannel, User } from 'discord.js';
import { Parser } from './parser';

export class CommandParseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CommandInteraction {
  public constructor(
    public readonly user: User,
    public readonly channel: TextBasedChannel,
    public readonly guild: Guild | null,
    public readonly args: string[],
    public readonly permissions: PermissionsBitField | null
  ) {
    this.user = user;
    this.channel = channel;
    this.guild = guild;
    this.args = args;
    this.permissions = permissions;
  }

  public async reply(message: string | MessagePayload | MessageCreateOptions): Promise<void> {
    await this.channel.send(message);
  }
}

export type CommandCallback = (interaction: CommandInteraction) => Promise<void>;

export class Command {
  public constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly usage: string,
    public readonly minArgs: number,
    public readonly maxArgs: number | null,
    public readonly callback: CommandCallback
  ) {
    this.name = name;
    this.usage = usage;
    this.minArgs = minArgs;
    this.maxArgs = maxArgs;
    this.callback = callback;
  }

  public formatUsage(): string {
    return `${this.name} ${this.usage}`;
  }
}

function parsedEscape(parser: Parser, retval: string): string {
  parser.forward();
  return retval;
}

function parseStringEscape(parser: Parser): string {
  if (!parser.hasMore()) {
    throw new CommandParseError('Unterminated string');
  }

  parser.forward();
  const seq = parser.peek();

  switch (seq) {
    case 'n':
      return parsedEscape(parser, '\n');

    case 'r':
      return parsedEscape(parser, '\r');

    case 't':
      return parsedEscape(parser, '\t');

    case '\\':
      return parsedEscape(parser, '\\');

    case '"':
      return parsedEscape(parser, '"');

    default:
      throw new CommandParseError(`Unknown escape sequence \\${seq}`);
  }
}

function parseString(parser: Parser): string {
  const parts = [];
  parser.forward();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const part = parser.takeWhile((ch) => ch !== '"' && ch !== '\\');
    parts.push(part);

    if (!parser.hasMore()) {
      throw new CommandParseError('Unterminated string');
    }

    const ch = parser.peek();

    if (ch === '"') {
      parser.forward();
      break;
    }

    // Can only be \\ here
    parts.push(parseStringEscape(parser));
  }

  return parts.join('');
}

function parseBarePart(parser: Parser): string {
  return parser.takeWhile((ch) => ch !== '"').trim();
}

export function parseCommandArgs(message: string): string[] {
  const parser = new Parser(message);
  const args = [];

  while (parser.hasMore()) {
    if (parser.peek() === '"') {
      args.push(parseString(parser));
    } else {
      const part = parseBarePart(parser);

      if (part.length > 0) {
        args.push(part);
      }
    }
  }

  return args;
}

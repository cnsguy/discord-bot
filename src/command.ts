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

function parseEscape(parser: Parser): string {
  if (!parser.hasMore()) {
    throw new CommandParseError('Unterminated string');
  }

  parser.forward();
  const next = parser.peek();

  switch (next) {
    case '|':
      return parsedEscape(parser, '|');

    case '\\':
      return parsedEscape(parser, '\\');

    default:
      return parsedEscape(parser, next);
  }
}

function parsePart(parser: Parser): string {
  const part = [];

  while (parser.hasMore()) {
    const barePart = parser.takeWhile((ch) => ch !== '|' && ch !== '\\');
    part.push(barePart);

    if (parser.peek() === '\\') {
      part.push(parseEscape(parser));
      continue;
    }

    break;
  }

  return part.join('');
}

export function parseCommandArgs(message: string): string[] {
  const parser = new Parser(message);
  const args = [];

  while (parser.hasMore()) {
    const arg = parsePart(parser).trim();

    if (arg.length > 0) {
      args.push(arg);
    }

    if (parser.peek() == '|') {
      parser.forward();
      continue;
    }

    break;
  }

  return args;
}

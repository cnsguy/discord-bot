import { ChatInputCommandInteraction } from 'discord.js';
import { UniqueMap } from './unique_map';
import { map, arrayFrom, pipe } from 'iter-tools';

export enum CommandType {
  Command = 1,
  CommandGroup = 2,
}

export enum CommandOptionType {
  String = 3,
  Int = 4,
  Boolean = 5,
  User = 6,
  Channel = 7,
  Role = 8,
  Mentionable = 9,
  Double = 10,
  Attachment = 11,
}

export type CommandCallback = (interaction: ChatInputCommandInteraction) => Promise<void>;

export abstract class CommandBase {
  protected constructor(public readonly name: string, public readonly description: string) {
    this.name = name;
    this.description = description;
  }

  public abstract toApiJSON(): object;
}

export class Command extends CommandBase {
  private readonly optionMap: Map<string, Option>;

  public constructor(name: string, description: string, options: Option[], public readonly callback: CommandCallback) {
    super(name, description);
    this.optionMap = new UniqueMap<string, Option>(map((option) => [option.name, option], options));
    this.callback = callback;
  }

  public toApiJSON(): object {
    const options: object[] = [];

    for (const option of this.optionMap.values()) {
      options.push({
        name: option.name,
        description: option.description,
        type: option.type,
        required: option.required,
      });
    }

    return {
      type: CommandType.Command,
      name: this.name,
      description: this.description,
      options: options,
    };
  }
}

function groupToApiJsonWithType(nested: CommandGroup, type: CommandType): object {
  const transform = pipe(
    map((command: Command) => command.toApiJSON()),
    arrayFrom
  );

  return {
    type: type,
    description: nested.description,
    name: nested.name,
    options: transform(nested.commandMap.values()),
  };
}

export class CommandGroup extends CommandBase {
  public readonly commandMap: Map<string, Command>;

  public constructor(name: string, description: string, commands: Command[]) {
    super(name, description);
    this.commandMap = new UniqueMap<string, Command>(map((command) => [command.name, command], commands));
  }

  public toApiJSON(): object {
    return groupToApiJsonWithType(this, CommandType.Command);
  }
}

export class GroupedCommandGroup extends CommandBase {
  public readonly commandGroupMap: Map<string, CommandGroup>;

  public constructor(name: string, description: string, groups: CommandGroup[]) {
    super(name, description);
    this.commandGroupMap = new UniqueMap<string, CommandGroup>(map((group) => [group.name, group], groups));
  }

  public toApiJSON(): object {
    const transform = pipe(
      map((group: CommandGroup) => groupToApiJsonWithType(group, CommandType.CommandGroup)),
      arrayFrom
    );

    return {
      type: CommandType.Command,
      description: this.description,
      name: this.name,
      options: transform(this.commandGroupMap.values()),
    };
  }
}

export type CommandEntry = Command | CommandGroup | GroupedCommandGroup;

export class Option {
  public constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly type: CommandOptionType,
    public readonly required = true
  ) {
    this.name = name;
    this.description = description;
    this.required = required;
    this.type = type;
  }
}

import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  User,
  Guild,
  TextBasedChannel,
  PermissionsBitField,
} from 'discord.js';
import { Command, CommandInteraction } from './command';
import { ModalEntry } from './modal';
import { Module, LoadableModule } from './module';
import { UniqueMap } from './unique_map';
import { parseCommandArgs } from './command';
import { EventEmitter } from 'events';
import { open, Database } from 'sqlite';
import { RSSModule } from './modules/rss';
import { TalkbotModule } from './modules/talkbot';
import { HelpModule } from './modules/help';
import { ReminderModule } from './modules/reminder';
import { ChoiceModule } from './modules/choice';
import { NoteModule } from './modules/note';
import { GoogleModule } from './modules/google';
import { TauriModule } from './modules/tauri';
import sqlite3 from 'sqlite3';

export class BotModuleLoadError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface LoadableModuleMap {
  readonly [key: string]: LoadableModule | undefined;
}

export declare interface Bot {
  on(event: BotEventNames.ClientReady, listener: () => void): this;
  on(event: BotEventNames.MessageCreate, listener: (message: Message) => void): this;
}

export enum BotEventNames {
  ClientReady = 'ready',
  MessageCreate = 'messageCreate',
}

export class Bot extends EventEmitter {
  public readonly modules = new UniqueMap<string, Module>();
  public readonly client: Client;
  public readonly commandMap = new UniqueMap<string, Command>();
  public readonly modalMap = new UniqueMap<string, ModalEntry>();

  private constructor(
    private readonly token: string,
    moduleNames: string[],
    public readonly database: Database,
    private readonly commandPrefix: string
  ) {
    super();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.token = token;
    this.database = database;
    this.commandPrefix = commandPrefix;

    for (const moduleName of moduleNames) {
      console.log(`Loading module ${moduleName}`);
      this.loadModule(moduleName);
    }
  }

  public static async new(token: string, modules: string[], databaseName: string, commandPrefix: string): Promise<Bot> {
    const database = await open({
      filename: databaseName,
      driver: sqlite3.Database,
    });

    return new Bot(token, modules, database, commandPrefix);
  }

  public registerCommand(entry: Command): void {
    this.commandMap.set(entry.name, entry);
  }

  public registerModalEntry(entry: ModalEntry): void {
    this.modalMap.set(entry.id, entry);
  }

  private loadModule(moduleName: string): void {
    const moduleNameMap: LoadableModuleMap = {
      ['rss']: RSSModule,
      ['talkbot']: TalkbotModule,
      ['help']: HelpModule,
      ['reminder']: ReminderModule,
      ['choice']: ChoiceModule,
      ['note']: NoteModule,
      ['google']: GoogleModule,
      ['tauri']: TauriModule,
    };

    const module = moduleNameMap[moduleName];

    if (module === undefined) {
      throw new BotModuleLoadError(`Invalid module '${moduleName}' specified`);
    }

    this.modules.set(moduleName, module.load(this));
  }

  private matchCommand(line: string): [Command, string] | null {
    for (const [commandName, command] of this.commandMap.entries()) {
      const pattern = this.commandPrefix + commandName;

      if (line.startsWith(pattern)) {
        const rest = line.slice(pattern.length);
        return [command, rest];
      }
    }

    return null;
  }

  private async tryProcessCommandLine(
    author: User,
    channel: TextBasedChannel,
    guild: Guild | null,
    permissions: PermissionsBitField | null,
    line: string
  ): Promise<void> {
    const matchResult = this.matchCommand(line);

    if (matchResult === null) {
      return;
    }

    const [command, rest] = matchResult;
    let args;

    try {
      args = parseCommandArgs(rest);
    } catch (error) {
      await channel.send(`Failed to parse command arguments: ${String(error)}`);
      return;
    }

    if (args.length < command.minArgs) {
      await channel.send(`Too few arguments. Usage: ${command.formatUsage()}`);
      return;
    }

    if (command.maxArgs !== null && args.length > command.maxArgs) {
      await channel.send(`Too many arguments. Usage: ${command.formatUsage()}`);
      return;
    }

    try {
      await command.callback(new CommandInteraction(author, channel, guild, args, permissions));
    } catch (error) {
      console.warn(`Failed to run command ${command.name}: ${String(error)}`);
    }
  }

  private async tryProcessCommands(message: Message): Promise<void> {
    if (message.author === this.client.user) {
      return;
    }

    for (const line of message.content.split('\n')) {
      await this.tryProcessCommandLine(
        message.author,
        message.channel,
        message.guild,
        message.member?.permissions ?? null,
        line
      );
    }
  }

  private registerEvents(): void {
    this.client.on(Events.ClientReady, () => {
      console.log('Logged in');
      this.emit(BotEventNames.ClientReady);
    });

    this.client.on(Events.MessageCreate, (message) => {
      this.emit(BotEventNames.MessageCreate, message);
      void this.tryProcessCommands(message);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isModalSubmit()) {
        const entry = this.modalMap.get(interaction.customId);

        if (entry === undefined) {
          return;
        }

        await entry.callback(interaction);
      } else if (interaction.isChatInputCommand()) {
        if (!interaction.channel || !interaction.channel.isTextBased()) {
          await interaction.reply('Commands are only available in text-based channels.');
          return;
        }

        const entry = this.commandMap.get(interaction.commandName);

        if (entry === undefined) {
          return;
        }
      }
    });
  }

  public async run(): Promise<void> {
    console.log('Registering events');
    this.registerEvents();
    console.log('Logging in');
    await this.client.login(this.token);
  }
}

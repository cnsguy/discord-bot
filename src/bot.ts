import { Client, Events, GatewayIntentBits, Message } from 'discord.js';
import { Command, CommandInteraction } from './command';
import { ModalEntry } from './modal';
import { Module, LoadableModule } from './module';
import { UniqueMap } from './unique_map';
import { parseCommand } from './command';
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

  private registerEvents(): void {
    this.client.on(Events.ClientReady, () => {
      console.log('Logged in');
      this.emit(BotEventNames.ClientReady);
    });

    this.client.on(Events.MessageCreate, async (message) => {
      this.emit(BotEventNames.MessageCreate, message);

      if (message.author === this.client.user) {
        return;
      }

      const content = message.content;

      if (!content.startsWith(this.commandPrefix)) {
        return;
      }

      const commandPart = content.slice(this.commandPrefix.length);
      let parsed;

      try {
        parsed = parseCommand(commandPart);
      } catch (error) {
        await message.reply(`Failed to parse command: ${String(error)}`);
        return;
      }

      if (parsed.length === 0) {
        return;
      }

      const commandName = parsed[0];
      const command = this.commandMap.get(commandName);

      if (command === undefined) {
        return;
      }

      const args = parsed.slice(1);
      const permissions = message.member?.permissions ?? null;
      const guild = message.guild;

      if (args.length < command.minArgs) {
        await message.reply(`Too few arguments. Usage: ${command.formatUsage()}`);
        return;
      }

      if (command.maxArgs !== null && args.length > command.maxArgs) {
        await message.reply(`Too many arguments. Usage: ${command.formatUsage()}`);
        return;
      }

      try {
        await command.callback(new CommandInteraction(message.author, message.channel, guild, args, permissions));
      } catch (error) {
        console.warn(`Failed to run command ${commandName}: ${String(error)}`);
      }
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

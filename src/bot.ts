import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  ChatInputCommandInteraction,
  Routes,
} from 'discord.js';
import { Module, LoadableModule } from './module';
import { UniqueMap } from './unique_map';
import { EventEmitter } from 'events';
import { open, Database } from 'sqlite';
import { RSSModule } from './modules/rss';
import { TalkbotModule } from './modules/talkbot';
import { HelpModule } from './modules/help';
import { DateModule as ReminderModule } from './modules/reminder';
import { ChoiceModule } from './modules/choice';
import { NoteModule } from './modules/note';
import { TauriModule } from './modules/tauri';
import { DuckDuckGoModule } from './modules/duckduckgo';
import sqlite3 from 'sqlite3';

export type SlashCommandCallback = (interaction: ChatInputCommandInteraction) => Promise<void>;

export class SlashCommand {
  public constructor(
    public readonly command: RESTPostAPIChatInputApplicationCommandsJSONBody,
    public readonly callback: SlashCommandCallback
  ) {
    this.command = command;
    this.callback = callback;
  }
}

interface OAuthCurrentApplicationResponse {
  readonly bot: { id: string };
}

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
  public readonly slashCommands = new UniqueMap<string, SlashCommand>();

  private constructor(private readonly token: string, moduleNames: string[], public readonly database: Database) {
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

    for (const moduleName of moduleNames) {
      console.log(`Loading module ${moduleName}`);
      this.loadModule(moduleName);
    }
  }

  public static async new(token: string, modules: string[], databaseName: string): Promise<Bot> {
    const database = await open({
      filename: databaseName,
      driver: sqlite3.Database,
    });

    return new Bot(token, modules, database);
  }

  private loadModule(moduleName: string): void {
    const moduleNameMap: LoadableModuleMap = {
      ['rss']: RSSModule,
      ['talkbot']: TalkbotModule,
      ['help']: HelpModule,
      ['reminder']: ReminderModule,
      ['choice']: ChoiceModule,
      ['note']: NoteModule,
      ['tauri']: TauriModule,
      ['duckduckgo']: DuckDuckGoModule,
    };

    const module = moduleNameMap[moduleName];

    if (module === undefined) {
      throw new BotModuleLoadError(`Invalid module '${moduleName}' specified`);
    }

    this.modules.set(moduleName, module.load(this));
  }

  public registerSlashCommand(
    json: RESTPostAPIChatInputApplicationCommandsJSONBody,
    callback: SlashCommandCallback
  ): void {
    this.slashCommands.set(json.name, new SlashCommand(json, callback));
  }

  private registerEvents(): void {
    this.client.on(Events.ClientReady, async () => {
      const commands = Array.from(this.slashCommands, ([, entry]) => entry.command);
      const resp = (await this.client.rest.get(Routes.oauth2CurrentApplication())) as OAuthCurrentApplicationResponse;

      await this.client.rest.put(Routes.applicationCommands(resp.bot.id), {
        body: commands,
      });

      this.emit(BotEventNames.ClientReady);
    });

    this.client.on(Events.MessageCreate, (message) => {
      this.emit(BotEventNames.MessageCreate, message);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) {
        if (!interaction.channel || !interaction.channel.isTextBased()) {
          await interaction.reply('Commands are only available in text-based channels.');
          return;
        }

        const entry = this.slashCommands.get(interaction.commandName);

        if (entry === undefined) {
          return;
        }

        await entry.callback(interaction);
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

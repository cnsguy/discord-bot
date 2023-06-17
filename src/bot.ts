import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  ChatInputCommandInteraction,
  PermissionsBitField,
  Routes,
} from 'discord.js';
import { Module, LoadableModule } from './module';
import { UniqueMap } from './unique_map';
import { EventEmitter } from 'events';
import { open, Database } from 'sqlite';
import { Permission } from './permission';
import { RSSModule } from './modules/rss';
import { TalkbotModule } from './modules/talkbot';
import { HelpModule } from './modules/help';
import { DateModule as ReminderModule } from './modules/reminder';
import { ChoiceModule } from './modules/choice';
import { NoteModule } from './modules/note';
import { TauriModule } from './modules/tauri';
import { DuckDuckGoModule } from './modules/duckduckgo';
import { GelbooruModule } from './modules/gelbooru';
import { FourLeafModule } from './modules/fourleaf';
import sqlite3 from 'sqlite3';
import assert from 'assert';

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

export interface Bot {
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

  private constructor(
    private readonly token: string,
    private readonly adminUserId: string | undefined,
    moduleNames: string[],
    public readonly database: Database
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
    this.adminUserId = adminUserId;

    for (const moduleName of moduleNames) {
      console.log(`Loading module ${moduleName}`);
      this.loadModule(moduleName);
    }
  }

  public static async new(
    token: string,
    adminUserId: string | undefined,
    modules: string[],
    databaseName: string
  ): Promise<Bot> {
    const database = await open({
      filename: databaseName,
      driver: sqlite3.Database,
    });

    return new Bot(token, adminUserId, modules, database);
  }

  private loadModule(moduleName: string): void {
    const moduleNameMap: LoadableModuleMap = {
      ['rss']: RSSModule,
      ['talkbot']: TalkbotModule,
      ['gelbooru']: GelbooruModule,
      ['help']: HelpModule,
      ['reminder']: ReminderModule,
      ['choice']: ChoiceModule,
      ['note']: NoteModule,
      ['tauri']: TauriModule,
      ['duckduckgo']: DuckDuckGoModule,
      ['fourleaf']: FourLeafModule,
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

  public async checkInteractionPermissions(
    interaction: ChatInputCommandInteraction,
    required: Permission[]
  ): Promise<boolean> {
    const userId = interaction.user?.id;

    if (this.adminUserId !== undefined && userId == this.adminUserId) {
      return true;
    }

    const permissions = interaction.member?.permissions;

    if (permissions === undefined) {
      await interaction.reply('This command is only available in a server.');
      return false;
    }

    assert(permissions instanceof PermissionsBitField);

    for (const permission of required) {
      if ((permissions.bitfield & permission.bits) == 0n) {
        await interaction.reply(`Missing permission: ${permission.name}`);
        return false;
      }
    }

    return true;
  }

  private registerEvents(): void {
    this.client.on(Events.ClientReady, async () => {
      const commands = Array.from(this.slashCommands, ([, entry]) => entry.command);
      const resp = (await this.client.rest.get(Routes.oauth2CurrentApplication())) as OAuthCurrentApplicationResponse;

      await this.client.rest.put(Routes.applicationCommands(resp.bot.id), {
        body: commands,
      });

      try {
        this.emit(BotEventNames.ClientReady);
      } catch (error) {
        console.error(`Exception while emitting ClientReady: ${String(error)}`);
      }
    });

    this.client.on(Events.MessageCreate, (message) => {
      try {
        this.emit(BotEventNames.MessageCreate, message);
      } catch (error) {
        console.error(`Exception while emitting MessageCreate: ${String(error)}`);
      }
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

        try {
          await entry.callback(interaction);
        } catch (error) {
          console.error(`Exception while running command ${interaction.commandName}: ${String(error)}`);
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

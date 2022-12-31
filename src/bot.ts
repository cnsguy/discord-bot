import { REST, Routes, Client, Events, ChatInputCommandInteraction, GatewayIntentBits, Message } from 'discord.js';
import { CommandEntry, Command, CommandGroup, GroupedCommandGroup } from './command';
import { ModalEntry } from './modal';
import { Module, LoadableModule } from './module';
import { UniqueMap } from './unique_map';
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
  public readonly commandMap = new UniqueMap<string, CommandEntry>();
  public readonly modalMap = new UniqueMap<string, ModalEntry>();

  private constructor(
    private readonly token: string,
    private readonly clientId: string,
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
    this.clientId = clientId;
    this.database = database;

    for (const moduleName of moduleNames) {
      console.log(`Loading module ${moduleName}`);
      this.loadModule(moduleName);
    }
  }

  public static async new(token: string, clientId: string, modules: string[], databaseName: string): Promise<Bot> {
    const database = await open({
      filename: databaseName,
      driver: sqlite3.Database,
    });

    return new Bot(token, clientId, modules, database);
  }

  public registerCommandEntry(entry: CommandEntry): void {
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

  private async handleCommand(command: Command, interaction: ChatInputCommandInteraction): Promise<void> {
    await command.callback(interaction);
  }

  private async handleCommandGroup(group: CommandGroup, interaction: ChatInputCommandInteraction): Promise<void> {
    const command = group.commandMap.get(interaction.options.getSubcommand());

    if (command === undefined) {
      return;
    }

    await this.handleCommand(command, interaction);
  }

  private async handleGroupedCommandGroup(
    group: GroupedCommandGroup,
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const interactionGroup = interaction.options.getSubcommandGroup();

    if (interactionGroup === null) {
      return;
    }

    const commandGroup = group.commandGroupMap.get(interactionGroup);

    if (commandGroup === undefined) {
      return;
    }

    await this.handleCommandGroup(commandGroup, interaction);
  }

  private registerEvents(): void {
    this.client.on(Events.ClientReady, () => {
      console.log('Logged in');
      this.emit(BotEventNames.ClientReady);
    });

    this.client.on(Events.MessageCreate, (message) => {
      this.emit(BotEventNames.MessageCreate, message);
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

        try {
          if (entry instanceof Command) {
            await this.handleCommand(entry, interaction);
          } else if (entry instanceof CommandGroup) {
            await this.handleCommandGroup(entry, interaction);
          } else if (entry instanceof GroupedCommandGroup) {
            await this.handleGroupedCommandGroup(entry, interaction);
          }
        } catch (error) {
          if (error instanceof Error && error.stack !== undefined) {
            console.error(`Exception while running command entry in ${entry.name}: ${error.stack}`);
          } else {
            console.error(`Exception while running command entry in ${entry.name}: ${String(error)}`);
          }
        }
      }
    });
  }

  private async registerCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(this.token);
    const json = [];

    for (const entry of this.commandMap.values()) {
      json.push(entry.toApiJSON());
    }

    await rest.put(Routes.applicationCommands(this.clientId), {
      body: json,
    });
  }

  public async run(): Promise<void> {
    console.log('Registering events');
    this.registerEvents();
    console.log('Registering commands');
    await this.registerCommands();
    console.log('Logging in');
    await this.client.login(this.token);
  }
}

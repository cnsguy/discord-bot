import { Module } from '../module';
import { Bot } from '../bot';
import { Command, CommandInteraction } from '../command';
import { EmbedBuilder } from 'discord.js';
import { ReminderDatabase } from './reminder/database';
import { splitEvery } from 'ramda';
import { parseDate } from 'chrono-node';
import { formatDistanceStrict } from 'date-fns';
import { checkInteractionPermissions, ManageGuild } from '../permission';

enum DatePart {
  Year = 1,
  Month = 2,
  Day = 3,
  Hour = 4,
  Minute = 5,
  Second = 6,
}

function parseUserId(arg: string): string | null {
  const match = /<@(\d+)>/.exec(arg);
  return match === null ? null : match[1];
}

function matchDatePart(part: string): DatePart | null {
  const dateParts: [string, DatePart][] = [
    ['years?', DatePart.Year],
    ['months?', DatePart.Month],
    ['days?', DatePart.Day],
    ['hours?', DatePart.Hour],
    ['minutes?', DatePart.Minute],
    ['seconds?', DatePart.Second],
  ];

  for (const entry of dateParts) {
    const [pattern, enumEntry] = entry;

    if (part.match(new RegExp(pattern, 'i'))) {
      return enumEntry;
    }
  }

  return null;
}

function matchNumericPart(part: string): number | null {
  if (!part.match(/\d+/)) {
    return null;
  }

  return Number(part);
}

function processDatePart(date: Date, numericPart: number, datePart: DatePart): void {
  switch (datePart) {
    case DatePart.Year:
      date.setUTCFullYear(date.getFullYear() + numericPart);
      break;
    case DatePart.Month:
      date.setUTCMonth(date.getMonth() + numericPart);
      break;
    case DatePart.Day:
      date.setUTCDate(date.getDate() + numericPart);
      break;
    case DatePart.Hour:
      date.setUTCHours(date.getHours() + numericPart);
      break;
    case DatePart.Minute:
      date.setUTCMinutes(date.getMinutes() + numericPart);
      break;
    case DatePart.Second:
      date.setUTCSeconds(date.getSeconds() + numericPart);
      break;
  }
}

function parseRelativeDate(input: string): Date | null {
  const date = new Date(0);
  const split = splitEvery(2, input.split(' '));

  for (const part of split) {
    if (part.length != 2) {
      return null;
    }

    const numericPart = matchNumericPart(part[0]);
    const datePart = matchDatePart(part[1]);

    if (numericPart === null || numericPart === 0 || datePart === null) {
      return null;
    }

    processDatePart(date, numericPart, datePart);
  }

  return date;
}

export class ReminderModule extends Module {
  private readonly database: ReminderDatabase;

  private constructor(private readonly bot: Bot) {
    const reminderOn = new Command(
      'reminder-on',
      'Show a reminder once on a specific date',
      '<date> <message>',
      2,
      null,
      async (interaction) => this.reminderOnCommand(interaction)
    );

    const reminderIn = new Command(
      'reminder-in',
      'Show a reminder once on a specific date (relative)',
      '<date> <message>',
      2,
      null,
      async (interaction) => this.reminderInCommand(interaction)
    );

    const reminderEach = new Command(
      'reminder-each',
      'Repeat a reminder based on an interval (relative)',
      '<interval> <message>',
      2,
      null,
      async (interaction) => this.reminderEachCommand(interaction)
    );

    const reminderList = new Command(
      'reminder-list',
      'List all reminders in your current server',
      '-',
      0,
      0,
      async (interaction) => this.reminderListCommand(interaction)
    );

    const reminderAdminList = new Command(
      'reminder-admin-list',
      'List all reminders in the current server for a given user',
      '<user>',
      1,
      1,
      async (interaction) => this.reminderAdminListCommand(interaction)
    );

    const reminderDelete = new Command(
      'reminder-delete',
      'Delete the specified reminders by ID',
      '<ids...>',
      1,
      null,
      async (interaction) => this.reminderDeleteCommand(interaction)
    );

    const reminderAdminDelete = new Command(
      'reminder-admin-delete',
      'Delete the specified reminders by ID for a given user',
      '<user> <ids...>',
      2,
      null,
      async (interaction) => this.reminderAdminDeleteCommand(interaction)
    );

    bot.registerCommand(reminderOn);
    bot.registerCommand(reminderIn);
    bot.registerCommand(reminderEach);
    bot.registerCommand(reminderList);
    bot.registerCommand(reminderAdminList);
    bot.registerCommand(reminderDelete);
    bot.registerCommand(reminderAdminDelete);

    super();
    this.bot = bot;
    this.database = new ReminderDatabase(this.bot.database);
    setInterval(() => void this.timerTick(), 1000);
  }

  public static load(bot: Bot): ReminderModule {
    return new ReminderModule(bot);
  }

  private async timerTick(): Promise<void> {
    try {
      const entries = await this.database.getEntries();
      const now = Date.now();

      for (const entry of entries) {
        if (now >= entry.nextDate.getTime()) {
          const channel = await this.bot.client.channels.fetch(entry.channelId);

          if (channel !== null && channel.isTextBased()) {
            await channel.send(`<@${entry.senderId}> ${entry.messageContent}`);
          }

          if (entry.repeatInterval !== null) {
            const nextDate = new Date(Date.now() + entry.repeatInterval.getTime());
            await entry.setNextDate(nextDate);
          } else {
            await entry.delete();
          }
        }
      }
    } catch (error) {
      console.error(`Exception while processing reminder entries: ${String(error)}`);
    }
  }

  private async checkUserNoteLimit(interaction: CommandInteraction): Promise<boolean> {
    if (interaction.guild === null) {
      return true;
    }

    const entries = await this.database.getEntriesForSenderInGuild(interaction.user.id, interaction.guild.id);
    return entries.length >= 10;
  }

  private async reminderOnCommand(interaction: CommandInteraction): Promise<void> {
    if (await this.checkUserNoteLimit(interaction)) {
      await interaction.reply('You have too many reminders on this server.');
      return;
    }

    const date = interaction.args[0];
    const message = interaction.args.slice(1).join(' ');
    const nextDate: Date | null = parseDate(date);

    if (nextDate === null) {
      await interaction.reply(`Could not parse date '${date}'`);
      return;
    }

    await this.database.newEntry(
      message,
      interaction.guild?.id ?? null,
      interaction.channel.id,
      interaction.user.id,
      nextDate,
      null
    );

    await interaction.reply('Reminder set.');
  }

  private async reminderInCommand(interaction: CommandInteraction): Promise<void> {
    if (await this.checkUserNoteLimit(interaction)) {
      await interaction.reply('You have too many reminders on this server.');
      return;
    }

    const date = interaction.args[0];
    const message = interaction.args.slice(1).join(' ');
    const relativeDate = parseRelativeDate(date);

    if (relativeDate === null) {
      await interaction.reply(`Could not parse date '${date}'`);
      return;
    }

    const nextDate = new Date(Date.now() + relativeDate.getTime());
    await this.database.newEntry(
      message,
      interaction.guild?.id ?? null,
      interaction.channel.id,
      interaction.user.id,
      nextDate,
      null
    );

    await interaction.reply('Reminder set.');
  }

  private async reminderEachCommand(interaction: CommandInteraction): Promise<void> {
    if (await this.checkUserNoteLimit(interaction)) {
      await interaction.reply('You have too many reminders on this server.');
      return;
    }

    const date = interaction.args[0];
    const message = interaction.args.slice(1).join(' ');
    const interval = parseRelativeDate(date);

    if (interval === null) {
      await interaction.reply(`Could not parse date '${date}'`);
      return;
    }

    const nextDate = new Date(Date.now() + interval.getTime());
    await this.database.newEntry(
      message,
      interaction.guild?.id ?? null,
      interaction.channel.id,
      interaction.user.id,
      nextDate,
      interval
    );

    await interaction.reply('Reminder set.');
  }

  private async reminderList(interaction: CommandInteraction, userId: string): Promise<void> {
    const entries = await this.database.getEntriesForSenderInGuild(userId, interaction.guild?.id ?? null);

    if (entries.length === 0) {
      await interaction.reply('No reminders.');
      return;
    }

    const embeds = entries.map((entry, i) => {
      const builder = new EmbedBuilder();
      const id = i + 1;

      builder.addFields({ name: 'ID', value: id.toString() });
      builder.addFields({ name: 'Channel', value: `<#${entry.channelId}>` });
      builder.addFields({ name: 'Message', value: entry.messageContent });
      builder.addFields({ name: 'Time left', value: formatDistanceStrict(entry.nextDate, new Date()) });

      if (entry.repeatInterval !== null) {
        builder.addFields({ name: 'Repeat interval', value: formatDistanceStrict(new Date(0), entry.repeatInterval) });
      }

      return builder;
    });

    await interaction.reply({ embeds: embeds });
  }

  private async reminderListCommand(interaction: CommandInteraction): Promise<void> {
    return this.reminderList(interaction, interaction.user.id);
  }

  private async reminderAdminListCommand(interaction: CommandInteraction): Promise<void> {
    if (!(await checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    const userId = parseUserId(interaction.args[0]);

    if (userId === null) {
      await interaction.reply('Could not parse user');
      return;
    }

    return this.reminderList(interaction, userId);
  }

  private async reminderDelete(interaction: CommandInteraction, userId: string, ids: string[]): Promise<void> {
    const entries = await this.database.getEntriesForSenderInGuild(userId, interaction.guild?.id ?? null);
    const selectedEntries = [];

    for (const idPart of ids) {
      const id = Number(idPart.trim());

      if (id < 1 || id > entries.length) {
        await interaction.reply(`Invalid ID: ${id}`);
        return;
      }

      const i = id - 1;
      selectedEntries.push(entries[i]);
    }

    for (const entry of selectedEntries) {
      await entry.delete();
    }

    await interaction.reply('Deleted.');
  }

  private async reminderDeleteCommand(interaction: CommandInteraction): Promise<void> {
    return this.reminderDelete(interaction, interaction.user.id, interaction.args);
  }

  private async reminderAdminDeleteCommand(interaction: CommandInteraction): Promise<void> {
    if (!(await checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    const userId = parseUserId(interaction.args[0]);

    if (userId === null) {
      await interaction.reply('Could not parse user');
      return;
    }

    return this.reminderDelete(interaction, userId, interaction.args.slice(1));
  }
}

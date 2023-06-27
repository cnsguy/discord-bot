import { Module } from '../module';
import { Bot } from '../bot';
import {
  EmbedBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandStringOption,
  SlashCommandUserOption,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import { ReminderDatabase } from './reminder/database';
import { splitEvery } from 'ramda';
import { parseDate } from 'chrono-node';
import { formatDistanceStrict } from 'date-fns';
import { ManageGuild } from '../permission';

enum DatePart {
  Year = 1,
  Month = 2,
  Day = 3,
  Hour = 4,
  Minute = 5,
  Second = 6,
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

export class DateModule extends Module {
  private readonly database: ReminderDatabase;

  private constructor(private readonly bot: Bot) {
    const inSubcommand = new SlashCommandSubcommandBuilder()
      .setName('in')
      .setDescription('Show a reminder once on a specific date (relative)')
      .addStringOption(
        new SlashCommandStringOption().setName('date').setDescription('Date to show the message on').setRequired(true)
      )
      .addStringOption(
        new SlashCommandStringOption().setName('message').setDescription('Message to show').setRequired(true)
      );

    const onSubcommand = new SlashCommandSubcommandBuilder()
      .setName('at')
      .setDescription('Show a reminder once on a specific date (absolute)')
      .addStringOption(
        new SlashCommandStringOption().setName('date').setDescription('Date to show the message on').setRequired(true)
      )
      .addStringOption(
        new SlashCommandStringOption().setName('message').setDescription('Message to show').setRequired(true)
      );

    const repeatSubcommand = new SlashCommandSubcommandBuilder()
      .setName('repeat')
      .setDescription('Repeat a reminder based on an interval (relative)')
      .addStringOption(
        new SlashCommandStringOption()
          .setName('interval')
          .setDescription('Interval for repeating the message')
          .setRequired(true)
      )
      .addStringOption(
        new SlashCommandStringOption().setName('message').setDescription('Message to show').setRequired(true)
      )
      .addStringOption(new SlashCommandStringOption().setName('start').setDescription('When to start (default: now)'));

    const listSubcommand = new SlashCommandSubcommandBuilder()
      .setName('list')
      .setDescription('List all reminders in the current server for yourself');

    const deleteSubcommand = new SlashCommandSubcommandBuilder()
      .setName('delete')
      .setDescription('Delete the specified reminders by ID')
      .addStringOption(new SlashCommandStringOption().setName('ids').setDescription('IDs to delete').setRequired(true));

    const adminListSubcommand = new SlashCommandSubcommandBuilder()
      .setName('list')
      .setDescription('List all reminders in the current server for a given user')
      .addUserOption(
        new SlashCommandUserOption().setName('user').setDescription('User to list reminders for').setRequired(true)
      );

    const adminDeleteSubcommand = new SlashCommandSubcommandBuilder()
      .setName('delete')
      .setDescription('Delete the specified reminders by ID for a given user')
      .addUserOption(
        new SlashCommandUserOption().setName('user').setDescription('User to delete the reminder for').setRequired(true)
      )
      .addStringOption(new SlashCommandStringOption().setName('ids').setDescription('IDs to delete').setRequired(true));

    const adminSubcommands = new SlashCommandSubcommandGroupBuilder()
      .setName('admin')
      .setDescription('Reminder admin commands')
      .addSubcommand(adminListSubcommand)
      .addSubcommand(adminDeleteSubcommand);

    const reminderCommand = new SlashCommandBuilder()
      .setName('reminder')
      .setDescription('Reminder commands')
      .addSubcommand(inSubcommand)
      .addSubcommand(onSubcommand)
      .addSubcommand(repeatSubcommand)
      .addSubcommand(listSubcommand)
      .addSubcommand(deleteSubcommand)
      .addSubcommandGroup(adminSubcommands)
      .toJSON();

    bot.registerSlashCommand(reminderCommand, (interaction) => this.reminderCommand(interaction));
    super();
    this.bot = bot;
    this.database = new ReminderDatabase(this.bot.database);
    setInterval(() => void this.timerTick(), 1000);
  }

  public static load(bot: Bot): DateModule {
    return new DateModule(bot);
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

  private async checkUserReminderLimit(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (interaction.guild === null) {
      return true;
    }

    const entries = await this.database.getEntriesForSenderInGuild(interaction.user.id, interaction.guild.id);
    return entries.length >= 10;
  }

  private async reminderInSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (await this.checkUserReminderLimit(interaction)) {
      await interaction.reply('You have too many reminders on this server.');
      return;
    }

    if (interaction.channelId === null) {
      await interaction.reply('This command is only available in a channel');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const date = interaction.options.getString('date')!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const message = interaction.options.getString('message')!;
    const relativeDate = parseRelativeDate(date);

    if (relativeDate === null) {
      await interaction.reply(`Could not parse date '${date}'`);
      return;
    }

    const nextDate = new Date(Date.now() + relativeDate.getTime());
    await this.database.newEntry(
      message,
      interaction.guild?.id ?? null,
      interaction.channelId,
      interaction.user.id,
      nextDate,
      null
    );

    await interaction.reply('Reminder set.');
  }

  private async reminderAtSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (await this.checkUserReminderLimit(interaction)) {
      await interaction.reply('You have too many reminders on this server.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const date = interaction.options.getString('date')!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const message = interaction.options.getString('message')!;
    const nextDate: Date | null = parseDate(date);

    if (nextDate === null) {
      await interaction.reply(`Could not parse date '${date}'`);
      return;
    }

    await this.database.newEntry(
      message,
      interaction.guild?.id ?? null,
      interaction.channelId,
      interaction.user.id,
      nextDate,
      null
    );

    await interaction.reply('Reminder set.');
  }

  private async reminderRepeatSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (await this.checkUserReminderLimit(interaction)) {
      await interaction.reply('You have too many reminders on this server.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const interval = interaction.options.getString('interval')!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const message = interaction.options.getString('message')!;
    const start = interaction.options.getString('start');
    const intervalDate = parseRelativeDate(interval);

    if (intervalDate === null) {
      await interaction.reply(`Could not parse date '${interval}'`);
      return;
    }

    let nextDate = new Date(Date.now() + intervalDate.getTime());

    if (start !== null) {
      const startDate = start ? parseDate(start) : null;

      if (startDate === null) {
        await interaction.reply(`Could not parse date '${start}'`);
        return;
      }

      nextDate = startDate;
    }

    await this.database.newEntry(
      message,
      interaction.guild?.id ?? null,
      interaction.channelId,
      interaction.user.id,
      nextDate,
      intervalDate
    );

    await interaction.reply('Reminder set.');
  }

  private async reminderList(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const entries = await this.database.getEntriesForSenderInGuild(userId, interaction.guild?.id ?? null);

    if (entries.length === 0) {
      await interaction.reply('No reminders.');
      return;
    }

    const embeds = entries.map((entry, i) => {
      const id = i + 1;

      const builder = new EmbedBuilder()
        .addFields({ name: 'ID', value: id.toString() })
        .addFields({ name: 'Channel', value: `<#${entry.channelId}>` })
        .addFields({ name: 'Message', value: entry.messageContent })
        .addFields({ name: 'Time left', value: formatDistanceStrict(entry.nextDate, new Date()) });

      if (entry.repeatInterval !== null) {
        builder.addFields({ name: 'Repeat interval', value: formatDistanceStrict(new Date(0), entry.repeatInterval) });
      }

      return builder;
    });

    await interaction.reply({ embeds: embeds });
  }

  private async reminderListSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    return this.reminderList(interaction, interaction.user.id);
  }

  private async reminderAdminListSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await this.bot.checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const user = interaction.options.getUser('user')!;
    return this.reminderList(interaction, user.id);
  }

  private async reminderDeleteCommon(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ids = interaction.options.getString('ids')!.split(' ');
    const entries = await this.database.getEntriesForSenderInGuild(userId, interaction.guildId);
    const toDelete = [];

    for (const idString of ids) {
      const id = Number(idString);

      if (Number.isNaN(id)) {
        await interaction.reply(`Invalid ID '${idString}'`);
        return;
      }

      if (id > entries.length || id < 0) {
        await interaction.reply(`No entry with id ${id} exists.`);
        return;
      }

      toDelete.push(entries[id - 1]);
    }

    for (const entry of toDelete) {
      await entry.delete();
    }

    await interaction.reply('Deleted.');
  }

  private async reminderDeleteSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.reminderDeleteCommon(interaction, interaction.user.id);
  }

  private async reminderAdminDeleteSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await this.bot.checkInteractionPermissions(interaction, [ManageGuild]))) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const user = interaction.options.getUser('user')!;
    return this.reminderDeleteCommon(interaction, user.id);
  }

  private async reminderCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(true);
    const subcommandGroup = interaction.options.getSubcommandGroup();

    switch (subcommandGroup) {
      case null: {
        switch (subcommand) {
          case 'in':
            return this.reminderInSubcommand(interaction);
          case 'at':
            return this.reminderAtSubcommand(interaction);
          case 'repeat':
            return this.reminderRepeatSubcommand(interaction);
          case 'list':
            return this.reminderListSubcommand(interaction);
          case 'delete':
            return this.reminderDeleteSubcommand(interaction);
          default:
            throw new Error(`Invalid subcommand: ${subcommand}`);
        }
      }
      case 'admin': {
        switch (subcommand) {
          case 'list':
            return this.reminderAdminListSubcommand(interaction);
          case 'delete':
            return this.reminderAdminDeleteSubcommand(interaction);
          default:
            throw new Error(`Invalid subcommand: ${subcommand}`);
        }
      }
    }
  }
}

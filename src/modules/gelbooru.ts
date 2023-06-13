import { Module } from '../module';
import { Bot } from '../bot';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import assert from 'assert';

interface ResultEntry {
  readonly id: number;
  readonly file_url: string;
}

interface Results {
  readonly post: ResultEntry[];
}

class CommandInfo {
  public constructor(public readonly tags: string, public readonly description: string) {
    this.tags = tags;
    this.description = description;
  }
}

export class GelbooruModule extends Module {
  private readonly commands: Map<string, CommandInfo>;

  private constructor(bot: Bot) {
    super();

    this.commands = new Map();
    this.commands.set(
      'explosion',
      new CommandInfo('rating:general sort:random megumin', 'Random Megumin picture from Gelbooru')
    );
    this.commands.set(
      'useless',
      new CommandInfo('rating:general sort:random aqua_(konosuba)', 'Random Aqua picture from Gelbooru')
    );
    this.commands.set(
      'illya',
      new CommandInfo('rating:general sort:random illyasviel_von_einzbern', 'Random Illya picture from Gelbooru')
    );

    for (const [name, info] of this.commands.entries()) {
      const command = new SlashCommandBuilder().setName(name).setDescription(info.description).toJSON();
      bot.registerSlashCommand(command, (interaction) => this.handleCommand(interaction));
    }
  }

  public static load(bot: Bot): GelbooruModule {
    return new GelbooruModule(bot);
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const info = this.commands.get(interaction.commandName);
    assert(info !== undefined);
    await interaction.deferReply();

    const response = await fetch(
      `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(info.tags)}`
    );

    if (response.status != 200) {
      await interaction.followUp(`Failed to get image; server returned error code ${response.status}`);
      return;
    }

    const json = JSON.parse(await response.text()) as Results;
    const imageUrl = json.post[0].file_url;
    const id = json.post[0].id;

    if (imageUrl === undefined) {
      await interaction.followUp(`Failed to get image; no results?`);
      return;
    }

    const postUrl = `https://gelbooru.com/index.php?page=post&s=view&id=${id}`;
    const embed = new EmbedBuilder().setTitle(`Post number ${id}`).setURL(postUrl).setImage(imageUrl);
    await interaction.followUp({ embeds: [embed] });
  }
}

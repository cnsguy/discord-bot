import { Module } from '../module';
import { Bot } from '../bot';
import { Command, CommandInteraction } from '../command';

interface ResultEntry {
  readonly id: number;
  readonly file_url: string;
}

interface Results {
  readonly post?: ResultEntry[];
}

async function handleImageCommon(interaction: CommandInteraction, tags: string): Promise<void> {
  const response = await fetch(
    `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tags)}`
  );

  if (response.status != 200) {
    await interaction.reply(`Failed to get image; server returned error code ${response.status}`);
    return;
  }

  const json = JSON.parse(await response.text()) as Results;

  if (json.post === undefined || json.post.length == 0) {
    await interaction.reply('No results.');
    return;
  }

  const imageUrl = json.post[0].file_url;

  if (imageUrl === undefined) {
    await interaction.reply(`Failed to get image; no results?`);
    return;
  }

  await interaction.reply(imageUrl);
}

export class GelbooruModule extends Module {
  private constructor(bot: Bot) {
    super();

    bot.registerCommand(
      new Command('!explosion', 'Random Megumin picture from Gelbooru', '-', 0, 0, (interaction) =>
        this.explosionCommand(interaction)
      )
    );

    bot.registerCommand(
      new Command('!useless', 'Random Aqua picture from Gelbooru', '-', 0, 0, (interaction) =>
        this.uselessCommand(interaction)
      )
    );

    bot.registerCommand(
      new Command('!illya', 'Random Illya picture from Gelbooru', '-', 0, 0, (interaction) =>
        this.illyaCommand(interaction)
      )
    );

    bot.registerCommand(
      new Command('!gelbooru', 'Search gelbooru', '<tags>', 1, 1, (interaction) => this.gelbooruCommand(interaction))
    );
  }

  public static load(bot: Bot): GelbooruModule {
    return new GelbooruModule(bot);
  }

  private async explosionCommand(interaction: CommandInteraction): Promise<void> {
    await handleImageCommon(interaction, `rating:general sort:random megumin`);
  }

  private async uselessCommand(interaction: CommandInteraction): Promise<void> {
    await handleImageCommon(interaction, `rating:general sort:random aqua_(konosuba)`);
  }

  private async illyaCommand(interaction: CommandInteraction): Promise<void> {
    await handleImageCommon(interaction, `rating:general sort:random illyasviel_von_einzbern`);
  }

  private async gelbooruCommand(interaction: CommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tags = interaction.args[0];
    await handleImageCommon(interaction, `rating:general sort:random ${tags}`);
  }
}

import { Module } from '../module';
import { Command, CommandInteraction } from '../command';
import { Bot } from '../bot';
import { EmbedBuilder } from 'discord.js';
import { parse as parseURL } from 'url';
import * as cheerio from 'cheerio';

class SearchResult {
  public constructor(public readonly title: string, public readonly url: string, public readonly content: string) {
    this.title = title;
    this.url = url;
    this.content = content;
  }
}

function extractResults(html: string): SearchResult | null {
  const $ = cheerio.load(html);
  const title = $('div.vvjwJb')
    .map((_, el) => $(el).text())
    .get(0);

  const url = $('a')
    .toArray()
    .flatMap((el) => {
      const parsed = parseURL(el.attribs['href'], true);
      const queryPart = parsed.query['q'];
      return typeof queryPart === 'string' && queryPart.startsWith('http') ? [queryPart] : [];
    })[0];

  const content = $('div.s3v9rd')
    .map((_, el) => $(el).text())
    .get(0);

  if (title === undefined || url === undefined || content === undefined) {
    return null;
  }

  return new SearchResult(title, url, content);
}

export class GoogleModule extends Module {
  private constructor(private readonly bot: Bot) {
    super();
    this.bot = bot;
    this.bot.registerCommand(
      new Command('google', 'Search the web', '<query...>', 1, null, async (interaction) =>
        this.googleCommand(interaction)
      )
    );
  }

  public static load(bot: Bot): GoogleModule {
    return new GoogleModule(bot);
  }

  private async googleCommand(interaction: CommandInteraction): Promise<void> {
    const query = interaction.args.join(' ');
    const response = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    const decoder = new TextDecoder('iso-8859-1');

    if (response.status != 200) {
      await interaction.reply(`Failed to get search results; server returned error code ${response.status}`);
      return;
    }

    const html = decoder.decode(await response.arrayBuffer());
    const searchResult = extractResults(html);

    if (searchResult === null) {
      await interaction.reply(`Failed to get search results`);
      return;
    }

    const embed = new EmbedBuilder();
    embed.setTitle(searchResult.title);
    embed.setURL(searchResult.url);
    embed.setDescription(searchResult.content);
    await interaction.reply({ embeds: [embed] });
  }
}

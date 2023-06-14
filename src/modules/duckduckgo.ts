import { Module } from '../module';
import { Command, CommandInteraction } from '../command';
import { Bot } from '../bot';
import { EmbedBuilder } from 'discord.js';
import { parse as parseURL } from 'url';
import * as cheerio from 'cheerio';

class SearchResult {
  public constructor(public readonly title: string, public readonly url: string, public readonly snippet: string) {
    this.title = title;
    this.url = url;
    this.snippet = snippet;
  }
}

function extractResults(html: string): SearchResult[] {
  const $ = cheerio.load(html);
  const titles = $('a.result__a')
    .map((_, el) => $(el).text())
    .toArray();

  const urls = $('a.result__url')
    .toArray()
    .flatMap((el) => {
      const parsed = parseURL(el.attribs['href'], true);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return parsed.query['uddg']!;
    });

  const snippets = $('a.result__snippet')
    .map((_, el) => $(el).text())
    .toArray();

  return titles.map((title, i) => new SearchResult(title, urls[i], snippets[i]));
}

export class DuckDuckGoModule extends Module {
  private constructor(private readonly bot: Bot) {
    super();

    const duckduckgoCommand = new Command('!ddg', 'Search the web (with duckduckgo)', '<query>', 1, 1, (interaction) =>
      this.ddgCommand(interaction)
    );

    bot.registerCommand(duckduckgoCommand);
    this.bot = bot;
  }

  public static load(bot: Bot): DuckDuckGoModule {
    return new DuckDuckGoModule(bot);
  }

  private async ddgCommand(interaction: CommandInteraction): Promise<void> {
    const query = interaction.args[0];
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const decoder = new TextDecoder('utf-8');

    if (response.status != 200) {
      await interaction.reply(`Failed to get search results; server returned error code ${response.status}`);
      return;
    }

    const html = decoder.decode(await response.arrayBuffer());
    const searchResult = extractResults(html);

    if (searchResult.length === 0) {
      await interaction.reply(`Failed to get search results`);
      return;
    }

    for (const result of searchResult.slice(0, 3)) {
      const embed = new EmbedBuilder();
      embed.setTitle(result.title);
      embed.setURL(result.url);
      embed.setDescription(result.snippet);
      await interaction.reply({ embeds: [embed] });
    }
  }
}

import { Module } from '../module';
import { Bot } from '../bot';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
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

    const duckDuckGoCommand = new SlashCommandBuilder()
      .setName('ddg')
      .setDescription('Search the web (with duckduckgo)')
      .addStringOption(new SlashCommandStringOption().setName('query').setDescription('Search query').setRequired(true))
      .toJSON();

    bot.registerSlashCommand(duckDuckGoCommand, (interaction) => this.ddgCommand(interaction));
    this.bot = bot;
  }

  public static load(bot: Bot): DuckDuckGoModule {
    return new DuckDuckGoModule(bot);
  }

  private async ddgCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const query = interaction.options.getString('query')!;
    await interaction.deferReply();

    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: new Headers({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0',
      }),
    });

    if (response.status != 200) {
      await interaction.followUp(`Failed to get search results; server returned error code ${response.status}`);
      return;
    }

    const searchResults = extractResults(new TextDecoder('utf-8').decode(await response.arrayBuffer()));

    if (searchResults.length === 0) {
      await interaction.followUp(`Failed to get search results`);
      return;
    }

    const embeds = searchResults
      .slice(0, 3)
      .map((result) => new EmbedBuilder().setTitle(result.title).setURL(result.url).setDescription(result.snippet));

    await interaction.followUp({ embeds: embeds });
  }
}

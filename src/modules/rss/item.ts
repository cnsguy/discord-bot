import RSSParser from 'rss-parser';
import * as cheerio from 'cheerio';

function isLinkImage(href: string): boolean {
  const extensions = ['gif', 'png', 'webp', 'jpg', 'jpeg'];

  for (const extension of extensions) {
    if (href.endsWith(`.${extension}`)) {
      return true;
    }
  }

  return false;
}

function extractImagesFromHTML(html: string): string[] {
  const $ = cheerio.load(html);
  const linkImages = $('a')
    .map((_, el) => el.attribs['href'])
    .toArray()
    .filter((link) => isLinkImage(link));

  const images = $('img')
    .map((_, el) => el.attribs['src'])
    .toArray();

  return linkImages.concat(images);
}

export class RSSItemError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface RawMediaGroupThumbnail {
  readonly url: string;
}

interface RawMediaGroupThumbnailContainer {
  readonly ['$']?: RawMediaGroupThumbnail;
}

interface RawMediaGroup {
  readonly ['media:description']?: string[];
  readonly ['media:thumbnail']?: RawMediaGroupThumbnailContainer[];
}

interface RawRSSItem {
  readonly content?: string;
  readonly title?: string;
  readonly author?: string;
  readonly link?: string;
  readonly contentSnippet?: string;
  readonly ['media:group']?: RawMediaGroup;
}

interface RawRSSFeed {
  readonly items: RawRSSItem[];
}

function processRSSContent(rawItem: RawRSSItem, isYoutube: boolean): string | null {
  if (isYoutube) {
    const description = rawItem['media:group']?.['media:description']?.[0];

    if (description !== undefined) {
      return description;
    }
  }

  return rawItem.contentSnippet ? rawItem.contentSnippet : null;
}

function processRSSImages(rawItem: RawRSSItem, isYoutube: boolean): string[] {
  if (isYoutube) {
    const url = rawItem['media:group']?.['media:thumbnail']?.[0]?.['$']?.['url'];

    if (url !== undefined) {
      return [url];
    }
  }

  return rawItem.content ? extractImagesFromHTML(rawItem.content) : [];
}

async function getRawRSS(link: string): Promise<RawRSSFeed> {
  const parser = new RSSParser<RawRSSFeed>({
    customFields: {
      item: ['media:group'],
    },
  });

  return parser.parseURL(link);
}

export class RSSItem {
  public constructor(
    public link: string,
    public content: string | null,
    public title: string | null,
    public author: string | null,
    public images: string[]
  ) {
    this.link = link;
    this.content = content;
    this.title = title;
    this.author = author;
    this.images = images;
  }

  public static async fromLink(link: string): Promise<RSSItem[]> {
    let rawResult;

    try {
      rawResult = await getRawRSS(link);
    } catch (error) {
      throw new RSSItemError(String(error));
    }

    const results: RSSItem[] = [];

    for (const rawItem of rawResult.items) {
      if (rawItem.link === undefined) {
        continue;
      }

      const parsedLink = new URL(rawItem.link);
      const isYoutube = parsedLink.hostname === 'www.youtube.com';
      const images = processRSSImages(rawItem, isYoutube);
      const content = processRSSContent(rawItem, isYoutube);

      results.push(
        new RSSItem(
          rawItem.link,
          content,
          rawItem.title ? rawItem.title : null,
          rawItem.author ? rawItem.author : null,
          images
        )
      );
    }

    return results;
  }
}

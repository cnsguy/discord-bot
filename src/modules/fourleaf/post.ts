import { fetchJson } from '../../util';
import { convert } from 'html-to-text';

interface RawFourLeafCatalogThread {
  readonly no: number;
}

interface RawFourLeafCatalogPage {
  readonly threads: RawFourLeafCatalogThread[];
}

type RawFourLeafCatalog = RawFourLeafCatalogPage[];

interface RawFourLeafPost {
  readonly no: number;
  readonly name: string;
  readonly sub?: string;
  readonly com?: string;
  readonly filename?: string;
  readonly ext?: string;
  readonly tim: number;
  readonly time: number;
  readonly trip?: string;
}

interface RawFourLeafThread {
  readonly posts: RawFourLeafPost[];
}

export class FourLeafPost {
  public constructor(
    public readonly url: string,
    public readonly no: number,
    public readonly name: string,
    public readonly subject: string | undefined,
    public readonly message: string | undefined,
    public readonly filename: string | undefined,
    public readonly trip: string | undefined,
    public readonly threadSubject: string | undefined,
    public readonly numReplies: number,
    public readonly time: number,
    public readonly fileUrl: string | undefined,
    public readonly isOp: boolean
  ) {
    this.url = url;
    this.no = no;
    this.name = name;
    this.subject = subject;
    this.message = message;
    this.filename = filename;
    this.trip = trip;
    this.threadSubject = threadSubject;
    this.numReplies = numReplies;
    this.time = time;
    this.fileUrl = fileUrl;
    this.isOp = isOp;
  }
}

class MentionTrackedPost {
  public mentions: number;

  public constructor(
    public readonly url: string,
    public readonly no: number,
    public readonly name: string,
    public readonly sub: string | undefined,
    public readonly trip: string | undefined,
    public readonly time: number,
    public readonly message: string | undefined,
    public readonly filename: string | undefined,
    public readonly threadSubject: string | undefined,
    public readonly fileUrl: string | undefined,
    public readonly isOp: boolean
  ) {
    this.url = url;
    this.no = no;
    this.name = name;
    this.sub = sub;
    this.trip = trip;
    this.time = time;
    this.message = message;
    this.filename = filename;
    this.threadSubject = threadSubject;
    this.fileUrl = fileUrl;
    this.isOp = isOp;
    this.mentions = 0;
  }

  public addMention(): void {
    this.mentions += 1;
  }
}

export async function getNewPosts(board: string): Promise<FourLeafPost[]> {
  const catalog = await fetchJson<RawFourLeafCatalog>(`https://a.4cdn.org/${board}/catalog.json`);
  const results = [];
  const mentionTracker = new Map<number, MentionTrackedPost>();

  for (const rawPage of catalog) {
    for (const rawCatalogThread of rawPage.threads) {
      const rawThread = await fetchJson<RawFourLeafThread>(
        `https://a.4cdn.org/${board}/thread/${rawCatalogThread.no}.json`
      );

      const threadSubject = rawThread.posts[0]?.sub;

      for (const rawPost of rawThread.posts) {
        const filename =
          rawPost.filename !== undefined && rawPost.ext !== undefined ? rawPost.filename + rawPost.ext : undefined;

        let message = undefined;

        if (rawPost.com !== undefined) {
          message = convert(rawPost.com, {
            wordwrap: 2000, // XXX tmp
          });

          const mentions = [...message.matchAll(/>>(\d+)/g)].map((match) => Number(match[1]));

          for (const mention of mentions) {
            const post = mentionTracker.get(mention);

            if (post !== undefined) {
              post.addMention();
            }
          }
        }

        mentionTracker.set(
          rawPost.no,
          new MentionTrackedPost(
            `https://boards.4chan.org/${board}/thread/${rawCatalogThread.no}#p${rawPost.no}`,
            rawPost.no,
            rawPost.name,
            rawPost.sub,
            rawPost.trip,
            rawPost.time,
            message,
            filename,
            threadSubject,
            rawPost.ext !== undefined ? `https://i.4cdn.org/${board}/${rawPost.tim}${rawPost.ext}` : undefined,
            rawPost.no === rawCatalogThread.no
          )
        );
      }
    }
  }

  for (const elem of mentionTracker.values()) {
    results.push(
      new FourLeafPost(
        elem.url,
        elem.no,
        elem.name,
        elem.sub,
        elem.message,
        elem.filename,
        elem.trip,
        elem.threadSubject,
        elem.mentions,
        elem.time,
        elem.fileUrl,
        elem.isOp
      )
    );
  }

  return results;
}

import { slowFetchJson } from '../../util';
import { convert } from 'html-to-text';

interface RawFourLeafCatalogThread {
  readonly no: number;
}

interface RawFourLeafCatalogPage {
  readonly threads: RawFourLeafCatalogThread[];
}

type RawFourLeafCatalog = RawFourLeafCatalogPage[];

interface RawFourLeafCatalogThreadPost {
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

interface RawFourLeafCatalogThread {
  readonly posts: RawFourLeafCatalogThreadPost[];
}

interface RawFourLeafPageThreadPost {
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

interface RawFourLeafPageThread {
  readonly posts: RawFourLeafPageThreadPost[];
}

interface RawFourLeafPage {
  readonly threads: RawFourLeafPageThread[];
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
    public readonly time: number,
    public readonly fileUrl: string | undefined,
    public readonly board: string
  ) {
    this.url = url;
    this.no = no;
    this.name = name;
    this.subject = subject;
    this.message = message;
    this.filename = filename;
    this.trip = trip;
    this.threadSubject = threadSubject;
    this.time = time;
    this.fileUrl = fileUrl;
    this.board = board;
  }
}

export class FourLeafThreadPost extends FourLeafPost {
  public numReplies: number;

  public constructor(
    url: string,
    no: number,
    name: string,
    subject: string | undefined,
    message: string | undefined,
    filename: string | undefined,
    trip: string | undefined,
    threadSubject: string | undefined,
    time: number,
    fileUrl: string | undefined,
    board: string,
    public readonly isOp: boolean | undefined
  ) {
    super(url, no, name, subject, message, filename, trip, threadSubject, time, fileUrl, board);
    this.numReplies = 1;
    this.isOp = isOp;
  }

  public addMention(): void {
    this.numReplies += 1;
  }
}

export class FourLeafPagePost extends FourLeafPost {}

export async function getNewThreadPosts(board: string): Promise<FourLeafThreadPost[]> {
  const catalog = await slowFetchJson<RawFourLeafCatalog>(`https://a.4cdn.org/${board}/catalog.json`, 1000);
  const results = [];
  const mentionTracker = new Map<number, FourLeafThreadPost>();

  for (const rawPage of catalog) {
    for (const rawCatalogThread of rawPage.threads) {
      const rawThread = await slowFetchJson<RawFourLeafCatalogThread>(
        `https://a.4cdn.org/${board}/thread/${rawCatalogThread.no}.json`,
        1000
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

        const post = new FourLeafThreadPost(
          `https://boards.4chan.org/${board}/thread/${rawCatalogThread.no}#p${rawPost.no}`,
          rawPost.no,
          rawPost.name,
          rawPost.sub,
          message,
          filename,
          rawPost.trip,
          threadSubject,
          rawPost.time,
          rawPost.ext !== undefined ? `https://i.4cdn.org/${board}/${rawPost.tim}${rawPost.ext}` : undefined,
          board,
          rawPost.no === rawCatalogThread.no
        );

        mentionTracker.set(rawPost.no, post);
        results.push(post);
      }
    }
  }

  return results;
}

export async function getNewFrontPagePosts(board: string): Promise<FourLeafPagePost[]> {
  const catalog = await slowFetchJson<RawFourLeafPage>(`https://a.4cdn.org/${board}/1.json`, 1000);
  const results = [];

  for (const rawThread of catalog.threads) {
    for (const rawPost of rawThread.posts) {
      const threadSubject = rawThread.posts[0]?.sub;

      const filename =
        rawPost.filename !== undefined && rawPost.ext !== undefined ? rawPost.filename + rawPost.ext : undefined;

      let message = undefined;

      if (rawPost.com !== undefined) {
        message = convert(rawPost.com, {
          wordwrap: 2000, // XXX tmp
        });
      }

      const post = new FourLeafPagePost(
        `https://boards.4chan.org/${board}/thread/${rawThread.posts[0].no}#p${rawPost.no}`,
        rawPost.no,
        rawPost.name,
        rawPost.sub,
        message,
        filename,
        rawPost.trip,
        threadSubject,
        rawPost.time,
        rawPost.ext !== undefined ? `https://i.4cdn.org/${board}/${rawPost.tim}${rawPost.ext}` : undefined,
        board
      );

      results.push(post);
    }
  }

  return results;
}

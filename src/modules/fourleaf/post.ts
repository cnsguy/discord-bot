import { fetchJson, slowFetchJson } from '../../util';
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
    public readonly board: string,
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
    this.time = time;
    this.fileUrl = fileUrl;
    this.board = board;
    this.isOp = isOp;
  }
}

export class FourLeafThreadPost extends FourLeafPost {
  public numThreadReplies: number;

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
    isOp: boolean
  ) {
    super(url, no, name, subject, message, filename, trip, threadSubject, time, fileUrl, board, isOp);
    this.numThreadReplies = 1;
  }

  public addMention(): void {
    this.numThreadReplies += 1;
  }
}

export class FourLeafPagePost extends FourLeafPost {}

export async function* getNewThreadPosts(board: string): AsyncGenerator<FourLeafPost> {
  let catalog: RawFourLeafCatalog;

  try {
    catalog = await fetchJson<RawFourLeafCatalog>(`https://a.4cdn.org/${board}/catalog.json`);
  } catch (error) {
    console.error(`Exception while fetching fourleaf catalog: ${String(error)}`);
    return;
  }

  for (const rawPage of catalog) {
    for (const rawCatalogThread of rawPage.threads) {
      const mentionTracker = new Map<number, FourLeafThreadPost>();
      const results = [];
      let rawThread: RawFourLeafCatalogThread;

      try {
        rawThread = await slowFetchJson<RawFourLeafCatalogThread>(
          `https://a.4cdn.org/${board}/thread/${rawCatalogThread.no}.json`,
          1000
        );
      } catch (error) {
        console.error(`Exception while fetching fourleaf thread: ${String(error)}`);
        continue;
      }

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

        results.push(post);
        mentionTracker.set(rawPost.no, post);
      }

      for (const result of results) {
        yield result;
      }
    }
  }
}

export async function getNewFrontPagePosts(board: string): Promise<FourLeafPagePost[]> {
  const catalog = await fetchJson<RawFourLeafPage>(`https://a.4cdn.org/${board}/1.json`);
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
        board,
        rawPost.no === rawThread.posts[0]?.no
      );

      results.push(post);
    }
  }

  return results;
}

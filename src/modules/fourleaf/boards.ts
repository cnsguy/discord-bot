import { slowFetchJson } from '../../util';

interface RawFourLeafBoardListEntry {
  readonly board: string;
}

interface RawFourLeafBoardList {
  readonly boards: RawFourLeafBoardListEntry[];
}

export async function getFourLeafBoards(): Promise<string[]> {
  const raw = await slowFetchJson<RawFourLeafBoardList>('https://a.4cdn.org/boards.json', 1000);
  return raw.boards.map((entry) => entry.board);
}

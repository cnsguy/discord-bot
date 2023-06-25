import { fetchJson } from '../../util';

interface RawFourLeafBoardListEntry {
  readonly board: string;
}

interface RawFourLeafBoardList {
  readonly boards: RawFourLeafBoardListEntry[];
}

export async function getFourLeafBoards(): Promise<string[]> {
  const raw = await fetchJson<RawFourLeafBoardList>('https://a.4cdn.org/boards.json');
  return raw.boards.map((entry) => entry.board);
}

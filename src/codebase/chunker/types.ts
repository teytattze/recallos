type Chunk = {
  content: string;
  symbolName: string;
  symbolKind: string;
  filePath: string;
  startLine: number;
  endLine: number;
};

type Chunker = {
  chunk(content: string, filePath: string): Chunk[];
};

export type { Chunk, Chunker };

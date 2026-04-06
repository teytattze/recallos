type DiskFile = { path: string; hash: string };
type StateEntry = { filePath: string; contentHash: string };

type DiffResult = {
  added: string[];
  modified: string[];
  deleted: string[];
  unchanged: string[];
};

function diffFiles(
  diskFiles: DiskFile[],
  stateEntries: StateEntry[],
): DiffResult {
  const stateMap = new Map(
    stateEntries.map((s) => [s.filePath, s.contentHash]),
  );
  const diskMap = new Map(diskFiles.map((f) => [f.path, f.hash]));

  const added: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const file of diskFiles) {
    const storedHash = stateMap.get(file.path);
    if (storedHash === undefined) {
      added.push(file.path);
    } else if (storedHash !== file.hash) {
      modified.push(file.path);
    } else {
      unchanged.push(file.path);
    }
  }

  const deleted = stateEntries
    .filter((s) => !diskMap.has(s.filePath))
    .map((s) => s.filePath);

  return { added, modified, deleted, unchanged };
}

export { diffFiles };
export type { DiskFile, StateEntry, DiffResult };

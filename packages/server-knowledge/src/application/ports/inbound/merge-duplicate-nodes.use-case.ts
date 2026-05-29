import type { Result } from "@repo/server-kernel";

export type MergeDuplicateNodesInput = {
  limit: number;
};

export type MergeDuplicateNodesReport = {
  merged: number;
};

/** Drains `DUPLICATE_OF` edges: folds provenance into the survivor and
 *  re-points incident edges, reusing the domain's merge semantics (§6/§8). */
export interface MergeDuplicateNodes {
  execute(
    input: MergeDuplicateNodesInput,
  ): Promise<Result<MergeDuplicateNodesReport>>;
}

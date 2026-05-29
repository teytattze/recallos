import { type NodeId } from "./node-id.value-object.ts";

/** A candidate match for resolution. `matchedByKey` flags a deterministic
 *  natural-key hit; otherwise `score` is a vector-similarity score in `[0, 1]`. */
export type ResolutionMatch = {
  nodeId: NodeId;
  score: number;
  matchedByKey: boolean;
};

export type ResolutionThresholds = {
  /** At/above this similarity a single match is taken as the same entity. */
  resolve: number;
  /** At/above this (but below `resolve`) matches are ambiguous — defer to merge. */
  ambiguous: number;
};

export type ResolutionDecision =
  | { kind: "new" }
  | { kind: "resolved"; nodeId: NodeId }
  | { kind: "ambiguous"; candidates: NodeId[] };

/**
 * The pure entity-resolution decision (§8 of the processing doc): given the
 * candidate matches gathered by the application layer (natural-key lookup +
 * optional vector ANN), decide whether the candidate **is** an existing node,
 * is **new**, or is **ambiguous**. The I/O — how matches are fetched — lives in
 * ports; only the threshold policy lives here so it stays unit-testable.
 *
 * The bias is conservative: prefer transient fragmentation (a later merge fixes
 * it) over irreversible over-merging in the hot path.
 */
export const EntityResolution = {
  classify(
    matches: ResolutionMatch[],
    thresholds: ResolutionThresholds,
  ): ResolutionDecision {
    const keyMatch = matches.find((match) => match.matchedByKey);
    if (keyMatch) return { kind: "resolved", nodeId: keyMatch.nodeId };

    const strong = matches.filter((match) => match.score >= thresholds.resolve);
    if (strong.length === 1)
      return { kind: "resolved", nodeId: strong[0]!.nodeId };
    if (strong.length > 1)
      return { kind: "ambiguous", candidates: strong.map((m) => m.nodeId) };

    const near = matches.filter((match) => match.score >= thresholds.ambiguous);
    if (near.length > 0)
      return { kind: "ambiguous", candidates: near.map((m) => m.nodeId) };

    return { kind: "new" };
  },
} as const;

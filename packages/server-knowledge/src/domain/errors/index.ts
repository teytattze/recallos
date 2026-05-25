import { defineError } from "server-kernel";

export const EmptyNodeBodyError = defineError(
  "EmptyNodeBodyError",
  "validation",
);
export const NodeBodyTooLongError = defineError(
  "NodeBodyTooLongError",
  "validation",
);
export const EmptyEmbeddingError = defineError(
  "EmptyEmbeddingError",
  "validation",
);
export const NonFiniteEmbeddingError = defineError(
  "NonFiniteEmbeddingError",
  "validation",
);
export const MissingEmbeddingModelError = defineError(
  "MissingEmbeddingModelError",
  "validation",
);
export const ConfidenceOutOfRangeError = defineError(
  "ConfidenceOutOfRangeError",
  "validation",
);
export const UnknownNodeTypeError = defineError(
  "UnknownNodeTypeError",
  "validation",
);
export const UnknownRelationshipTypeError = defineError(
  "UnknownRelationshipTypeError",
  "validation",
);
export const MissingProvenanceError = defineError(
  "MissingProvenanceError",
  "validation",
);
export const SelfLoopNotAllowedError = defineError(
  "SelfLoopNotAllowedError",
  "validation",
);
export const IncompatibleRelationshipError = defineError(
  "IncompatibleRelationshipError",
  "validation",
);
export const EmptyGraphNameError = defineError(
  "EmptyGraphNameError",
  "validation",
);

export type KnowledgeGraphDomainError =
  | ReturnType<typeof EmptyNodeBodyError>
  | ReturnType<typeof NodeBodyTooLongError>
  | ReturnType<typeof EmptyEmbeddingError>
  | ReturnType<typeof NonFiniteEmbeddingError>
  | ReturnType<typeof MissingEmbeddingModelError>
  | ReturnType<typeof ConfidenceOutOfRangeError>
  | ReturnType<typeof UnknownNodeTypeError>
  | ReturnType<typeof UnknownRelationshipTypeError>
  | ReturnType<typeof MissingProvenanceError>
  | ReturnType<typeof SelfLoopNotAllowedError>
  | ReturnType<typeof IncompatibleRelationshipError>
  | ReturnType<typeof EmptyGraphNameError>;

import type { HoidHistoryBackendKind } from "./conversationHistoryAuthorityJournal";

/**
 * Migration-only capability exposed by a fenced storage adapter.
 *
 * It is deliberately separate from the ordinary application store: reads and
 * writes are permitted only while the partition is fenced for the exact
 * operation and generation. The adapter must hold its native exclusive gate
 * across the complete storage operation.
 */
export type HoidHistoryMigrationSnapshotPort = Readonly<{
  kind: HoidHistoryBackendKind;
  role: "source" | "target";
  read: (input: Readonly<{
    operationId: string;
    generation: number;
  }>) => Promise<unknown>;
  replace: (input: Readonly<{
    operationId: string;
    generation: number;
    expectedRevision: number;
    snapshot: unknown;
  }>) => Promise<unknown>;
  clear: (input: Readonly<{
    operationId: string;
    generation: number;
    expectedRevision: number;
  }>) => Promise<unknown>;
}>;

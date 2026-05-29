/**
 * Runs `work` inside a single transaction so a page's writes — nodes, edges,
 * ledger rows, and the checkpoint — commit atomically (§10). The repositories
 * enrolled in the work share that transaction.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

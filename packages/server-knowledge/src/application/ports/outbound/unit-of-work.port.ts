/**
 * Runs `work` inside a single transaction so a batch's writes — nodes, edges,
 * and ledger rows — commit atomically (§10). The repositories enrolled in the
 * work share that transaction.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { codebaseTable, type SelectCodebase } from "@/db/schema";
import { newBaseFieldsValue } from "@/db/util";

async function getCodebaseById(id: string): Promise<SelectCodebase | null> {
  const [codebase] = await db
    .select()
    .from(codebaseTable)
    .where(eq(codebaseTable.id, id));
  return codebase ?? null;
}

async function ensureCodebase(
  name: string,
): Promise<{ id: string; name: string }> {
  const [existing] = await db
    .select({ id: codebaseTable.id, name: codebaseTable.name })
    .from(codebaseTable)
    .where(eq(codebaseTable.name, name))
    .limit(1);

  if (existing) return existing;

  const [inserted] = await db
    .insert(codebaseTable)
    .values({ ...newBaseFieldsValue(), name })
    .returning({ id: codebaseTable.id, name: codebaseTable.name });

  return inserted!;
}

async function listCodebases(): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: codebaseTable.id, name: codebaseTable.name })
    .from(codebaseTable);
}

async function deleteCodebase(name: string): Promise<boolean> {
  const deleted = await db
    .delete(codebaseTable)
    .where(eq(codebaseTable.name, name))
    .returning({ id: codebaseTable.id });

  return deleted.length > 0;
}

export { getCodebaseById, ensureCodebase, listCodebases, deleteCodebase };

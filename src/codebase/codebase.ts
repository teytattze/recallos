import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { codebase } from "@/db/schema";
import { newBaseFieldsValue } from "@/db/util";

async function ensureCodebase(
  name: string,
): Promise<{ id: string; name: string }> {
  const [existing] = await db
    .select({ id: codebase.id, name: codebase.name })
    .from(codebase)
    .where(eq(codebase.name, name))
    .limit(1);

  if (existing) return existing;

  const [inserted] = await db
    .insert(codebase)
    .values({ ...newBaseFieldsValue(), name })
    .returning({ id: codebase.id, name: codebase.name });

  return inserted!;
}

async function listCodebases(): Promise<{ id: string; name: string }[]> {
  return db.select({ id: codebase.id, name: codebase.name }).from(codebase);
}

async function deleteCodebase(name: string): Promise<boolean> {
  const deleted = await db
    .delete(codebase)
    .where(eq(codebase.name, name))
    .returning({ id: codebase.id });

  return deleted.length > 0;
}

export { ensureCodebase, listCodebases, deleteCodebase };

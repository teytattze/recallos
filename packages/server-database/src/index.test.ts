import {
  Prisma,
  PrismaClient,
  createPrismaClient,
} from "@repo/server-database";
import { expect, test } from "bun:test";

test("server-database barrel: given representative public contracts, it should export them", () => {
  // THEN
  expect(createPrismaClient).toBeDefined();
  expect(PrismaClient).toBeDefined();
  expect(Prisma).toBeDefined();
});

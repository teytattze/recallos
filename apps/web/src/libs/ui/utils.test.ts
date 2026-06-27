import { expect, test } from "vitest";

import { cn } from "@/libs/ui/utils";

test("cn: given conflicting Tailwind classes, it should keep the later class", () => {
  // WHEN
  const className = cn("px-2 text-sm", "px-4");

  // THEN
  expect(className).toBe("text-sm px-4");
});

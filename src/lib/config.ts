import { join } from "node:path";
import z from "zod";

const CONFIG_FILE = ".recallos.json";

const configSchema = z.object({
  codebase: z.object({
    id: z.uuidv7(),
  }),
  excludePattern: z.string().array().default([]),
});

type Config = z.infer<typeof configSchema>;

async function loadConfig(dir: string = process.cwd()): Promise<Config> {
  const filePath = join(dir, CONFIG_FILE);
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(
      `${CONFIG_FILE} not found in ${dir}. Run "recallos setup" first.`,
    );
  }
  const content = await file.json();
  return configSchema.parse(content);
}

async function saveConfig(config: Config, dir: string = process.cwd()) {
  const filePath = join(dir, CONFIG_FILE);
  await Bun.write(filePath, JSON.stringify(config, null, 2) + "\n");
}

export { loadConfig, saveConfig, configSchema };
export type { Config };

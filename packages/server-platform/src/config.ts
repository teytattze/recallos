import convict, { type Schema } from "convict";

type ConfigWithEnvironment = {
  readonly app: {
    readonly environment: string;
  };
};

type ConfigParser<Config> = {
  parse(value: unknown): Config;
};

type CreateConfigOptions<Config extends ConfigWithEnvironment> = {
  readonly schema: Schema<Config>;
  readonly parser: ConfigParser<Config>;
  readonly profiles: Readonly<Record<string, object>>;
  readonly env?: NodeJS.ProcessEnv;
};

const createConfig = <Config extends ConfigWithEnvironment>({
  schema,
  parser,
  profiles,
  env = process.env,
}: CreateConfigOptions<Config>): Config => {
  const config = convict(schema, { env });
  const environment = config.getProperties().app.environment;

  if (!Object.hasOwn(profiles, environment)) {
    throw new Error(`Unsupported APP_ENV: ${String(environment)}`);
  }

  config.load(profiles[environment]);
  config.validate({ allowed: "strict" });

  return parser.parse(config.getProperties());
};

export { createConfig };
export type { ConfigParser, CreateConfigOptions };

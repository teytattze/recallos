interface E2eResource<TInitArgs extends unknown[] = []> {
  init(...args: TInitArgs): Promise<void>;
  cleanUp(): Promise<void>;
}

export type { E2eResource };

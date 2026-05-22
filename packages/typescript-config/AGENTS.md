# AGENTS.md — TypeScript Config

Shared TypeScript configurations extended by all apps and packages. Read the [root AGENTS.md](../../AGENTS.md) first.

## Configs

| File          | Extends | For                                                                            |
| ------------- | ------- | ------------------------------------------------------------------------------ |
| `base.json`   | —       | Foundation. Strict, `bundler` resolution, `noUncheckedIndexedAccess`, no emit. |
| `bun.json`    | base    | Bun apps and packages.                                                         |
| `nextjs.json` | base    | Next.js apps. Adds `jsx: preserve`, Next plugin, `allowJs`.                    |
| `react.json`  | base    | React packages. Adds `jsx: react-jsx`.                                         |

## When modifying

- Add new options to `base.json` only if they apply to **every** consumer.
- App-specific overrides go in the app's own `tsconfig.json`, not here.
- Never relax strictness in `base.json`. If an app needs looser rules, override in its local `tsconfig.json`.

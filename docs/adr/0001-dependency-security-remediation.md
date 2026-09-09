# ADR-0001: Dependency security remediation and removal of unused CLI dependencies

* **Status:** Accepted
* **Date:** 2026-09-09
* **Deciders:** Project maintainer
* **Supersedes / Superseded by:** —

## Context

`npm audit` reported **17 vulnerabilities (9 high, 5 moderate, 3 low)** against the
dependency tree, and `npm run lint` could not run at all.

Analysis of the audit output identified four distinct root causes:

1. **`@modelcontextprotocol/sdk@1.9.0` (high, direct runtime dependency)**
   * `GHSA-w48q-cv73-mx4w` — DNS rebinding protection not enabled by default.
   * `GHSA-8r9q-7v3j-jr4g` — ReDoS in the SDK.
   * The old SDK also pulled a vulnerable Express 5 sub-tree, which is where the
     `body-parser`, `qs` and `path-to-regexp` advisories came from.
2. **`uuid@11.1.0` (moderate, direct runtime dependency)**
   * `GHSA-w5hq-g745-h8pq` — missing buffer bounds check in v3/v5/v6 when `buf` is provided.
3. **Unused dependencies contributing vulnerabilities.** `inquirer` and `chalk` were
   declared in `dependencies` but had **zero references anywhere in `src/`**. The
   `inquirer` tree was the sole source of the `tmp` (`GHSA-52f5-9888-hmc6`,
   `GHSA-ph9p-34f9-6g65`), `external-editor` and `@inquirer/editor` advisories.
   This server is a stdio MCP server; it has no interactive terminal prompts, so
   these packages were dead weight and pure attack surface.
4. **Dev-tooling transitives** (`ajv`, `js-yaml`, `minimatch`, `brace-expansion`,
   `flatted`, `picomatch`, `tar-fs`, `yaml`, `diff`) reachable only from ESLint,
   nodemon and copyfiles, all fixable in-range.

Separately, `npm run lint` failed outright because `.prettierrc.json`,
`.eslintrc.json` and `tsconfig.json` were committed with a UTF-8 BOM (`EF BB BF`),
which is not valid JSON — Prettier threw `JSONError: Unexpected token "\u{feff}"`.
ESLint also had no ignore file and therefore linted the generated `dist/` output.

## Decision

1. **Upgrade the vulnerable direct dependencies** rather than pinning transitive
   overrides, so fixes come from upstream and stay maintainable:
   * `@modelcontextprotocol/sdk` `^1.9.0` → `^1.30.0`
   * `uuid` `^11.1.0` → `^11.1.1`
   * `zod` `^3.23.8` → `^3.25.76` (required: SDK 1.30 declares a non-optional
     peer dependency `zod: ^3.25 || ^4.0`). Stayed on the zod 3.x line rather than
     jumping to 4.x to avoid a breaking schema-API migration in the same change.
2. **Remove unused dependencies:** `inquirer`, `@types/inquirer`, `chalk`.
3. **Remove `@types/uuid`** — redundant since `uuid` v11 ships its own type
   declarations (`./dist/cjs/index.d.ts`).
4. **Move `@types/better-sqlite3` from `dependencies` to `devDependencies`**, where
   type-only packages belong, so it is not installed in production.
5. **Run `npm audit fix`** for the remaining in-range dev-tree transitives.
6. **Strip the invalid UTF-8 BOMs** from `.prettierrc.json`, `.eslintrc.json` and
   `tsconfig.json`, add an `.eslintignore` for `dist/`, and fix the one
   `no-empty` ESLint error in `ConfigurationManager.ts` so `npm run lint` exits 0.

Deliberately **deferred** (breaking major upgrades, to be handled separately with
their own testing): `better-sqlite3` 13.x (requires Node >= 22), `eslint` 9.x
(flat-config migration), `@typescript-eslint` 8.x, `zod` 4.x, `pino` 10.x,
`@types/node` 26.x, `lint-staged` 16.x. None of these are required to reach zero
known vulnerabilities.

## Consequences

### Positive

* `npm audit` reports **0 vulnerabilities**, verified both in-tree and from a
  clean-room `npm ci` against the committed lockfile.
* Production dependency count reduced; `inquirer`/`chalk` removal eliminated the
  entire `tmp`/`external-editor` advisory chain instead of merely patching it.
* MCP SDK is current, gaining the upstream DNS-rebinding and ReDoS fixes.
* `npm run lint` is usable again (0 errors), and lint no longer scans `dist/`.

### Negative / Risks

* SDK 1.9 → 1.30 is a large jump. Mitigated by a full type-check plus an
  end-to-end functional test of every registered tool (see Validation).
* `zod` was upgraded to satisfy the SDK peer dependency, so schema behaviour is
  now on 3.25.x. Type-check and runtime validation tests both pass.
* Remaining `prettier/prettier` **warnings** (pre-existing formatting drift) were
  intentionally left untouched to keep this security diff reviewable.

## Alternatives Considered

* **`npm audit fix --force`** — rejected: it would have pulled breaking majors
  (eslint 9, better-sqlite3 13, zod 4) with no test suite to catch regressions.
* **`overrides` for transitive pins** — rejected for the direct dependencies since
  real upstream releases already contained the fixes; overrides would have masked
  the outdated SDK rather than resolving it.
* **Keeping `inquirer`/`chalk` "just in case"** — rejected: unused code cannot be
  justified when it is the sole source of three advisories.

## Validation

```bash
npm audit                 # found 0 vulnerabilities
npm audit --omit=dev      # found 0 vulnerabilities (production tree)
npx tsc --noEmit          # exit 0, no type errors
npm run build             # exit 0, dist/server.js + dist/db/schema.sql emitted
npm run lint              # exit 0, 0 errors
cd /tmp/ciaudit && npm ci && npm audit   # clean-room: 0 vulnerabilities
```

Functional verification over stdio JSON-RPC against the rebuilt server:

* `initialize` + `notifications/initialized` handshake succeeds.
* `tools/list` returns all **13** tools.
* Full lifecycle exercised end to end: `createProject` → `searchProjects` →
  `addTask` → `expandTask` → `getNextTask` → `setTaskStatus` → `listTasks` →
  `exportProject` → `deleteProject`, all returning expected payloads.
* Invalid input (`project_id: "not-a-uuid"`) is still correctly rejected as an
  MCP tool error, confirming zod validation behaviour is intact.

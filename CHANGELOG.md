# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

* Resolved all **17 reported npm vulnerabilities** (9 high, 5 moderate, 3 low);
  `npm audit` now reports 0 vulnerabilities for both the full and production-only
  dependency trees. See [ADR-0001](docs/adr/0001-dependency-security-remediation.md).
* Upgraded `@modelcontextprotocol/sdk` `^1.9.0` → `^1.30.0`, fixing
  [GHSA-w48q-cv73-mx4w](https://github.com/advisories/GHSA-w48q-cv73-mx4w)
  (DNS rebinding protection not enabled by default) and
  [GHSA-8r9q-7v3j-jr4g](https://github.com/advisories/GHSA-8r9q-7v3j-jr4g) (ReDoS).
  This also removed the vulnerable transitive `body-parser`, `qs` and
  `path-to-regexp` advisories.
* Upgraded `uuid` `^11.1.0` → `^11.1.1`, fixing
  [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
  (missing buffer bounds check in v3/v5/v6).
* Removed the unused `inquirer` dependency, which was the sole source of the
  `tmp`, `external-editor` and `@inquirer/editor` advisories.
* Applied `npm audit fix` for remaining dev-tree transitives (`ajv`, `js-yaml`,
  `minimatch`, `brace-expansion`, `flatted`, `picomatch`, `tar-fs`, `yaml`, `diff`).

### Changed

* Upgraded `zod` `^3.23.8` → `^3.25.76` to satisfy the non-optional peer
  dependency of MCP SDK 1.30 (`zod: ^3.25 || ^4.0`).
* Moved `@types/better-sqlite3` from `dependencies` to `devDependencies`.

### Removed

* Dropped unused runtime dependencies `inquirer` and `chalk` (no references in `src/`).
* Dropped `@types/inquirer`, and `@types/uuid` (redundant — `uuid` v11 ships its
  own type declarations).

### Fixed

* Removed the invalid UTF-8 BOM from `.prettierrc.json`, `.eslintrc.json` and
  `tsconfig.json`. The BOM made them invalid JSON and caused `npm run lint` to
  abort with `JSONError: Unexpected token "\u{feff}"`.
* Added `.eslintignore` so linting no longer scans the generated `dist/` output.
* Fixed the `no-empty` ESLint error in `ConfigurationManager.ts` by documenting the
  intentional spin-wait block. `npm run lint` now exits 0.

### Documentation

* Documented Cline CLI installation (`cline mcp install`) in `README.md`, and
  clarified that the default database path (`./data/taskmanager.db`) resolves
  relative to the process working directory — i.e. the directory Cline was
  launched from — giving each workspace its own task database. `cwd` is
  deliberately left unset in the MCP settings so this inheritance works.
* Added `CHANGELOG.md`, `docs/adr/template.md` and ADR-0001.

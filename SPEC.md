# Specification

## Installation
- [x] Can be installed in one command.
- [x] Can be uninstalled in one command.

## Integration
- [x] Starting `claude` will not be slower than normal.
- [x] `claudx` will support `fish`.
- [ ] `claudx` will support `zsh`.

## Shims
- [x] `git` will not be shimmed (causes infinite process spawning).

## Metrics
- [x] Collects metrics for all common tools Claude invokes (see `src/tools.ts`).
- [x] Collects runtime duration for a given tool invocation.
- [x] Estimates input tokens for a given tool invocation.
- [x] Estimates output tokens for a given tool invocation.
- [x] Tools which are often used as `tool command` format can be collected as unique tools (e.g. `pnpm install` vs `pnpm run`).

## Configuration
- [x] Can be configured to send metrics to dataStores.
- [x] Configuration can be local in the current directory where `claude` was invoked, or in the home directory.
- [x] Search up to the `git` root from the directory where `claude` was invoked to find a configuration file.

## DataStores
- [x] Supports sending to multiple dataStores.

### SQLite
- [x] Stores data in SQLite database by default.
- [x] SQLite database is shared across the whole system.

### DataDog
- [x] Can be configured to send metrics to DataDog.
- [x] API key can be provided via environment variable.
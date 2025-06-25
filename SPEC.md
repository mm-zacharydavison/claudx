# Specification

## Installation
- [x] Can be installed in one command.
- [x] Can be uninstalled in one command.

## Integration
- [x] Starting `claude` will not be slower than normal.

## Metrics
- [x] Collects metrics for all common tools Claude invokes (see `src/tools.ts`).
- [x] Collects runtime duration for a given tool invocation.
- [x] Estimates input tokens for a given tool invocation.
- [x] Estimates output tokens for a given tool invocation.
- [x] Tools which are often used as `tool command` format can be collected as unique tools (e.g. `pnpm install` vs `pnpm run`).

## Configuration
- [x] Can be configured to send metrics to destinations.
- [x] Configuration can be local in the current directory, or in the home directory.
- [ ] Search up to the `git` root to find a configuration file.

## Destinations
- [x] Supports sending to multiple destinations.

### SQLite
- [x] Stores data in SQLite database by default.
- [x] SQLite database is shared across the whole system.

### DataDog
- [x] Can be configured to send metrics to DataDog.
- [x] API key can be provided via environment variable.
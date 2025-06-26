# 📈🤖`claudx`

A tool that automatically measures and tracks execution times for commands used by Claude Code.
We wrote this tool so we could understand where developers were getting bottlenecked when using Claude Code.

Using it, you can detect what tools are being used, how long they take, and how often they are used.
From that, you can dedicate resources to speeding up the slowest tools.

e.g:

- Are we spending most of the time running `pnpm test`?
- Are we spending most of the time running `type-check` or `lint`?

## Features

- **Automatic Installation**: One-command setup that shims Claude itself
- **Real Metrics**: Measures precise execution time for actual tool calls
- **Auto-Discovery**: Automatically finds and shims all executables on your PATH
- **Safe Implementation**: Zero impact on your system environment  
- **Metrics Storage**: Persists metrics to SQLite database for historical analysis
- **CLI Interface**: View summaries and recent executions via command line
- **Complete Coverage**: Works with any executable Claude Code uses
- **DataDog Integration**: Send metrics to DataDog for analysis (requires configuration)

## How It Works

1. **Shims the `claude` executable** itself - no manual wrapper needed
2. **Auto-discovers executables** on your PATH when Claude starts
3. **Creates shimmed executables** in an isolated directory that Claude will use instead (these track metrics).
4. **Does not affect your own invocations of tools** - your PATH is never modified
5. **Collects real execution metrics** automatically when Claude runs commands

## Privacy

- Command arguments and working directory are stored for analysis.
- No file contents or sensitive data is logged.
- Metrics are stored locally in SQLite database (unless you configure a DataDog dataStore).
- Your system environment is never modified.

## Installation

### Quick Setup (Recommended)

```bash
npx claudx bootstrap
```

This creates shims for common development tools that Claude frequently uses (~100 tools).

### Uninstall

```bash
# Remove claudx (uninstall)
npx claudx uninstall
```

## Usage

Just use Claude normally - metrics are collected automatically:

```bash
# Use Claude exactly as before - metrics collection happens automatically
claude

# No wrapper scripts needed, no manual setup required
```

## Benefits

- ✅ **Zero system impact** - your PATH and environment are never modified
- ✅ **Real metrics** - captures actual tool execution times 
- ✅ **Complete coverage** - works with any executable Claude Code uses
- ✅ **Safe and reversible** - easy to uninstall with no traces
- ✅ **No Claude Code modifications** required

## Configuration

Claudx can be configured using a `claudx.config.js` file. The configuration file will be automatically created in your current directory (or `~/.claudx/`) when Claudx first runs.

### Configuration File Structure

```javascript
// claudx.config.cjs
module.exports = {
  datastores: [
    {
      type: 'sqlite',
      options: {
        // Optional custom database path
        dbPath: process.env.CLAUDX_DB_PATH || undefined
      }
    },
    
    // DataDog dataStore (optional)
    {
      type: 'datadog',
      options: {
        apiKey: process.env.DATADOG_API_KEY,
        site: process.env.DATADOG_SITE || 'datadoghq.com',
        service: process.env.DATADOG_SERVICE || 'claudx',
        env: process.env.DATADOG_ENV || 'development',
        tags: {
          team: process.env.DATADOG_TEAM_NAME || 'claudx-developers',
          // Add more custom tags as needed
        }
      }
    }
  ]
};
```

## Commands

### Viewing Metrics (SQLite only)

```bash
# View summary of all tools
npm run cli summary

# View recent executions
npm run cli recent
```

## Metrics Collected

- **Tool Name**: Which executable was run
- **Duration**: Execution time in milliseconds
- **Success Rate**: Percentage of successful executions
- **Parameters**: Command arguments and working directory
- **Timestamps**: When executions occurred

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test
```

```bash
# Run with debug logging
# (warning, this will emit noise into the tool responses consumed by claude)
LOG_LEVEL=debug claude
```

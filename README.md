# Claudx

A tool that automatically measures and tracks execution times for commands used by Claude Code. This tool helps identify performance bottlenecks and understand where Claude Code spends the most time during operations.

## Features

- **Automatic Installation**: One-command setup that shims Claude itself
- **Real Metrics**: Measures precise execution time for actual tool calls
- **Auto-Discovery**: Automatically finds and shims all executables on your PATH
- **Safe Implementation**: Zero impact on your system environment  
- **Metrics Storage**: Persists metrics to SQLite database for historical analysis
- **CLI Interface**: View summaries and recent executions via command line
- **Complete Coverage**: Works with any executable Claude Code uses

## How It Works

1. **Shims the `claude` executable** itself - no manual wrapper needed
2. **Auto-discovers ALL executables** on your PATH when Claude starts
3. **Creates shimmed executables** in an isolated directory  
4. **Leaves your system completely untouched** - no permanent PATH modifications
5. **Collects real execution metrics** automatically when Claude runs commands

## Installation

### Quick Setup (Recommended)

```bash
npm install
npm run bootstrap
```

This creates shims for common development tools that Claude frequently uses (~100 tools).

### Complete Coverage Setup

```bash
npm install
npm run bootstrap:all
```

This discovers and shims ALL executables on your PATH (~3000+ tools) - slower but provides complete coverage.

The installer will:
- Find your existing `claude` executable
- Create a shim that wraps it with metrics collection
- Create shims for tools (common tools by default, or all with `--shim-all`)
- Add the shim to your PATH so `claude` just works

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
// claudx.config.js
export default {
  destinations: [
    {
      type: 'sqlite',
      options: {
        // Optional custom database path
        dbPath: process.env.CLAUDX_DB_PATH || undefined
      }
    },
    
    // DataDog destination (optional)
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

### Configuration Options

#### SQLite Destination
- `type`: Must be `'sqlite'`
- `options.dbPath`: Optional custom path for the SQLite database file

#### DataDog Destination
- `type`: Must be `'datadog'`
- `options.apiKey`: Your DataDog API key (required)
- `options.site`: DataDog site (defaults to `datadoghq.com`)
- `options.service`: Service name for metrics (defaults to `claudx`)
- `options.env`: Environment name (defaults to `development`)
- `options.tags`: Custom tags to attach to metrics

### Environment Variables

The configuration file supports JavaScript expressions and environment variables:

- `CLAUDX_DB_PATH`: Custom SQLite database path
- `DATADOG_API_KEY`: DataDog API key
- `DATADOG_SITE`: DataDog site URL
- `DATADOG_SERVICE`: DataDog service name
- `DATADOG_ENV`: DataDog environment
- `DATADOG_TEAM_NAME`: Team name for DataDog tags

## Commands

### Installation Management

```bash
# Install Claudx metrics (one-time setup)
npm run install

# Remove Claudx metrics (uninstall)
npm run uninstall
```

### Viewing Metrics

```bash
# View summary of all tools
npm run cli summary

# View recent executions
npm run cli recent

# Clear all metrics
npm run cli clear
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

## Privacy

- Command arguments and working directory are stored for analysis
- No file contents or sensitive data is logged
- Metrics are stored locally in SQLite database
- Your system environment is never modified

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request
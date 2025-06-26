#!/usr/bin/env node

/**
 * CLI for interacting with `claudx`.
 * 
 * Invoke `npm run cli` for usage.
 */

import { Command } from 'commander';
import { MetricsManager } from './metrics-manager';

const program = new Command();

program.name('claudx').description('View claudx tool execution metrics').version('1.0.0');

program
  .command('bootstrap')
  .description('Install claudx shims for claude-code metrics collection')
  .option('--shim-all', 'Shim all executables on PATH (slower but complete coverage)')
  .action(async (options) => {
    const { spawn } = await import('child_process');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const fs = await import('fs/promises');
    
    // Get the directory where this script is located
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Setup ~/.claudx directory and copy necessary files
    const installDir = path.join(process.env.HOME || '/tmp', '.claudx');
    await fs.mkdir(installDir, { recursive: true });
    
    // Copy dist files to ~/.claudx for runtime access
    console.log('📦 Copying runtime files to ~/.claudx...');
    const distDir = path.join(__dirname);
    try {
      await fs.copyFile(path.join(distDir, 'metrics-collector.js'), path.join(installDir, 'metrics-collector.js'));
      await fs.copyFile(path.join(distDir, 'auto-shim.js'), path.join(installDir, 'auto-shim.js'));
      await fs.copyFile(path.join(__dirname, '..', 'uninstall.sh'), path.join(installDir, 'uninstall.sh'));
      
      // Create package.json in ~/.claudx to enable ES modules
      await fs.writeFile(path.join(installDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));
    } catch (error) {
      console.error('❌ Failed to copy runtime files:', error);
      process.exit(1);
    }
    
    const scriptPath = path.join(__dirname, '..', 'bootstrap.sh');
    const args = options.shimAll ? ['--shim-all'] : [];
    const child = spawn('bash', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: path.dirname(__dirname)
    });
    
    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  });

program
  .command('uninstall')
  .description('Uninstall claudx shims and restore original claude')
  .action(async () => {
    const { spawn } = await import('child_process');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    // Get the directory where this script is located
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Try to use uninstall.sh from ~/.claudx first, then fall back to package
    const installDir = path.join(process.env.HOME || '/tmp', '.claudx');
    const localUninstallScript = path.join(installDir, 'uninstall.sh');
    const packageUninstallScript = path.join(__dirname, '..', 'uninstall.sh');
    
    const fs = await import('fs/promises');
    let scriptPath: string;
    
    try {
      await fs.access(localUninstallScript);
      scriptPath = localUninstallScript;
    } catch {
      scriptPath = packageUninstallScript;
    }
    
    const child = spawn('bash', [scriptPath], {
      stdio: 'inherit',
      cwd: path.dirname(scriptPath)
    });
    
    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  });

program
  .command('summary')
  .description('Show summary of tool execution metrics')
  .option('-l, --limit <number>', 'Limit number of tools shown', '10')
  .action(async (options) => {
    const manager = new MetricsManager(undefined, process.env.CLAUDX_ORIGINAL_CWD);
    await manager.initialize();
    const summary = await manager.getMetricsSummary();
    const limit = Number.parseInt(options.limit);

    console.log('Tool Execution Summary');
    console.log('=====================');
    console.log();

    const limitedSummary = summary.slice(0, limit);

    if (limitedSummary.length === 0) {
      console.log(
        'No metrics found. Install shims and use Claude Code with the wrapper to collect metrics.'
      );
      console.log('Run: npm run install-shims');
      manager.close();
      return;
    }

    console.log(
      formatTable([
        ['Tool', 'Calls', 'Total (ms)', 'Avg (ms)', 'Tokens', 'Avg Tokens', 'Success %'],
        ...limitedSummary.map((m) => [
          m.toolName,
          m.totalCalls.toString(),
          m.totalDuration.toFixed(1),
          m.avgDuration.toFixed(1),
          m.totalTokens.toString(),
          m.avgTokens.toFixed(0),
          `${(m.successRate * 100).toFixed(1)}%`,
        ]),
      ])
    );

    // Show token breakdown
    console.log();
    console.log('Token Usage Breakdown (Estimated)');
    console.log('====================');
    console.log();

    console.log(
      formatTable([
        ['Tool', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Avg per Call'],
        ...limitedSummary.map((m) => [
          m.toolName,
          m.inputTokens.toString(),
          m.outputTokens.toString(),
          m.totalTokens.toString(),
          m.avgTokens.toFixed(0),
        ]),
      ])
    );

    manager.close();
  });

program
  .command('recent')
  .description('Show recent tool executions')
  .option('-l, --limit <number>', 'Number of recent executions to show', '20')
  .action(async (options) => {
    const manager = new MetricsManager(undefined, process.env.CLAUDX_ORIGINAL_CWD);
    await manager.initialize();
    const recent = await manager.getRecentMetrics(Number.parseInt(options.limit));

    console.log('Recent Tool Executions');
    console.log('======================');
    console.log();

    if (recent.length === 0) {
      console.log(
        'No metrics found. Install shims and use Claude Code with the wrapper to collect metrics.'
      );
      console.log('Run: npm run install-shims');
      manager.close();
      return;
    }

    for (const metric of recent) {
      const status = metric.success ? '✓' : '✗';
      const time = metric.timestamp.toLocaleString();
      console.log(
        `${status} ${metric.toolName} - ${metric.duration.toFixed(1)}ms - ${metric.totalTokens} tokens - ${time}`
      );
      if (metric.totalTokens > 0) {
        console.log(`  Tokens: ${metric.inputTokens} in, ${metric.outputTokens} out`);
      }
      if (!metric.success && metric.errorMessage) {
        console.log(`  Error: ${metric.errorMessage}`);
      }
    }

    manager.close();
  });

program
  .command('config')
  .description('Manage data dataStores configuration')
  .option('--show', 'Show current configuration and config file path')
  .option('--path', 'Show configuration file path')
  .action(async (options) => {
    const manager = new MetricsManager(undefined, process.env.CLAUDX_ORIGINAL_CWD);
    const configManager = manager.getConfigManager();

    if (options.path) {
      console.log('Configuration file path:');
      console.log(configManager.getConfigPath());
      return;
    }

    if (options.show) {
      try {
        await manager.initialize();
        const currentConfig = await configManager.getConfig();

        console.log('Current Data DataStores:');
        console.log('========================');

        currentConfig.dataStores.forEach((dest, index) => {
          if (dest.options) {
            for (const [key, value] of Object.entries(dest.options)) {
              if (typeof value !== 'string') {
                throw new Error(`Expected string for ${key}, got ${typeof value}`);
              }
              if (key === 'apiKey' && value) {
                console.log(`   ${key}: ${'*'.repeat(8)}${value.slice(-4)}`);
              } else {
                console.log(`   ${key}: ${value || 'default'}`);
              }
            }
          }
          console.log();
        });

        console.log('Configuration file path:');
        console.log(configManager.getConfigPath());
      } catch (error) {
        console.error('Error loading configuration:', error);
      }
      return;
    }

    // Default action - show help
    console.log('Configuration Management:');
    console.log('========================');
    console.log('');
    console.log('claudx config --show    Show current configuration');
    console.log('claudx config --path    Show configuration file path');
    console.log('');
    console.log('Edit the configuration file directly to add/remove dataStores.');
    console.log('The file supports JavaScript expressions and environment variables.');
  });

  /**
   * Pretty prints a 2d table.
   * @param rows
   * @returns 
   */
function formatTable(rows: string[][]): string {
  if (rows.length === 0) return '';

  const colWidths = rows[0].map((_, colIndex) =>
    Math.max(...rows.map((row) => row[colIndex]?.length || 0))
  );

  const formatRow = (row: string[], separator = ' ') =>
    row.map((cell, i) => cell.padEnd(colWidths[i])).join(separator);

  const result = [formatRow(rows[0])];
  result.push(colWidths.map((w) => '-'.repeat(w)).join(' '));
  result.push(...rows.slice(1).map((row) => formatRow(row)));

  return result.join('\n');
}

program.parse();

#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { rmdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { MetricsManager } from './metrics-manager.js';
import { MetricsSummary } from './types.js';

const program = new Command();

program.name('claudx').description('View claudx tool execution metrics').version('1.0.0');

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
  .description('Manage data destinations configuration')
  .option('--show', 'Show current configuration and config file path')
  .option('--init', 'Initialize/recreate the configuration file')
  .option('--path', 'Show configuration file path')
  .action(async (options) => {
    const manager = new MetricsManager(undefined, process.env.CLAUDX_ORIGINAL_CWD);
    const configManager = manager.getConfigManager();

    if (options.path) {
      console.log('Configuration file path:');
      console.log(configManager.getConfigPath());
      return;
    }

    if (options.init) {
      await configManager.initializeConfig();
      console.log('Configuration file initialized at:');
      console.log(configManager.getConfigPath());
      console.log(
        '\nEdit this file to configure your data destinations with environment variables.'
      );
      return;
    }

    if (options.show) {
      try {
        await manager.initialize();
        const currentConfig = await configManager.getConfig();

        console.log('Current Data Destinations:');
        console.log('========================');

        currentConfig.destinations.forEach((dest, index) => {
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
        console.log('\nTry running: claudx config --init');
      }
      return;
    }

    // Default action - show help
    console.log('Configuration Management:');
    console.log('========================');
    console.log('');
    console.log('claudx config --show    Show current configuration');
    console.log('claudx config --init    Initialize configuration file');
    console.log('claudx config --path    Show configuration file path');
    console.log('');
    console.log('Edit the configuration file directly to add/remove destinations.');
    console.log('The file supports JavaScript expressions and environment variables.');
  });

program
  .command('uninstall')
  .description('Uninstall by removing the ~/.claudx directory')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    const metricsDir = join(homedir(), '.claudx');

    if (!existsSync(metricsDir)) {
      console.log('~/.claudx directory does not exist. Nothing to uninstall.');
      return;
    }

    if (!options.yes) {
      const { createInterface } = await import('node:readline/promises');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(
        'Are you sure you want to remove ~/.claudx directory? (y/N) '
      );
      rl.close();
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('Cancelled.');
        return;
      }
    }

    try {
      await rmdir(metricsDir, { recursive: true });
      console.log('[claudx] Successfully removed ~/.claudx directory.');
    } catch (error) {
      console.error('[claudx] Failed to remove ~/.claudx directory:', error);
      process.exit(1);
    }
  });

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

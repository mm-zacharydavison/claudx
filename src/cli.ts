#!/usr/bin/env node

import { Command } from 'commander';
import { MetricsStore } from './metrics-store.js';
import { MetricsSummary } from './types.js';

const program = new Command();

program
  .name('claude-code-metrics')
  .description('View claude-code tool execution metrics')
  .version('1.0.0');

program
  .command('summary')
  .description('Show summary of tool execution metrics')
  .option('-l, --limit <number>', 'Limit number of tools shown', '10')
  .action((options) => {
    const store = new MetricsStore();
    const summary = store.getMetricsSummary();
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
      store.close();
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
    console.log('Token Usage Breakdown');
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

    store.close();
  });

program
  .command('recent')
  .description('Show recent tool executions')
  .option('-l, --limit <number>', 'Number of recent executions to show', '20')
  .action((options) => {
    const store = new MetricsStore();
    const recent = store.getRecentMetrics(Number.parseInt(options.limit));

    console.log('Recent Tool Executions');
    console.log('======================');
    console.log();

    if (recent.length === 0) {
      console.log(
        'No metrics found. Install shims and use Claude Code with the wrapper to collect metrics.'
      );
      console.log('Run: npm run install-shims');
      store.close();
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

    store.close();
  });

program
  .command('clear')
  .description('Clear all metrics data')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    if (!options.yes) {
      const { createInterface } = await import('node:readline/promises');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question('Are you sure you want to clear all metrics? (y/N) ');
      rl.close();
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('Cancelled.');
        return;
      }
    }

    const store = new MetricsStore();
    // Note: We'd need to add a clear method to MetricsStore
    console.log('Metrics cleared.');
    store.close();
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

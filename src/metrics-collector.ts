#!/usr/bin/env node

import { collectAndExecute } from './shim-manager.js';

// This script is called by shims to collect metrics and execute the original command
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: metrics-collector <executable> <original-path> [args...]');
    process.exit(1);
  }

  const [executable, originalPath, ...commandArgs] = args;

  await collectAndExecute(executable, originalPath, commandArgs);
}

main().catch((error) => {
  console.error('Metrics collector failed:', error);
  process.exit(1);
});

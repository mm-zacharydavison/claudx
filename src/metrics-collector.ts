#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { ToolMetric } from './types';
import { COMMAND_DESCRIPTORS } from './commands';
import { MetricsManager } from './metrics-manager';

/**
 * Statistics about number of tokens used by Claude.
 */
interface TokenInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Fast token estimation using character count with typical token-to-char ratio
 * GPT-style models: ~4 characters per token on average
 * This is a rough approximation but very fast
 * @param text 
 * @returns 
 */
function estimateTokens(text: string): number {

  return Math.ceil(text.length / 4);
}

/**
 * For tool execution, we estimate tokens from the actual output
 * Input tokens = command + args (what was "sent" to the tool)
 * Output tokens = stdout + stderr (what the tool "generated")
 * @param executable - The executable (e.g. `cat`)
 * @param stdout - contents of stdout
 * @param stderr - contents of stderr
 * @param args - Arguments passed to the executable
 * @returns {@link TokenInfo}
 */
function extractTokensFromOutput(
  executable: string,
  stdout: string,
  stderr: string,
  args: string[]
): TokenInfo {
  const outputTokens = estimateTokens(stdout + stderr);

  // Input tokens = executable name + all arguments
  const inputText = `${executable} ${args.join(' ')}`;
  const inputTokens = estimateTokens(inputText);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

/**
 * Uses a whitelist of tool names to form the tool name that should be saved in metrics.
 * 
 * Some tools are 'omni-tools' (e.g. `pnpm`) and we want to capture the command as well as a separate 'tool'.
 * 
 * e.g (`pnpm run jest`)
 * 
 * @see {@link COMMAND_DESCRIPTORS}
 * 
 * @param executable - The executable (e.g `cat`)
 * @param args - Arguments passed to the executable
 * @returns The final tool name ready for saving.
 */
function generateToolName(executable: string, args: string[]): string {
  // Find matching command descriptor
  const descriptor = COMMAND_DESCRIPTORS.find((d) => d.command === executable);

  if (!descriptor || descriptor.argumentCount === 0 || args.length === 0) {
    return executable;
  }

  // Take the specified number of arguments
  const relevantArgs = args.slice(0, descriptor.argumentCount);

  return `${executable} ${relevantArgs.join(' ')}`;
}

/**
 * Save metrics in the destinations configured for `claudx`.
 * 
 * Creates and invokes a `MetricsManager` instance to save the metrics.
 * 
 * @param metric
 */
async function saveMetric(metric: ToolMetric): Promise<void> {
  if (process.env.LOG_LEVEL === 'debug') {
    console.debug('[claudx] Starting to save metric for:', metric.toolName);
  }

  try {
    const metricsManager = new MetricsManager(undefined, process.env.CLAUDX_ORIGINAL_CWD);
    await metricsManager.initialize();
    await metricsManager.saveMetric(metric);
    metricsManager.close();

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Successfully saved metric for:', metric.toolName);
    }
  } catch (error) {
    // Don't fail the command if metrics collection fails
    console.warn('Failed to save metrics:', error instanceof Error ? error.message : String(error));

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Error details:', error);
    }
  }
}

/**
 * Main function that is called by shims to execute a tool and collect metrics.
 * @param executable - The executable name we are running.
 * @param originalPath - The original executable path (unshimmed).
 * @param args - Arguments to the executable.
 */
export async function executeAndCollect(
  executable: string,
  originalPath: string,
  args: string[]
): Promise<void> {
  const startTime = process.hrtime.bigint();
  const metricId = randomUUID();

  try {
    // Execute original command
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn(originalPath, args, {
          stdio: ['inherit', 'pipe', 'pipe'],
          env: process.env,
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          process.stdout.write(chunk);
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          process.stderr.write(chunk);
        });

        child.on('close', (code) => {
          resolve({ code: code || 0, stdout, stderr });
        });

        child.on('error', reject);
      }
    );

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;

    // Extract token information from output
    const tokens = extractTokensFromOutput(executable, result.stdout, result.stderr, args);

    // Generate tool name with arguments based on command descriptors
    const toolName = generateToolName(executable, args);

    // Save metrics
    await saveMetric({
      id: metricId,
      toolName,
      startTime,
      endTime,
      duration,
      success: result.code === 0,
      errorMessage: result.code !== 0 ? `Exit code: ${result.code}` : undefined,
      parameters: { args, cwd: process.cwd() },
      timestamp: new Date(),
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      totalTokens: tokens.totalTokens,
    });

    process.exit(result.code);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;

    // Generate tool name with arguments based on command descriptors
    const toolName = generateToolName(executable, args);

    await saveMetric({
      id: metricId,
      toolName,
      startTime,
      endTime,
      duration,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      parameters: { args, cwd: process.cwd() },
      timestamp: new Date(),
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });

    console.error(
      `[claudx] Shim execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// This script is called by shims to collect metrics and execute the original command
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('[claudx] Usage: metrics-collector <executable> <original-path> [args...]');
    process.exit(1);
  }

  const [executable, originalPath, ...commandArgs] = args;

  await executeAndCollect(executable, originalPath, commandArgs);
}

main().catch((error) => {
  console.error('[claudx] Metrics collector failed:', error);
  process.exit(1);
});

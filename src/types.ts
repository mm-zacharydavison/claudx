import type { DataStoreConfigOptions } from "./datastore";

/**
 * A metric set for a given tool (e.g. `pnpm`)
 */
export interface ToolMetric {
  id: string;
  toolName: string;
  startTime: bigint;
  endTime: bigint;
  duration: number; // milliseconds
  success: boolean;
  errorMessage?: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * A description of a command, used to decide how many 'words' define a command.
 * 
 * e.g. `pnpm install` is 1 command.
 */
export interface CommandDescriptor {
  /**
   * The base command name.
   * @example `pnpm`.
   */
  command: string;
  /**
   * The number of arguments after the base command that should be included in the command name.
   */
  argumentCount: number;
}

export interface MetricsSummary {
  toolName: string;
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  totalTokens: number;
  avgTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ClaudxConfig {
  datastores: DataStoreConfigOptions[]
}

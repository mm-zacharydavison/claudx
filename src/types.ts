import type { DataStoreConfigOptions } from "./datastore";

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

export interface CommandDescriptor {
  command: string;
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

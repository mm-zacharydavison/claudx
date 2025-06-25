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
  inputTokens: number; // Always 0 for executable metrics
  outputTokens: number; // Always 0 for executable metrics
  totalTokens: number; // Always 0 for executable metrics
}

export interface MetricsSummary {
  toolName: string;
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  totalTokens: number; // Always 0 for executable metrics
  avgTokens: number; // Always 0 for executable metrics
  inputTokens: number; // Always 0 for executable metrics
  outputTokens: number; // Always 0 for executable metrics
}

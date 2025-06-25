import type { MetricsSummary, ToolMetric } from './types.js';

export interface DataDestination {
  saveMetric(metric: ToolMetric): Promise<void>;
  getMetricsSummary(): Promise<MetricsSummary[]>;
  getRecentMetrics(limit?: number): Promise<ToolMetric[]>;
  close(): void;
}

export interface DataDestinationConfig {
  type: 'sqlite' | 'datadog';
  options?: {
    // SQLite options
    dbPath?: string;

    // DataDog options
    apiKey?: string;
    site?: string; // e.g., 'datadoghq.com', 'datadoghq.eu'
    service?: string;
    env?: string;
    tags?: Record<string, string>;
  };
}

export async function createDataDestination(
  config: DataDestinationConfig
): Promise<DataDestination> {
  switch (config.type) {
    case 'sqlite': {
      const { SQLiteDestination } = await import('./destinations/sqlite-destination.js');
      return new SQLiteDestination(config.options?.dbPath);
    }

    case 'datadog': {
      const { DataDogDestination } = await import('./destinations/datadog-destination.unused.js');
      return new DataDogDestination({
        apiKey: config.options?.apiKey || '',
        site: config.options?.site || 'datadoghq.com',
        service: config.options?.service || 'claudx',
        env: config.options?.env || 'development',
        tags: config.options?.tags || {},
      });
    }

    default:
      throw new Error(`Unsupported destination type: ${config.type}`);
  }
}

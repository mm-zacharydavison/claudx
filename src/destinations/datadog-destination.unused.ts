import type { DataDestination } from '../data-destinations.js';
import type { MetricsSummary, ToolMetric } from '../types.js';

export interface DataDogConfig {
  apiKey: string;
  site: string;
  service: string;
  env: string;
  tags: Record<string, string>;
}

interface DataDogMetric {
  metric: string;
  points: [number, number][];
  tags: string[];
  host: string;
  type: 'gauge' | 'count' | 'rate';
}

export class DataDogDestination implements DataDestination {
  private config: DataDogConfig;
  private metricsBuffer: ToolMetric[] = [];
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: DataDogConfig) {
    this.validateConfig(config);
    this.config = config;

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] DataDog destination created (lazy initialization):', {
        site: config.site,
        service: config.service,
        env: config.env,
        tags: config.tags,
        apiKeyPresent: !!config.apiKey,
      });
    }
  }

  private validateConfig(config: DataDogConfig): void {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('DataDog API key is required');
    }

    if (!config.site || config.site.trim() === '') {
      throw new Error('DataDog site is required (e.g., "datadoghq.com", "datadoghq.eu")');
    }

    if (!config.service || config.service.trim() === '') {
      throw new Error('DataDog service name is required');
    }

    if (!config.env || config.env.trim() === '') {
      throw new Error('DataDog environment is required');
    }

    const validSites = ['datadoghq.com', 'datadoghq.eu', 'ddog-gov.com', 'datadoghq.us'];
    if (!validSites.includes(config.site)) {
      console.warn(
        `[claudx] DataDog: Unknown site "${config.site}". Valid sites: ${validSites.join(', ')}`
      );
    }
  }

  async saveMetric(metric: ToolMetric): Promise<void> {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Saving metric:', {
        toolName: metric.toolName,
        duration: metric.duration,
        success: metric.success,
        timestamp: metric.timestamp.toISOString(),
      });
    }

    try {
      await this.ensureInitialized();
      const dataDogMetrics = this.convertToDataDogMetric(metric);
      await this.sendToDataDog(dataDogMetrics);

      if (process.env.LOG_LEVEL === 'debug') {
        console.debug(`[claudx] DataDog: Successfully sent metric for ${metric.toolName}`);
      }
    } catch (error) {
      console.error(`[claudx] DataDog: Failed to send metric for ${metric.toolName}:`, error);
      // Buffer failed metrics for potential retry
      this.metricsBuffer.push(metric);
    }
  }

  async getMetricsSummary(): Promise<MetricsSummary[]> {
    // DataDog destination only supports pushing data
    return [];
  }

  async getRecentMetrics(): Promise<ToolMetric[]> {
    // DataDog destination only supports pushing data
    return [];
  }

  close(): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Closing, buffered metrics:', this.metricsBuffer.length);
    }

    // Flush any remaining buffered metrics
    if (this.metricsBuffer.length > 0) {
      this.flushBufferedMetrics().catch((error) => {
        console.error('[claudx] DataDog: Failed to flush buffered metrics on close:', error);
      });
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initialize();
    return this.initializationPromise;
  }

  private async initialize(): Promise<void> {
    try {
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug('[claudx] DataDog: Performing lazy initialization...');
      }

      await this.testConnection();
      this.isInitialized = true;

      if (process.env.LOG_LEVEL === 'debug') {
        console.debug('[claudx] DataDog: Initialization completed successfully');
      }
    } catch (error) {
      this.initializationPromise = null;
      throw new Error(`DataDog initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async testConnection(): Promise<void> {
    // Send a minimal test request to validate the connection
    const testMetric: DataDogMetric = {
      metric: 'claudx.connection.test',
      points: [[Math.floor(Date.now() / 1000), 1]],
      tags: [`service:${this.config.service}`, `env:${this.config.env}`],
      host: 'localhost',
      type: 'gauge',
    };

    const response = await fetch(`https://api.${this.config.site}/api/v1/series`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.config.apiKey,
      },
      body: JSON.stringify({ series: [testMetric] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DataDog connection test failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] DataDog: Connection test successful');
    }
  }

  // Stub helper methods for future implementation
  private convertToDataDogMetric(metric: ToolMetric): DataDogMetric[] {
    const timestamp = Math.floor(metric.timestamp.getTime() / 1000);
    const baseTags = [
      `tool:${metric.toolName}`,
      `success:${metric.success}`,
      `service:${this.config.service}`,
      `env:${this.config.env}`,
      ...Object.entries(this.config.tags).map(([k, v]) => `${k}:${v}`),
    ];

    return [
      {
        metric: 'claudx.tool.duration',
        points: [[timestamp, metric.duration]],
        tags: baseTags,
        host: 'localhost',
        type: 'gauge',
      },
      {
        metric: 'claudx.tool.input_tokens',
        points: [[timestamp, metric.inputTokens]],
        tags: baseTags,
        host: 'localhost',
        type: 'gauge',
      },
      {
        metric: 'claudx.tool.output_tokens',
        points: [[timestamp, metric.outputTokens]],
        tags: baseTags,
        host: 'localhost',
        type: 'gauge',
      },
    ];
  }

  private async sendToDataDog(metrics: DataDogMetric[]): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('DataDog API key is required');
    }

    const response = await fetch(`https://api.${this.config.site}/api/v1/series`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.config.apiKey,
      },
      body: JSON.stringify({ series: metrics }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DataDog API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[claudx] DataDog: Successfully sent ${metrics.length} metrics`);
    }
  }

  private async flushBufferedMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metrics = this.metricsBuffer.flatMap((metric) => this.convertToDataDogMetric(metric));
      await this.sendToDataDog(metrics);
      this.metricsBuffer = [];

      if (process.env.LOG_LEVEL === 'debug') {
        console.debug(`[claudx] DataDog: Flushed ${metrics.length} buffered metrics`);
      }
    } catch (error) {
      console.error('[claudx] DataDog: Failed to flush buffered metrics:', error);
    }
  }
}

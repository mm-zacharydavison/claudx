import type { DataDestination } from '../data-destinations.js';
import type { ToolMetric, MetricsSummary } from '../types.js';

export interface DataDogConfig {
  apiKey: string;
  site: string;
  service: string;
  env: string;
  tags: Record<string, string>;
}

export class DataDogDestination implements DataDestination {
  private config: DataDogConfig;
  private metricsBuffer: ToolMetric[] = [];

  constructor(config: DataDogConfig) {
    this.config = config;
    
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[DataDogDestination] Initialized with config:', {
        site: config.site,
        service: config.service,
        env: config.env,
        tags: config.tags,
        apiKeyPresent: !!config.apiKey
      });
    }
  }

  async saveMetric(metric: ToolMetric): Promise<void> {
    // For now, just log and buffer the metric
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[DataDogDestination] Saving metric:', {
        toolName: metric.toolName,
        duration: metric.duration,
        success: metric.success,
        timestamp: metric.timestamp.toISOString()
      });
    }

    // Buffer the metric for future batch sending
    this.metricsBuffer.push(metric);

    // Stub: In a real implementation, this would send metrics to DataDog
    // Example API call structure:
    // await this.sendToDataDog([this.convertToDataDogMetric(metric)]);
    
    console.log(`[claudx] DataDog: Would send metric for ${metric.toolName} (duration: ${metric.duration}ms, success: ${metric.success})`);
  }

  async getMetricsSummary(): Promise<MetricsSummary[]> {
    // Stub: In a real implementation, this would query DataDog API
    console.log('[claudx] DataDog: Would query metrics summary from DataDog API');
    
    // For now, return empty array
    return [];
  }

  async getRecentMetrics(limit = 100): Promise<ToolMetric[]> {
    // Stub: In a real implementation, this would query DataDog API
    console.log(`[claudx] DataDog: Would query ${limit} recent metrics from DataDog API`);
    
    // For now, return buffered metrics
    return this.metricsBuffer.slice(-limit);
  }

  close(): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[DataDogDestination] Closing, buffered metrics:', this.metricsBuffer.length);
    }
    
    // Stub: In a real implementation, this would flush any remaining buffered metrics
    if (this.metricsBuffer.length > 0) {
      console.log(`[claudx] DataDog: Would flush ${this.metricsBuffer.length} buffered metrics`);
    }
  }

  // Stub helper methods for future implementation
  private convertToDataDogMetric(metric: ToolMetric): any {
    // Stub: Convert ToolMetric to DataDog metric format
    return {
      metric: 'claudx.tool.execution',
      points: [[Math.floor(metric.timestamp.getTime() / 1000), metric.duration]],
      tags: [
        `tool:${metric.toolName}`,
        `success:${metric.success}`,
        `service:${this.config.service}`,
        `env:${this.config.env}`,
        ...Object.entries(this.config.tags).map(([k, v]) => `${k}:${v}`)
      ],
      host: 'localhost', // Could be made configurable
      type: 'gauge'
    };
  }

  private async sendToDataDog(metrics: any[]): Promise<void> {
    // Stub: Send metrics to DataDog API
    // const response = await fetch(`https://api.${this.config.site}/api/v1/series`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'DD-API-KEY': this.config.apiKey
    //   },
    //   body: JSON.stringify({ series: metrics })
    // });
    
    console.log(`[claudx] DataDog: Would POST ${metrics.length} metrics to https://api.${this.config.site}/api/v1/series`);
  }
}
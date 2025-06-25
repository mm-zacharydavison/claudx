import { MetricsStore } from '../metrics-store.js';
import type { DataDestination } from '../data-destinations.js';
import type { ToolMetric, MetricsSummary } from '../types.js';

export class SQLiteDestination implements DataDestination {
  private metricsStore: MetricsStore;

  constructor(dbPath?: string) {
    this.metricsStore = new MetricsStore(dbPath);
  }

  async saveMetric(metric: ToolMetric): Promise<void> {
    return this.metricsStore.saveMetric(metric);
  }

  async getMetricsSummary(): Promise<MetricsSummary[]> {
    return this.metricsStore.getMetricsSummary();
  }

  async getRecentMetrics(limit?: number): Promise<ToolMetric[]> {
    return this.metricsStore.getRecentMetrics(limit);
  }

  close(): void {
    this.metricsStore.close();
  }
}
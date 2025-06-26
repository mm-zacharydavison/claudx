import type { DataStore } from '../datastore';
import { MetricsStore } from '../metrics-store';
import type { MetricsSummary, ToolMetric } from '../types';

export class SQLiteDataStore implements DataStore {
  private metricsStore: MetricsStore;

  constructor(dbPath: string) {
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

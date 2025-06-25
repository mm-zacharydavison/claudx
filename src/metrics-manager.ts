import { ConfigManager } from './config.js';
import type { DataDestination } from './data-destinations.js';
import { createDataDestination } from './data-destinations.js';
import type { MetricsSummary, ToolMetric } from './types.js';

export class MetricsManager {
  private destinations: DataDestination[] = [];
  private configManager: ConfigManager;

  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
  }

  async initialize(): Promise<void> {
    await this.configManager.initializeConfig();
    const config = await this.configManager.getConfig();

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(
        '[claudx] Initializing with destinations:',
        config.destinations.map((d) => d.type)
      );
    }

    // Create destination instances
    for (const destinationConfig of config.destinations) {
      try {
        const destination = await createDataDestination(destinationConfig);
        this.destinations.push(destination);
      } catch (error) {
        console.error(
          `[claudx] Failed to initialize ${destinationConfig.type} destination:`,
          error
        );
      }
    }

    if (this.destinations.length === 0) {
      console.warn('[claudx] No destinations initialized, falling back to SQLite');
      const fallbackDestination = await createDataDestination({ type: 'sqlite' });
      this.destinations.push(fallbackDestination);
    }
  }

  async saveMetric(metric: ToolMetric): Promise<void> {
    // Save to all configured destinations
    const promises = this.destinations.map(async (destination) => {
      try {
        await destination.saveMetric(metric);
      } catch (error) {
        console.error('[claudx] Error saving metric to destination:', error);
      }
    });

    await Promise.allSettled(promises);
  }

  async getMetricsSummary(): Promise<MetricsSummary[]> {
    // Get summary from the first available destination (typically SQLite)
    for (const destination of this.destinations) {
      try {
        return await destination.getMetricsSummary();
      } catch (error) {
        console.error('[claudx] Error getting metrics summary:', error);
      }
    }

    return [];
  }

  async getRecentMetrics(limit?: number): Promise<ToolMetric[]> {
    // Get recent metrics from the first available destination (typically SQLite)
    for (const destination of this.destinations) {
      try {
        return await destination.getRecentMetrics(limit);
      } catch (error) {
        console.error('[claudx] Error getting recent metrics:', error);
      }
    }

    return [];
  }

  close(): void {
    for (const destination of this.destinations) {
      try {
        destination.close();
      } catch (error) {
        console.error('[claudx] Error closing destination:', error);
      }
    }
    this.destinations = [];
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }
}

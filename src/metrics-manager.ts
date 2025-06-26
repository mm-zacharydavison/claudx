import { ConfigManager } from './config';
import { type DataStore, createDataStore } from './datastore';
import type { MetricsSummary, ToolMetric } from './types';

/**
 * Responsible for saving metrics.
 * 
 * Loads configuration, figures out which datastores to save to, and saves metrics.
 * 
 * Creates and invokes a `ConfigManager` instance to load configuration.
 */
export class MetricsManager {
  private datastores: DataStore[] = [];
  private configManager: ConfigManager;

  constructor(configPath?: string, originalCwd?: string) {
    this.configManager = new ConfigManager(configPath, originalCwd);
  }

  async initialize(): Promise<void> {
    const config = await this.configManager.getConfig();

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(
        '[claudx] Initializing with dataStores:',
        config.datastores.map((d) => d.type)
      );
    }

    // Create dataStore instances
    for (const dataStoreConfig of config.datastores) {
      try {
        const dataStore = await createDataStore(dataStoreConfig);
        this.datastores.push(dataStore);
      } catch (error) {
        console.error(
          `[claudx] Failed to initialize ${dataStoreConfig.type} dataStore:`,
          error
        );
      }
    }

    if (this.datastores.length === 0) {
      console.warn('[claudx] No dataStores initialized, falling back to SQLite');
      const fallbackDataStore = await createDataStore({ type: 'sqlite' });
      this.datastores.push(fallbackDataStore);
    }
  }

  async saveMetric(metric: ToolMetric): Promise<void> {
    // Save to all configured dataStores
    const promises = this.datastores.map(async (datastore) => {
      try {
        await datastore.saveMetric(metric);
      } catch (error) {
        console.error('[claudx] Error saving metric to dataStore:', error);
      }
    });

    await Promise.allSettled(promises);
  }

  async getMetricsSummary(): Promise<MetricsSummary[]> {
    // Get summary from the first available dataStore (typically SQLite)
    for (const dataStore of this.datastores) {
      try {
        return await dataStore.getMetricsSummary();
      } catch (error) {
        console.error('[claudx] Error getting metrics summary:', error);
      }
    }

    return [];
  }

  async getRecentMetrics(limit?: number): Promise<ToolMetric[]> {
    // Get recent metrics from the first available dataStore (typically SQLite)
    for (const dataStore of this.datastores) {
      try {
        return await dataStore.getRecentMetrics(limit);
      } catch (error) {
        console.error('[claudx] Error getting recent metrics:', error);
      }
    }

    return [];
  }

  close(): void {
    for (const dataStore of this.datastores) {
      try {
        dataStore.close();
      } catch (error) {
        console.error('[claudx] Error closing dataStore:', error);
      }
    }
    this.datastores = [];
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }
}

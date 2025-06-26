import path from 'node:path';
import type { MetricsSummary, ToolMetric } from './types';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

export interface DataStore {
  /**
   * Saves a metric to the backing store.
   * @param metric
   */
  saveMetric(metric: ToolMetric): Promise<void>;
  /**
   * Gets a summary of metrics (only supported by DataStores that allow fetching)
   */
  getMetricsSummary(): Promise<MetricsSummary[]>;
  /**
   * Gets a summary of metrics (only supported by DataStores that allow fetching)
   */
  getRecentMetrics(limit?: number): Promise<ToolMetric[]>;
  /**
   * Close the connection to a store and cleanup any resources.
   */
  close(): void;
}

/**
 * User configuration for a sqlite datastore.
 */
export interface SQLiteConfigOptions {
  type: 'sqlite'
  options? : {
    /**
     * Where to store the sqlite file.
     * @default ~/.claudx/metrics.db
     */
    dbPath?: string;
  }
}

/**
 * User configuration for a DataDog datastore.
 */
export interface DataDogConfigOptions {
  type: 'datadog';
  options?: {
    // DataDog options
    apiKey?: string;
    site?: string; // e.g., 'datadoghq.com', 'datadoghq.eu'
    service?: string;
    env?: string;
    tags?: Record<string, string>;
  };
}

export type DataStoreConfigOptions = SQLiteConfigOptions | DataDogConfigOptions

/**
 * Creates a DataStore of the correct type from a given config.
 * @param config
 * @returns a {@link DataStore} instance.
 */
export async function createDataStore(
  config: DataStoreConfigOptions
): Promise<DataStore> {
  switch (config.type) {
    case 'sqlite': {
      const { SQLiteDataStore } = await import('./datastores/sqlite.js');
      // Use user configured path.
      if (config.options?.dbPath) {
        return new SQLiteDataStore(config.options?.dbPath);
      }
      // Use default path.
      const claudxHomeDir = path.join(homedir(), '.claudx');
        // Ensure the directory exists
        if (!existsSync(claudxHomeDir)) {
          mkdirSync(claudxHomeDir, { recursive: true });
        }
        const defaultDbPath = path.join(claudxHomeDir, 'metrics.db');
        return new SQLiteDataStore(defaultDbPath);
    }

    case 'datadog': {
      const { DataDogDataStore } = await import('./datastores/datadog.js');
      return new DataDogDataStore({
        apiKey: config.options?.apiKey || '',
        site: config.options?.site || 'datadoghq.com',
        service: config.options?.service || 'claudx',
        env: config.options?.env || 'development',
        tags: config.options?.tags || {},
      });
    }
    default: {
      const type = (config as {type: string}).type
      throw new Error(`Unsupported dataStore type: ${type}`)
    }
  }
}

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir, cwd } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ClaudxConfig } from './types.js';

export class ConfigManager {
  private configPath: string;
  private defaultConfigTemplate = `// claudx configuration file
// This file supports JavaScript expressions and environment variables

export default {
  destinations: [
    {
      type: 'sqlite',
      options: {
        // Optional custom database path
        // dbPath: process.env.CLAUDX_DB_PATH || undefined
      }
    }
    
    // Example DataDog destination (uncomment and configure):
    // {
    //   type: 'datadog',
    //   options: {
    //     apiKey: process.env.DATADOG_API_KEY,
    //     site: process.env.DATADOG_SITE || 'datadoghq.com',
    //     service: process.env.DATADOG_SERVICE || 'claudx',
    //     env: process.env.DATADOG_ENV || 'development',
    //     tags: {
    //       team: process.env.DATADOG_TEAM_NAME || 'engineering',
    //       // Add more custom tags as needed
    //     }
    //   }
    // }
  ]
};`;

  private defaultConfig: ClaudxConfig = {
    destinations: [
      {
        type: 'sqlite',
        options: {},
      },
    ],
  };

  constructor(configPath?: string) {
    if (configPath) {
      this.configPath = configPath;
    } else {
      // Try current directory first, then home directory
      const currentDirConfig = join(process.cwd());
      const homeDirConfig = join(homedir(), '.claudx');
      
      let configDir: string;
      if (existsSync(currentDirConfig)) {
        configDir = currentDirConfig;
      } else if (existsSync(homeDirConfig)) {
        configDir = homeDirConfig;
      } else {
        // Default to current directory if neither exists
        configDir = currentDirConfig;
        mkdirSync(configDir, { recursive: true });
      }
      
      this.configPath = join(configDir, 'claudx.config.js');
    }
  }

  async getConfig(): Promise<ClaudxConfig> {
    if (!existsSync(this.configPath)) {
      // Create default config if it doesn't exist
      this.createDefaultConfig();
      return this.defaultConfig;
    }

    try {
      // Use dynamic import to load the config
      const configUrl = pathToFileURL(this.configPath).href;
      const configModule = await import(`${configUrl}?t=${Date.now()}`);
      const config = configModule.default as ClaudxConfig;

      // Validate and provide defaults
      if (!config.destinations || config.destinations.length === 0) {
        config.destinations = this.defaultConfig.destinations;
      }

      return config;
    } catch (error) {
      console.warn(`[claudx] Error loading config file: ${error}. Using default config.`);
      return this.defaultConfig;
    }
  }

  private createDefaultConfig(): void {
    try {
      writeFileSync(this.configPath, this.defaultConfigTemplate, 'utf-8');
    } catch (error) {
      console.error(`[claudx] Error creating default config file: ${error}`);
    }
  }

  updateConfig(updater: (config: ClaudxConfig) => ClaudxConfig): Promise<void> {
    // For JS configs, we recommend manual editing
    // This method provides programmatic updates by rewriting the file
    console.warn(
      '[claudx] Configuration updates for JS files should be done by editing the config file directly.'
    );
    console.log(`[claudx] Config file location: ${this.configPath}`);
    return Promise.resolve();
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async initializeConfig(): Promise<void> {
    if (!existsSync(this.configPath)) {
      this.createDefaultConfig();
      console.log(`[claudx] Created default config file at: ${this.configPath}`);
      console.log(
        '[claudx] Edit this file to configure your data destinations with environment variables.'
      );
    }
  }
}

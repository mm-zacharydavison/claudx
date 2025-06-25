import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import type { ClaudxConfig } from './types.js';

export class ConfigManager {
  private configPath: string;
  private defaultConfigTemplate = `// claudx configuration file
// http://github.com/mm-zacharydavison/claudx
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
      // Try to find config in order: current dir, git root, home dir
      const currentDirConfig = join(process.cwd());
      const gitRootConfig = this.findGitRoot();
      const homeDirConfig = join(homedir(), '.claudx');

      let configDir: string;
      if (existsSync(join(currentDirConfig, 'claudx.config.js'))) {
        configDir = currentDirConfig;
      } else if (gitRootConfig && existsSync(join(gitRootConfig, 'claudx.config.js'))) {
        configDir = gitRootConfig;
      } else if (existsSync(homeDirConfig)) {
        configDir = homeDirConfig;
      } else {
        // Default to current directory if no config found
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

  private findGitRoot(): string | null {
    try {
      const gitRoot = execSync('git rev-parse --show-toplevel', { 
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: 'pipe'
      }).trim();
      return gitRoot;
    } catch {
      return null;
    }
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

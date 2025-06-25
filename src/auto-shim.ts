#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CLAUDE_TOOLS_WHITELIST } from './claude-tools-whitelist.js';
import { MetricsStore } from './metrics-store.js';
import { ShimManager } from './shim-manager.js';

/**
 * Auto-shim manager for claudx startup
 * This runs when claudx starts to ensure all shims are current
 */
export class AutoShimManager {
  private shimDir: string;
  private timestampFile: string;
  private updateInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private shimAll: boolean;

  constructor(baseDir: string, shimAll = false) {
    this.shimDir = path.join(baseDir, 'shims');
    this.timestampFile = path.join(this.shimDir, '.last_update');
    this.shimAll = shimAll;
  }

  async shouldUpdateShims(): Promise<boolean> {
    try {
      const timestamp = await fs.readFile(this.timestampFile, 'utf8');
      const lastUpdate = Number.parseInt(timestamp);
      const now = Date.now();

      return now - lastUpdate > this.updateInterval;
    } catch {
      // File doesn't exist or is invalid, needs update
      return true;
    }
  }

  async updateShims(): Promise<void> {
    if (this.shimAll) {
      console.error('[claudx] 🔄 Updating all executable shims...');
    } else {
      console.error('[claudx] 🔄 Updating common tool shims...');
    }

    const store = new MetricsStore();
    const manager = new ShimManager(store, path.dirname(this.shimDir));

    try {
      if (this.shimAll) {
        // Shim all executables on PATH
        await manager.installShims();
      } else {
        // Shim only whitelisted tools that are available
        const availableTools = [];
        for (const tool of CLAUDE_TOOLS_WHITELIST) {
          const toolPath = await manager.findExecutablePath(tool);
          if (toolPath) {
            availableTools.push(tool);
          }
        }
        console.error(`[claudx] 📋 Found ${availableTools.length} whitelisted tools available`);
        await manager.installShims(availableTools);
      }

      await fs.writeFile(this.timestampFile, Date.now().toString());
      console.error('[claudx] ✅ Shims updated successfully');
    } catch (error) {
      console.error(
        '[claudx] ⚠️  Shim update failed:',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      store.close();
    }
  }

  async ensureShimsUpdated(): Promise<void> {
    if (await this.shouldUpdateShims()) {
      await this.updateShims();
    } else {
      console.error('[claudx] ✅ Shims are up to date');
    }
  }
}

// CLI interface for auto-shim
if (import.meta.url === `file://${process.argv[1]}`) {
  const baseDir = process.argv[2] || path.join(process.env.HOME || '/tmp', '.claudx');
  const shimAll = process.argv[3] === 'true';

  const autoShim = new AutoShimManager(baseDir, shimAll);

  autoShim.ensureShimsUpdated().catch((error) => {
    console.error('[claudx] ❌ Auto-shim failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

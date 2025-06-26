import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { EXCLUDED_EXECUTABLES } from './constants/claude-tools-blacklist';

const execAsync = promisify(exec);

/**
 * Configuration for a specific shimmed executable.
 */
export interface ShimConfig {
  /**
   * The executable name.
   */
  executable: string;
  /**
   * The original path of the executable (unshimmed).
   */
  originalPath?: string;
  /**
   * The new, shimmed path of the executable (in `~/.claudx/shims`)
   */
  shimPath?: string;
  /**
   * If this executable is shimmed or not.
   */
  enabled: boolean;
}

/**
 * Handles the creation of shims.
 * 
 * Executables are shimmed in order to add duration/token measurement when Claude calls them.
 */
export class ShimManager {
  private shimDir: string;
  private backupDir: string;
  private configFile: string;

  constructor(baseDir?: string) {
    const base = baseDir || path.join(process.env.HOME || '/tmp', '.claudx');
    this.shimDir = path.join(base, 'shims');
    this.backupDir = path.join(base, 'backups');
    this.configFile = path.join(base, 'shim-config.json');
  }

  /**
   * Create required directories.
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.shimDir, { recursive: true });
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  /**
   * Find the path to an executable using `which`.
   * @param executable
   * @returns The absolute path of the executable.
   */
  async findExecutablePath(executable: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`which ${executable}`);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Iterates through all PATH members and finds all executables.
   * @returns A list of absolute paths to executables.
   */
  async discoverAllExecutables(): Promise<string[]> {
    const pathDirs = (process.env.PATH || '').split(':').filter((dir) => dir.length > 0);
    const executables = new Set<string>();

    console.log(`🔍 Discovering executables in ${pathDirs.length} PATH directories...`);

    // Process directories in parallel for better performance
    const discoveryPromises = pathDirs.map(async (dir) => {
      try {
        const entries = await fs.readdir(dir);
        const dirExecutables: string[] = [];

        // Process entries in batches to avoid overwhelming the filesystem
        const batchSize = 50;
        for (let i = 0; i < entries.length; i += batchSize) {
          const batch = entries.slice(i, i + batchSize);

          const batchPromises = batch.map(async (entry) => {
            const fullPath = path.join(dir, entry);

              try {
                const stats = await fs.stat(fullPath);
                // Check if it's a regular file and executable
                if (stats.isFile() && (stats.mode & 0o111) !== 0) {
                  return entry;
                }
              } catch {
                // Skip entries we can't stat (broken symlinks, etc.)
                return null;
              }
          });

          const batchResults = await Promise.all(batchPromises);
          dirExecutables.push(...(batchResults.filter(Boolean) as string[]));
        }

        return dirExecutables;
      } catch {
        // Skip directories we can't read
        return [];
      }
    });

    const allResults = await Promise.all(discoveryPromises);

    // Flatten and deduplicate results
    for (const dirExecutables of allResults) {
      for (const executable of dirExecutables) {
        executables.add(executable);
      }
    }

    const result = Array.from(executables).sort();
    console.log(`✅ Found ${result.length} executable tools to shim`);

    return result;
  }

  /**
   * If an executable should be shimmed (e.g. if it is not blacklisted).
   * @param executable 
   * @returns `true` if the executable should be shimmed.
   */
  private shouldShimExecutable(executable: string): boolean {
    // Skip if in exclusion list
    if (EXCLUDED_EXECUTABLES.has(executable)) {
      return false;
    }

    // Skip hidden files and system files
    if (executable.startsWith('.')) {
      return false;
    }

    // Skip files with extensions that are usually not executables
    const ext = path.extname(executable).toLowerCase();
    const skipExtensions = new Set([
      '.txt',
      '.md',
      '.json',
      '.xml',
      '.html',
      '.css',
      '.js',
      '.so',
      '.a',
      '.o',
    ]);
    if (skipExtensions.has(ext)) {
      return false;
    }

    // Skip files that look like libraries or system files
    if (executable.includes('.so.') || executable.startsWith('lib')) {
      return false;
    }

    return true;
  }

  /**
   * Creates a shim file.
   * @param executable - The executable name.
   */
  async createShim(executable: string): Promise<void> {
    const originalPath = await this.findExecutablePath(executable);
    if (!originalPath) {
      throw new Error(`Executable '${executable}' not found in PATH`);
    }

    const shimPath = path.join(this.shimDir, executable);
    const backupPath = path.join(this.backupDir, `${executable}.original`);

    // Create backup of original
    await fs.copyFile(originalPath, backupPath);

    // Create shim script
    const shimScript = this.generateShimScript(executable, originalPath);
    await fs.writeFile(shimPath, shimScript, { mode: 0o755 });
  }

  /**
   * Creates the text content of a shim.
   * 
   * @param executable - The executable name.
   * @param originalPath - The original path (unshimmed).
   * @returns - The raw string content of the shim.
   */
  private generateShimScript(executable: string, originalPath: string): string {
    // In ES modules, __dirname is not available, so we need to construct the path differently
    const currentFile = new URL(import.meta.url).pathname;
    const currentDir = path.dirname(currentFile);
    const metricsCollectorPath = path.resolve(currentDir, '../dist/metrics-collector.js');

    return `#!/bin/bash
# claudx shim for ${executable}
# Generated on ${new Date().toISOString()}

# Pass the original working directory to the metrics collector
export CLAUDX_ORIGINAL_CWD="\$PWD"

# Collect metrics
node "${metricsCollectorPath}" "${executable}" "${originalPath}" "$@"
`;
  }

  /**
   * Installs shims into the `~/.claudx/shims` directory.
   * @param executables - A list of executable names to shim. If `undefined`, discovers all executables on your PATH.
   */
  async installShims(executables?: string[]): Promise<void> {
    await this.initialize();

    // If no executables provided, discover all from PATH
    const targetExecutables = (executables ?? (await this.discoverAllExecutables())).filter(this.shouldShimExecutable);

    console.log(`🚀 Installing shims for ${targetExecutables.length} executables...`);

    const config: ShimConfig[] = [];
    let successCount = 0;
    let skipCount = 0;

    // Process in parallel batches for much better performance
    const batchSize = 100; // Process 100 shims concurrently
    const batches = [];

    for (let i = 0; i < targetExecutables.length; i += batchSize) {
      batches.push(targetExecutables.slice(i, i + batchSize));
    }

    console.log(`📦 Processing ${batches.length} batches of ${batchSize} shims each...`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Process entire batch in parallel
      const batchPromises = batch.map(async (executable) => {
        try {
          await this.createShim(executable);
          const originalPath = await this.findExecutablePath(executable);
          const shimPath = path.join(this.shimDir, executable);

          return {
            executable,
            originalPath: originalPath || undefined,
            shimPath,
            enabled: true,
            success: true,
          };
        } catch (error) {
          // Only show individual errors for small batches
          if (targetExecutables.length <= 50) {
            console.warn(
              `⚠️  Failed to create shim for ${executable}:`,
              error instanceof Error ? error.message : String(error)
            );
          }
          return {
            executable,
            enabled: false,
            success: false,
          };
        }
      });

      // Wait for entire batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Collect results
      for (const result of batchResults) {
        config.push({
          executable: result.executable,
          originalPath: result.originalPath,
          shimPath: result.shimPath,
          enabled: result.enabled,
        });

        if (result.success) {
          successCount++;
        } else {
          skipCount++;
        }
      }

      // Show progress
      const completed = (batchIndex + 1) * batchSize;
      const actualCompleted = Math.min(completed, targetExecutables.length);
      console.log(
        `📊 Progress: ${actualCompleted}/${targetExecutables.length} executables processed (${successCount} shims created)...`
      );
    }

    // Save configuration
    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));

    console.log('✅ Shim installation completed:');
    console.log(`   📦 ${successCount} shims created successfully`);
    if (skipCount > 0) {
      console.log(`   ⚠️  ${skipCount} executables skipped (errors or excluded)`);
    }
  }
}

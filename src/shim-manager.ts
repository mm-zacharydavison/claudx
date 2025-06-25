import { exec, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { MetricsStore } from './metrics-store.js';
import { COMMAND_DESCRIPTORS, type ToolMetric } from './types.js';

interface TokenInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

const execAsync = promisify(exec);

export interface ShimConfig {
  executable: string;
  originalPath?: string;
  shimPath?: string;
  enabled: boolean;
}

export class ShimManager {
  private metricsStore: MetricsStore;
  private shimDir: string;
  private backupDir: string;
  private configFile: string;

  // Executables to exclude from shimming for safety
  private readonly EXCLUDED_EXECUTABLES = new Set([
    // System critical
    'init',
    'kernel',
    'kthreadd',
    'systemd',
    'systemctl',
    // Shell and core utilities (to avoid infinite loops)
    'sh',
    'bash',
    'zsh',
    'fish',
    'dash',
    'csh',
    'tcsh',
    // Core system commands that could break the system
    'sudo',
    'su',
    'passwd',
    'mount',
    'umount',
    'fsck',
    'fdisk',
    'mkfs',
    'parted',
    'lvm',
    'cryptsetup',
    // Process and system management
    'kill',
    'killall',
    'pkill',
    'ps',
    'top',
    'htop',
    // Network and security critical
    'iptables',
    'firewalld',
    'ufw',
    'ssh',
    'sshd',
    // Package managers (could cause system issues)
    'apt',
    'apt-get',
    'yum',
    'dnf',
    'pacman',
    'zypper',
    // Our own tools (to avoid infinite recursion)
    'claudx',
    'claudx-shim',
    // Node.js process (to avoid shimming ourselves)
    'node',
    'npm',
    'bun', // We'll handle these specially if needed
    // Noisy claude invocations (claude likes to use these behind the scenes and they're not very useful to track)
    'tail',
    'head',
    'sort',
    'uniq',
    'base64',
    'sed',
    'grep',
    'awk',
    'uname',
    'tr',
  ]);

  constructor(metricsStore: MetricsStore, baseDir?: string) {
    this.metricsStore = metricsStore;
    const base = baseDir || path.join(process.env.HOME || '/tmp', '.claudx');
    this.shimDir = path.join(base, 'shims');
    this.backupDir = path.join(base, 'backups');
    this.configFile = path.join(base, 'shim-config.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.shimDir, { recursive: true });
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  async findExecutablePath(executable: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`which ${executable}`);
      return stdout.trim();
    } catch {
      return null;
    }
  }

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
            if (this.shouldShimExecutable(entry)) {
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
            }
            return null;
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

  private shouldShimExecutable(executable: string): boolean {
    // Skip if in exclusion list
    if (this.EXCLUDED_EXECUTABLES.has(executable)) {
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

  private generateShimScript(executable: string, originalPath: string): string {
    // In ES modules, __dirname is not available, so we need to construct the path differently
    const currentFile = new URL(import.meta.url).pathname;
    const currentDir = path.dirname(currentFile);
    const metricsCollectorPath = path.resolve(currentDir, '../dist/metrics-collector.js');

    return `#!/bin/bash
# Claudx Metrics Shim for ${executable}
# Generated on ${new Date().toISOString()}

# Collect metrics (pass debug flag if present)
node $DEBUG_FLAG "${metricsCollectorPath}" "${executable}" "${originalPath}" "$@"
`;
  }

  async installShims(executables?: string[]): Promise<void> {
    await this.initialize();

    // If no executables provided, discover all from PATH
    const targetExecutables = executables || (await this.discoverAllExecutables());

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

    // Create Claude Code launcher wrapper
    await this.createClaudeWrapper();
  }

  private async createClaudeWrapper(): Promise<void> {
    const wrapperPath = path.join(path.dirname(this.shimDir), 'claudx-with-metrics');

    const wrapperScript = `#!/bin/bash
# Claudx Metrics Wrapper
# This wrapper ensures Claudx runs with shimmed executables for metrics collection
# The user's environment remains completely untouched

# Add our shim directory to PATH for Claudx execution only
export PATH="${this.shimDir}:\$PATH"

# Find and execute the real claudx
CLAUDX_PATH=\$(which claudx 2>/dev/null || echo "claudx")

if [ "\$CLAUDX_PATH" = "claudx" ]; then
    echo "Warning: claudx not found in PATH. Trying to execute anyway..."
fi

echo "🔍 Claudx Metrics: Monitoring tool execution..."
echo "📊 Metrics will be saved to the claudx database"
echo "💡 View metrics with: cd $(pwd) && npm run cli summary"
echo ""

# Execute claudx with the modified PATH
exec "\$CLAUDX_PATH" "\$@"
`;

    await fs.writeFile(wrapperPath, wrapperScript, { mode: 0o755 });
    console.log('🔒 Your system PATH remains completely untouched!');
  }
}

// Metrics collector functions - called when a shim is executed
export async function collectAndExecute(
  executable: string,
  originalPath: string,
  args: string[]
): Promise<void> {
  const startTime = process.hrtime.bigint();
  const metricId = randomUUID();

  try {
    // Execute original command
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn(originalPath, args, {
          stdio: ['inherit', 'pipe', 'pipe'],
          env: process.env,
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          process.stdout.write(chunk);
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          process.stderr.write(chunk);
        });

        child.on('close', (code) => {
          resolve({ code: code || 0, stdout, stderr });
        });

        child.on('error', reject);
      }
    );

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;

    // Extract token information from output
    const tokens = extractTokensFromOutput(executable, result.stdout, result.stderr, args);

    // Generate tool name with arguments based on command descriptors
    const toolName = generateToolName(executable, args);

    // Save metrics
    await saveMetric({
      id: metricId,
      toolName,
      startTime,
      endTime,
      duration,
      success: result.code === 0,
      errorMessage: result.code !== 0 ? `Exit code: ${result.code}` : undefined,
      parameters: { args, cwd: process.cwd() },
      timestamp: new Date(),
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      totalTokens: tokens.totalTokens,
    });

    process.exit(result.code);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;

    // Generate tool name with arguments based on command descriptors
    const toolName = generateToolName(executable, args);

    await saveMetric({
      id: metricId,
      toolName,
      startTime,
      endTime,
      duration,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      parameters: { args, cwd: process.cwd() },
      timestamp: new Date(),
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });

    console.error(
      `Shim execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

function generateToolName(executable: string, args: string[]): string {
  // Find matching command descriptor
  const descriptor = COMMAND_DESCRIPTORS.find((d) => d.command === executable);

  if (!descriptor || descriptor.argumentCount === 0 || args.length === 0) {
    return executable;
  }

  // Take the specified number of arguments
  const relevantArgs = args.slice(0, descriptor.argumentCount);

  return `${executable} ${relevantArgs.join(' ')}`;
}

function estimateTokens(text: string): number {
  // Fast token estimation using character count with typical token-to-char ratio
  // GPT-style models: ~4 characters per token on average
  // This is a rough approximation but very fast
  return Math.ceil(text.length / 4);
}

function extractTokensFromOutput(
  executable: string,
  stdout: string,
  stderr: string,
  args: string[]
): TokenInfo {
  // For tool execution, we estimate tokens from the actual output
  // Input tokens = command + args (what was "sent" to the tool)
  // Output tokens = stdout + stderr (what the tool "generated")

  const outputTokens = estimateTokens(stdout + stderr);

  // Input tokens = executable name + all arguments
  const inputText = `${executable} ${args.join(' ')}`;
  const inputTokens = estimateTokens(inputText);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

async function saveMetric(metric: ToolMetric): Promise<void> {
  if (process.env.LOG_LEVEL === 'debug') {
    console.debug('[ShimManager] Starting to save metric for:', metric.toolName);
  }

  try {
    const metricsStore = new MetricsStore();
    await metricsStore.saveMetric(metric);
    metricsStore.close();

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[ShimManager] Successfully saved metric for:', metric.toolName);
    }
  } catch (error) {
    // Don't fail the command if metrics collection fails
    console.warn('Failed to save metrics:', error instanceof Error ? error.message : String(error));

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[ShimManager] Error details:', error);
    }
  }
}

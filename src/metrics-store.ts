import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database } from 'sql.js';
import type { MetricsSummary, ToolMetric } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MetricsStore {
  private db?: Database;
  private dbPath: string;
  private dbPromise: Promise<void>;

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.dbPromise = this.initializeDatabase();

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Initializing with database path:', this.dbPath);
    }
  }

  private async initializeDatabase(): Promise<void> {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Initializing SQLite database...');
    }

    const SQL = await initSqlJs();

    // Load existing database or create new one
    let dbData: Uint8Array | undefined;
    if (existsSync(this.dbPath)) {
      dbData = readFileSync(this.dbPath);
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug('[claudx] Loaded existing database file, size:', dbData.length, 'bytes');
      }
    } else {
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug('[claudx] Creating new database file');
      }
    }

    this.db = new SQL.Database(dbData);

    // Initialize schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tool_metrics (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        duration REAL NOT NULL,
        success INTEGER NOT NULL,
        error_message TEXT,
        parameters TEXT,
        timestamp DATETIME NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS idx_tool_name ON tool_metrics(tool_name);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON tool_metrics(timestamp);
    `);

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Database schema initialized successfully');
    }
  }

  private saveDatabase(): void {
    if (!this.db) {
      return;
    }
    const data = this.db.export();
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Exporting database, size:', data.length, 'bytes');
    }
    writeFileSync(this.dbPath, data);
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Database file written successfully');
    }
  }

  async saveMetric(metric: ToolMetric): Promise<void> {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Saving metric for tool:', metric.toolName);
    }
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Metric data:', {
        id: metric.id,
        toolName: metric.toolName,
        duration: metric.duration,
        success: metric.success,
        timestamp: metric.timestamp.toISOString(),
        inputTokens: metric.inputTokens,
        outputTokens: metric.outputTokens,
        totalTokens: metric.totalTokens,
        errorMessage: metric.errorMessage,
        parameters: metric.parameters,
      });
    }

    await this.dbPromise;

    if (!this.db) {
      throw new Error('[claudx] "db" not initialized.');
    }

    const stmt = this.db.prepare(`
      INSERT INTO tool_metrics 
      (id, tool_name, start_time, end_time, duration, success, error_message, parameters, timestamp, input_tokens, output_tokens, total_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const values = [
      metric.id,
      metric.toolName,
      metric.startTime.toString(),
      metric.endTime.toString(),
      metric.duration,
      metric.success ? 1 : 0,
      metric.errorMessage || null,
      JSON.stringify(metric.parameters),
      metric.timestamp.toISOString(),
      metric.inputTokens,
      metric.outputTokens,
      metric.totalTokens,
    ];

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Executing SQL insert with values:', values);
    }

    stmt.run(values);
    stmt.free();

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Metric inserted successfully, saving database to disk');
    }

    this.saveDatabase();

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[claudx] Database saved to:', this.dbPath);
    }
  }

  async getMetricsSummary(): Promise<MetricsSummary[]> {
    await this.dbPromise;

    if (!this.db) {
      throw new Error('[claudx] "db" not initialized.');
    }

    const stmt = this.db.prepare(`
      SELECT 
        tool_name,
        COUNT(*) as total_calls,
        SUM(duration) as total_duration,
        AVG(duration) as avg_duration,
        MIN(duration) as min_duration,
        MAX(duration) as max_duration,
        AVG(CAST(success AS REAL)) as success_rate,
        SUM(total_tokens) as total_tokens,
        AVG(total_tokens) as avg_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens
      FROM tool_metrics 
      GROUP BY tool_name
      ORDER BY total_duration DESC
    `);

    const results: MetricsSummary[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        toolName: row.tool_name as string,
        totalCalls: row.total_calls as number,
        totalDuration: row.total_duration as number,
        avgDuration: row.avg_duration as number,
        minDuration: row.min_duration as number,
        maxDuration: row.max_duration as number,
        successRate: row.success_rate as number,
        totalTokens: (row.total_tokens as number) || 0,
        avgTokens: (row.avg_tokens as number) || 0,
        inputTokens: (row.input_tokens as number) || 0,
        outputTokens: (row.output_tokens as number) || 0,
      });
    }
    stmt.free();

    return results;
  }

  async getRecentMetrics(limit = 100): Promise<ToolMetric[]> {
    await this.dbPromise;

    if (!this.db) {
      throw new Error('[claudx] "db" not initialized.');
    }

    const stmt = this.db.prepare(`
      SELECT * FROM tool_metrics 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const results: ToolMetric[] = [];
    stmt.bind([limit]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id as string,
        toolName: row.tool_name as string,
        startTime: BigInt(row.start_time as string),
        endTime: BigInt(row.end_time as string),
        duration: row.duration as number,
        success: (row.success as number) === 1,
        errorMessage: (row.error_message as string) || undefined,
        parameters: JSON.parse(row.parameters as string),
        timestamp: new Date(row.timestamp as string),
        inputTokens: (row.input_tokens as number) || 0,
        outputTokens: (row.output_tokens as number) || 0,
        totalTokens: (row.total_tokens as number) || 0,
      });
    }
    stmt.free();

    return results;
  }

  close(): void {
    if (this.db) {
      this.saveDatabase();
      this.db.close();
    }
  }
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { MetricsSummary, ToolMetric } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MetricsStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(__dirname, '..', 'metrics.db');
    this.db = new Database(dbPath || defaultPath);
    this.initializeSchema();
  }

  private initializeSchema() {
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
  }

  saveMetric(metric: ToolMetric): void {
    const stmt = this.db.prepare(`
      INSERT INTO tool_metrics 
      (id, tool_name, start_time, end_time, duration, success, error_message, parameters, timestamp, input_tokens, output_tokens, total_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
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
      metric.totalTokens
    );
  }

  getMetricsSummary(): MetricsSummary[] {
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

    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      toolName: row.tool_name,
      totalCalls: row.total_calls,
      totalDuration: row.total_duration,
      avgDuration: row.avg_duration,
      minDuration: row.min_duration,
      maxDuration: row.max_duration,
      successRate: row.success_rate,
      totalTokens: row.total_tokens || 0,
      avgTokens: row.avg_tokens || 0,
      inputTokens: row.input_tokens || 0,
      outputTokens: row.output_tokens || 0,
    }));
  }

  getRecentMetrics(limit = 100): ToolMetric[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tool_metrics 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map((row) => ({
      id: row.id,
      toolName: row.tool_name,
      startTime: BigInt(row.start_time),
      endTime: BigInt(row.end_time),
      duration: row.duration,
      success: row.success === 1,
      errorMessage: row.error_message || undefined,
      parameters: JSON.parse(row.parameters),
      timestamp: new Date(row.timestamp),
      inputTokens: row.input_tokens || 0,
      outputTokens: row.output_tokens || 0,
      totalTokens: row.total_tokens || 0,
    }));
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Metrics server: Prometheus-compatible metrics on separate port
 * Tracks HTTP request latency, projector lag, and pipeline state
 */

import http from 'http';

interface MetricsState {
  requestCount: number;
  requestDurations: number[]; // milliseconds
  projectorLag: number; // max(seq) - checkpoint
  pipelineState: 'running' | 'stopped' | 'error';
}

class MetricsCollector {
  private state: MetricsState = {
    requestCount: 0,
    requestDurations: [],
    projectorLag: 0,
    pipelineState: 'running',
  };

  recordRequest(durationMs: number) {
    this.state.requestCount++;
    this.state.requestDurations.push(durationMs);
    // Keep last 1000 samples
    if (this.state.requestDurations.length > 1000) {
      this.state.requestDurations.shift();
    }
  }

  setProjectorLag(lag: number) {
    this.state.projectorLag = lag;
  }

  setPipelineState(state: 'running' | 'stopped' | 'error') {
    this.state.pipelineState = state;
  }

  getMetrics(): string {
    const avgLatency = this.state.requestDurations.length > 0
      ? this.state.requestDurations.reduce((a, b) => a + b, 0) / this.state.requestDurations.length
      : 0;

    const p95Latency = this.getPercentile(95);
    const p99Latency = this.getPercentile(99);

    const pipelineStateValue = {
      'running': 1,
      'stopped': 0,
      'error': -1,
    }[this.state.pipelineState];

    return [
      `# HELP http_requests_total Total HTTP requests`,
      `# TYPE http_requests_total counter`,
      `http_requests_total ${this.state.requestCount}`,
      '',
      `# HELP http_request_duration_ms HTTP request duration milliseconds`,
      `# TYPE http_request_duration_ms gauge`,
      `http_request_duration_ms{quantile="avg"} ${avgLatency.toFixed(2)}`,
      `http_request_duration_ms{quantile="p95"} ${p95Latency.toFixed(2)}`,
      `http_request_duration_ms{quantile="p99"} ${p99Latency.toFixed(2)}`,
      '',
      `# HELP projector_lag_sequences Projector lag in sequences`,
      `# TYPE projector_lag_sequences gauge`,
      `projector_lag_sequences ${this.state.projectorLag}`,
      '',
      `# HELP pipeline_state Pipeline operational state`,
      `# TYPE pipeline_state gauge`,
      `pipeline_state ${pipelineStateValue}`,
    ].join('\n');
  }

  private getPercentile(p: number): number {
    if (this.state.requestDurations.length === 0) return 0;
    const sorted = [...this.state.requestDurations].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }
}

export const collector = new MetricsCollector();

export async function startMetricsServer(port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(collector.getMetrics());
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`✓ Metrics server listening on port ${port}`);
      resolve(server);
    });
  });
}

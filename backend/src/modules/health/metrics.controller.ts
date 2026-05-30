import type { RequestHandler } from "express";
import type { BackendRuntime } from "../../server.js";


/**
 * GET /api/v1/metrics
 *
 * Returns backend operational metrics aggregated from all runtime services.
 * Responds with JSON by default; set Accept: text/plain for Prometheus format.
 *
 * This endpoint is intentionally unauthenticated for scraper compatibility.
 */
export function getMetricsController(runtime: BackendRuntime): RequestHandler {
  return (_request, response) => {
    // Update dynamic metrics before rendering
    const uptimeSeconds = Math.floor(
      (Date.now() - new Date(runtime.startedAt).getTime()) / 1000,
    );
    runtime.metricsRegistry.setGauge("vaultdao_uptime_seconds", uptimeSeconds);
    if (runtime.cacheManager) {
      const cacheStats = runtime.cacheManager.stats();
      runtime.metricsRegistry.setGauge("vaultdao_cache_hits_total", cacheStats.hits);
      runtime.metricsRegistry.setGauge("vaultdao_cache_misses_total", cacheStats.misses);
      runtime.metricsRegistry.setGauge("vaultdao_cache_hit_rate", (cacheStats as any).hitRate ?? cacheStats.hitRatio);
      runtime.metricsRegistry.setGauge("vaultdao_cache_miss_rate", (cacheStats as any).missRate ?? 0);
    }

    const acceptsPlain = (_request.get("Accept") ?? "").includes("text/plain");

    if (acceptsPlain) {
      response
        .status(200)
        .set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        .send(runtime.metricsRegistry.render());
      return;
    }

    // JSON response for human-readable snapshot
    response
      .status(200)
      .set("Content-Type", "application/json")
      .json({
        success: true,
        timestamp: new Date().toISOString(),
        uptimeSeconds,
        cache: runtime.cacheManager?.stats(),
      });
  };
}

## Description

This pull request consolidates the implementation of several key backend enhancements, focusing on scalability, security, standardizing API responses, and safe lifecycle management.

### Key Features Implemented:
* **Rate Limiter with Redis Backend for Horizontal Scaling:**
  * Implemented `RedisRateLimitStore` using `ioredis` with an `INCR` + `EXPIRE` pattern for atomic counter increments.
  * Added fallback logic to use the in-memory store if Redis is unavailable or `REDIS_URL` is not configured.
  * Added environment variables (`REDIS_URL`, `REDIS_TLS`) and exposed Redis connection status in the detailed health endpoint (`GET /api/v1/health/detailed`).
* **Secure Logging with PII Redaction:**
  * Integrated a fast JSON logger (`pino`) replacing `console.log`.
  * Implemented a custom log serializer to recursively redact sensitive fields (e.g., `password`, `token`, `ssn`, `credit_card`) with `[REDACTED]`.
  * Created an Express middleware to log all HTTP requests (method, url, status, duration) and structured application logs with `traceId` and `userId` where applicable.
* **Standardized API Error Response Schema:**
  * Standardized the API error response shape to ensure consistency (`{ error: { code, message, details, meta } }`).
  * Updated the `error()` helper and `createErrorMiddleware` to enforce the new structure.
  * Introduced request body validation middleware using TypeScript type guards.
* **Graceful Shutdown with In-Flight Request Draining:**
  * Enhanced `LifecycleManager` to wait for in-flight HTTP requests to complete before terminating the server.
  * Implemented a thread-safe middleware counter to track in-flight requests.
  * Added `GET /health/drain` for load balancer health checks and configured `GET /ready` to return 503 during shutdown to stop routing.

---

Closes #986
Closes #984
Closes #983
Closes #978

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { RedisRateLimitStore, createRedisRateLimitStore } from "./redis-rate-limit.store.js";

// Mock ioredis import
const mockRedis = {
  incr: async () => 1,
  expire: async () => 1,
  get: async () => "1",
  flushdb: async () => {},
  quit: async () => {},
};

// Mock import function
(global as any).import = async (module: string) => {
  if (module === "ioredis") {
    return {
      default: class MockRedis {
        constructor() {}
        incr() { return Promise.resolve(1); }
        expire() { return Promise.resolve(1); }
        get() { return Promise.resolve("1"); }
        flushdb() { return Promise.resolve(); }
        quit() { return Promise.resolve(); }
      },
      ...mockRedis,
    };
  }
  return {};
};

describe("RedisRateLimitStore", () => {
  let store: RedisRateLimitStore;

  beforeEach(() => {
    // Create store with mock Redis URL
    store = createRedisRateLimitStore("redis://localhost:6379", {
      windowMs: 60000,
      maxRequests: 100,
    });
  });

  afterEach(() => {
    // Clean up
  });

  it("should create store with Redis URL", () => {
    assert.ok(store);
  });

  it("should fall back to in-memory when Redis is unavailable", async () => {
    // Test fallback behavior
    const fallbackStore = createRedisRateLimitStore(undefined, {
      windowMs: 60000,
      maxRequests: 100,
    });
    
    const req = { ip: "127.0.0.1" } as unknown as Request;
    
    const isLimited = await fallbackStore.isLimited(req);
    assert.strictEqual(isLimited, false);
  });
});

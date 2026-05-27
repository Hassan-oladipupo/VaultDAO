import { Router } from "express";
import { VaultService } from "./vault.service.js";
import { createVaultConfigController } from "./vault.controller.js";
import type { CacheManager } from "../../shared/cache/cache-manager.js";

export function createVaultRouter(
  rpcUrl: string,
  networkPassphrase: string,
  cache?: CacheManager,
): Router {
  const router = Router();
  const service = new VaultService(rpcUrl, networkPassphrase);

  router.get("/config", createVaultConfigController(service, cache));

  return router;
}

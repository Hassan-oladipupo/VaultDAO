import { Router } from "express";
import type { RequestHandler } from "express";
import type { RecurringIndexerService } from "./recurring.service.js";
import {
  getAllRecurringController,
  getRecurringByIdController,
  getDueRecurringController,
  getDueWithLookaheadController,
  triggerSyncController,
} from "./recurring.controller.js";

/**
 * Creates the recurring payments router with all API endpoints
 */
export function createRecurringRouter(
  service: RecurringIndexerService,
  authMiddleware?: RequestHandler,
) {
  const router = Router();

  /**
   * GET /api/v1/recurring/due?lookaheadLedgers=1440
   * Returns payments due within the next lookaheadLedgers ledgers (1–17280, default 1440).
   * Requires authMiddleware.
   */
  if (authMiddleware) {
    router.get("/due", authMiddleware, getDueWithLookaheadController(service));
  } else {
    router.get("/due", getDueWithLookaheadController(service));
  }

  /**
   * POST /api/v1/recurring/sync
   * Triggers a manual sync cycle immediately.
   */
  router.post("/sync", triggerSyncController(service));

  /**
   * GET /api/v1/recurring
   */
  router.get("/", getAllRecurringController(service));

  /**
   * GET /api/v1/recurring/:id
   */
  router.get("/:paymentId", getRecurringByIdController(service));

  return router;
}

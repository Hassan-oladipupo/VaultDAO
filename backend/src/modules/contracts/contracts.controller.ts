import express, { RequestHandler, Router } from "express";
import type { ContractRegistry } from "./contract-registry.js";
import { error } from "../../shared/http/response.js";
import { ErrorCode } from "../../shared/http/errorCodes.js";

export function getContractsController(
  registry: ContractRegistry,
): RequestHandler {
  return (_req, res) => {
    const list = registry.list();
    res.status(200).json({ success: true, data: list });
  };
}

export function registerContractController(
  registry: ContractRegistry,
): RequestHandler {
  return (req, res) => {
    const { id } = req.body as { id?: string };
    if (!id || typeof id !== "string") {
      error(res, {
        message: "id is required",
        status: 400,
        code: ErrorCode.VALIDATION_ERROR,
      });
      return;
    }

    const result = registry.register(id);
    if (!result.success) {
      error(res, {
        message: result.error ?? "Registration failed",
        status: 400,
        code: ErrorCode.VALIDATION_ERROR,
      });
      return;
    }

    res.status(201).json({ success: true, data: registry.get(id) });
  };
}

export function createContractsRouter(
  registry: ContractRegistry,
  adminAuthMiddleware?: RequestHandler,
): Router {
  const router = express.Router();
  router.get("/", getContractsController(registry));

  if (adminAuthMiddleware) {
    router.post("/", adminAuthMiddleware, registerContractController(registry));
  } else {
    router.post("/", registerContractController(registry));
  }

  return router;
}

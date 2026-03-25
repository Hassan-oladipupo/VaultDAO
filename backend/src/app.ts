import express from "express";

import type { BackendEnv } from "./config/env.js";
import type { BackendRuntime } from "./server.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { error } from "../shared/http/response.js";

export function createApp(env: BackendEnv, runtime: BackendRuntime) {
  const app = express();

  app.use(express.json());
  app.use(createHealthRouter(env, runtime));

  app.use((_request, response) => {
    error(response, { message: "Not Found", status: 404 });
  });

  return app;
}

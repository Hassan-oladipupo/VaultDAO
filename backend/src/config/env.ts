import { z } from "zod";

export interface BackendEnv {
  readonly port: number;
  readonly host: string;
  readonly nodeEnv: string;
  readonly stellarNetwork: string;
  readonly sorobanRpcUrl: string;
  readonly horizonUrl: string;
  readonly contractId: string;
  readonly contractIds: string[];
  readonly indexingParallelism: number;
  readonly websocketUrl: string;
  readonly eventPollingIntervalMs: number;
  readonly eventPollingEnabled: boolean;
  readonly duePaymentsJobEnabled: boolean;
  readonly duePaymentsJobIntervalMs: number;
  readonly cursorCleanupJobEnabled: boolean;
  readonly cursorCleanupJobIntervalMs: number;
  readonly cursorRetentionDays: number;
  readonly corsOrigin: string[];
  readonly requestBodyLimit: string;
  readonly apiKey?: string;
  readonly apiKeyNext?: string;
  readonly cursorStorageType: "file" | "database";
  readonly databasePath: string;
  // Rate limiting
  readonly rateLimitEnabled?: boolean;
  readonly rateLimitRedisUrl?: string;
  readonly redisTls?: boolean;
  /** Max requests per minute for /api/v1/proposals */
  readonly rateLimitProposalsPerMin?: number;
  /** Max requests per minute for /api/v1/execute */
  readonly rateLimitExecutePerMin?: number;
  /** Default max requests per minute for all other endpoints */
  readonly rateLimitDefaultPerMin?: number;
}

const DEFAULT_CONTRACT_ID =
  "CDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const MIN_POLLING_INTERVAL_MS = 1000;

function validateCorsOriginValue(
  value: string,
  nodeEnv: string,
  issues: string[],
): void {
  if (value === "*") {
    return;
  }

  try {
    const parsed = new URL(value);

    if (value.endsWith("/")) {
      issues.push(
        `CORS_ORIGIN entries must not include a trailing slash. Received "${value}".`,
      );
      return;
    }

    if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
      issues.push(
        `CORS_ORIGIN entries must be origin-only URLs (no path, query, or hash). Received "${value}".`,
      );
      return;
    }

    if (parsed.protocol === "https:") {
      return;
    }

    if (parsed.protocol === "http:" && nodeEnv !== "production") {
      return;
    }

    if (parsed.protocol === "http:" && nodeEnv === "production") {
      issues.push(
        `CORS_ORIGIN entry "${value}" uses http:// which is not allowed in production.`,
      );
      return;
    }

    issues.push(
      `CORS_ORIGIN entry "${value}" must use https:// (or http:// in non-production).`,
    );
  } catch {
    issues.push(`CORS_ORIGIN entry "${value}" must be a valid URL or "*".`);
  }
}

function validateCorsOrigins(
  origins: string[],
  nodeEnv: string,
  issues: string[],
): void {
  if (origins.length === 0) {
    return;
  }

  const hasWildcard = origins.includes("*");
  if (hasWildcard && origins.length > 1) {
    issues.push(
      'CORS_ORIGIN cannot combine "*" with specific origins. Use either "*" or explicit origins.',
    );
  }

  for (const origin of origins) {
    validateCorsOriginValue(origin, nodeEnv, issues);
  }
}

function readValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function commaSeparatedToArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const BackendEnvSchema = z
  .object({
    PORT: z
      .preprocess(
        (value) => parseNumber(value),
        z.number().int().min(1).max(65535),
      )
      .default(8787)
      .describe("Port on which the backend listens"),
    HOST: z
      .string()
      .nonempty()
      .default("0.0.0.0")
      .describe("Host on which the backend binds"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development")
      .describe("Node.js environment"),
    STELLAR_NETWORK: z
      .enum(["testnet", "mainnet", "futurenet", "standalone"])
      .default("testnet")
      .describe("Stellar network to target"),
    SOROBAN_RPC_URL: z
      .string()
      .url()
      .default("https://soroban-testnet.stellar.org")
      .describe("Soroban RPC endpoint"),
    HORIZON_URL: z
      .string()
      .url()
      .default("https://horizon-testnet.stellar.org")
      .describe("Horizon API endpoint"),
    CONTRACT_ID: z
      .string()
      .nonempty()
      .default(DEFAULT_CONTRACT_ID)
      .describe("Primary deployed contract ID"),
    CONTRACT_IDS: z
      .preprocess(
        (value) => commaSeparatedToArray(value),
        z.array(z.string()).default([]),
      )
      .describe("Comma-separated list of additional deployed contract IDs"),
    INDEXING_PARALLELISM: z
      .preprocess(
        (value) => parseNumber(value),
        z.number().int().min(1).default(4),
      )
      .describe("Parallel threads used for indexing"),
    VITE_WS_URL: z
      .string()
      .url()
      .default("ws://localhost:8080")
      .describe("WebSocket URL for real-time updates"),
    EVENT_POLLING_INTERVAL_MS: z
      .preprocess(
        (value) => parseNumber(value),
        z.number().int().min(MIN_POLLING_INTERVAL_MS).default(10000),
      )
      .describe("Event polling interval in milliseconds"),
    EVENT_POLLING_ENABLED: z
      .preprocess((value) => parseBoolean(value), z.boolean().default(true))
      .describe("Enable event polling"),
    DUE_PAYMENTS_JOB_ENABLED: z
      .preprocess((value) => parseBoolean(value), z.boolean().default(true))
      .describe("Enable due payments job"),
    DUE_PAYMENTS_JOB_INTERVAL_MS: z
      .preprocess(
        (value) => parseNumber(value),
        z.number().int().min(1).default(60000),
      )
      .describe("Due payments job interval in milliseconds"),
    CURSOR_CLEANUP_JOB_ENABLED: z
      .preprocess((value) => parseBoolean(value), z.boolean().default(true))
      .describe("Enable cursor cleanup job"),
    CURSOR_CLEANUP_JOB_INTERVAL_MS: z
      .preprocess(
        (value) => parseNumber(value),
        z.number().int().min(1).default(86400000),
      )
      .describe("Cursor cleanup interval in milliseconds"),
    CURSOR_RETENTION_DAYS: z
      .preprocess(
        (value) => parseNumber(value),
        z.number().int().min(0).default(30),
      )
      .describe("Days to retain cursor data"),
    CORS_ORIGIN: z
      .preprocess(
        (value) => commaSeparatedToArray(value),
        z.array(z.string()).default(["*"]),
      )
      .describe("Allowed CORS origin values"),
    REQUEST_BODY_LIMIT: z
      .string()
      .default("64kb")
      .describe("Default JSON body limit for API endpoints"),
    NOTIFICATIONS_REQUEST_BODY_LIMIT: z
      .string()
      .default("16kb")
      .describe("JSON body limit for notification endpoints"),
    SNAPSHOTS_REQUEST_BODY_LIMIT: z
      .string()
      .default("512kb")
      .describe("JSON body limit for snapshot endpoints"),
    WEBHOOKS_REQUEST_BODY_LIMIT: z
      .string()
      .default("32kb")
      .describe("JSON body limit for webhook endpoints"),
    API_KEY: z
      .string()
      .optional()
      .describe("API key for admin and protected routes"),
    CURSOR_STORAGE_TYPE: z
      .enum(["file", "database"])
      .default("file")
      .describe("Cursor storage backend type"),
    DATABASE_PATH: z
      .string()
      .default("./vaultdao.sqlite")
      .describe("SQLite database path"),
    RATE_LIMIT_ENABLED: z
      .preprocess((value) => parseBoolean(value), z.boolean().default(true))
      .describe("Enable rate limiting"),
    RATE_LIMIT_REDIS_URL: z
      .string()
      .optional()
      .describe("Redis URL for rate limiting state"),
    RATE_LIMIT_PROPOSALS_PER_MIN: z
      .preprocess(
        (value) => parseNumber(value),
        z.number().int().min(1).default(100),
      )
      .describe("Proposal request limit per minute"),
    RATE_LIMIT_EXECUTE_PER_MIN: z
      .preprocess(
        (value) => parseNumber(value),
        z.number().int().min(1).default(10),
      )
      .describe("Execute request limit per minute"),
    RATE_LIMIT_DEFAULT_PER_MIN: z
      .preprocess(
        (value) => parseNumber(value),
        z.number().int().min(1).default(60),
      )
      .describe("Default request limit per minute"),
  })
  .superRefine((env, ctx) => {
    if (
      env.nodeEnv === "production" &&
      env.contractId === DEFAULT_CONTRACT_ID
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CONTRACT_ID"],
        message:
          "CONTRACT_ID must be configured with a real deployed contract ID in production.",
      });
    }

    if (env.nodeEnv === "production" && !env.API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["API_KEY"],
        message: "API_KEY is required in production.",
      });
    }

    if (env.nodeEnv === "production" && env.CORS_ORIGIN.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGIN"],
        message: "CORS_ORIGIN is required in production.",
      });
    }
  });

export type BackendEnv = z.infer<typeof BackendEnvSchema>;

function formatZodErrorMessage(error: z.ZodError) {
  const rows = error.errors.map((issue) => {
    const variable = issue.path.length > 0 ? issue.path.join(".") : "<root>";
    const received =
      issue.received === undefined
        ? "undefined"
        : JSON.stringify(issue.received);
    const expected = issue.message ?? issue.code;
    return `| ${variable} | ${expected} | ${received} |`;
  });

  return [
    "Invalid backend environment configuration:",
    "",
    "| Variable | Expected | Received |",
    "| --- | --- | --- |",
    ...rows,
    "",
    'Review "backend/.env.example" and update your local or deployed environment before starting the backend.',
  ].join("\n");
}

export function loadEnv(): BackendEnv {
  const issues: string[] = [];

  const port = readPort("PORT", 8787, issues);
  const host = readString("HOST", "0.0.0.0");
  const nodeEnv = readString("NODE_ENV", "development");
  const stellarNetwork = readString("STELLAR_NETWORK", "testnet");
  const sorobanRpcUrl = readString(
    "SOROBAN_RPC_URL",
    "https://soroban-testnet.stellar.org",
  );
  const horizonUrl = readString(
    "HORIZON_URL",
    "https://horizon-testnet.stellar.org",
  );
  const contractId = readString("CONTRACT_ID", DEFAULT_CONTRACT_ID);
  const contractIds = readCommaSeparatedString("CONTRACT_IDS", []);
  const indexingParallelism = readPort("INDEXING_PARALLELISM", 4, issues);
  const websocketUrl = readString("VITE_WS_URL", "ws://localhost:8080");
  const eventPollingIntervalMs = readPort(
    "EVENT_POLLING_INTERVAL_MS",
    10000,
    issues,
  );
  const eventPollingEnabled =
    readString("EVENT_POLLING_ENABLED", "true") === "true";
  const duePaymentsJobEnabled =
    readString("DUE_PAYMENTS_JOB_ENABLED", "true") === "true";
  const duePaymentsJobIntervalMs = readPort(
    "DUE_PAYMENTS_JOB_INTERVAL_MS",
    60000,
    issues,
  );
  const cursorCleanupJobEnabled =
    readString("CURSOR_CLEANUP_JOB_ENABLED", "true") === "true";
  const cursorCleanupJobIntervalMs = readPort(
    "CURSOR_CLEANUP_JOB_INTERVAL_MS",
    86400000,
    issues,
  );
  const cursorRetentionDays = readPort("CURSOR_RETENTION_DAYS", 30, issues);
  const corsOrigin = readCommaSeparatedString(
    "CORS_ORIGIN",
    nodeEnv === "production" ? [] : ["*"],
  );
  const requestBodyLimit = readString("REQUEST_BODY_LIMIT", "10kb");
  const apiKey = readValue("VAULT_API_KEY") ?? readValue("API_KEY");
  const apiKeyNext = readValue("VAULT_API_KEY_NEXT");
  const cursorStorageType = readString("CURSOR_STORAGE_TYPE", "file") as
    | "file"
    | "database";
  const databasePath = readString("DATABASE_PATH", "./vaultdao.sqlite");
  const rateLimitEnabled = readString("RATE_LIMIT_ENABLED", "true") === "true";
  const rateLimitRedisUrl = readValue("RATE_LIMIT_REDIS_URL");
  const redisTls = readString("REDIS_TLS", "false") === "true";
  const rateLimitProposalsPerMin = readPort(
    "RATE_LIMIT_PROPOSALS_PER_MIN",
    100,
    issues,
  );
  const rateLimitExecutePerMin = readPort(
    "RATE_LIMIT_EXECUTE_PER_MIN",
    10,
    issues,
  );
  const rateLimitDefaultPerMin = readPort(
    "RATE_LIMIT_DEFAULT_PER_MIN",
    60,
    issues,
  );

  validateRequiredString("HOST", host, issues);
  validateAllowedValue("NODE_ENV", nodeEnv, ALLOWED_NODE_ENVS, issues);
  validateAllowedValue(
    "STELLAR_NETWORK",
    stellarNetwork,
    ALLOWED_STELLAR_NETWORKS,
    issues,
  );
  validateUrl("SOROBAN_RPC_URL", sorobanRpcUrl, ["http:", "https:"], issues);
  validateUrl("HORIZON_URL", horizonUrl, ["http:", "https:"], issues);
  validateUrl("VITE_WS_URL", websocketUrl, ["ws:", "wss:"], issues);
  
  if (rateLimitRedisUrl) {
    validateUrl("RATE_LIMIT_REDIS_URL", rateLimitRedisUrl, ["redis:", "rediss:", "redis://", "rediss://"], issues);
  }

  if (eventPollingIntervalMs < MIN_POLLING_INTERVAL_MS) {
    issues.push(
      `EVENT_POLLING_INTERVAL_MS must be at least ${MIN_POLLING_INTERVAL_MS}ms to prevent excessive RPC load. Received "${eventPollingIntervalMs}".`,
    );
  }

  validateContractId(contractId, nodeEnv, issues);
  validateAllowedValue(
    "CURSOR_STORAGE_TYPE",
    cursorStorageType,
    ALLOWED_CURSOR_STORAGE_TYPES,
    issues,
  );

  if (nodeEnv === "production" && corsOrigin.length === 0) {
    issues.push("CORS_ORIGIN is required in production environment.");
  }

  validateCorsOrigins(corsOrigin, nodeEnv, issues);

  if (nodeEnv === "production" && !apiKey) {
    issues.push(
      "VAULT_API_KEY (or API_KEY) is required in production environment.",
    );
  }

  throwIfInvalid(issues);

  return {
    port,
    host,
    nodeEnv,
    stellarNetwork,
    sorobanRpcUrl,
    horizonUrl,
    contractId,
    contractIds,
    indexingParallelism,
    websocketUrl,
    eventPollingIntervalMs,
    eventPollingEnabled,
    duePaymentsJobEnabled,
    duePaymentsJobIntervalMs,
    cursorCleanupJobEnabled,
    cursorCleanupJobIntervalMs,
    cursorRetentionDays,
    corsOrigin,
    requestBodyLimit,
    apiKey,
    apiKeyNext,
    cursorStorageType,
    databasePath,
    rateLimitEnabled,
    rateLimitRedisUrl,
    redisTls,
    rateLimitProposalsPerMin,
    rateLimitExecutePerMin,
    rateLimitDefaultPerMin,
  };
}

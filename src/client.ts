// src/client.ts
// Pipedrive API client — supports v1 and v2 endpoints
// Auth: Authorization: Bearer <token> header (secure, not logged in proxies)
// Base URL: https://{COMPANY_DOMAIN}.pipedrive.com

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Max characters per tool response — protects agent context window */
export const CHARACTER_LIMIT = 50_000;

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Valid Pipedrive subdomain: alphanumeric + hyphens only, 1-63 chars.
 * Does NOT allow dots — if you have 'mycompany.pipedrive.com', use only 'mycompany'.
 */
const SAFE_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9\-]{0,62}$/;

// ─── Config & Error Types ─────────────────────────────────────────────────────

export interface PipedriveConfig {
  apiToken: string;
  companyDomain: string;
}

export class PipedriveError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PipedriveError";
  }
}

// ─── Response Envelope Types ───────────────────────────────────────────────────

export interface SingleResponse<T> {
  success: boolean;
  data: T;
}

export interface ListResponseV2<T> {
  success: boolean;
  data: T[];
  additional_data: {
    next_cursor: string | null;
  };
}

export interface ListResponseV1<T> {
  success: boolean;
  data: T[];
  additional_data: {
    pagination: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
}

// ─── API Client ────────────────────────────────────────────────────────────────

export function createClient(config: PipedriveConfig) {
  // C1-A5: Strict domain validation — no dots allowed (prevents passing full URL)
  if (!SAFE_DOMAIN_RE.test(config.companyDomain)) {
    throw new Error(
      `Invalid PIPEDRIVE_DOMAIN: "${config.companyDomain}". ` +
        `Use only the subdomain part (letters, numbers, hyphens). ` +
        `Example: if your URL is mycompany.pipedrive.com, set PIPEDRIVE_DOMAIN=mycompany`,
    );
  }

  const baseUrl = `https://${config.companyDomain}.pipedrive.com`;

  async function request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
    } = {},
  ): Promise<T> {
    const { method = "GET", body, params = {} } = options;

    const url = new URL(`${baseUrl}${path}`);

    // Personal API tokens must be sent via the x-api-token header.
    // Authorization: Bearer is only for OAuth access tokens (v1u:... format).
    // ?api_token= query param works only on v1; v2 ignores it and returns the web app HTML.
    const headers: Record<string, string> = {
      "x-api-token": config.apiToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        throw new PipedriveError(
          408,
          "TIMEOUT",
          `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Try reducing the limit param or adding more filters.`,
        );
      }
      const safeMsg =
        fetchErr instanceof Error ? fetchErr.message : "connection failed";
      throw new PipedriveError(0, "NETWORK_ERROR", `Network error: ${safeMsg}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401) {
      throw new PipedriveError(
        401,
        "UNAUTHORIZED",
        "Invalid API token. Verify PIPEDRIVE_API_TOKEN in your environment.",
      );
    }

    if (response.status === 403) {
      const body403 = await response.text().catch(() => "");
      const isCloudflare =
        body403.includes("Cloudflare") || body403.includes("error 1020");
      if (isCloudflare) {
        throw new PipedriveError(
          403,
          "RATE_LIMIT_BLOCKED",
          "IP blocked by Cloudflare after repeated rate limit violations. " +
            "Wait several minutes and reduce request frequency.",
        );
      }
      throw new PipedriveError(
        403,
        "FORBIDDEN",
        "Access denied. Verify the API token has required permissions for this resource.",
      );
    }

    if (response.status === 404) {
      throw new PipedriveError(
        404,
        "NOT_FOUND",
        `Resource not found at ${path}. Verify the ID is correct and the entity exists.`,
      );
    }

    if (response.status === 422) {
      let detail = "";
      try {
        const b = (await response.json()) as {
          error?: string;
          error_info?: string;
        };
        detail = b.error || b.error_info || "";
      } catch {
        /* ignore */
      }
      throw new PipedriveError(
        422,
        "VALIDATION_ERROR",
        `Validation failed: ${detail || "check required fields and data types"}`,
      );
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After") || "2";
      const remaining = response.headers.get("X-RateLimit-Remaining") ?? "?";
      const resetAt = response.headers.get("X-RateLimit-Reset") ?? "?";
      const dailyLeft =
        response.headers.get("X-Daily-RateLimit-Remaining") ?? "?";
      throw new PipedriveError(
        429,
        "RATE_LIMITED",
        `Rate limit exceeded. Retry after ${retryAfter}s. ` +
          `Burst remaining: ${remaining} (resets: ${resetAt}). ` +
          `Daily tokens remaining: ${dailyLeft}. ` +
          `Repeated 429s trigger a Cloudflare IP block. Slow down requests.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new PipedriveError(
        response.status,
        "PARSE_ERROR",
        `Unexpected non-JSON response from Pipedrive (HTTP ${response.status}).`,
      );
    }

    const envelope = parsed as {
      success: boolean;
      error?: string;
      error_info?: string;
    };

    if (!response.ok || !envelope.success) {
      throw new PipedriveError(
        response.status,
        "API_ERROR",
        envelope.error || envelope.error_info || `HTTP ${response.status}`,
      );
    }

    return parsed as T;
  }

  const get = <T>(path: string, params?: Record<string, unknown>): Promise<T> =>
    request<T>(path, {
      method: "GET",
      params: params as Record<string, string | number | boolean | undefined>,
    });

  const post = <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: "POST", body });

  const patch = <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: "PATCH", body });

  /** v1 Notes API requires HTTP PUT (not PATCH) */
  const put = <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: "PUT", body });

  const del = <T>(path: string, params?: Record<string, unknown>): Promise<T> =>
    request<T>(path, {
      method: "DELETE",
      params: params as Record<string, string | number | boolean | undefined>,
    });

  return { get, post, patch, put, del };
}

export type PipedriveClient = ReturnType<typeof createClient>;

// ─── Tool Result Helpers ───────────────────────────────────────────────────────

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function ok(text: string): ToolResult {
  const truncated =
    text.length > CHARACTER_LIMIT
      ? text.slice(0, CHARACTER_LIMIT) +
        `\n\n[Response truncated at ${CHARACTER_LIMIT} chars. Use pagination or filters to narrow results.]`
      : text;
  return { content: [{ type: "text", text: truncated }] };
}

export function err(error: unknown): ToolResult {
  let message: string;
  if (error instanceof PipedriveError) {
    message = `Error [${error.code}] (HTTP ${error.status}): ${error.message}`;
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = `Unexpected error. Please retry.`;
  }
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Strip undefined/null from params before sending as body or query string */
export function compactBody(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) body[key] = value;
  }
  return body;
}

/**
 * Normalize filter/list params before sending to the Pipedrive API.
 *
 * Convention: `owner_id=0` or `user_id=0` means "all owners / all users"
 * (i.e. do NOT filter by owner). The Pipedrive API does not understand `0`
 * as a user ID — it must be omitted entirely to return results across all owners.
 *
 * This helper strips those keys when their value is `0` so the API receives
 * no owner/user filter and returns data for the entire company.
 *
 * Usage:  `compactBody(normalizeFilters(params))`
 */
export function normalizeFilters(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...params };
  if (out.owner_id === 0) delete out.owner_id;
  if (out.user_id === 0) delete out.user_id;
  return out;
}

/** Serialize response data without pretty-printing to reduce payload size */
export function serialize(data: unknown): string {
  return JSON.stringify(data);
}

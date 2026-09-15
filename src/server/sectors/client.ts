import type { z } from "zod";
import { SectorsApiError } from "./errors.ts";
import { SectorsErrorResponseSchema } from "./schemas.ts";

const DEFAULT_BASE_URL = "https://api.sectors.app/v2";

export type SectorsFetchOptions<T> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Query parameters; `undefined` values are skipped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON request body. */
  body?: unknown;
  signal?: AbortSignal;
  /** Optional runtime validation of the decoded JSON payload. */
  schema?: z.ZodType<T>;
};

/**
 * Server-only base client for the Sectors REST API v2.
 *
 * Requests are always built in code from an explicit path and query object, so
 * the API key never reaches the browser and a model can never invent a URL.
 */
export async function sectorsFetch<T>(
  path: string,
  options: SectorsFetchOptions<T> = {},
): Promise<T> {
  const { method = "GET", query, body: requestBody, signal, schema } = options;
  const apiKey = requireApiKey();
  const url = buildUrl(path, query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
        ...(requestBody === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
      signal,
    });
  } catch (error) {
    throw new SectorsApiError(`Sectors API request failed: ${method} ${url}`, {
      status: 0,
      code: "network_error",
      details: error,
      url,
    });
  }

  const body = await readBody(response);

  if (!response.ok) {
    throw new SectorsApiError(describeHttpError(response, body), {
      status: response.status,
      code: readErrorCode(body.json),
      details: body.json ?? body.text,
      url,
    });
  }

  if (body.json === undefined) {
    throw new SectorsApiError(`Sectors API returned an empty or non-JSON body: ${method} ${url}`, {
      status: response.status,
      code: "invalid_json",
      details: body.text,
      url,
    });
  }

  return schema ? schema.parse(body.json) : (body.json as T);
}

function requireApiKey(): string {
  if ("window" in globalThis) {
    throw new SectorsApiError("sectorsFetch is server-only and must never run in the browser", {
      status: 0,
      code: "server_only",
    });
  }

  const apiKey = process.env.SECTORS_API_KEY;
  if (!apiKey) {
    throw new SectorsApiError(
      "SECTORS_API_KEY is not set. Copy .env.example to .env and configure it.",
      {
        status: 0,
        code: "missing_api_key",
      },
    );
  }

  return apiKey;
}

function buildUrl(path: string, query: SectorsFetchOptions<unknown>["query"]): string {
  const baseUrl = (process.env.SECTORS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return url.toString();
}

type SectorsBody = {
  /** Parsed JSON payload, or `undefined` when the body was empty or not JSON. */
  json: unknown;
  text: string;
};

async function readBody(response: Response): Promise<SectorsBody> {
  const text = await response.text();
  if (text.length === 0) return { json: undefined, text };

  try {
    return { json: JSON.parse(text) as unknown, text };
  } catch {
    return { json: undefined, text };
  }
}

function describeHttpError(response: Response, body: SectorsBody): string {
  const parsed = SectorsErrorResponseSchema.safeParse(body.json);
  if (parsed.success) {
    const message = parsed.data.message ?? parsed.data.error;
    if (message) return `Sectors API error ${response.status}: ${message}`;
  }

  const fallback = response.statusText || body.text.slice(0, 200);
  return `Sectors API error ${response.status}${fallback ? `: ${fallback}` : ""}`;
}

function readErrorCode(json: unknown): string | undefined {
  const parsed = SectorsErrorResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.error : undefined;
}

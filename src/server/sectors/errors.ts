export type SectorsApiErrorOptions = {
  /** HTTP status code, or `0` when the request never reached the API. */
  status: number;
  /** Short machine-readable code, e.g. `network_error`, `invalid_json`. */
  code?: string;
  /** Decoded response body (or the underlying failure) for debugging. */
  details?: unknown;
  /** Fully qualified request URL. Never contains the API key. */
  url?: string;
};

/** Error thrown by every failed Sectors REST API v2 request. */
export class SectorsApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;
  readonly url: string | undefined;

  constructor(message: string, options: SectorsApiErrorOptions) {
    super(message);
    this.name = "SectorsApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.url = options.url;
  }

  /** `true` when the API was unreachable or answered with a 5xx. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}
